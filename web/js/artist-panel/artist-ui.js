/* Panel del artista · PIEZAS DE VISTA COMPARTIDAS.
 * Un solo encabezado de acordeón para todas las secciones plegables del Cash Flow (hoy: «Movimientos» y «Opiniones de clientes»), para que no haya dos versiones del mismo control:
 * el título a la izquierda y, SIEMPRE a su derecha, el botón «+» / «−» dentro de un círculo de cristal; cerrado, deja a la vista un resumen corto.
 * El aspecto vive en css/mdj-cashflow-panel.css (clases .ap-acc-*), que copia componentes que ya existían (orbe de cristal de staff.html y «+» dorado de los acordeones de dj-profile).
 * Cada módulo gestiona su propio clic con data-act="toggle" (delegado en su contenedor). El estado abierto/cerrado se recuerda en este navegador por sección; por defecto CERRADO
 * (son de consulta). Compatible con Safari 13 (sin ??, sin ?.). */
(function () {
    'use strict';
    var AP = window.ArtistPanel = window.ArtistPanel || {};

    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

    var PREFIX = 'mdj-acc-';
    function getOpen(key) { try { return localStorage.getItem(PREFIX + key) === '1'; } catch (e) { return false; } }
    function setOpen(key, v) { try { localStorage.setItem(PREFIX + key, v ? '1' : '0'); } catch (e) { /* sin almacenamiento: queda cerrado */ } }

    /* Resumen corto del encabezado cerrado. pairs = [[etiqueta, valor, tono]], tono = 'avail' | 'pend' | ''. */
    function mini(pairs) {
        var box = el('div', 'ap-acc-mini');
        pairs.forEach(function (p, i) {
            if (i) box.appendChild(el('span', 'ap-acc-mini-sep', '·'));
            if (p[0]) box.appendChild(el('span', null, p[0] + ' '));
            box.appendChild(el('b', 'ap-acc-mini-v' + (p[2] ? ' ap-acc-mini-v--' + p[2] : ''), p[1]));
        });
        return box;
    }

    /* opts: { title, open, mini (nodo o null), tools (nodo o null), openLabel, closeLabel } → <div class="ap-acc-head"> con el título (también abre/cierra) y el botón circular a su derecha. */
    function accHead(o) {
        var head = el('div', 'ap-acc-head'), h3 = el('h3', 'chart-title ap-acc-title', o.title), right = el('div', 'ap-acc-right');
        h3.setAttribute('data-act', 'toggle');
        if (o.mini) right.appendChild(o.mini);
        if (o.tools) right.appendChild(o.tools);                 /* p. ej. el orden de las opiniones: en la MISMA línea, a la izquierda del botón */
        var label = o.open ? o.closeLabel : o.openLabel, b = el('button', 'ap-acc-toggle');
        b.type = 'button'; b.setAttribute('data-act', 'toggle'); b.setAttribute('aria-expanded', o.open ? 'true' : 'false'); b.setAttribute('aria-label', label); b.setAttribute('title', label);
        b.appendChild(el('span', 'ap-acc-icon', o.open ? '−' : '+'));
        right.appendChild(b); head.appendChild(h3); head.appendChild(right);
        return head;
    }

    AP.ui = { el: el, getOpen: getOpen, setOpen: setOpen, mini: mini, accHead: accHead };
})();
