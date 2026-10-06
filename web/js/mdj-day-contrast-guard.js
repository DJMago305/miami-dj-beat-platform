/* Guarda de contraste del MODO DÍA para páginas embebidas del portal (hoy: staff-admin.html).
 *
 * Por qué existe: staff-admin.html (y el JS que pinta sus 18 secciones) escribe cientos de colores de TEXTO pensados para fondo negro (azules, verdes y dorados pastel, blanco
 * translúcido…) en línea y en clases sueltas. El tema de día cambia las superficies (variables + reglas en la propia página), pero esos textos claros quedaban casi invisibles sobre blanco.
 * La solución de fondo es pasar esos colores a variables; mientras tanto, esta guarda revisa SOLO el texto visible y, si el contraste contra su fondo real (claro) es < 3:1, lo oscurece conservando el tono (no toca medidas, orden ni estructura). Solo actúa con body[data-mode="light"] (el interruptor del portal); al volver a noche devuelve cada
 * color a como estaba. Compatible con Safari 13 (sin ?. ni ??).
 */
(function () {
    'use strict';
    var ROOT_SEL = 'main, #crm';           /* zona de contenido: el cascarón y el menú no se tocan */
    var ATTR = 'data-mdj-day-fix';
    var timer = null, running = false;

    function parse(c) {
        var m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return null;
        var p = m[1].split(',').map(function (v) { return parseFloat(v); });
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    }
    function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    function lum(c) { return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b); }
    function ratio(a, b) { var l1 = Math.max(a, b) + 0.05, l2 = Math.min(a, b) + 0.05; return l1 / l2; }

    /* Fondo real: se compone, de abajo hacia arriba, cada capa translúcida de los ancestros sobre blanco. Si hay imagen/degradado en el camino, no se opina (null). */
    function effBg(el) {
        var chain = [], e = el, i;
        while (e && e.nodeType === 1) {
            var cs = window.getComputedStyle(e);
            if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
            var c = parse(cs.backgroundColor);
            if (c && c.a > 0) { chain.push(c); if (c.a >= 0.999) break; }
            e = e.parentElement;
        }
        var base = { r: 255, g: 255, b: 255 };
        for (i = chain.length - 1; i >= 0; i--) {
            var l = chain[i];
            base = { r: l.r * l.a + base.r * (1 - l.a), g: l.g * l.a + base.g * (1 - l.a), b: l.b * l.a + base.b * (1 - l.a) };
        }
        return base;
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2, d = max - min;
        if (d) {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
            h /= 6;
        }
        return [h, s, l];
    }
    function hslToRgb(h, s, l) {
        function f(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }
        if (!s) { var v = Math.round(l * 255); return { r: v, g: v, b: v }; }
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        return { r: Math.round(f(p, q, h + 1 / 3) * 255), g: Math.round(f(p, q, h) * 255), b: Math.round(f(p, q, h - 1 / 3) * 255) };
    }
    /* Oscurece conservando el tono hasta 4.5:1 (suelo de luminosidad 0.18). Los casi grises/blancos pasan a la tinta del portal. */
    function darken(c, bgL) {
        var hsl = rgbToHsl(c.r, c.g, c.b);
        if (hsl[1] < 0.12) return 'rgb(27,31,39)';
        var l = Math.min(hsl[2], 0.5), out = c;
        while (l > 0.18) {
            out = hslToRgb(hsl[0], Math.min(1, hsl[1] * 1.05), l);
            if (ratio(lum(out), bgL) >= 4.5) break;
            l -= 0.04;
        }
        return 'rgb(' + out.r + ',' + out.g + ',' + out.b + ')';
    }

    function isLight() { return document.body && document.body.getAttribute('data-mode') === 'light'; }

    function restore() {
        var nodes = document.querySelectorAll('[' + ATTR + ']'), i, n, orig;
        for (i = 0; i < nodes.length; i++) {
            n = nodes[i]; orig = n.getAttribute(ATTR);
            if (orig === '\u0000') n.style.removeProperty('color'); else n.style.setProperty('color', orig);
            n.removeAttribute(ATTR);
        }
    }

    /* Dos pasadas: primero se LEE todo (calcular colores no toca el DOM) y luego se ESCRIBE. Mezclarlas forzaba un recálculo de diseño por elemento y el barrido tardaba segundos. */
    function scan() {
        if (running) return; running = true;
        try {
            if (!isLight()) { restore(); return; }
            var roots = document.querySelectorAll(ROOT_SEL), r, all, i, el, cs, c, bg, hasText, k, nd, tl, bl, todo = [];
            if (!roots.length) roots = [document.body];      /* páginas sin <main> (p. ej. embebidas): se revisa todo el cuerpo */
            for (r = 0; r < roots.length; r++) {
                all = roots[r].querySelectorAll('*');
                for (i = 0; i < all.length; i++) {
                    el = all[i];
                    try {
                        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.hasAttribute(ATTR)) continue;
                        hasText = false;
                        for (k = 0; k < el.childNodes.length; k++) { nd = el.childNodes[k]; if (nd.nodeType === 3 && nd.nodeValue.replace(/\s+/g, '').length > 1) { hasText = true; break; } }
                        if (!hasText || !el.offsetParent) continue;
                        cs = window.getComputedStyle(el); c = parse(cs.color); if (!c) continue;
                        bg = effBg(el); if (!bg) continue;
                        tl = lum(c); bl = lum(bg);
                        if (bl > 0.45 && ratio(tl, bl) < 3) todo.push([el, darken(c, bl)]);   /* fondo claro y texto de poco contraste (típico: pasteles pensados para fondo negro) */
                    } catch (eEl) { /* un elemento raro no debe cortar el barrido del resto */ }
                }
            }
            for (i = 0; i < todo.length; i++) {
                el = todo[i][0];
                el.setAttribute(ATTR, el.style.getPropertyValue('color') || '\u0000');
                el.style.setProperty('color', todo[i][1], 'important');
            }
        } catch (e) { /* sin consola: nunca debe romper la página */ } finally { running = false; }
    }

    function later() { clearTimeout(timer); timer = setTimeout(scan, 350); }

    function start() {
        scan();
        if (window.MutationObserver) {
            new MutationObserver(function (muts) {
                var i; for (i = 0; i < muts.length; i++) { if (muts[i].attributeName === ATTR) continue; later(); return; }
            }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'data-mode'] });
        }
        window.addEventListener('hashchange', later);
        window.addEventListener('message', function (e) { if (e && e.data && e.data.mdjTheme) later(); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
