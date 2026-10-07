/* Código QR de un ticket o mesa (https://www.miamidjbeat.com/t/<uuid>) con descarga y enlace para acompañantes.
   Lo usan la pantalla de «gracias» tras el pago (venue-room.html) y la página del ticket (t.html): UN solo patrón.
   Requiere qrcodejs (cdnjs, con SRI) cargado antes. Sin ?. ni ?? (Safari 13). Nunca pide sesión: todo es público. */
(function (g) {
    'use strict';
    var SITE = 'https://www.miamidjbeat.com';
    var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    function ticketUrl(id) { return SITE + '/t/' + String(id).toLowerCase(); }
    function refOf(id) { return String(id).slice(0, 8).toUpperCase(); }
    function validId(id) { return UUID_RE.test(String(id || '')); }

    /* Dibuja el QR dentro de host (espera hasta 5 s a que cargue la librería). cb(ok). */
    function render(host, id, size, cb) {
        if (!host || !validId(id)) { if (cb) cb(false); return; }
        var tries = 0;
        (function go() {
            if (typeof g.QRCode === 'function') {
                try {
                    host.innerHTML = '';
                    new g.QRCode(host, { text: ticketUrl(id), width: size || 220, height: size || 220, colorDark: '#000000', colorLight: '#ffffff', correctLevel: g.QRCode.CorrectLevel.M });
                    if (cb) cb(true);
                } catch (e) { if (cb) cb(false); }
                return;
            }
            if (++tries > 20) { if (cb) cb(false); return; }
            setTimeout(go, 250);
        })();
    }

    /* PNG listo para guardar o capturar: QR grande sobre fondo blanco con margen y la referencia debajo. */
    function pngDataUrl(host, id) {
        var src = host && host.querySelector('canvas');
        if (!src) return '';
        var pad = 48, qr = 640, w = qr + pad * 2, h = qr + pad * 2 + 70;
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(src, pad, pad, qr, qr);
        ctx.fillStyle = '#111111'; ctx.textAlign = 'center';
        ctx.font = '700 30px -apple-system, Helvetica, Arial, sans-serif';
        ctx.fillText('Miami DJ Beat  ·  ' + refOf(id), w / 2, qr + pad + 52);
        try { return c.toDataURL('image/png'); } catch (e) { return ''; }
    }

    /* Descarga el PNG (en el teléfono queda en descargas / se puede guardar en la galería). Devuelve true si pudo. */
    function download(host, id) {
        var url = pngDataUrl(host, id);
        if (!url) return false;
        var a = document.createElement('a');
        a.href = url; a.download = 'ticket-' + refOf(id) + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        return true;
    }

    /* Copia el enlace /t/<id> (para mandarlo por WhatsApp a los acompañantes). Promesa → true/false. */
    function copyLink(id) {
        var url = ticketUrl(id);
        function fallback() {
            try {
                var t = document.createElement('textarea');
                t.value = url; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
                document.body.appendChild(t); t.select(); t.setSelectionRange(0, url.length);
                var ok = document.execCommand('copy'); document.body.removeChild(t); return ok;
            } catch (e) { return false; }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(url).then(function () { return true; }, function () { return fallback(); });
        }
        return Promise.resolve(fallback());
    }

    g.mdjTicketQr = { url: ticketUrl, ref: refOf, valid: validId, render: render, download: download, copyLink: copyLink };
})(typeof window !== 'undefined' ? window : this);
