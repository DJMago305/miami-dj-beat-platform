/**
 * Smart country / state selectors + optional US ZIP hints (account-settings).
 * Depends on account-address-data.js (MDJ_COUNTRY_NAMES, MDJ_US_STATES, MDJ_ZIP_HINTS_US).
 */
(function () {
  'use strict';

  function el(id) {
    return document.getElementById(id);
  }

  function isUnitedStates() {
    var s = el('select-country');
    return s && s.value === 'United States';
  }

  function rebuildCountryOptions(filterVal, preferredValue) {
    var all = window.MDJ_COUNTRY_NAMES || [];
    var q = (filterVal || '').trim().toLowerCase();
    var list = !q ? all.slice() : all.filter(function (n) {
      return n.toLowerCase().indexOf(q) >= 0;
    });
    var sel = el('select-country');
    if (!sel) return;
    var prev = preferredValue != null ? preferredValue : sel.value;
    sel.innerHTML = '';
    if (list.length === 0) {
      var o0 = document.createElement('option');
      o0.value = '';
      o0.textContent = 'No matches';
      sel.appendChild(o0);
      return;
    }
    list.forEach(function (name) {
      var o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });
    if (prev && Array.from(sel.options).some(function (o) { return o.value === prev; })) {
      sel.value = prev;
    } else if (list.indexOf('United States') >= 0 && !q) {
      sel.value = 'United States';
    } else {
      sel.selectedIndex = 0;
    }
  }

  function populateUSStates() {
    var sel = el('select-state-us');
    if (!sel) return;
    sel.innerHTML = '';
    var ph = document.createElement('option');
    ph.value = '';
    ph.textContent = '— Select state —';
    sel.appendChild(ph);
    (window.MDJ_US_STATES || []).forEach(function (st) {
      var o = document.createElement('option');
      o.value = st.code;
      o.textContent = st.name;
      sel.appendChild(o);
    });
  }

  /** Letter keys jump to states by name (e.g. F → Florida; T → Tennessee, then T again → Texas). */
  var _mdjStateTypeCycle = { letter: null, i: 0, t: 0 };

  function attachUSStateSpeedFill() {
    var sel = el('select-state-us');
    if (!sel || sel.dataset.mdjSpeedFill === '1') return;
    sel.dataset.mdjSpeedFill = '1';
    sel.addEventListener('keydown', function (e) {
      if (!isUnitedStates()) return;
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key.length !== 1) return;
      var L = e.key.toLowerCase();
      if (L < 'a' || L > 'z') return;
      var states = window.MDJ_US_STATES || [];
      var matches = states.filter(function (st) {
        return st.name.charAt(0).toLowerCase() === L;
      });
      if (!matches.length) return;
      e.preventDefault();
      var now = Date.now();
      if (_mdjStateTypeCycle.letter === L && now - _mdjStateTypeCycle.t < 800) {
        _mdjStateTypeCycle.i = (_mdjStateTypeCycle.i + 1) % matches.length;
      } else {
        _mdjStateTypeCycle.i = 0;
      }
      _mdjStateTypeCycle.letter = L;
      _mdjStateTypeCycle.t = now;
      sel.value = matches[_mdjStateTypeCycle.i].code;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function syncStateFields() {
    var us = isUnitedStates();
    var selUs = el('select-state-us');
    var intl = el('input-state-intl');
    var wrapUs = el('wrap-state-us');
    var wrapIntl = el('wrap-state-intl');
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

  function normalizeUSStateToCode(raw) {
    if (!raw) return '';
    var s = String(raw).trim();
    if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
    var lower = s.toLowerCase();
    var found = (window.MDJ_US_STATES || []).filter(function (st) {
      return st.name.toLowerCase() === lower || st.code.toLowerCase() === lower;
    })[0];
    return found ? found.code : '';
  }

  window.mdjGetAddressCountryForSave = function () {
    var s = el('select-country');
    return s ? String(s.value || '').trim() : '';
  };

  window.mdjGetAddressStateForSave = function () {
    if (isUnitedStates()) {
      var sel = el('select-state-us');
      return sel ? String(sel.value || '').trim() : '';
    }
    var intl = el('input-state-intl');
    return intl ? String(intl.value || '').trim() : '';
  };

  /**
   * @param {object} addr — address_* and/or legacy flat keys from user_metadata
   */
  window.mdjHydrateAccountAddress = function (addr) {
    if (!addr) return;
    var country = addr.address_country || '';
    rebuildCountryOptions(el('input-country-filter') ? el('input-country-filter').value : '', country || 'United States');
    if (el('select-country')) {
      if (country && Array.from(el('select-country').options).some(function (o) { return o.value === country; })) {
        el('select-country').value = country;
      } else if (!country) {
        el('select-country').value = 'United States';
      }
    }
    syncStateFields();

    var st = addr.address_state || '';
    if (isUnitedStates()) {
      var code = normalizeUSStateToCode(st);
      if (el('select-state-us') && code) el('select-state-us').value = code;
    } else if (el('input-state-intl')) {
      el('input-state-intl').value = st || '';
    }

    if (el('input-street') && addr.address_street) el('input-street').value = addr.address_street;
    if (el('input-apt') && addr.address_apt) el('input-apt').value = addr.address_apt;
    if (el('input-city') && addr.address_city) el('input-city').value = addr.address_city;
    if (el('input-zip') && addr.address_zip) el('input-zip').value = addr.address_zip;

    syncStateFields();
  };

  var _zipHintTimer = null;

  function applyZipHint() {
    if (!isUnitedStates()) return;
    var zipEl = el('input-zip');
    var cityEl = el('input-city');
    var stateSel = el('select-state-us');
    if (!zipEl) return;
    var raw = zipEl.value.replace(/\D/g, '');
    if (raw.length < 5) return;
    var z5 = raw.slice(0, 5);

    var hints = window.MDJ_ZIP_HINTS_US || {};
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

  window.mdjInitAccountAddressSelectors = function () {
    populateUSStates();
    rebuildCountryOptions('', 'United States');

    var ctry = el('select-country');
    if (ctry) {
      ctry.addEventListener('change', function () {
        _mdjStateTypeCycle = { letter: null, i: 0, t: 0 };
        /* Evita dos «United States»: el filtro no debe quedar como segunda caja de valor */
        var filtClear = el('input-country-filter');
        if (filtClear) filtClear.value = '';
        var curVal = el('select-country') ? el('select-country').value : '';
        rebuildCountryOptions('', curVal);
        syncStateFields();
      });
    }

    var filt = el('input-country-filter');
    if (filt) {
      filt.addEventListener('input', function () {
        var cur = el('select-country') ? el('select-country').value : '';
        rebuildCountryOptions(filt.value, cur);
        syncStateFields();
      });
    }

    var zip = el('input-zip');
    if (zip) {
      zip.addEventListener('blur', applyZipHint);
      zip.addEventListener('change', applyZipHint);
      zip.addEventListener('input', function () {
        clearTimeout(_zipHintTimer);
        _zipHintTimer = setTimeout(function () {
          var d = (el('input-zip').value || '').replace(/\D/g, '');
          if (d.length >= 5) applyZipHint();
        }, 140);
      });
    }

    attachUSStateSpeedFill();

    syncStateFields();
  };
})();
