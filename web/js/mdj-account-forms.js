/**
 * Shared helpers: US phone display (NANP) + legal name split/join for account UI.
 * Used by login signup and account-settings.
 */
(function () {
  'use strict';

  function digitsOnly(s) {
    return String(s == null ? '' : s).replace(/\D/g, '');
  }

  /** Up to 10 US national digits; strips leading country code 1 when 11 digits. */
  function mdjNANPDigitsFromTel(value) {
    var d = digitsOnly(value);
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    return d.slice(0, 10);
  }

  /** Format 10 (or partial) digits as (305) 607-1780 */
  function mdjFormatNANPDisplay(nationalDigits) {
    var d = mdjNANPDigitsFromTel(nationalDigits);
    if (!d.length) return '';
    if (d.length <= 3) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6, 10);
  }

  function mdjSplitFullNameToParts(full) {
    var t = String(full == null ? '' : full).trim();
    if (!t) return { first: '', middle: '', last: '' };
    var parts = t.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first: parts[0], middle: '', last: '' };
    if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1] };
    return {
      first: parts[0],
      middle: parts.slice(1, -1).join(' '),
      last: parts[parts.length - 1]
    };
  }

  function mdjJoinFullNameFromParts(first, middle, last) {
    return [first, middle, last]
      .map(function (x) {
        return String(x == null ? '' : x).trim();
      })
      .filter(Boolean)
      .join(' ');
  }

  function mdjAttachPhoneUSFormatting(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.getAttribute('data-mdj-phone-us') === '1') return;
    el.setAttribute('data-mdj-phone-us', '1');
    if (!el.getAttribute('inputmode')) el.setAttribute('inputmode', 'tel');

    function sync() {
      var d = mdjNANPDigitsFromTel(el.value);
      var next = mdjFormatNANPDisplay(d);
      if (el.value !== next) el.value = next;
    }

    el.addEventListener('input', sync);
    el.addEventListener('blur', sync);
    sync();
  }

  window.mdjNANPDigitsFromTel = mdjNANPDigitsFromTel;
  window.mdjFormatNANPDisplay = mdjFormatNANPDisplay;
  window.mdjSplitFullNameToParts = mdjSplitFullNameToParts;
  window.mdjJoinFullNameFromParts = mdjJoinFullNameFromParts;
  window.mdjAttachPhoneUSFormatting = mdjAttachPhoneUSFormatting;
})();
