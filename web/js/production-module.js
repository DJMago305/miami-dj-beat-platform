/**
 * Admin Dashboard — Producción: Event Flow + factura/cotización manual (Supabase).
 * Requiere: supabase client, production-templates.js, tablas mdj_event_flows + mdj_staff_manual_invoices.
 */
(function (global) {
  'use strict';

  var FLOW_PRINT_KEY = 'mdj_event_flow_print_v1';

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  }

  function money(n) {
    var x = Number(n);
    if (!isFinite(x)) x = 0;
    return x.toFixed(2);
  }

  /** Misma regla que client-portal.js payDepositStripe */
  function calcEventDepositUsd(totalUsd) {
    var bal = Number(totalUsd);
    if (!isFinite(bal) || bal < 0) bal = 0;
    return Math.max(bal * 0.3, 150);
  }

  function mdjCorpZelleEmail() {
    return (typeof global.MDB_OFFICIAL_CONTACT_EMAIL === 'string' && global.MDB_OFFICIAL_CONTACT_EMAIL) || 'miamidjbeat@gmail.com';
  }

  function zelleMemoForLead(leadId) {
    return 'MDJB-' + String(leadId).slice(0, 8).toUpperCase();
  }

  function buildZelleDepositInstructions(email, amountUsd, memo, portalUrl) {
    return (
      'Miami DJ Beat — Depósito por Zelle\n' +
      'Recipient / Destinatario: ' + email + '\n' +
      'Amount / Monto: $' + money(amountUsd) + ' USD\n' +
      'Memo / Nota (required): ' + memo + '\n' +
      (portalUrl ? 'Portal: ' + portalUrl + '\n' : '') +
      'After sending, confirm in your client portal or send screenshot to your event manager.'
    );
  }

  function prodT(key) {
    if (global.i18n && typeof global.i18n.t === 'function') {
      return global.i18n.t(key);
    }
    return '';
  }

  function prodTVar(key, vars) {
    var s = prodT(key);
    if (!vars || !s) return s;
    return String(s).replace(/\{(\w+)\}/g, function (_, k) {
      return Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : '';
    });
  }

  function invAddrFieldVal(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  /** Compone texto multilínea para DB / impresión (misma lógica que perfil / cuenta). */
  function formatInvAddrLines(prefix) {
    var base = prefix === 'ev' ? 'prod-inv-ev' : 'prod-inv-bill';
    var street = invAddrFieldVal(base + '-street');
    var apt = invAddrFieldVal(base + '-apt');
    var city = invAddrFieldVal(base + '-city');
    var zip = invAddrFieldVal(base + '-zip');
    var countryEl = document.getElementById(base + '-select-country');
    var country = countryEl ? String(countryEl.value || '').trim() : '';
    var st = '';
    if (country === 'United States') {
      var sel = document.getElementById(base + '-select-state-us');
      st = sel ? String(sel.value || '').trim() : '';
    } else {
      var intl = document.getElementById(base + '-input-state-intl');
      st = intl ? String(intl.value || '').trim() : '';
    }
    var lines = [];
    if (street) lines.push(street);
    if (apt) lines.push(apt);
    var mid = [city, st].filter(Boolean).join(', ');
    if (mid) lines.push(mid);
    var last = [zip, country].filter(Boolean).join(' ');
    if (last) lines.push(last);
    return lines.join('\n');
  }

  /** UUID vacío = cliente manual; UUID válido = registrado; otro = inválido. */
  function resolveProdInvClientUserId() {
    var el = document.getElementById('prod-inv-client');
    var raw = el ? String(el.value || '').trim() : '';
    if (!raw) {
      return { ok: true, uuid: null, manual: true };
    }
    if (/^[0-9a-f-]{36}$/i.test(raw)) {
      return { ok: true, uuid: raw.toLowerCase(), manual: false };
    }
    return { ok: false, uuid: null, manual: false };
  }

  /** Mail del Panel 1 (trim + lowercase). Vacío si no hay valor. */
  function readProdInvClientEmail() {
    var emailEl = document.getElementById('prod-inv-client-email');
    return emailEl ? emailEl.value.trim().toLowerCase() : '';
  }

  /** Panel 5 — modo de cobro Stripe: deposit (default) | full */
  function readProdCobroChargeMode() {
    var fullEl = document.getElementById('prod-cobro-charge-mode-full');
    if (fullEl && fullEl.checked) return 'full';
    return 'deposit';
  }

  global.MDJProduction = {
    _inited: false,
    _i18nListenerBound: false,

    _panelHeadHtml: function (num, titleKey, helpKey) {
      return (
        '<div class="mdj-prod-inv-panel-head">' +
        '<div class="mdj-prod-inv-panel-head-main">' +
        '<span class="mdj-prod-inv-panel-num" aria-hidden="true">' +
        num +
        '</span>' +
        '<p class="fineprint mdj-prod-inv-panel-title" data-i18n="' +
        titleKey +
        '"></p>' +
        '</div>' +
        '<span class="mdj-prod-inv-help" tabindex="0">' +
        '<span class="mdj-prod-inv-help-icon" aria-hidden="true">?</span>' +
        '<span class="mdj-prod-inv-help-tip" role="tooltip" data-i18n="' +
        helpKey +
        '"></span>' +
        '</span></div>'
      );
    },

    _sectionHeadHtml: function (titleKey, helpKey) {
      return (
        '<div class="mdj-prod-inv-panel-head mdj-prod-cobro-head">' +
        '<div class="mdj-prod-inv-panel-head-main">' +
        '<p class="fineprint mdj-prod-inv-box-title" style="margin:0;" data-i18n="' +
        titleKey +
        '"></p>' +
        '</div>' +
        '<span class="mdj-prod-inv-help" tabindex="0">' +
        '<span class="mdj-prod-inv-help-icon" aria-hidden="true">?</span>' +
        '<span class="mdj-prod-inv-help-tip" role="tooltip" data-i18n="' +
        helpKey +
        '"></span>' +
        '</span></div>'
      );
    },

    _numberedTitleHeadHtml: function (num, titleKey) {
      return (
        '<div class="mdj-prod-inv-panel-head">' +
        '<div class="mdj-prod-inv-panel-head-main">' +
        '<span class="mdj-prod-inv-panel-num" aria-hidden="true">' +
        num +
        '</span>' +
        '<p class="fineprint mdj-prod-inv-panel-title" data-i18n="' +
        titleKey +
        '"></p>' +
        '</div></div>'
      );
    },

    init: function () {
      if (this._inited) return;
      this._inited = true;
      var host = document.getElementById('production-module-host');
      if (!host) return;
      host.innerHTML = this._shellHtml();
      if (global.i18n && typeof global.i18n.updateUI === 'function') {
        global.i18n.updateUI();
      }
      this._bind();
      if (!this._i18nListenerBound) {
        this._i18nListenerBound = true;
        document.addEventListener('languageChanged', function () {
          if (!global.MDJProduction._inited) return;
          if (global.i18n && typeof global.i18n.updateUI === 'function') {
            global.i18n.updateUI();
          }
          global.MDJProduction._renderInvLines();
          global.MDJProduction._updateInvTotal();
          void global.MDJProduction._refreshLists();
        });
      }
      void this._refreshLists();
    },

    _shellHtml: function () {
      return (
        '<div class="admin-card mdj-prod-inner-card" style="margin-top:0;border:1px solid var(--line);">' +
        '<div id="prod-panel-inv" style="display:block;">' +
        '<div class="mdj-prod-inv-panel mdj-prod-inv-panel--client mdj-prod-inv-box mdj-prod-inv-box--info">' +
        this._panelHeadHtml('1', 'prod-inv-panel-1-title', 'prod-inv-panel-1-help') +
        '<div class="mdj-prod-inv-panel-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<div style="grid-column:1/-1;" class="mdj-prod-inv-client-lookup-row">' +
        '<label class="fineprint" data-i18n="prod-inv-client-lookup-lbl"></label>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:4px;">' +
        '<input type="text" id="prod-inv-client-lookup" class="price-input" style="flex:1 1 220px;min-width:0;" autocomplete="off" spellcheck="false" data-i18n-hold="prod-inv-client-lookup-ph" />' +
        '<button type="button" class="btn secondary small" id="prod-inv-client-lookup-btn" data-i18n="prod-inv-client-lookup-btn"></button>' +
        '</div>' +
        '<div id="prod-inv-client-lookup-msg" class="fineprint" style="margin-top:8px;min-height:1.2em;opacity:0.88;"></div>' +
        '</div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-inv-buyer-name-lbl"></label>' +
        '<input type="text" id="prod-inv-buyer-name" class="price-input" style="width:100%;margin-top:4px;" autocomplete="name" /></div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-inv-company-name-lbl"></label>' +
        '<input type="text" id="prod-inv-company-name" class="price-input" style="width:100%;margin-top:4px;" data-i18n-hold="prod-inv-company-ph" autocomplete="organization" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-client-phone-lbl"></label>' +
        '<input type="tel" id="prod-inv-client-phone" class="price-input" style="width:100%;margin-top:4px;" maxlength="40" autocomplete="tel" data-i18n-hold="prod-inv-client-phone-ph" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-client-email-lbl"></label>' +
        '<input type="email" id="prod-inv-client-email" class="price-input" style="width:100%;margin-top:4px;" maxlength="120" autocomplete="email" data-i18n-hold="prod-inv-client-email-ph" /></div>' +
        '<div style="grid-column:1/-1;" class="mdj-prod-addr-section">' +
        '<p class="fineprint mdj-prod-addr-section-title" data-i18n="prod-inv-billing-section"></p>' +
        '<div class="mdj-prod-addr-grid">' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-inv-addr-street-lbl"></label>' +
        '<input type="text" id="prod-inv-bill-street" class="price-input" style="width:100%;margin-top:4px;" data-i18n-hold="prod-inv-addr-street-ph" autocomplete="street-address" /></div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-inv-addr-apt-lbl"></label>' +
        '<input type="text" id="prod-inv-bill-apt" class="price-input" style="width:100%;margin-top:4px;" data-i18n-hold="prod-inv-addr-apt-ph" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-city-lbl"></label>' +
        '<input type="text" id="prod-inv-bill-city" class="price-input" style="width:100%;margin-top:4px;" autocomplete="address-level2" /></div>' +
        '<div>' +
        '<div id="prod-inv-bill-wrap-state-us">' +
        '<label class="fineprint" data-i18n="prod-inv-addr-state-lbl"></label>' +
        '<select id="prod-inv-bill-select-state-us" class="price-input" style="width:100%;margin-top:4px;" aria-label="State"></select>' +
        '</div>' +
        '<div id="prod-inv-bill-wrap-state-intl" style="display:none;">' +
        '<label class="fineprint" data-i18n="prod-inv-addr-state-intl-lbl"></label>' +
        '<input type="text" id="prod-inv-bill-input-state-intl" class="price-input" style="width:100%;margin-top:4px;" />' +
        '</div></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-zip-lbl"></label>' +
        '<input type="text" id="prod-inv-bill-zip" class="price-input" style="width:100%;margin-top:4px;" maxlength="12" autocomplete="postal-code" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-country-lbl"></label>' +
        '<select id="prod-inv-bill-select-country" class="price-input" style="width:100%;margin-top:4px;" aria-label="Country"></select></div>' +
        '</div></div>' +
        '<input type="hidden" id="prod-inv-client" value="" />' +
        '</div></div></div>' +
        '<div class="mdj-prod-inv-panel mdj-prod-inv-panel--event mdj-prod-inv-box">' +
        this._panelHeadHtml('2', 'prod-inv-panel-2-title', 'prod-inv-panel-2-help') +
        '<div class="mdj-prod-inv-panel-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<div style="grid-column:1/-1;" class="mdj-prod-addr-section">' +
        '<div class="mdj-prod-addr-grid">' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-inv-addr-street-lbl"></label>' +
        '<input type="text" id="prod-inv-ev-street" class="price-input" style="width:100%;margin-top:4px;" data-i18n-hold="prod-inv-addr-street-ph" /></div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-inv-addr-apt-lbl"></label>' +
        '<input type="text" id="prod-inv-ev-apt" class="price-input" style="width:100%;margin-top:4px;" data-i18n-hold="prod-inv-addr-apt-ph" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-city-lbl"></label>' +
        '<input type="text" id="prod-inv-ev-city" class="price-input" style="width:100%;margin-top:4px;" autocomplete="address-level2" /></div>' +
        '<div>' +
        '<div id="prod-inv-ev-wrap-state-us">' +
        '<label class="fineprint" data-i18n="prod-inv-addr-state-lbl"></label>' +
        '<select id="prod-inv-ev-select-state-us" class="price-input" style="width:100%;margin-top:4px;" aria-label="State"></select>' +
        '</div>' +
        '<div id="prod-inv-ev-wrap-state-intl" style="display:none;">' +
        '<label class="fineprint" data-i18n="prod-inv-addr-state-intl-lbl"></label>' +
        '<input type="text" id="prod-inv-ev-input-state-intl" class="price-input" style="width:100%;margin-top:4px;" />' +
        '</div></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-zip-lbl"></label>' +
        '<input type="text" id="prod-inv-ev-zip" class="price-input" style="width:100%;margin-top:4px;" maxlength="12" autocomplete="postal-code" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-country-lbl"></label>' +
        '<select id="prod-inv-ev-select-country" class="price-input" style="width:100%;margin-top:4px;" aria-label="Country"></select></div>' +
        '</div></div>' +
        '</div></div></div>' +
        '<div class="mdj-prod-inv-box mdj-prod-inv-box--quote">' +
        this._numberedTitleHeadHtml('3', 'prod-inv-box-quote-title') +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
        '<div><label class="fineprint" data-i18n="prod-inv-type-lbl"></label><select id="prod-inv-kind" class="price-input" style="width:100%;margin-top:4px;">' +
        '<option value="quote" data-i18n="prod-doc-quote"></option>' +
        '<option value="invoice" data-i18n="prod-doc-invoice"></option></select></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-tax-lbl"></label><input type="number" id="prod-inv-tax" class="price-input" style="width:100%;margin-top:4px;" value="7" step="0.01" min="0" max="100" /></div>' +
        '</div>' +
        '<div style="margin:0 0 8px;display:flex;justify-content:flex-end;">' +
        '<button type="button" class="mdj-prod-inv-add-line-btn" id="prod-inv-add-line" data-i18n="prod-inv-add-line"></button>' +
        '</div>' +
        '<div id="prod-inv-lines"></div>' +
        '<button type="button" id="prod-inv-save" data-i18n="prod-inv-save" hidden style="display:none;" aria-hidden="true" tabindex="-1"></button>' +
        '<div class="mdj-prod-inv-box mdj-prod-inv-box--quote" style="margin-top:14px;">' +
        this._sectionHeadHtml('prod-cobro-title', 'prod-cobro-section-help') +
        '<input type="hidden" id="prod-cobro-lead-id" value="" />' +
        '<input type="hidden" id="prod-cobro-event-date" value="" />' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
        '<div><label class="fineprint" data-i18n="prod-cobro-event-type-lbl"></label>' +
        '<select id="prod-cobro-event-type" class="price-input" style="width:100%;margin-top:4px;">' +
        '<option value="Wedding" data-i18n="prod-opt-wedding"></option>' +
        '<option value="Quinceañera" data-i18n="prod-opt-quinceanera"></option>' +
        '<option value="Corporate" data-i18n="prod-cobro-opt-corporate"></option>' +
        '<option value="Private Party" data-i18n="prod-cobro-opt-private"></option>' +
        '<option value="Event Services" data-i18n="prod-cobro-opt-services"></option>' +
        '</select></div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint mdj-prod-inv-field-lbl-row">' +
        '<span data-i18n="prod-cobro-dj-lbl"></span>' +
        '<span class="mdj-prod-inv-help mdj-prod-inv-help--inline" tabindex="0">' +
        '<span class="mdj-prod-inv-help-icon" aria-hidden="true">?</span>' +
        '<span class="mdj-prod-inv-help-tip" role="tooltip" data-i18n="prod-cobro-dj-help"></span>' +
        '</span></label>' +
        '<select id="prod-cobro-dj" class="price-input" style="width:100%;margin-top:4px;"><option value="">—</option></select></div>' +
        '<div><label class="fineprint" data-i18n="prod-cobro-dj-payout-lbl"></label>' +
        '<input type="number" id="prod-cobro-dj-payout" class="price-input" style="width:100%;margin-top:4px;" min="0" step="0.01" placeholder="0.00" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-cobro-deposit-lbl"></label>' +
        '<input type="text" id="prod-cobro-deposit-display" class="price-input" style="width:100%;margin-top:4px;" readonly tabindex="-1" aria-readonly="true" /></div>' +
        '</div></div>' +
        '<div class="mdj-prod-inv-panel mdj-prod-inv-panel--totals mdj-prod-inv-box">' +
        this._panelHeadHtml('4', 'prod-inv-panel-3-title', 'prod-inv-panel-3-help') +
        '<div class="mdj-prod-inv-panel-body">' +
        '<div id="prod-inv-summary-card" class="mdj-prod-inv-summary-card" aria-live="polite"></div>' +
        '</div></div>' +
        '<div class="mdj-prod-inv-panel mdj-prod-inv-panel--actions mdj-prod-inv-box">' +
        this._panelHeadHtml('5', 'prod-inv-panel-5-title', 'prod-inv-panel-5-help') +
        '<div class="mdj-prod-inv-panel-body">' +
        '<div id="prod-cobro-status" class="fineprint" style="margin:0 0 10px;min-height:1.2em;opacity:0.88;"></div>' +
        '<div class="mdj-prod-fin-discount-tab" aria-label="Manager discount">' +
        '<p class="mdj-prod-fin-discount-tab-title" data-i18n="prod-fin-manager-discount"></p>' +
        '<p class="mdj-prod-fin-discount-tab-note fineprint" data-i18n="prod-fin-manager-discount-pending"></p>' +
        '</div>' +
        '<div class="mdj-prod-cobro-charge-mode" style="margin:0 0 12px;">' +
        '<label class="fineprint" data-i18n="prod-cobro-charge-mode-lbl"></label>' +
        '<div style="display:flex;flex-wrap:wrap;gap:12px 18px;margin-top:6px;">' +
        '<label class="fineprint" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">' +
        '<input type="radio" name="prod-cobro-charge-mode" id="prod-cobro-charge-mode-deposit" value="deposit" checked />' +
        '<span data-i18n="prod-cobro-charge-mode-deposit"></span></label>' +
        '<label class="fineprint" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;">' +
        '<input type="radio" name="prod-cobro-charge-mode" id="prod-cobro-charge-mode-full" value="full" />' +
        '<span data-i18n="prod-cobro-charge-mode-full"></span></label>' +
        '</div></div>' +
        '<div class="mdj-prod-inv-action-bar" role="toolbar" aria-label="Invoice actions">' +
        '<button type="button" class="mdj-prod-inv-action-btn" id="prod-inv-open-print" data-i18n-aria="prod-inv-action-print" data-i18n-title="prod-inv-action-print-tip">' +
        '<span class="mdj-prod-inv-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg></span>' +
        '<span class="mdj-prod-inv-action-lbl" data-i18n="prod-inv-action-print"></span></button>' +
        '<button type="button" class="mdj-prod-inv-action-btn" id="prod-inv-action-copy-link" data-i18n-aria="prod-inv-action-copy-link" data-i18n-title="prod-inv-action-copy-link-tip">' +
        '<span class="mdj-prod-inv-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>' +
        '<span class="mdj-prod-inv-action-lbl" data-i18n="prod-inv-action-copy-link"></span></button>' +
        '<button type="button" class="mdj-prod-inv-action-btn" id="prod-inv-create-account" data-i18n-aria="prod-inv-action-create-account" data-i18n-title="prod-inv-action-create-account-tip">' +
        '<span class="mdj-prod-inv-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></span>' +
        '<span class="mdj-prod-inv-action-lbl" data-i18n="prod-inv-action-create-account"></span></button>' +
        '<button type="button" class="mdj-prod-inv-action-btn" id="prod-inv-action-save" data-i18n-aria="prod-inv-action-save" data-i18n-title="prod-inv-action-save-tip">' +
        '<span class="mdj-prod-inv-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></span>' +
        '<span class="mdj-prod-inv-action-lbl" data-i18n="prod-inv-action-save"></span></button>' +
        '<button type="button" class="mdj-prod-inv-action-btn" id="prod-cobro-stripe-deposit" data-i18n-aria="prod-inv-action-stripe" data-i18n-title="prod-inv-action-stripe-tip">' +
        '<span class="mdj-prod-inv-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></span>' +
        '<span class="mdj-prod-inv-action-lbl" data-i18n="prod-inv-action-stripe"></span></button>' +
        '</div>' +
        '<div id="prod-inv-create-account-msg" class="fineprint" style="margin-top:8px;min-height:1.2em;opacity:0.88;white-space:pre-wrap;"></div>' +
        '<button type="button" id="prod-cobro-zelle-deposit" data-i18n="prod-cobro-zelle-deposit" hidden style="display:none;" aria-hidden="true" tabindex="-1"></button>' +
        '<button type="button" id="prod-cobro-zelle-confirm" data-i18n="prod-cobro-zelle-confirm" hidden style="display:none;" aria-hidden="true" tabindex="-1"></button>' +
        '<button type="button" id="prod-cobro-release-dj" data-i18n="prod-cobro-release-dj" hidden style="display:none;" aria-hidden="true" tabindex="-1"></button>' +
        '</div></div>' +
        '<div id="prod-inv-msg" class="fineprint" style="margin-top:8px;color:var(--admin-accent);"></div>' +
        '<h4 style="margin:22px 0 8px;color:var(--gold);" data-i18n="prod-elixis-quotes-h"></h4>' +
        '<p class="fineprint" style="margin:0 0 8px;opacity:0.8;" data-i18n="prod-elixis-quotes-hint"></p>' +
        '<div id="prod-elixis-quote-list" class="fineprint"></div>' +
        '<h4 style="margin:22px 0 8px;color:var(--gold);" data-i18n="prod-inv-list-h"></h4><div id="prod-inv-list" class="fineprint"></div>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    },

    _bind: function () {
      var self = this;
      // Planificación tab removed — Factura panel is now the only view.
      var taxEl = document.getElementById('prod-inv-tax');
      if (taxEl) {
        taxEl.addEventListener('input', function () {
          self._updateInvTotal();
        });
      }
      document.getElementById('prod-inv-add-line').onclick = function () {
        self._invLines.push({ desc: '', qty: 1, unit: 0 });
        self._renderInvLines();
      };
      document.getElementById('prod-inv-save').onclick = function () {
        void self._saveInvoice();
      };
      var saveActionBtn = document.getElementById('prod-inv-action-save');
      if (saveActionBtn) {
        saveActionBtn.onclick = function () {
          var legacySave = document.getElementById('prod-inv-save');
          if (legacySave) legacySave.click();
        };
      }
      var printBtn = document.getElementById('prod-inv-open-print');
      if (printBtn) {
        printBtn.onclick = function () {
          self._pushInvoicePrint();
        };
      }
      if (typeof global.mdjInitProductionInvAddressBlocks === 'function') {
        global.mdjInitProductionInvAddressBlocks();
      }
      var createAcctBtn = document.getElementById('prod-inv-create-account');
      if (createAcctBtn) {
        createAcctBtn.onclick = function () {
          void self._createClientAccountFromPanel();
        };
      }
      var lookupBtn = document.getElementById('prod-inv-client-lookup-btn');
      if (lookupBtn) {
        lookupBtn.onclick = function () {
          void self._lookupClientByAccount();
        };
      }
      var lookupInput = document.getElementById('prod-inv-client-lookup');
      if (lookupInput) {
        lookupInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            void self._lookupClientByAccount();
          }
        });
      }
      var stripeDepBtn = document.getElementById('prod-cobro-stripe-deposit');
      if (stripeDepBtn) {
        stripeDepBtn.onclick = function () {
          void self._sendDepositStripeLink();
        };
      }
      var copyLinkBtn = document.getElementById('prod-inv-action-copy-link');
      if (copyLinkBtn) {
        copyLinkBtn.onclick = function () {
          void self._copyPaymentLink();
        };
      }
      var zelleDepBtn = document.getElementById('prod-cobro-zelle-deposit');
      if (zelleDepBtn) {
        zelleDepBtn.onclick = function () {
          void self._sendDepositZelleInstructions();
        };
      }
      var zelleConfirmBtn = document.getElementById('prod-cobro-zelle-confirm');
      if (zelleConfirmBtn) {
        zelleConfirmBtn.onclick = function () {
          void self._confirmZelleDeposit();
        };
      }
      var releaseBtn = document.getElementById('prod-cobro-release-dj');
      if (releaseBtn) {
        releaseBtn.onclick = function () {
          void self._releaseDjPayout();
        };
      }
      var evDateEl = document.getElementById('prod-cobro-event-date');
      if (evDateEl && !evDateEl.value) {
        evDateEl.value = new Date().toISOString().slice(0, 10);
      }
      self._bindElixisQuoteList();
      void self._loadCobroDjRoster();
      this._invLines = [{ desc: prodT('prod-inv-default-line'), qty: 1, unit: 0 }];
      this._renderInvLines();
    },

    _flowRows: [],
    _invLines: [],
    _elixisCheckoutUrls: {},

    _renderFlowTable: function () { /* removed — Planificación tab eliminated */ },

    _renderFlowTableLegacy: function () {
      var type = document.getElementById('prod-flow-type') && document.getElementById('prod-flow-type').value;
      if (document.getElementById('prod-flow-apply-template') === document.activeElement ||
        (arguments[0] && arguments[0].forceTemplate)) {
        this._flowRows = global.mdjCloneDefaultBlocksForType(type);
      }
      var wrap = document.getElementById('prod-flow-table-wrap');
      var rows = this._flowRows
        .map(function (r, i) {
          return (
            '<article class="mdj-prod-block" data-idx="' +
            i +
            '">' +
            '<div class="mdj-prod-block-head">' +
            '<span class="mdj-prod-block-num">#' +
            (i + 1) +
            '</span>' +
            '<button type="button" class="btn-pill red" data-del-flow="' +
            i +
            '" aria-label="remove">×</button>' +
            '</div>' +
            '<div class="mdj-prod-block-times">' +
            '<div class="mdj-prod-field">' +
            '<label class="fineprint mdj-prod-mini-lbl">' +
            esc(prodT('prod-th-start')) +
            '</label>' +
            '<input type="text" class="price-input mdj-prod-time" data-f="start" value="' +
            esc(r.start) +
            '" placeholder="' +
            esc(prodT('prod-ph-flow-start')) +
            '" />' +
            '</div>' +
            '<div class="mdj-prod-field">' +
            '<label class="fineprint mdj-prod-mini-lbl">' +
            esc(prodT('prod-th-end')) +
            '</label>' +
            '<input type="text" class="price-input mdj-prod-time" data-f="end" value="' +
            esc(r.end) +
            '" placeholder="' +
            esc(prodT('prod-ph-flow-end')) +
            '" />' +
            '</div>' +
            '</div>' +
            '<div class="mdj-prod-field">' +
            '<label class="fineprint mdj-prod-mini-lbl">' +
            esc(prodT('prod-th-block')) +
            '</label>' +
            '<input type="text" class="price-input" data-f="title" value="' +
            esc(r.title) +
            '" placeholder="' +
            esc(prodT('prod-ph-flow-block')) +
            '" />' +
            '</div>' +
            '<div class="mdj-prod-field">' +
            '<label class="fineprint mdj-prod-mini-lbl">' +
            esc(prodT('prod-th-actions')) +
            '</label>' +
            '<textarea class="price-input mdj-prod-textarea" data-f="actions" rows="5" spellcheck="true" placeholder="' +
            esc(prodT('prod-ph-flow-actions')) +
            '">' +
            esc(r.actions) +
            '</textarea>' +
            '</div>' +
            '<div class="mdj-prod-field">' +
            '<label class="fineprint mdj-prod-mini-lbl">' +
            esc(prodT('prod-th-notes')) +
            '</label>' +
            '<textarea class="price-input mdj-prod-textarea" data-f="notes" rows="4" spellcheck="true" placeholder="' +
            esc(prodT('prod-ph-flow-notes')) +
            '">' +
            esc(r.notes) +
            '</textarea>' +
            '</div>' +
            '</article>'
          );
        })
        .join('');
      wrap.innerHTML = '<div class="mdj-prod-timeline">' + rows + '</div>';
      var self = this;
      function bindField(el) {
        el.addEventListener('input', function () {
          var block = el.closest('[data-idx]');
          if (!block) return;
          var idx = parseInt(block.getAttribute('data-idx'), 10);
          var f = el.getAttribute('data-f');
          if (self._flowRows[idx]) self._flowRows[idx][f] = el.value;
        });
      }
      wrap.querySelectorAll('input[data-f], textarea[data-f]').forEach(bindField);
      wrap.querySelectorAll('[data-del-flow]').forEach(function (btn) {
        btn.onclick = function () {
          var ix = parseInt(btn.getAttribute('data-del-flow'), 10);
          self._flowRows.splice(ix, 1);
          self._renderFlowTable();
        };
      });
    },

    _readFlowRowsFromDom: function () {
      return this._flowRows.slice();
    },

    _saveFlow: async function () {
      var msg = document.getElementById('prod-flow-msg');
      msg.textContent = '';
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) {
        msg.textContent = prodT('prod-msg-supabase-off');
        return;
      }
      var sm = await db.auth.getSession();
      var uid = sm.data && sm.data.session && sm.data.session.user && sm.data.session.user.id;
      if (!uid) {
        msg.textContent = prodT('prod-msg-session');
        return;
      }
      var type = document.getElementById('prod-flow-type').value;
      var title = document.getElementById('prod-flow-title').value.trim() || prodT('prod-flow-default-title');
      var venue = document.getElementById('prod-flow-venue').value.trim() || null;
      var eventDate = document.getElementById('prod-flow-date').value || null;
      var cuid = document.getElementById('prod-flow-client').value.trim() || null;
      var payload = {
        created_by: uid,
        client_user_id: cuid && /^[0-9a-f-]{36}$/i.test(cuid) ? cuid : null,
        lead_id: null,
        event_type: type,
        title: title,
        venue: venue,
        event_date: eventDate,
        access_notes: (function () {
          var a = document.getElementById('prod-flow-access');
          return a ? a.value.trim() || null : null;
        })(),
        blocks: this._readFlowRowsFromDom(),
        meta: { criticalFields: (global.MDJ_EVENT_FLOW_TEMPLATES[type] || {}).criticalFields || [] },
        status: 'draft'
      };
      var ins = await db.from('mdj_event_flows').insert(payload).select('id').single();
      if (ins.error) {
        msg.style.color = '#ff5555';
        msg.textContent = ins.error.message || String(ins.error);
        return;
      }
      msg.style.color = 'var(--admin-accent)';
      msg.textContent = prodTVar('prod-msg-saved-flow', {
        id: ins.data && ins.data.id ? ins.data.id : ''
      });
      void this._refreshLists();
    },

    _pushFlowPrint: function () {
      var type = document.getElementById('prod-flow-type').value;
      var o = {
        v: 1,
        title: document.getElementById('prod-flow-title').value.trim() || prodT('prod-flow-default-title'),
        venue: document.getElementById('prod-flow-venue').value.trim(),
        eventDate: document.getElementById('prod-flow-date').value,
        eventType: type,
        blocks: this._readFlowRowsFromDom(),
        accessNotes: (function () {
          var a = document.getElementById('prod-flow-access');
          return a ? String(a.value || '').trim() : '';
        })(),
        accessHeading: prodT('prod-flow-print-access-heading')
      };
      try {
        sessionStorage.setItem(FLOW_PRINT_KEY, JSON.stringify(o));
      } catch (e) {}
    },

    _renderInvLines: function () {
      var host = document.getElementById('prod-inv-lines');
      var self = this;
      host.innerHTML =
        '<table class="fineprint" style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr><th>' +
        esc(prodT('prod-th-desc')) +
        '</th><th>' +
        esc(prodT('prod-th-qty')) +
        '</th><th>' +
        esc(prodT('prod-th-unit')) +
        '</th><th></th></tr></thead><tbody>' +
        this._invLines
          .map(function (L, i) {
            return (
              '<tr data-iidx="' +
              i +
              '"><td><input class="price-input" data-if="desc" value="' +
              esc(L.desc) +
              '" style="width:100%"/></td>' +
              '<td><input class="price-input" data-if="qty" type="number" min="1" step="1" value="' +
              esc(String(L.qty)) +
              '" style="width:64px"/></td>' +
              '<td><input class="price-input" data-if="unit" type="number" min="0" step="0.01" value="' +
              esc(String(L.unit)) +
              '" style="width:100px"/></td>' +
              '<td><button type="button" class="mdj-prod-inv-del-line-btn" data-del-inv="' +
              i +
              '">×</button></td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
      host.querySelectorAll('input[data-if]').forEach(function (inp) {
        inp.addEventListener('input', function () {
          var tr = inp.closest('tr');
          var ix = parseInt(tr.getAttribute('data-iidx'), 10);
          var f = inp.getAttribute('data-if');
          var v = f === 'qty' ? parseInt(inp.value, 10) || 1 : f === 'unit' ? parseFloat(inp.value) || 0 : inp.value;
          if (self._invLines[ix]) self._invLines[ix][f] = v;
          self._updateInvTotal();
        });
      });
      host.querySelectorAll('[data-del-inv]').forEach(function (btn) {
        btn.onclick = function () {
          var ix = parseInt(btn.getAttribute('data-del-inv'), 10);
          self._invLines.splice(ix, 1);
          if (!self._invLines.length) self._invLines.push({ desc: '', qty: 1, unit: 0 });
          self._renderInvLines();
        };
      });
      this._updateInvTotal();
    },

    _updateInvTotal: function () {
      var sub = 0;
      this._invLines.forEach(function (L) {
        sub += (Number(L.qty) || 0) * (Number(L.unit) || 0);
      });
      var taxRaw = document.getElementById('prod-inv-tax').value;
      var taxPct = parseFloat(taxRaw);
      if (!isFinite(taxPct) || taxPct < 0) taxPct = 0;
      if (taxPct > 100) taxPct = 100;
      var taxAmt = sub * (taxPct / 100);
      var tot = sub + taxAmt;
      var pctLabel = taxPct % 1 === 0 ? String(Math.round(taxPct)) : money(taxPct);
      var card = document.getElementById('prod-inv-summary-card');
      if (card) {
        card.innerHTML =
          '<div class="mdj-prod-inv-sum-grid">' +
          '<div class="mdj-prod-inv-sum-row"><span class="mdj-prod-inv-sum-lbl">' +
          esc(prodT('prod-inv-line-subtotal')) +
          '</span><span class="mdj-prod-inv-sum-val">$' +
          money(sub) +
          '</span></div>' +
          '<div class="mdj-prod-inv-sum-row mdj-prod-inv-sum-row--tax"><span class="mdj-prod-inv-sum-lbl">' +
          esc(prodT('prod-inv-line-tax')) +
          ' (' +
          esc(pctLabel) +
          '%)</span><span class="mdj-prod-inv-sum-val">$' +
          money(taxAmt) +
          '</span></div>' +
          '<div class="mdj-prod-inv-sum-total"><span class="mdj-prod-inv-sum-lbl">' +
          esc(prodT('prod-inv-line-total')) +
          '</span><span class="mdj-prod-inv-sum-val">$' +
          money(tot) +
          '</span></div></div>';
      }
      this._lastInvTotals = { sub: sub, taxAmt: taxAmt, total: tot, taxPct: taxPct };
      var depEl = document.getElementById('prod-cobro-deposit-display');
      if (depEl) {
        depEl.value = '$' + money(calcEventDepositUsd(tot));
      }
    },

    _lastInvTotals: { sub: 0, taxAmt: 0, total: 0, taxPct: 0 },

    _saveInvoice: async function () {
      var msg = document.getElementById('prod-inv-msg');
      msg.textContent = '';
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) {
        msg.textContent = prodT('prod-msg-supabase-off');
        return;
      }
      var sm = await db.auth.getSession();
      var uid = sm.data && sm.data.session && sm.data.session.user && sm.data.session.user.id;
      var clientRef = resolveProdInvClientUserId();
      if (!clientRef.ok) {
        msg.style.color = '#ff5555';
        msg.textContent = prodT('prod-msg-invalid-uuid');
        return;
      }
      var clientEmail = readProdInvClientEmail();
      if (!clientEmail) {
        msg.style.color = '#ff5555';
        msg.textContent = prodT('prod-msg-save-need-email');
        return;
      }
      this._updateInvTotal();
      var t = this._lastInvTotals;
      var leadId = null;
      try {
        leadId = await this._upsertEventLead(t.total, db);
      } catch (leadErr) {
        msg.style.color = '#ff5555';
        msg.textContent = (leadErr && leadErr.message) || String(leadErr);
        return;
      }
      if (clientRef.uuid) {
        var lines = this._invLines.map(function (L) {
          return {
            desc: (L.desc || '').trim(),
            qty: Number(L.qty) || 0,
            unit: Number(L.unit) || 0,
            unit_cents: Math.round((Number(L.unit) || 0) * 100)
          };
        });
        var payload = {
          created_by: uid,
          client_user_id: clientRef.uuid,
          lead_id: leadId,
          doc_kind: document.getElementById('prod-inv-kind').value,
          client_label: document.getElementById('prod-inv-buyer-name').value.trim() || null,
          client_company_name: document.getElementById('prod-inv-company-name').value.trim() || null,
          client_phone: (function () {
            var el = document.getElementById('prod-inv-client-phone');
            return el ? el.value.trim() || null : null;
          })(),
          client_email: (function () {
            var el = document.getElementById('prod-inv-client-email');
            return el ? el.value.trim() || null : null;
          })(),
          line_items: lines,
          subtotal_cents: Math.round(t.sub * 100),
          tax_pct: t.taxPct,
          total_cents: Math.round(t.total * 100),
          currency: 'USD',
          billing_address: formatInvAddrLines('bill') || null,
          event_address: formatInvAddrLines('ev') || null,
          notes: null,
          status: 'sent'
        };
        var ins = await db.from('mdj_staff_manual_invoices').insert(payload).select('id').single();
        if (ins.error) {
          msg.style.color = '#ff5555';
          msg.textContent = ins.error.message || String(ins.error);
          return;
        }
        if (leadId && ins.data && ins.data.id) {
          await db.from('leads').update({ staff_invoice_id: ins.data.id }).eq('id', leadId);
        }
        msg.style.color = 'var(--admin-accent)';
        msg.textContent = prodT('prod-msg-saved-inv');
      } else {
        msg.style.color = 'var(--admin-accent)';
        msg.textContent = prodT('prod-msg-saved-manual-lead');
      }
      if (leadId) {
        var leadHidden = document.getElementById('prod-cobro-lead-id');
        if (leadHidden) leadHidden.value = leadId;
        void this._refreshCobroStatus(leadId);
      }
      void this._refreshLists();
    },

    _pushInvoicePrint: function () {
      if (typeof global.mdjOpenInvoicePrint !== 'function') {
        var bridgeMsg = document.getElementById('prod-inv-msg');
        if (bridgeMsg) {
          bridgeMsg.style.color = '#f88';
          bridgeMsg.textContent = 'Print bridge unavailable. Reload admin dashboard.';
        }
        return;
      }
      this._updateInvTotal();
      var t = this._lastInvTotals;
      var lines = this._invLines.map(function (L) {
        return { desc: L.desc, qty: Number(L.qty) || 0, unit: Number(L.unit) || 0 };
      });
      var companyEl = document.getElementById('prod-inv-company-name');
      var buyerEl = document.getElementById('prod-inv-buyer-name');
      var emailEl = document.getElementById('prod-inv-client-email');
      var phoneEl = document.getElementById('prod-inv-client-phone');
      var company = companyEl ? companyEl.value.trim() : '';
      var name = buyerEl ? buyerEl.value.trim() : '';
      var email = emailEl ? emailEl.value.trim() : '';
      var phone = phoneEl ? phoneEl.value.trim() : '';
      var billing = formatInvAddrLines('bill');
      var billParts = [];
      if (company) billParts.push(company);
      if (name) billParts.push(name);
      if (billing) billParts.push(billing);
      if (email) billParts.push(email);
      if (phone) billParts.push('Tel: ' + phone);
      var evTypeEl = document.getElementById('prod-cobro-event-type');
      var evDateEl = document.getElementById('prod-cobro-event-date');
      var eventType = evTypeEl ? String(evTypeEl.value || '').trim() : '';
      var eventDate = evDateEl ? String(evDateEl.value || '').trim() : '';
      var eventAddr = formatInvAddrLines('ev');
      var eventParts = [];
      if (eventType) eventParts.push(eventType);
      if (eventAddr) eventParts.push(eventAddr);
      if (eventDate) eventParts.push(eventDate);
      var kindEl = document.getElementById('prod-inv-kind');
      var docKind = kindEl ? kindEl.value : 'quote';
      var notes = 'Thank you for your business. ';
      if (docKind === 'quote') {
        notes += 'This document is a quote. ';
      }
      notes += 'For questions, reply by email.';
      var payload = {
        v: 1,
        ref: '#MDJ-' + String(Date.now()).slice(-8),
        dateStr: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        billTo: billParts.length ? billParts.join('\n') : 'Client',
        eventLoc: eventParts.length ? eventParts.join('\n') : 'Event',
        lines: lines,
        taxPct: t.taxPct,
        notes: notes,
        sourceReturnUrl: './admin-dashboard.html'
      };
      try {
        global.mdjOpenInvoicePrint(payload);
      } catch (e) {
        var errMsg = document.getElementById('prod-inv-msg');
        if (errMsg) {
          errMsg.style.color = '#f88';
          errMsg.textContent = (e && e.message) || String(e);
        }
      }
    },

    _clientProfileSelect:
      'user_id,full_name,email,phone,company_name,address_street,address_apt,city,address_state,address_zip,address_country',

    _parseClientAccountQuery: function (raw) {
      var q = String(raw || '').trim();
      if (!q) return { kind: 'empty' };
      var compact = q.replace(/\s+/g, '');
      if (/^[0-9a-f-]{36}$/i.test(compact)) {
        return { kind: 'uuid', value: compact.toLowerCase() };
      }
      var normalized = compact.toUpperCase();
      if (/^MDJB-[A-Z0-9]{4}-[A-Z0-9]{4}-[CSAM]$/.test(normalized)) {
        return { kind: 'mdjb', stem: normalized.replace(/-[CSAM]$/, ''), full: normalized };
      }
      if (/^MDJB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
        return { kind: 'mdjb', stem: normalized, full: normalized };
      }
      return { kind: 'unknown', value: q };
    },

    _applyClientProfileToInvPanel: function (row) {
      if (!row) return;
      function setVal(id, val) {
        var node = document.getElementById(id);
        if (node && val != null && String(val).trim()) node.value = String(val).trim();
      }
      if (row.user_id) setVal('prod-inv-client', row.user_id);
      setVal('prod-inv-buyer-name', row.full_name);
      setVal('prod-inv-company-name', row.company_name);
      setVal('prod-inv-client-phone', row.phone);
      setVal('prod-inv-client-email', row.email);
      setVal('prod-inv-bill-street', row.address_street);
      setVal('prod-inv-bill-apt', row.address_apt);
      setVal('prod-inv-bill-city', row.city);
      setVal('prod-inv-bill-zip', row.address_zip);
      var country = row.address_country || 'United States';
      var cSel = document.getElementById('prod-inv-bill-select-country');
      if (cSel) {
        cSel.value = country;
        cSel.dispatchEvent(new Event('change', { bubbles: true }));
      }
      var st = row.address_state || '';
      if (country === 'United States') {
        setVal('prod-inv-bill-select-state-us', st);
      } else {
        setVal('prod-inv-bill-input-state-intl', st);
      }
    },

    _lookupClientByAccount: async function () {
      var msgEl = document.getElementById('prod-inv-client-lookup-msg');
      function setLookupMsg(text, isMuted) {
        if (!msgEl) return;
        msgEl.textContent = text || '';
        msgEl.style.color = isMuted ? 'rgba(255,255,255,0.55)' : 'var(--admin-accent)';
      }
      var inputEl = document.getElementById('prod-inv-client-lookup');
      var parsed = this._parseClientAccountQuery(inputEl ? inputEl.value : '');
      if (parsed.kind === 'empty') {
        setLookupMsg(prodT('prod-inv-client-lookup-empty'), true);
        return;
      }
      if (parsed.kind === 'unknown') {
        setLookupMsg(prodT('prod-inv-client-lookup-not-found'), true);
        return;
      }
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) {
        setLookupMsg(prodT('prod-inv-create-err-db'), true);
        return;
      }
      setLookupMsg(prodT('prod-inv-client-lookup-working'), false);
      var self = this;
      try {
        var userId = parsed.kind === 'uuid' ? parsed.value : null;
        if (parsed.kind === 'mdjb') {
          var mdjbRes = await db
            .from('mdjb_account_ids')
            .select('user_id,class,stem')
            .eq('stem', parsed.stem)
            .maybeSingle();
          if (mdjbRes.error) throw mdjbRes.error;
          if (!mdjbRes.data || !mdjbRes.data.user_id) {
            setLookupMsg(prodT('prod-inv-client-lookup-not-found'), true);
            return;
          }
          userId = mdjbRes.data.user_id;
          if (inputEl && mdjbRes.data.stem && mdjbRes.data.class) {
            inputEl.value = mdjbRes.data.stem + '-' + mdjbRes.data.class;
          }
        }
        var byUser = await db
          .from('client_profiles')
          .select(this._clientProfileSelect)
          .eq('user_id', userId)
          .maybeSingle();
        if (byUser.error) throw byUser.error;
        if (byUser.data) {
          self._applyClientProfileToInvPanel(byUser.data);
          setLookupMsg(prodT('prod-inv-client-lookup-found'), false);
          return;
        }
        if (parsed.kind === 'uuid') {
          var byId = await db
            .from('client_profiles')
            .select(this._clientProfileSelect)
            .eq('id', userId)
            .maybeSingle();
          if (byId.error) throw byId.error;
          if (byId.data) {
            self._applyClientProfileToInvPanel(byId.data);
            setLookupMsg(prodT('prod-inv-client-lookup-found'), false);
            return;
          }
        }
        setLookupMsg(prodT('prod-inv-client-lookup-not-found'), true);
      } catch (e) {
        setLookupMsg((e && e.message) || prodT('prod-inv-create-err-network'), true);
      }
    },

    _createClientAccountFromPanel: async function () {
      var msg = document.getElementById('prod-inv-create-account-msg');
      function setMsg(text, isErr) {
        if (!msg) return;
        msg.textContent = text || '';
        msg.style.color = isErr ? '#f88' : 'var(--admin-accent)';
      }
      function errText(code, detail) {
        var map = {
          forbidden_not_staff: prodT('prod-inv-create-err-forbidden'),
          invalid_session: prodT('prod-inv-create-err-invalid-session'),
          missing_authorization: prodT('prod-inv-create-err-invalid-session'),
          email_already_registered: prodT('prod-inv-create-err-email-duplicate'),
          invalid_email: prodT('prod-inv-create-err-invalid-email'),
          email_required: prodT('prod-inv-create-err-email'),
          client_authorized_required: prodT('prod-inv-create-err-auth'),
          profile_insert_failed: prodT('prod-inv-create-err-profile'),
          create_user_failed: prodT('prod-inv-create-err-create-user'),
          server_misconfigured: prodT('prod-inv-create-err-generic'),
          internal_error: prodT('prod-inv-create-err-generic'),
          method_not_allowed: prodT('prod-inv-create-err-generic'),
          request_failed: prodT('prod-inv-create-err-generic')
        };
        var t = map[code];
        if (t) return detail && code === 'create_user_failed' ? t + ' ' + detail : t;
        return detail || code || prodT('prod-inv-create-err-generic');
      }
      var authOk = document.getElementById('prod-inv-client-auth-ok');
      if (authOk && !authOk.checked) {
        setMsg(prodT('prod-inv-create-err-auth'), true);
        return;
      }
      var invEmailEl = document.getElementById('prod-inv-client-email');
      var email = invEmailEl && invEmailEl.value.trim() ? invEmailEl.value.trim() : '';
      if (!email) {
        setMsg(prodT('prod-inv-create-err-email'), true);
        return;
      }
      var buyerEl = document.getElementById('prod-inv-buyer-name');
      var fullName = buyerEl && buyerEl.value.trim() ? buyerEl.value.trim() : '';
      var phoneEl = document.getElementById('prod-inv-client-phone');
      var phone = phoneEl ? phoneEl.value.trim() : '';
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) {
        setMsg(prodT('prod-inv-create-err-db'), true);
        return;
      }
      var sess = await db.auth.getSession();
      var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!token) {
        setMsg(prodT('prod-inv-create-err-session'), true);
        return;
      }
      var url =
        typeof global.mdbSupabaseFunctionUrl === 'function'
          ? global.mdbSupabaseFunctionUrl('staff-create-client-account')
          : '';
      if (!url) {
        setMsg(prodT('prod-inv-create-err-config'), true);
        return;
      }
      setMsg(prodT('prod-inv-create-account-working'), false);
      try {
        var res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            apikey: typeof global.MDB_SUPABASE_ANON_KEY === 'string' ? global.MDB_SUPABASE_ANON_KEY : ''
          },
          body: JSON.stringify({
            email: email,
            full_name: fullName || null,
            phone: phone || null,
            client_authorized: true
          })
        });
        var j = await res.json().catch(function () {
          return {};
        });
        if (!res.ok || !j.ok) {
          setMsg(errText(String(j.error || 'request_failed'), j.detail ? String(j.detail) : ''), true);
          return;
        }
        var uuidEl = document.getElementById('prod-inv-client');
        if (uuidEl && j.user_id) uuidEl.value = j.user_id;
        if (invEmailEl && !invEmailEl.value.trim()) invEmailEl.value = email;
        var okLine = prodT('prod-inv-create-account-success');
        var pwLine = j.temp_password ? prodTVar('prod-inv-create-account-temp-msg', { password: j.temp_password }) : '';
        var loginAbs = '';
        try {
          loginAbs = new URL('login.html', global.location.href).href;
        } catch (e2) {
          loginAbs = 'login.html';
        }
        var portalLine =
          j.temp_password && email
            ? '\n\n' + prodTVar('prod-inv-create-account-portal-msg', { loginUrl: loginAbs, email: email })
            : '';
        setMsg((pwLine ? okLine + '\n\n' + pwLine : okLine) + portalLine, false);
      } catch (e) {
        setMsg((e && e.message) || prodT('prod-inv-create-err-network'), true);
      }
    },

    _loadCobroDjRoster: async function () {
      var sel = document.getElementById('prod-cobro-dj');
      if (!sel) return;
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) return;
      var prev = sel.value;
      var r = await db
        .from('dj_profiles')
        .select('id, stage_name, full_name, role')
        .order('stage_name', { ascending: true });
      if (r.error || !r.data) return;
      var staffRoles = { admin: 1, owner: 1, manager: 1, seller: 1, client: 1, cliente: 1 };
      var opts = '<option value="">—</option>';
      r.data.forEach(function (row) {
        var role = row.role ? String(row.role).toLowerCase().trim() : '';
        if (staffRoles[role]) return;
        var label = (row.stage_name || row.full_name || row.id || '').trim();
        if (!label) return;
        opts += '<option value="' + esc(row.id) + '">' + esc(label) + '</option>';
      });
      sel.innerHTML = opts;
      if (prev) sel.value = prev;
    },

    _upsertEventLead: async function (totalUsd, db) {
      var leadEl = document.getElementById('prod-cobro-lead-id');
      var existingId = leadEl ? leadEl.value.trim() : '';
      var clientRef = resolveProdInvClientUserId();
      if (!clientRef.ok) {
        throw new Error(prodT('prod-msg-invalid-uuid'));
      }
      var email = readProdInvClientEmail();
      var buyerEl = document.getElementById('prod-inv-buyer-name');
      var contact = buyerEl ? buyerEl.value.trim() : '';
      var companyEl = document.getElementById('prod-inv-company-name');
      var company = companyEl ? companyEl.value.trim() : '';
      if (company && contact) {
        contact = company + ' — ' + contact;
      } else if (company && !contact) {
        contact = company;
      }
      var evDateEl = document.getElementById('prod-cobro-event-date');
      var eventDate =
        evDateEl && evDateEl.value ? evDateEl.value : new Date().toISOString().slice(0, 10);
      var evTypeEl = document.getElementById('prod-cobro-event-type');
      var eventType = evTypeEl ? evTypeEl.value : 'Event Services';
      var djSel = document.getElementById('prod-cobro-dj');
      var djId = djSel && djSel.value ? djSel.value : null;
      var djName = '';
      if (djSel && djSel.selectedIndex > 0) {
        djName = djSel.options[djSel.selectedIndex].textContent || '';
      }
      var payoutEl = document.getElementById('prod-cobro-dj-payout');
      var payoutUsd = payoutEl ? parseFloat(payoutEl.value) : NaN;
      var depositUsd = calcEventDepositUsd(totalUsd);
      var eventLoc = formatInvAddrLines('ev');
      var base = {
        contact_person: contact || null,
        event_type: eventType,
        event_date: eventDate,
        total_amount: totalUsd,
        deposit_required_usd: depositUsd,
        assigned_dj_id: djId,
        assigned_dj_name: djName || null,
        dj_agreed_payout_usd: isFinite(payoutUsd) && payoutUsd > 0 ? payoutUsd : null
      };
      if (email) {
        base.email = email;
      }
      if (eventLoc) {
        base.location = eventLoc;
      }
      if (clientRef.uuid) {
        base.client_user_id = clientRef.uuid;
      }
      if (existingId && /^[0-9a-f-]{36}$/i.test(existingId)) {
        var up = await db.from('leads').update(base).eq('id', existingId).select('id').single();
        if (up.error) throw up.error;
        return existingId;
      }
      if (!email) {
        throw new Error(prodT('prod-msg-save-need-email'));
      }
      base.email = email;
      var insPayload = Object.assign(
        {
          balance_paid: 0,
          payment_status: 'UNPAID',
          status: 'NEW',
          source: 'staff_production'
        },
        base
      );
      var ins = await db.from('leads').insert([insPayload]).select('id').single();
      if (ins.error) throw ins.error;
      if (leadEl && ins.data && ins.data.id) leadEl.value = ins.data.id;
      return ins.data.id;
    },

    _refreshCobroStatus: async function (leadId) {
      var stEl = document.getElementById('prod-cobro-status');
      if (!stEl || !leadId) return;
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) return;
      var r = await db
        .from('leads')
        .select(
          'payment_status, balance_paid, total_amount, deposit_required_usd, dj_payout_released_at, dj_agreed_payout_usd'
        )
        .eq('id', leadId)
        .maybeSingle();
      if (r.error || !r.data) {
        stEl.textContent = '';
        return;
      }
      var L = r.data;
      var dep = L.deposit_required_usd != null ? Number(L.deposit_required_usd) : calcEventDepositUsd(L.total_amount);
      var paid = Number(L.balance_paid) || 0;
      var lines = [
        prodTVar('prod-cobro-status-lead', { id: String(leadId).slice(0, 8) }),
        prodTVar('prod-cobro-status-pay', {
          status: L.payment_status || 'UNPAID',
          paid: money(paid),
          deposit: money(dep)
        })
      ];
      if (L.dj_agreed_payout_usd != null) {
        lines.push(prodTVar('prod-cobro-status-dj', { amount: money(L.dj_agreed_payout_usd) }));
      }
      if (L.dj_payout_released_at) {
        lines.push(prodT('prod-cobro-status-released'));
      }
      stEl.textContent = lines.join(' · ');
      var zc = document.getElementById('prod-cobro-zelle-confirm');
      if (zc) {
        zc.style.display = (L.payment_status || '') === 'PENDING_ZELLE' ? '' : 'none';
      }
    },

    _showEventCheckoutError: function (stEl, out) {
      if (!stEl || !out) return;
      if (out.code === 'save_first') {
        stEl.textContent = prodT('prod-cobro-err-save-first');
      } else if (out.code === 'need_email') {
        stEl.textContent = prodT('prod-cobro-stripe-need-email');
      } else if (out.code === 'config') {
        stEl.textContent = prodT('prod-inv-create-err-config');
      } else {
        stEl.textContent = prodT('prod-cobro-stripe-fail') + ' ' + (out.message || '');
      }
    },

    /** Lead + email + charge mode → create-event-payment URL (sin abrir Stripe). */
    _createEventCheckoutUrl: async function () {
      var leadEl = document.getElementById('prod-cobro-lead-id');
      var leadId = leadEl ? leadEl.value.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
        return { ok: false, code: 'save_first' };
      }
      var emailEl = document.getElementById('prod-inv-client-email');
      var clientEmail = emailEl ? emailEl.value.trim().toLowerCase() : '';
      this._updateInvTotal();
      var t = this._lastInvTotals;
      var depositUsd = calcEventDepositUsd(t.total);
      var chargeMode = readProdCobroChargeMode();
      var balancePaidUsd = 0;
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (db) {
        var leadPatch = { deposit_required_usd: depositUsd, total_amount: t.total };
        if (clientEmail) leadPatch.email = clientEmail;
        await db.from('leads').update(leadPatch).eq('id', leadId);
        if (!clientEmail) {
          var lr = await db.from('leads').select('email').eq('id', leadId).maybeSingle();
          if (lr.data && lr.data.email) {
            clientEmail = String(lr.data.email).trim().toLowerCase();
          }
        }
        if (chargeMode === 'full') {
          var br = await db.from('leads').select('balance_paid').eq('id', leadId).maybeSingle();
          if (br.data && br.data.balance_paid != null && isFinite(Number(br.data.balance_paid))) {
            balancePaidUsd = Number(br.data.balance_paid);
          }
        }
      }
      if (!clientEmail) {
        return { ok: false, code: 'need_email' };
      }
      var CHECKOUT_FN =
        typeof global.mdbSupabaseFunctionUrl === 'function'
          ? global.mdbSupabaseFunctionUrl('create-event-payment')
          : '';
      if (!CHECKOUT_FN) {
        return { ok: false, code: 'config' };
      }
      var evTypeEl = document.getElementById('prod-cobro-event-type');
      var evDateEl = document.getElementById('prod-cobro-event-date');
      var eventType = evTypeEl ? evTypeEl.value : 'Event';
      var eventDate = evDateEl && evDateEl.value ? evDateEl.value : 'TBD';
      var amountCents;
      var checkoutDesc;
      if (chargeMode === 'full') {
        var remainingUsd = Math.max(0, t.total - balancePaidUsd);
        if (!isFinite(remainingUsd) || remainingUsd <= 0) {
          remainingUsd = Math.max(0, t.total);
        }
        amountCents = Math.max(Math.round(remainingUsd * 100), 100);
        checkoutDesc = 'Pago total — ' + eventType + ' · ' + eventDate;
      } else {
        amountCents = Math.max(Math.round(depositUsd * 100), 15000);
        checkoutDesc = 'Depósito de reserva — ' + eventType + ' · ' + eventDate;
      }
      try {
        var resp = await fetch(CHECKOUT_FN, {
          method: 'POST',
          headers:
            typeof global.mdjSupabaseAnonInvokeHeaders === 'function'
              ? global.mdjSupabaseAnonInvokeHeaders()
              : { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: leadId,
            amount_cents: amountCents,
            deposit_required_usd: depositUsd,
            description: checkoutDesc
          })
        });
        var result = await resp.json().catch(function () {
          return {};
        });
        if (!resp.ok || !result.url) {
          return {
            ok: false,
            code: 'checkout',
            message: (result && result.error) || 'checkout'
          };
        }
        return { ok: true, url: String(result.url), leadId: leadId };
      } catch (e) {
        return { ok: false, code: 'checkout', message: (e && e.message) || 'checkout' };
      }
    },

    _copyPaymentLink: async function () {
      var stEl = document.getElementById('prod-cobro-status');
      var btn = document.getElementById('prod-inv-action-copy-link');
      if (btn) btn.disabled = true;
      var out = await this._createEventCheckoutUrl();
      if (!out.ok) {
        this._showEventCheckoutError(stEl, out);
        if (btn) btn.disabled = false;
        return;
      }
      var url = out.url;
      var copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          copied = true;
        }
      } catch (clipErr) {
        copied = false;
      }
      if (!copied) {
        window.prompt(prodT('prod-cobro-stripe-prompt'), url);
      }
      if (stEl) stEl.textContent = prodT('prod-cobro-copy-link-ok');
      void this._refreshCobroStatus(out.leadId);
      if (btn) btn.disabled = false;
    },

    _sendDepositStripeLink: async function () {
      var stEl = document.getElementById('prod-cobro-status');
      var stripeTab = null;
      try {
        stripeTab = window.open('about:blank', '_blank');
      } catch (openErr) {
        stripeTab = null;
      }
      function closeStripeTab() {
        try {
          if (stripeTab && !stripeTab.closed) stripeTab.close();
        } catch (closeErr) {
          /* ignore */
        }
      }
      var btn = document.getElementById('prod-cobro-stripe-deposit');
      if (btn) {
        btn.disabled = true;
      }
      var out = await this._createEventCheckoutUrl();
      if (!out.ok) {
        closeStripeTab();
        this._showEventCheckoutError(stEl, out);
        if (btn) btn.disabled = false;
        return;
      }
      var url = out.url;
      if (stripeTab && !stripeTab.closed) {
        stripeTab.location.href = url;
        try {
          stripeTab.opener = null;
        } catch (_) {
          /* ignore */
        }
      } else {
        window.open(url, '_blank', 'noopener');
      }
      var copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          copied = true;
        }
      } catch (clipErr) {
        copied = false;
      }
      if (!copied) {
        window.prompt(prodT('prod-cobro-stripe-prompt'), url);
      }
      if (stEl) {
        var lang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
        stEl.textContent =
          lang === 'es'
            ? 'Stripe abierto. Si el navegador bloqueó la pestaña, el enlace quedó copiado.'
            : 'Stripe opened. If the browser blocked the tab, the link was copied.';
      }
      void this._refreshCobroStatus(out.leadId);
      if (btn) btn.disabled = false;
    },

    _sendDepositZelleInstructions: async function () {
      var stEl = document.getElementById('prod-cobro-status');
      var leadEl = document.getElementById('prod-cobro-lead-id');
      var leadId = leadEl ? leadEl.value.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
        if (stEl) stEl.textContent = prodT('prod-cobro-err-save-first');
        return;
      }
      this._updateInvTotal();
      var t = this._lastInvTotals;
      var depositUsd = calcEventDepositUsd(t.total);
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (db) {
        await db.from('leads').update({ deposit_required_usd: depositUsd, total_amount: t.total }).eq('id', leadId);
      }
      var portalUrl =
        typeof global.location !== 'undefined' && global.location.origin
          ? global.location.origin + '/client-portal.html?lead=' + encodeURIComponent(leadId)
          : '';
      var text = buildZelleDepositInstructions(mdjCorpZelleEmail(), depositUsd, zelleMemoForLead(leadId), portalUrl);
      var btn = document.getElementById('prod-cobro-zelle-deposit');
      if (btn) btn.disabled = true;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          if (stEl) stEl.textContent = prodT('prod-cobro-zelle-copied');
        } else {
          window.prompt(prodT('prod-cobro-zelle-prompt'), text);
        }
        void this._refreshCobroStatus(leadId);
      } catch (e) {
        window.prompt(prodT('prod-cobro-zelle-prompt'), text);
      }
      if (btn) btn.disabled = false;
    },

    _confirmZelleDeposit: async function () {
      var stEl = document.getElementById('prod-cobro-status');
      var leadEl = document.getElementById('prod-cobro-lead-id');
      var leadId = leadEl ? leadEl.value.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
        if (stEl) stEl.textContent = prodT('prod-cobro-err-save-first');
        return;
      }
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) return;
      var btn = document.getElementById('prod-cobro-zelle-confirm');
      if (btn) btn.disabled = true;
      try {
        var r = await db.rpc('staff_confirm_event_zelle_deposit', { p_lead_id: leadId });
        var data = r.data;
        if (r.error) throw r.error;
        if (data && data.ok === false) {
          throw new Error(String(data.error || 'zelle_confirm_failed'));
        }
        if (stEl) {
          stEl.textContent = prodTVar('prod-cobro-zelle-confirmed', {
            amount: money(data && data.credited_usd != null ? data.credited_usd : 0)
          });
        }
        void this._refreshCobroStatus(leadId);
      } catch (e) {
        if (stEl) stEl.textContent = prodT('prod-cobro-zelle-confirm-fail') + ' ' + ((e && e.message) || '');
      }
      if (btn) btn.disabled = false;
    },

    _releaseDjPayout: async function () {
      var stEl = document.getElementById('prod-cobro-status');
      var leadEl = document.getElementById('prod-cobro-lead-id');
      var leadId = leadEl ? leadEl.value.trim() : '';
      if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
        if (stEl) stEl.textContent = prodT('prod-cobro-err-save-first');
        return;
      }
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) return;
      var btn = document.getElementById('prod-cobro-release-dj');
      if (btn) btn.disabled = true;
      try {
        var r = await db.rpc('staff_release_event_dj_payout', { p_lead_id: leadId });
        var data = r.data;
        if (r.error) throw r.error;
        if (data && data.ok === false) {
          throw new Error(String(data.error || 'release_failed'));
        }
        if (stEl) {
          stEl.textContent =
            data && data.already
              ? prodT('prod-cobro-release-already')
              : prodT('prod-cobro-release-ok');
        }
        void this._refreshCobroStatus(leadId);
      } catch (e) {
        if (stEl) stEl.textContent = prodT('prod-cobro-release-fail') + ' ' + ((e && e.message) || '');
      }
      if (btn) btn.disabled = false;
    },

    _elixisQuoteLocked: function (q, eboPay) {
      var st = String((q && q.status) || '').toLowerCase();
      if (st === 'void' || st === 'expired') return true;
      var pay = String(eboPay || '').toLowerCase();
      return pay === 'deposit_paid' || pay === 'paid_full';
    },

    _elixisQuoteErrText: function (code, detail) {
      var key =
        code === 'missing_authorization' || code === 'invalid_session'
          ? 'prod-elixis-err-session'
          : code === 'forbidden_not_staff'
            ? 'prod-elixis-err-forbidden'
            : code === 'falta_email_lead'
              ? 'prod-elixis-err-email'
              : code === 'convert_failed'
                ? 'prod-elixis-err-convert'
                : code === 'stripe_session' || code === 'stripe_unconfigured'
                  ? 'prod-elixis-err-stripe'
                  : 'prod-elixis-err-generic';
      var base = prodT(key) || prodT('prod-elixis-err-generic');
      if (detail && code === 'convert_failed') return base + ' ' + String(detail);
      return base;
    },

    _bindElixisQuoteList: function () {
      var host = document.getElementById('prod-elixis-quote-list');
      if (!host || host.getAttribute('data-bound') === '1') return;
      host.setAttribute('data-bound', '1');
      var self = this;
      host.addEventListener('click', function (ev) {
        var charge = ev.target.closest('[data-elixis-charge]');
        if (charge) {
          ev.preventDefault();
          void self._chargeElixisQuoteDeposit(charge);
          return;
        }
        var openBtn = ev.target.closest('[data-elixis-open]');
        if (openBtn) {
          ev.preventDefault();
          var openUrl = openBtn.getAttribute('data-url') || '';
          if (openUrl) window.open(openUrl, '_blank', 'noopener');
          return;
        }
        var copyBtn = ev.target.closest('[data-elixis-copy]');
        if (copyBtn) {
          ev.preventDefault();
          void self._copyElixisCheckoutUrl(copyBtn);
        }
      });
    },

    _setElixisRowMsg: function (row, text, isError) {
      if (!row) return;
      var msg = row.querySelector('[data-elixis-msg]');
      if (!msg) return;
      msg.style.color = isError ? '#ff5555' : 'var(--admin-accent)';
      msg.textContent = text || '';
    },

    _showElixisCheckoutActions: function (row, url) {
      if (!row || !url) return;
      var openBtn = row.querySelector('[data-elixis-open]');
      var copyBtn = row.querySelector('[data-elixis-copy]');
      if (openBtn) {
        openBtn.setAttribute('data-url', url);
        openBtn.hidden = false;
        openBtn.disabled = false;
      }
      if (copyBtn) {
        copyBtn.setAttribute('data-url', url);
        copyBtn.hidden = false;
        copyBtn.disabled = false;
      }
    },

    _copyElixisCheckoutUrl: async function (btn) {
      var row = btn && btn.closest('[data-quote-id]');
      var url = btn ? String(btn.getAttribute('data-url') || '') : '';
      if (!url) return;
      var copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          copied = true;
        }
      } catch (clipErr) {
        copied = false;
      }
      if (!copied) {
        window.prompt(prodT('prod-cobro-stripe-prompt'), url);
      }
      this._setElixisRowMsg(row, prodT('prod-elixis-copy-ok'), false);
    },

    _chargeElixisQuoteDeposit: async function (btn) {
      var row = btn && btn.closest('[data-quote-id]');
      if (!row || btn.disabled) return;
      var quoteId = String(row.getAttribute('data-quote-id') || '').trim();
      var leadId = String(row.getAttribute('data-lead-id') || '').trim();
      if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
        var hidden = document.getElementById('prod-cobro-lead-id');
        leadId = hidden ? hidden.value.trim() : '';
      }
      if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return;
      if (!/^[0-9a-f-]{36}$/i.test(leadId)) {
        this._setElixisRowMsg(row, prodT('prod-elixis-need-lead'), true);
        return;
      }
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) {
        this._setElixisRowMsg(row, prodT('prod-msg-supabase-off'), true);
        return;
      }
      var sess = await db.auth.getSession();
      var token = sess && sess.data && sess.data.session && sess.data.session.access_token;
      if (!token) {
        this._setElixisRowMsg(row, prodT('prod-elixis-err-session'), true);
        return;
      }
      var fnUrl =
        typeof global.mdbSupabaseFunctionUrl === 'function'
          ? global.mdbSupabaseFunctionUrl('create-quote-deposit')
          : '';
      if (!fnUrl) {
        this._setElixisRowMsg(row, prodT('prod-inv-create-err-config'), true);
        return;
      }
      var label = btn.querySelector('[data-elixis-charge-lbl]') || btn;
      var prev = label.textContent;
      btn.disabled = true;
      label.textContent = prodT('prod-elixis-generating');
      this._setElixisRowMsg(row, '', false);
      try {
        var res = await fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + token,
            apikey: typeof global.MDB_SUPABASE_ANON_KEY === 'string' ? global.MDB_SUPABASE_ANON_KEY : ''
          },
          body: JSON.stringify({ quote_id: quoteId, lead_id: leadId })
        });
        var body = await res.json().catch(function () {
          return {};
        });
        if (!res.ok || !body || body.ok !== true || !body.url) {
          this._setElixisRowMsg(
            row,
            this._elixisQuoteErrText(body && body.error, body && body.detail),
            true
          );
          btn.disabled = false;
          label.textContent = prev;
          return;
        }
        this._elixisCheckoutUrls[quoteId] = {
          url: String(body.url),
          depositUsd: body.deposit_usd
        };
        this._showElixisCheckoutActions(row, String(body.url));
        this._setElixisRowMsg(
          row,
          prodTVar('prod-elixis-ready', { amount: money(body.deposit_usd) }),
          false
        );
        label.textContent = prev;
        btn.disabled = false;
        void this._refreshElixisQuotes();
        void this._refreshCobroStatus(leadId);
      } catch (e) {
        this._setElixisRowMsg(row, prodT('prod-elixis-err-generic') + ' ' + ((e && e.message) || ''), true);
        btn.disabled = false;
        label.textContent = prev;
      }
    },

    _refreshElixisQuotes: async function () {
      var host = document.getElementById('prod-elixis-quote-list');
      if (!host) return;
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) {
        host.innerHTML = '<span style="opacity:0.5">' + esc(prodT('prod-msg-supabase-off')) + '</span>';
        return;
      }
      var r = await db
        .from('event_quotes')
        .select('id, lead_id, event_date, event_type, deposit_usd, total_usd, status, ebo_id, created_at')
        .order('created_at', { ascending: false })
        .limit(12);
      if (r.error) {
        host.innerHTML = '<span style="color:#ff5555">' + esc(r.error.message || String(r.error)) + '</span>';
        return;
      }
      var rows = r.data || [];
      if (!rows.length) {
        host.innerHTML = '<span style="opacity:0.5">' + esc(prodT('prod-elixis-quotes-empty')) + '</span>';
        return;
      }
      var eboPay = {};
      var eboIds = rows
        .map(function (q) {
          return q.ebo_id;
        })
        .filter(Boolean);
      if (eboIds.length) {
        var ebo = await db.from('event_builder_orders').select('id, payment_status').in('id', eboIds);
        if (!ebo.error && ebo.data) {
          ebo.data.forEach(function (o) {
            eboPay[o.id] = o.payment_status;
          });
        }
      }
      var self = this;
      var currentLeadEl = document.getElementById('prod-cobro-lead-id');
      var currentLead = currentLeadEl ? currentLeadEl.value.trim() : '';
      host.innerHTML = rows
        .map(function (q) {
          var pay = q.ebo_id ? eboPay[q.ebo_id] : '';
          var locked = self._elixisQuoteLocked(q, pay);
          var leadAttr = q.lead_id ? String(q.lead_id) : currentLead;
          var st = String(q.status || 'draft');
          var badge = locked
            ? pay === 'deposit_paid' || pay === 'paid_full'
              ? prodT('prod-elixis-paid')
              : prodT('prod-elixis-locked')
            : st;
          var match =
            currentLead && q.lead_id && String(q.lead_id) === currentLead
              ? ' border-color:var(--gold);'
              : '';
          return (
            '<div class="mdj-prod-elixis-row" data-quote-id="' +
            esc(q.id) +
            '" data-lead-id="' +
            esc(leadAttr || '') +
            '" style="margin:0 0 10px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;' +
            match +
            '">' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;">' +
            '<strong>' +
            esc(q.event_type || '—') +
            '</strong>' +
            '<span>' +
            esc(q.event_date || '') +
            '</span>' +
            '<span>dep $' +
            money(q.deposit_usd) +
            ' · tot $' +
            money(q.total_usd) +
            '</span>' +
            '<span style="opacity:0.75;">' +
            esc(badge) +
            '</span>' +
            '<code style="opacity:0.7;">' +
            esc(String(q.id).slice(0, 8)) +
            '</code>' +
            '<a href="./quote.html?id=' +
            encodeURIComponent(q.id) +
            '" target="_blank" rel="noopener" style="color:var(--gold);">' +
            esc(prodT('prod-elixis-view')) +
            '</a></div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;align-items:center;">' +
            '<button type="button" class="btn secondary small" data-elixis-charge' +
            (locked ? ' disabled' : '') +
            '><span data-elixis-charge-lbl>' +
            esc(prodT('prod-elixis-charge-deposit')) +
            '</span></button>' +
            '<button type="button" class="btn secondary small" data-elixis-open hidden>' +
            esc(prodT('prod-elixis-open-stripe')) +
            '</button>' +
            '<button type="button" class="btn secondary small" data-elixis-copy hidden>' +
            esc(prodT('prod-elixis-copy-link')) +
            '</button></div>' +
            '<div data-elixis-msg class="fineprint" style="margin-top:6px;min-height:1.2em;"></div></div>'
          );
        })
        .join('');
      var urls = this._elixisCheckoutUrls || {};
      rows.forEach(function (q) {
        var saved = urls[q.id];
        if (!saved || !saved.url || self._elixisQuoteLocked(q, q.ebo_id ? eboPay[q.ebo_id] : '')) return;
        var rowEl = host.querySelector('[data-quote-id="' + q.id + '"]');
        if (!rowEl) return;
        self._showElixisCheckoutActions(rowEl, saved.url);
        self._setElixisRowMsg(
          rowEl,
          prodTVar('prod-elixis-ready', { amount: money(saved.depositUsd) }),
          false
        );
      });
    },

    _refreshLists: async function () {
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) return;
      void this._refreshElixisQuotes();
      var fl = document.getElementById('prod-flow-list');
      var il = document.getElementById('prod-inv-list');
      if (fl) {
        var r1 = await db.from('mdj_event_flows').select('id,title,event_type,status,created_at').order('created_at', { ascending: false }).limit(8);
        if (!r1.error && r1.data && r1.data.length) {
          fl.innerHTML = r1.data
            .map(function (x) {
              return '<div>· ' + esc(x.title) + ' <span style="opacity:0.6">(' + esc(x.event_type) + ')</span> — ' + esc(x.status) + '</div>';
            })
            .join('');
        } else fl.innerHTML = '<span style="opacity:0.5">' + esc(prodT('prod-list-empty')) + '</span>';
      }
      if (il) {
        var r2 = await db
          .from('mdj_staff_manual_invoices')
          .select('id,client_label,client_company_name,doc_kind,total_cents,created_at')
          .order('created_at', { ascending: false })
          .limit(8);
        if (!r2.error && r2.data && r2.data.length) {
          il.innerHTML = r2.data
            .map(function (x) {
              var usd = (x.total_cents || 0) / 100;
              var who = esc(x.client_label || '');
              if (x.client_company_name && String(x.client_company_name).trim()) {
                who += (who ? ' · ' : '') + esc(String(x.client_company_name).trim());
              }
              return '<div>· ' + esc(x.doc_kind) + ' — ' + who + ' — $' + money(usd) + '</div>';
            })
            .join('');
        } else il.innerHTML = '<span style="opacity:0.5">' + esc(prodT('prod-list-empty')) + '</span>';
      }
    }
  };

  /** Primera carga: aplicar plantilla según select sin borrar si usuario ya editó — en init ya clonamos wedding; al cambiar tipo usuario pulsa «Aplicar plantilla». */
  global.loadProductionPanel = function () {
    global.MDJProduction.init();
  };
})(typeof window !== 'undefined' ? window : globalThis);
