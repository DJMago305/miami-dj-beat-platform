// web/js/mdj-catalog-live-price.js
// Precios en vivo del catálogo real (service_catalog_public, vía
// mdj_catalog_precios_vigentes) para las páginas de categoría de renta de
// equipo (pro-audio-dj.html, lighting-dj.html, special-effects-dj.html,
// tents-dj.html, stages-dj.html, inflatables-dj.html, furniture-dj.html).
//
// Puramente aditivo: actualiza data-price/data-furn-price (que el carrito y
// el calculador de furniture YA leen en vivo al usarse -- addPackageToCart()
// lee getAttribute('data-price') en el momento del clic, el calculador de
// furniture lee getAttribute('data-furn-price') en cada tick) y el texto
// visible, una sola vez al cargar. Antes de esto los precios de estas
// páginas eran 100% estáticos en el HTML.
//
// El data-i18n se QUITA del elemento de precio una vez actualizado -- un
// precio en dólares no se traduce, y translations.js tenía el número
// hardcodeado en su diccionario (ES y EN por separado); dejarlo habría hecho
// que un cambio de idioma reescribiera el precio en vivo de vuelta al
// número viejo. El nombre del producto (span aparte) sigue traducido normal.
(function () {
    'use strict';

    function applyLivePrices() {
        var db = (typeof window.getSupabaseClient === 'function') ? window.getSupabaseClient() : null;
        if (!db) { setTimeout(applyLivePrices, 300); return; }

        var skuEls = Array.prototype.slice.call(document.querySelectorAll('[data-sku]'));
        var furnEls = Array.prototype.slice.call(document.querySelectorAll('[data-furn-id]'));
        if (!skuEls.length && !furnEls.length) return;

        var skus = [];
        skuEls.forEach(function (el) {
            var s = el.getAttribute('data-sku');
            if (s && skus.indexOf(s) === -1) skus.push(s);
        });
        furnEls.forEach(function (el) {
            var s = el.getAttribute('data-furn-id');
            if (s && skus.indexOf(s) === -1) skus.push(s);
        });
        if (!skus.length) return;

        db.rpc('mdj_catalog_precios_vigentes', { p_skus: skus }).then(function (res) {
            if (res.error || !Array.isArray(res.data)) return;
            var live = {};
            res.data.forEach(function (row) {
                if (row.activo && row.precio_efectivo_usd != null) {
                    live[row.sku] = parseFloat(row.precio_efectivo_usd);
                }
            });

            // Patrón A: <span data-sku="..." data-price="...">$400</span> -- el
            // precio es TODO el texto visible del elemento, se reemplaza entero.
            skuEls.forEach(function (el) {
                var sku = el.getAttribute('data-sku');
                if (sku == null || live[sku] == null) return;
                var price = live[sku];
                el.setAttribute('data-price', String(price));
                el.removeAttribute('data-i18n');
                el.textContent = '$' + Math.round(price).toLocaleString('en-US');
            });

            // Patrón B (furniture-dj.html, y lighting-dj.html para items que se
            // rentan por unidad como Moving Heads): <div data-furn-id="..."
            // data-furn-price="..."> contiene un span con el sufijo ("$6 / chair",
            // "$150 / unidad") -- solo se reemplaza el número inicial, se
            // conserva el sufijo. furndj-item-unit-price y mdj-unit-price-suffix
            // son el mismo patrón con dos nombres de clase (una por página).
            furnEls.forEach(function (el) {
                var sku = el.getAttribute('data-furn-id');
                if (sku == null || live[sku] == null) return;
                var price = live[sku];
                el.setAttribute('data-furn-price', String(price));
                var unitEl = el.querySelector('.furndj-item-unit-price, .mdj-unit-price-suffix');
                if (unitEl) {
                    unitEl.removeAttribute('data-i18n');
                    var newPriceStr = '$' + Math.round(price).toLocaleString('en-US');
                    unitEl.textContent = unitEl.textContent.replace(/^\$[\d,]+/, newPriceStr);
                }
            });
        }).catch(function () { /* silencioso -- la página sigue con el precio estático si falla */ });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyLivePrices);
    } else {
        applyLivePrices();
    }
})();
