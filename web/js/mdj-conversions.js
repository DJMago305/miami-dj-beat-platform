/* Eventos de conversión para Google Analytics 4 (GEO·SEO·IA, PO 2026-10-08: "medir conversiones").
 * Hasta hoy el sitio solo cargaba GA4 y no enviaba ningún evento, por eso las conversiones salían en 0.
 * Aquí se escuchan, a nivel de documento, los contactos reales del cliente y se mandan a GA4 con gtag:
 *   click_to_call   → clic en un enlace tel:
 *   click_whatsapp  → clic en un enlace de WhatsApp (wa.me / whatsapp.com)
 *   click_email     → clic en un enlace mailto:
 *   generate_lead   → envío de un formulario de contacto o cotización (lista cerrada de ids, abajo)
 *   sign_up         → envío del formulario de registro del Home
 * No envía números de teléfono, correos ni datos escritos en formularios: solo el nombre del evento, la ruta de la
 * página y el texto visible del botón. Si gtag no existe (bloqueador, sin GA4) no hace nada y nunca rompe la página. */
(function () {
  'use strict';
  try {
    if (window.__mdjConversionsOn) return;
    window.__mdjConversionsOn = true;

    var LEAD_FORMS = {
      'bottom-contact-form': 1,
      'footer-contact-form': 1,
      'lead-form': 1,
      'checkout-discovery-form': 1
    };
    var SIGNUP_FORMS = { 'hero-registration-form': 1 };

    function send(name, params) {
      try {
        if (typeof window.gtag === 'function') window.gtag('event', name, params);
      } catch (e) { /* sin analítica no pasa nada */ }
    }

    function base(extra) {
      var p = { page_path: location.pathname };
      for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) p[k] = extra[k]; }
      return p;
    }

    document.addEventListener('click', function (e) {
      var t = e.target;
      var a = t && t.closest ? t.closest('a[href]') : null;
      if (!a) return;
      var href = String(a.getAttribute('href') || '').toLowerCase();
      var label = String(a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (href.indexOf('tel:') === 0) {
        send('click_to_call', base({ link_text: label }));
      } else if (href.indexOf('wa.me') !== -1 || href.indexOf('whatsapp.com') !== -1) {
        send('click_whatsapp', base({ link_text: label }));
      } else if (href.indexOf('mailto:') === 0) {
        send('click_email', base({ link_text: label }));
      }
    }, true);

    document.addEventListener('submit', function (e) {
      var f = e.target;
      if (!f || String(f.tagName).toUpperCase() !== 'FORM') return;
      var id = f.id || '';
      if (LEAD_FORMS[id]) send('generate_lead', base({ form_id: id }));
      else if (SIGNUP_FORMS[id]) send('sign_up', base({ form_id: id, method: 'site_form' }));
    }, true);
  } catch (e) { /* nunca romper la página */ }
})();
