/**
 * Admin Dashboard — Producción: Event Flow + factura/cotización manual (Supabase).
 * Requiere: supabase client, production-templates.js, tablas mdj_event_flows + mdj_staff_manual_invoices.
 */
(function (global) {
  'use strict';

  var FLOW_PRINT_KEY = 'mdj_event_flow_print_v1';
  var INV_PRINT_KEY = 'mdj_staff_invoice_print_v1';

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

  global.MDJProduction = {
    _inited: false,
    _i18nListenerBound: false,

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
          global.MDJProduction._renderFlowTable();
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
        '<div class="mdj-prod-tab-row" style="display:flex;gap:10px;margin-bottom:18px;align-items:stretch;">' +
        '<button type="button" class="btn secondary small mdj-prod-tab" style="flex:1 1 0;min-width:0;text-align:center;justify-content:center;" data-prod-tab="flow" data-i18n="prod-tab-flow" aria-pressed="false"></button>' +
        '<button type="button" class="btn secondary small mdj-prod-tab mdj-prod-tab--active" style="flex:1 1 0;min-width:0;text-align:center;justify-content:center;" data-prod-tab="inv" data-i18n="prod-tab-invoice" aria-pressed="true"></button>' +
        '</div>' +
        '<div id="prod-panel-flow" style="display:none;">' +
        '<p class="fineprint" style="margin-top:0;" data-i18n="prod-flow-intro"></p>' +
        '<div class="mdj-prod-meta-grid" style="margin-bottom:4px;">' +
        '<div><label class="fineprint" data-i18n="prod-flow-type-lbl"></label><select id="prod-flow-type" class="price-input" style="width:100%;margin-top:4px;">' +
        '<option value="wedding" data-i18n="prod-opt-wedding"></option>' +
        '<option value="quinceanera" data-i18n="prod-opt-quinceanera"></option>' +
        '<option value="runway" data-i18n="prod-opt-runway"></option>' +
        '<option value="live_show" data-i18n="prod-opt-live_show"></option>' +
        '<option value="custom" data-i18n="prod-opt-custom"></option></select></div>' +
        '<div><label class="fineprint" data-i18n="prod-flow-title-lbl"></label>' +
        '<input type="text" id="prod-flow-title" class="price-input" style="width:100%;margin-top:4px;" data-i18n-hold="prod-flow-title-ph" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-flow-venue-lbl"></label><input type="text" id="prod-flow-venue" class="price-input" style="width:100%;margin-top:4px;" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-flow-date-lbl"></label><input type="date" id="prod-flow-date" class="price-input" style="width:100%;margin-top:4px;" /></div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-flow-client-lbl"></label>' +
        '<input type="text" id="prod-flow-client" class="price-input" style="width:100%;margin-top:4px;" data-i18n-hold="prod-flow-client-ph" /></div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-flow-access-lbl"></label>' +
        '<input type="text" id="prod-flow-access" class="price-input" style="width:100%;margin-top:4px;" maxlength="500" autocomplete="off" data-i18n-hold="prod-flow-access-ph" /></div>' +
        '</div>' +
        '<div style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" class="btn-pill" id="prod-flow-apply-template" data-i18n="prod-flow-apply-tpl"></button>' +
        '<button type="button" class="btn-pill" id="prod-flow-add-row" data-i18n="prod-flow-add-block"></button>' +
        '<button type="button" class="btn primary" id="prod-flow-save" data-i18n="prod-flow-save"></button>' +
        '<button type="button" class="btn gold" id="prod-flow-pdf" data-i18n="prod-flow-pdf"></button>' +
        '<button type="button" class="btn gold" id="prod-flow-png" data-i18n="prod-flow-png"></button>' +
        '</div>' +
        '<p class="fineprint mdj-prod-time-hint" style="margin:14px 0 12px;line-height:1.45;" data-i18n="prod-flow-time-hint"></p>' +
        '<div id="prod-flow-table-wrap" class="mdj-prod-timeline-host"></div>' +
        '<div id="prod-flow-msg" class="fineprint" style="margin-top:10px;color:var(--admin-accent);min-height:1.2em;"></div>' +
        '<h4 style="margin:22px 0 8px;color:var(--gold);" data-i18n="prod-flow-list-h"></h4><div id="prod-flow-list" class="fineprint"></div>' +
        '</div>' +
        '<div id="prod-panel-inv" style="display:block;">' +
        '<p class="fineprint" style="margin-top:0;line-height:1.55;" data-i18n="prod-inv-intro"></p>' +
        '<p class="fineprint mdj-prod-inv-calc-hint" style="margin:10px 0 12px;line-height:1.5;opacity:0.92;" data-i18n="prod-inv-calc-hint"></p>' +
        '<details class="mdj-prod-inv-moretools fineprint" style="margin:0 0 16px;opacity:0.88;">' +
        '<summary class="mdj-prod-inv-moretools-sum" data-i18n="prod-inv-more-tools-sum"></summary>' +
        '<div class="mdj-prod-inv-moretools-body" style="margin-top:10px;line-height:1.55;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.25);" data-i18n="prod-inv-more-tools-body"></div>' +
        '</details>' +
        '<div class="mdj-prod-inv-box mdj-prod-inv-box--info">' +
        '<p class="fineprint mdj-prod-inv-box-title" data-i18n="prod-inv-box-info-title"></p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
        '<details class="mdj-prod-inv-create-client fineprint" style="grid-column:1/-1;margin:0 0 8px;opacity:0.92;" open>' +
        '<summary style="cursor:pointer;color:var(--gold);font-weight:700;" data-i18n="prod-inv-create-account-sum"></summary>' +
        '<div style="margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.22);">' +
        '<p class="fineprint" style="margin:0 0 10px;line-height:1.45;" data-i18n="prod-inv-create-account-help"></p>' +
        '<label class="fineprint" style="display:flex;align-items:flex-start;gap:8px;margin:0 0 12px;">' +
        '<input type="checkbox" id="prod-inv-client-auth-ok" style="margin-top:2px;flex-shrink:0;" />' +
        '<span data-i18n="prod-inv-create-account-auth"></span></label>' +
        '<label class="fineprint" data-i18n="prod-inv-create-account-email-lbl"></label>' +
        '<input type="email" id="prod-inv-new-client-email" class="price-input" style="width:100%;margin-top:4px;" maxlength="120" autocomplete="email" data-i18n-hold="prod-inv-create-account-email-ph" />' +
        '<label class="fineprint" style="display:block;margin-top:10px;" data-i18n="prod-inv-create-account-name-lbl"></label>' +
        '<input type="text" id="prod-inv-new-client-name" class="price-input" style="width:100%;margin-top:4px;" maxlength="120" autocomplete="name" data-i18n-hold="prod-inv-create-account-name-ph" />' +
        '<button type="button" class="btn secondary small" id="prod-inv-create-account" style="margin-top:12px;" data-i18n="prod-inv-create-account-btn"></button>' +
        '<div id="prod-inv-create-account-msg" class="fineprint" style="margin-top:10px;min-height:1.2em;color:var(--admin-accent);white-space:pre-wrap;"></div>' +
        '</div></details>' +
        '<div><label class="fineprint" data-i18n="prod-inv-client-phone-lbl"></label>' +
        '<input type="tel" id="prod-inv-client-phone" class="price-input" style="width:100%;margin-top:4px;" maxlength="40" autocomplete="tel" data-i18n-hold="prod-inv-client-phone-ph" /></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-client-email-lbl"></label>' +
        '<input type="email" id="prod-inv-client-email" class="price-input" style="width:100%;margin-top:4px;" maxlength="120" autocomplete="email" data-i18n-hold="prod-inv-client-email-ph" /></div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-inv-buyer-name-lbl"></label>' +
        '<input type="text" id="prod-inv-buyer-name" class="price-input" style="width:100%;margin-top:4px;" autocomplete="name" /></div>' +
        '<div style="grid-column:1/-1;"><label class="fineprint" data-i18n="prod-inv-client-lbl"></label>' +
        '<input type="text" id="prod-inv-client" class="price-input" style="width:100%;margin-top:4px;" required autocomplete="off" spellcheck="false" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" title="Auth user UUID (36 characters) — required to save" /></div>' +
        '<details class="mdj-prod-inv-company fineprint" style="grid-column:1/-1;margin:0;opacity:0.92;">' +
        '<summary class="mdj-prod-inv-company-sum" style="cursor:pointer;color:var(--gold);font-weight:700;" data-i18n="prod-inv-company-section-sum"></summary>' +
        '<div style="margin-top:10px;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.22);">' +
        '<label class="fineprint" data-i18n="prod-inv-company-name-lbl"></label>' +
        '<input type="text" id="prod-inv-company-name" class="price-input" style="width:100%;margin-top:4px;" data-i18n-hold="prod-inv-company-ph" autocomplete="organization" />' +
        '</div></details>' +
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
        '<p class="fineprint" style="margin:4px 0 0;font-size:11px;opacity:0.5;line-height:1.35;" data-i18n="prod-inv-addr-state-hint"></p>' +
        '</div>' +
        '<div id="prod-inv-bill-wrap-state-intl" style="display:none;">' +
        '<label class="fineprint" data-i18n="prod-inv-addr-state-intl-lbl"></label>' +
        '<input type="text" id="prod-inv-bill-input-state-intl" class="price-input" style="width:100%;margin-top:4px;" />' +
        '</div></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-zip-lbl"></label>' +
        '<input type="text" id="prod-inv-bill-zip" class="price-input" style="width:100%;margin-top:4px;" maxlength="12" autocomplete="postal-code" />' +
        '<p class="fineprint" style="margin:4px 0 0;font-size:11px;opacity:0.5;line-height:1.35;" data-i18n="prod-inv-addr-zip-hint"></p></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-country-lbl"></label>' +
        '<select id="prod-inv-bill-select-country" class="price-input" style="width:100%;margin-top:4px;" aria-label="Country"></select></div>' +
        '</div></div>' +
        '<div style="grid-column:1/-1;" class="mdj-prod-addr-section">' +
        '<p class="fineprint mdj-prod-addr-section-title" data-i18n="prod-inv-event-section"></p>' +
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
        '<p class="fineprint" style="margin:4px 0 0;font-size:11px;opacity:0.5;line-height:1.35;" data-i18n="prod-inv-addr-state-hint"></p>' +
        '</div>' +
        '<div id="prod-inv-ev-wrap-state-intl" style="display:none;">' +
        '<label class="fineprint" data-i18n="prod-inv-addr-state-intl-lbl"></label>' +
        '<input type="text" id="prod-inv-ev-input-state-intl" class="price-input" style="width:100%;margin-top:4px;" />' +
        '</div></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-zip-lbl"></label>' +
        '<input type="text" id="prod-inv-ev-zip" class="price-input" style="width:100%;margin-top:4px;" maxlength="12" autocomplete="postal-code" />' +
        '<p class="fineprint" style="margin:4px 0 0;font-size:11px;opacity:0.5;line-height:1.35;" data-i18n="prod-inv-addr-zip-hint"></p></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-addr-country-lbl"></label>' +
        '<select id="prod-inv-ev-select-country" class="price-input" style="width:100%;margin-top:4px;" aria-label="Country"></select></div>' +
        '</div></div>' +
        '</div></div>' +
        '<div class="mdj-prod-inv-box mdj-prod-inv-box--quote">' +
        '<p class="fineprint mdj-prod-inv-box-title" data-i18n="prod-inv-box-quote-title"></p>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
        '<div><label class="fineprint" data-i18n="prod-inv-type-lbl"></label><select id="prod-inv-kind" class="price-input" style="width:100%;margin-top:4px;">' +
        '<option value="quote" data-i18n="prod-doc-quote"></option>' +
        '<option value="invoice" data-i18n="prod-doc-invoice"></option></select></div>' +
        '<div><label class="fineprint" data-i18n="prod-inv-tax-lbl"></label><input type="number" id="prod-inv-tax" class="price-input" style="width:100%;margin-top:4px;" value="7" step="0.01" min="0" max="100" /></div>' +
        '</div>' +
        '<div style="margin:0 0 12px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<button type="button" class="btn-pill" id="prod-inv-add-line" data-i18n="prod-inv-add-line"></button>' +
        '<button type="button" class="btn primary" id="prod-inv-save" data-i18n="prod-inv-save"></button>' +
        '<button type="button" class="btn gold" id="prod-inv-open-print" data-i18n="prod-inv-print"></button>' +
        '</div>' +
        '<div id="prod-inv-lines"></div>' +
        '<div id="prod-inv-summary-card" class="mdj-prod-inv-summary-card" aria-live="polite"></div>' +
        '<div id="prod-inv-msg" class="fineprint" style="margin-top:8px;color:var(--admin-accent);"></div>' +
        '<h4 style="margin:22px 0 8px;color:var(--gold);" data-i18n="prod-inv-list-h"></h4><div id="prod-inv-list" class="fineprint"></div>' +
        '</div>' +
        '</div>' +
        '</div>'
      );
    },

    _bind: function () {
      var self = this;
      document.querySelectorAll('[data-prod-tab]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = b.getAttribute('data-prod-tab');
          document.querySelectorAll('[data-prod-tab]').forEach(function (x) {
            var on = x === b;
            x.classList.toggle('mdj-prod-tab--active', on);
            x.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          document.getElementById('prod-panel-flow').style.display = t === 'flow' ? 'block' : 'none';
          document.getElementById('prod-panel-inv').style.display = t === 'inv' ? 'block' : 'none';
        });
      });
      document.getElementById('prod-flow-apply-template').onclick = function () {
        self._renderFlowTable();
      };
      document.getElementById('prod-flow-add-row').onclick = function () {
        self._flowRows.push({ id: 'b_' + Date.now(), start: '', end: '', title: '', actions: '', notes: '' });
        self._renderFlowTable();
      };
      document.getElementById('prod-flow-save').onclick = function () {
        void self._saveFlow();
      };
      document.getElementById('prod-flow-pdf').onclick = function () {
        self._pushFlowPrint();
        window.open('./event-flow-print.html', '_blank', 'noopener');
      };
      document.getElementById('prod-flow-png').onclick = function () {
        self._pushFlowPrint();
        window.open('./event-flow-print.html', '_blank', 'noopener');
      };
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
      document.getElementById('prod-inv-open-print').onclick = function () {
        self._pushInvoicePrint();
        window.open('./staff-invoice-print.html', '_blank', 'noopener');
      };
      if (typeof global.mdjInitProductionInvAddressBlocks === 'function') {
        global.mdjInitProductionInvAddressBlocks();
      }
      var createAcctBtn = document.getElementById('prod-inv-create-account');
      if (createAcctBtn) {
        createAcctBtn.onclick = function () {
          void self._createClientAccountFromPanel();
        };
      }
      this._flowRows = global.mdjCloneDefaultBlocksForType('wedding');
      this._invLines = [{ desc: prodT('prod-inv-default-line'), qty: 1, unit: 0 }];
      this._renderFlowTable();
      this._renderInvLines();
    },

    _flowRows: [],
    _invLines: [],

    _renderFlowTable: function () {
      var type = document.getElementById('prod-flow-type').value;
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
              '<td><button type="button" class="btn-pill red" data-del-inv="' +
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
      var cuid = document.getElementById('prod-inv-client').value.trim();
      if (!/^[0-9a-f-]{36}$/i.test(cuid)) {
        msg.style.color = '#ff5555';
        msg.textContent = prodT('prod-msg-invalid-uuid');
        return;
      }
      this._updateInvTotal();
      var t = this._lastInvTotals;
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
        client_user_id: cuid,
        lead_id: null,
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
      msg.style.color = 'var(--admin-accent)';
      msg.textContent = prodT('prod-msg-saved-inv');
      void this._refreshLists();
    },

    _pushInvoicePrint: function () {
      this._updateInvTotal();
      var t = this._lastInvTotals;
      var lines = this._invLines.map(function (L) {
        return { desc: L.desc, qty: Number(L.qty) || 0, unit: Number(L.unit) || 0 };
      });
      var o = {
        v: 1,
        ref: '#MDJ-' + String(Date.now()).slice(-8),
        dateStr: new Date().toLocaleDateString(),
        clientLabel: document.getElementById('prod-inv-buyer-name').value.trim(),
        clientCompanyName: document.getElementById('prod-inv-company-name').value.trim(),
        clientPhone: (function () {
          var el = document.getElementById('prod-inv-client-phone');
          return el ? String(el.value || '').trim() : '';
        })(),
        clientEmail: (function () {
          var el = document.getElementById('prod-inv-client-email');
          return el ? String(el.value || '').trim() : '';
        })(),
        contactPhoneLabel: prodT('prod-inv-print-contact-phone'),
        contactEmailLabel: prodT('prod-inv-print-contact-email'),
        companyPrintPrefix: prodT('prod-inv-print-company-prefix'),
        docKind: document.getElementById('prod-inv-kind').value,
        lines: lines,
        subtotal: t.sub,
        taxPct: t.taxPct,
        taxAmt: t.taxAmt,
        total: t.total,
        billingAddress: formatInvAddrLines('bill') || '',
        eventAddress: formatInvAddrLines('ev') || '',
        notes: ''
      };
      try {
        sessionStorage.setItem(INV_PRINT_KEY, JSON.stringify(o));
      } catch (e) {}
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
      if (!authOk || !authOk.checked) {
        setMsg(prodT('prod-inv-create-err-auth'), true);
        return;
      }
      var newEmailEl = document.getElementById('prod-inv-new-client-email');
      var invEmailEl = document.getElementById('prod-inv-client-email');
      var email = (newEmailEl && newEmailEl.value.trim()) || (invEmailEl && invEmailEl.value.trim()) || '';
      if (!email) {
        setMsg(prodT('prod-inv-create-err-email'), true);
        return;
      }
      var nmEl = document.getElementById('prod-inv-new-client-name');
      var buyerEl = document.getElementById('prod-inv-buyer-name');
      var fullName =
        (nmEl && nmEl.value.trim()) || (buyerEl && buyerEl.value.trim()) || '';
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

    _refreshLists: async function () {
      var db = global.getSupabaseClient && global.getSupabaseClient();
      if (!db) return;
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
