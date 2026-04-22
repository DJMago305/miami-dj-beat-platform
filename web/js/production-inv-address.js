/**
 * Direcciones en Producción → Factura: mismo criterio que account-settings
 * (país, estado US con lista o texto internacional, pistas ZIP).
 * Requiere account-address-data.js (MDJ_COUNTRY_NAMES, MDJ_US_STATES, MDJ_ZIP_HINTS_US).
 */
(function (global) {
  'use strict';

  function el(id) {
    return document.getElementById(id);
  }

  function isUnitedStates(prefix) {
    var s = el('prod-inv-' + prefix + '-select-country');
    return s && s.value === 'United States';
  }

  function rebuildCountryOptions(selectId, preferredValue) {
    var sel = el(selectId);
    if (!sel) return;
    var all = global.MDJ_COUNTRY_NAMES || [];
    var prev = preferredValue != null ? preferredValue : sel.value;
    sel.innerHTML = '';
    all.forEach(function (name) {
      var o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });
    if (prev && Array.from(sel.options).some(function (o) { return o.value === prev; })) {
      sel.value = prev;
    } else if (Array.from(sel.options).some(function (o) { return o.value === 'United States'; })) {
      sel.value = 'United States';
    } else {
      sel.selectedIndex = 0;
    }
  }

  function populateUSStates(selectId) {
    var sel = el(selectId);
    if (!sel) return;
    var prev = sel.value;
    sel.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = '—';
    sel.appendChild(ph);
    (global.MDJ_US_STATES || []).forEach(function (st) {
      var o = document.createElement('option');
      o.value = st.code;
      o.textContent = st.name;
      sel.appendChild(o);
    });
    if (prev && Array.from(sel.options).some(function (o) { return o.value === prev; })) {
      sel.value = prev;
    }
  }

  function syncStateFields(prefix) {
    var us = isUnitedStates(prefix);
    var selUs = el('prod-inv-' + prefix + '-select-state-us');
    var intl = el('prod-inv-' + prefix + '-input-state-intl');
    var wrapUs = el('prod-inv-' + prefix + '-wrap-state-us');
    var wrapIntl = el('prod-inv-' + prefix + '-wrap-state-intl');
    if (selUs) {
      selUs.style.display = us ? '' : 'none';
      if (!us) selUs.value = '';
    }
    if (intl) {
      intl.style.display = us ? 'none' : '';
      if (us) intl.value = '';
    }
    if (wrapUs) wrapUs.style.display = us ? '' : 'none';
    if (wrapIntl) wrapIntl.style.display = us ? 'none' : '';
  }

  function attachUSStateSpeedFill(prefix) {
    var sel = el('prod-inv-' + prefix + '-select-state-us');
    if (!sel || sel.dataset.mdjSpeedFill === '1') return;
    sel.dataset.mdjSpeedFill = '1';
    var cycle = { letter: null, i: 0, t: 0 };
    sel.addEventListener('keydown', function (e) {
      if (!isUnitedStates(prefix)) return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key.length !== 1) return;
      var L = e.key.toLowerCase();
      if (L < 'a' || L > 'z') return;
      var states = global.MDJ_US_STATES || [];
      var matches = states.filter(function (st) {
        return st.name.charAt(0).toLowerCase() === L;
      });
      if (!matches.length) return;
      e.preventDefault();
      var now = Date.now();
      if (cycle.letter === L && now - cycle.t < 800) {
        cycle.i = (cycle.i + 1) % matches.length;
      } else {
        cycle.i = 0;
      }
      cycle.letter = L;
      cycle.t = now;
      sel.value = matches[cycle.i].code;
    });
  }

  function applyZipHint(prefix) {
    if (!isUnitedStates(prefix)) return;
    var zipEl = el('prod-inv-' + prefix + '-zip');
    var cityEl = el('prod-inv-' + prefix + '-city');
    var stateSel = el('prod-inv-' + prefix + '-select-state-us');
    if (!zipEl) return;
    var raw = zipEl.value.replace(/\D/g, '');
    if (raw.length < 5) return;
    var z5 = raw.slice(0, 5);
    var hints = global.MDJ_ZIP_HINTS_US || {};
    if (hints[z5]) {
      if (cityEl) cityEl.value = hints[z5].city;
      if (stateSel) stateSel.value = hints[z5].state;
      return;
    }
    if (/^331\d{2}$/.test(z5)) {
      if (cityEl) cityEl.value = 'Miami';
      if (stateSel) stateSel.value = 'FL';
    } else if (/^330\d{2}$/.test(z5) || /^332\d{2}$/.test(z5) || /^333\d{2}$/.test(z5) || /^334\d{2}$/.test(z5)) {
      if (cityEl && !String(cityEl.value || '').trim()) cityEl.value = 'Miami';
      if (stateSel) stateSel.value = 'FL';
    } else if (/^328\d{2}$/.test(z5)) {
      if (cityEl && !String(cityEl.value || '').trim()) cityEl.value = 'Orlando';
      if (stateSel) stateSel.value = 'FL';
    }
  }

  var zipTimers = { bill: null, ev: null };

  function initBlock(prefix) {
    if (!el('prod-inv-' + prefix + '-select-country')) return;
    if (!global.MDJ_US_STATES || !global.MDJ_COUNTRY_NAMES) return;

    populateUSStates('prod-inv-' + prefix + '-select-state-us');
    rebuildCountryOptions('prod-inv-' + prefix + '-select-country', 'United States');

    var ctry = el('prod-inv-' + prefix + '-select-country');
    if (ctry && ctry.dataset.mdjProdAddrInit !== '1') {
      ctry.dataset.mdjProdAddrInit = '1';
      ctry.addEventListener('change', function () {
        var cur = el('prod-inv-' + prefix + '-select-country')
          ? el('prod-inv-' + prefix + '-select-country').value
          : '';
        rebuildCountryOptions('prod-inv-' + prefix + '-select-country', cur);
        syncStateFields(prefix);
      });
    }

    var zip = el('prod-inv-' + prefix + '-zip');
    if (zip && zip.dataset.mdjProdZipInit !== '1') {
      zip.dataset.mdjProdZipInit = '1';
      zip.addEventListener('blur', function () {
        applyZipHint(prefix);
      });
      zip.addEventListener('change', function () {
        applyZipHint(prefix);
      });
      zip.addEventListener('input', function () {
        clearTimeout(zipTimers[prefix]);
        zipTimers[prefix] = setTimeout(function () {
          var z = el('prod-inv-' + prefix + '-zip');
          var d = (z && z.value) ? String(z.value).replace(/\D/g, '') : '';
          if (d.length >= 5) applyZipHint(prefix);
        }, 140);
      });
    }

    attachUSStateSpeedFill(prefix);
    syncStateFields(prefix);
  }

  global.mdjInitProductionInvAddressBlocks = function () {
    initBlock('bill');
    initBlock('ev');
  };
})(typeof window !== 'undefined' ? window : this);
