/**
 * Client account settings — client_profiles only (no dj_profiles / artist mix).
 */
(function () {
  'use strict';

  function db() {
    return typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
  }

  function fnUrl(name) {
    return typeof window.mdbSupabaseFunctionUrl === 'function' ? window.mdbSupabaseFunctionUrl(name) : '';
  }

  function edgeInvokeHeaders(session) {
    var key = typeof window.MDB_SUPABASE_ANON_KEY === 'string' ? window.MDB_SUPABASE_ANON_KEY : '';
    var headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + ((session && session.access_token) || ''),
    };
    if (key) headers.apikey = key;
    return headers;
  }

  function edgeFnError(data, res, fallback) {
    var msg = (data && (data.error || data.message)) || (res && res.statusText) || fallback || 'Request failed';
    if (data && data.code === 'NOT_FOUND') {
      return t('client-account-billing-fn-missing', 'Payment service is not deployed yet. Contact support or try again later.');
    }
    return msg;
  }

  function t(key, fallback) {
    try {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var v = window.i18n.t(key);
        if (v && v !== key) return v;
      }
    } catch (e) { /* ignore */ }
    return fallback || key;
  }

  function setStatus(el, msg, ok) {
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = ok ? 'var(--gold)' : '#f88';
    el.style.display = msg ? 'block' : 'none';
  }

  function setAvatarHtml(el, url) {
    if (!el) return;
    if (url) {
      el.innerHTML =
        '<img src="' + String(url).replace(/"/g, '&quot;') + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />';
    }
  }

  function displayNameFromFields() {
    var join =
      typeof window.mdjJoinFullNameFromParts === 'function'
        ? window.mdjJoinFullNameFromParts
        : function (a, b, c) {
            return [a, b, c].filter(Boolean).join(' ');
          };
    return join(
      (document.getElementById('ca-name-first') || {}).value,
      (document.getElementById('ca-name-middle') || {}).value,
      (document.getElementById('ca-name-last') || {}).value,
    );
  }

  function syncOverview(session) {
    var email = (session && session.user && session.user.email) || (document.getElementById('ca-email') || {}).value || '';
    var name = displayNameFromFields() || email.split('@')[0] || '—';
    var el;
    if ((el = document.getElementById('ca-overview-name'))) el.textContent = name;
    if ((el = document.getElementById('ca-overview-email'))) el.textContent = email || '—';
    if ((el = document.getElementById('ca-profile-email-display'))) el.textContent = email || '—';
    if ((el = document.getElementById('ca-sidebar-name'))) el.textContent = name;
    if ((el = document.getElementById('ca-sidebar-email'))) el.textContent = email || '—';
  }

  function applyAvatarAll(url) {
    setAvatarHtml(document.getElementById('ca-sidebar-avatar'), url);
    setAvatarHtml(document.getElementById('ca-overview-avatar'), url);
    setAvatarHtml(document.getElementById('ca-profile-avatar'), url);
  }

  function switchPanel(panelId, opts) {
    opts = opts || {};
    document.querySelectorAll('.ca-panel[data-ca-panel]').forEach(function (el) {
      var on = el.getAttribute('data-ca-panel') === panelId;
      el.classList.toggle('is-active', on);
      if (on) el.removeAttribute('hidden');
      else el.setAttribute('hidden', '');
    });
    document.querySelectorAll('.ca-nav button[data-ca-panel]').forEach(function (btn) {
      var on = btn.getAttribute('data-ca-panel') === panelId;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var profilePanel = document.getElementById('ca-panel-profile');
    if (profilePanel) {
      var nameOnly = panelId === 'profile' && opts.scope === 'name';
      profilePanel.classList.toggle('ca-profile-panel--name-only', nameOnly);
      var profileTitle = profilePanel.querySelector('h1');
      if (profileTitle && panelId === 'profile') {
        if (nameOnly) {
          profileTitle.setAttribute('data-i18n', 'client-account-overview-name');
          profileTitle.textContent = t('client-account-overview-name', 'Display name');
        } else {
          profileTitle.setAttribute('data-i18n', 'client-account-nav-profile');
          profileTitle.textContent = t('client-account-nav-profile', 'Profile');
        }
      }
    }
  }

  function goToOverview() {
    switchPanel('overview');
    var main = document.querySelector('.ca-main');
    if (main && main.scrollIntoView) {
      try {
        main.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) {
        main.scrollIntoView(true);
      }
    }
  }

  function wireCancelOverview() {
    document.querySelectorAll('.ca-cancel-overview').forEach(function (btn) {
      btn.addEventListener('click', function () {
        goToOverview();
      });
    });
  }

  function wirePanelNav() {
    document.querySelectorAll('.ca-nav button[data-ca-panel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = btn.getAttribute('data-ca-panel') || 'overview';
        switchPanel(panel, panel === 'profile' ? { scope: 'full' } : {});
        if (panel === 'profile') {
          enableProfileFields();
          var ph = document.getElementById('ca-phone');
          if (ph && typeof window.mdjAttachPhoneUSFormatting === 'function') {
            window.mdjAttachPhoneUSFormatting(ph);
          }
        }
        if (panel === 'payments' && caSession) {
          enableBillingFields();
          loadPaymentMethods(caSession);
        }
      });
    });
    document.querySelectorAll('[data-ca-goto]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var panel = btn.getAttribute('data-ca-goto') || 'overview';
        var scope = btn.getAttribute('data-ca-goto-scope') || 'full';
        switchPanel(panel, { scope: scope });
        if (panel === 'profile') {
          enableProfileFields();
          var ph = document.getElementById('ca-phone');
          if (ph && typeof window.mdjAttachPhoneUSFormatting === 'function') {
            window.mdjAttachPhoneUSFormatting(ph);
          }
        }
        if (panel === 'payments' && caSession) {
          enableBillingFields();
          loadPaymentMethods(caSession);
        }
      });
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMoney(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v);
    } catch (e) {
      return '$' + v.toFixed(2);
    }
  }

  function formatEventDate(raw) {
    if (!raw) return '—';
    var d = new Date(raw);
    if (isNaN(d.getTime())) return String(raw);
    try {
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e2) {
      return String(raw);
    }
  }

  function leadIsPlanned(lead) {
    if (!lead || !lead.event_date) return true;
    var d = new Date(lead.event_date);
    if (isNaN(d.getTime())) return true;
    d.setHours(0, 0, 0, 0);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() >= today.getTime();
  }

  function leadIsPast(lead) {
    if (!lead || !lead.event_date) return false;
    var d = new Date(lead.event_date);
    if (isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }

  async function fetchAllClientLeads(session) {
    var client = db();
    if (!client || !session || !session.user) return [];
    var uid = session.user.id;
    var emailNorm = session.user.email ? String(session.user.email).trim().toLowerCase() : '';
    var cols =
      'id,email,client_user_id,event_type,event_date,location,status,created_at,payment_status,balance_paid,total_amount';
    var seen = {};
    var rows = [];
    function absorb(data) {
      (data || []).forEach(function (row) {
        if (row && row.id && !seen[row.id]) {
          seen[row.id] = true;
          rows.push(row);
        }
      });
    }
    if (uid) {
      var r1 = await client.from('leads').select(cols).eq('client_user_id', uid).order('event_date', { ascending: false }).limit(50);
      absorb(r1.data);
    }
    if (emailNorm) {
      var r2 = await client.from('leads').select(cols).ilike('email', emailNorm).order('event_date', { ascending: false }).limit(50);
      absorb(r2.data);
    }
    return rows;
  }

  function renderEventsRows(leads) {
    return leads
      .map(function (lead) {
        var total = lead.total_amount;
        var paid = lead.balance_paid;
        var balance =
          total != null && paid != null && isFinite(Number(total)) && isFinite(Number(paid))
            ? Number(total) - Number(paid)
            : null;
        var href = './client-portal.html?lead=' + encodeURIComponent(lead.id);
        return (
          '<tr>' +
          '<td>' +
          escapeHtml(lead.event_type || '—') +
          '</td>' +
          '<td>' +
          escapeHtml(formatEventDate(lead.event_date)) +
          '</td>' +
          '<td>' +
          escapeHtml(lead.location || '—') +
          '</td>' +
          '<td>' +
          escapeHtml(lead.status || '—') +
          '</td>' +
          '<td>' +
          escapeHtml(lead.payment_status || '—') +
          '</td>' +
          '<td class="ca-events-num">' +
          escapeHtml(formatMoney(total)) +
          '</td>' +
          '<td class="ca-events-num">' +
          escapeHtml(formatMoney(paid)) +
          '</td>' +
          '<td class="ca-events-num">' +
          escapeHtml(formatMoney(balance)) +
          '</td>' +
          '<td><a href="' +
          href +
          '">' +
          escapeHtml(t('client-account-events-open', 'Open')) +
          '</a></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function sortPlanned(a, b) {
    var da = a && a.event_date ? new Date(a.event_date).getTime() : Infinity;
    var db2 = b && b.event_date ? new Date(b.event_date).getTime() : Infinity;
    return da - db2;
  }

  function sortPast(a, b) {
    var da = a && a.event_date ? new Date(a.event_date).getTime() : 0;
    var db2 = b && b.event_date ? new Date(b.event_date).getTime() : 0;
    return db2 - da;
  }

  async function loadClientEventTables(session) {
    var plannedBody = document.getElementById('ca-events-tbody');
    var pastBody = document.getElementById('ca-past-events-tbody');
    var loading =
      '<tr class="ca-events-empty"><td colspan="9">' +
      escapeHtml(t('client-account-events-loading', 'Loading events…')) +
      '</td></tr>';
    if (plannedBody) plannedBody.innerHTML = loading;
    if (pastBody) pastBody.innerHTML = loading;
    try {
      var all = await fetchAllClientLeads(session);
      var planned = all.filter(leadIsPlanned).sort(sortPlanned);
      var past = all.filter(leadIsPast).sort(sortPast);
      if (plannedBody) {
        plannedBody.innerHTML = planned.length
          ? renderEventsRows(planned)
          : '<tr class="ca-events-empty"><td colspan="9">' +
            escapeHtml(t('client-account-events-empty', 'No planned events linked to this account yet.')) +
            '</td></tr>';
      }
      if (pastBody) {
        pastBody.innerHTML = past.length
          ? renderEventsRows(past)
          : '<tr class="ca-events-empty"><td colspan="9">' +
            escapeHtml(t('client-account-past-events-empty', 'No past events linked to this account yet.')) +
            '</td></tr>';
      }
    } catch (e) {
      var err =
        '<tr class="ca-events-empty"><td colspan="9">' +
        escapeHtml(t('client-account-events-error', 'Could not load events.')) +
        '</td></tr>';
      if (plannedBody) plannedBody.innerHTML = err;
      if (pastBody) pastBody.innerHTML = err;
    }
  }

  function resolveLoyaltyTier(eventCount) {
    var count = Number(eventCount) || 0;
    if (count >= 10) {
      return { icon: '💎', name: t('client-account-rewards-tier-diamond', 'Diamond Partner') };
    }
    if (count >= 5) {
      return { icon: '🏆', name: t('client-account-rewards-tier-gold', 'Gold Partner') };
    }
    if (count >= 2) {
      return { icon: '🥈', name: t('client-account-rewards-tier-silver', 'Silver Member') };
    }
    return { icon: '🌱', name: t('client-account-rewards-tier-new', 'New Client') };
  }

  function settingsToMap(rows) {
    var map = {};
    (rows || []).forEach(function (row) {
      if (row && row.key) map[row.key] = row.value;
    });
    return map;
  }

  async function loadRewards(session) {
    var tbody = document.getElementById('ca-rewards-tbody');
    var tierBox = document.getElementById('ca-rewards-tier');
    if (!tbody) return;
    tbody.innerHTML =
      '<tr class="ca-events-empty"><td colspan="4">' +
      escapeHtml(t('client-account-rewards-loading', 'Loading offers…')) +
      '</td></tr>';
    try {
      var client = db();
      if (!client || !session || !session.user) throw new Error('No session');
      var uid = session.user.id;
      var cpRes = await client
        .from('client_profiles')
        .select('loyalty_points,total_events_booked,discount_eligible,source_ref')
        .eq('user_id', uid)
        .maybeSingle();
      var cp = (cpRes && cpRes.data) || {};
      var settingsRes = await client
        .from('platform_settings')
        .select('key,value')
        .in('key', ['seasonal_qr_active', 'seasonal_qr_title', 'seasonal_qr_subtitle', 'seasonal_qr_url']);
      var settings = settingsToMap(settingsRes && settingsRes.data);

      var eventCount = Number(cp.total_events_booked) || 0;
      var tier = resolveLoyaltyTier(eventCount);
      if (tierBox) {
        tierBox.hidden = false;
        var iconEl = document.getElementById('ca-rewards-tier-icon');
        var nameEl = document.getElementById('ca-rewards-tier-name');
        var metaEl = document.getElementById('ca-rewards-tier-meta');
        if (iconEl) iconEl.textContent = tier.icon;
        if (nameEl) nameEl.textContent = tier.name;
        if (metaEl) {
          metaEl.textContent =
            ' · ' +
            t('client-account-rewards-events-count', '{count} events').replace('{count}', String(eventCount));
        }
      }

      var offers = [];
      if (settings.seasonal_qr_active === 'true') {
        offers.push({
          title: settings.seasonal_qr_title || t('client-account-rewards-seasonal-title', 'Seasonal promotion'),
          benefit: settings.seasonal_qr_subtitle || t('client-account-rewards-seasonal-benefit', 'Limited-time offer'),
          link: settings.seasonal_qr_url || '',
          status: t('client-account-rewards-status-active', 'Active'),
        });
      }
      if (eventCount > 0) {
        offers.push({
          title: t('client-account-rewards-loyalty-title', 'Official Client benefit'),
          benefit: t('client-account-rewards-loyalty-benefit', '5% off services on your event cart'),
          code: t('client-account-rewards-auto-applied', 'Auto-applied'),
          status: t('client-account-rewards-status-active', 'Active'),
        });
      }
      if (cp.discount_eligible !== false) {
        offers.push({
          title: t('client-account-rewards-referral-title', 'Referral welcome credit'),
          benefit: t('client-account-rewards-referral-benefit', 'Up to $30 off your first referred purchase'),
          code: cp.source_ref ? String(cp.source_ref) : '—',
          status: t('client-account-rewards-status-eligible', 'Eligible'),
        });
      }

      if (!offers.length) {
        tbody.innerHTML =
          '<tr class="ca-events-empty"><td colspan="4">' +
          escapeHtml(t('client-account-rewards-empty', 'No active offers right now. Check back for new coupons and promotions.')) +
          '</td></tr>';
        return;
      }

      tbody.innerHTML = offers
        .map(function (offer) {
          var codeCell = '—';
          if (offer.link) {
            codeCell =
              '<a href="' +
              escapeHtml(offer.link).replace(/"/g, '&quot;') +
              '" target="_blank" rel="noopener noreferrer">' +
              escapeHtml(t('client-account-rewards-open-offer', 'Open offer')) +
              '</a>';
          } else if (offer.code) {
            codeCell = escapeHtml(offer.code);
          }
          return (
            '<tr>' +
            '<td>' +
            escapeHtml(offer.title) +
            '</td>' +
            '<td>' +
            escapeHtml(offer.benefit) +
            '</td>' +
            '<td>' +
            codeCell +
            '</td>' +
            '<td>' +
            escapeHtml(offer.status) +
            '</td>' +
            '</tr>'
          );
        })
        .join('');
    } catch (e) {
      tbody.innerHTML =
        '<tr class="ca-events-empty"><td colspan="4">' +
        escapeHtml(t('client-account-rewards-error', 'Could not load offers.')) +
        '</td></tr>';
    }
  }

  function normalizeCountryLabel(raw) {
    var c = String(raw || '').trim();
    if (!c || c === 'US' || c === 'USA') return 'United States';
    return c;
  }

  function enableProfileFields() {
    [
      'ca-name-first',
      'ca-name-middle',
      'ca-name-last',
      'ca-username',
      'ca-phone',
      'input-street',
      'input-apt',
      'input-city',
      'input-zip',
      'select-state-us',
      'input-state-intl',
      'select-country',
    ].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.disabled = false;
      node.readOnly = false;
      node.removeAttribute('aria-disabled');
    });
  }

  function enableBillingFields() {
    [
      'ca-billing-name-on-card',
      'billing-input-street',
      'billing-input-apt',
      'billing-input-city',
      'billing-input-zip',
      'billing-select-state-us',
      'billing-input-state-intl',
      'billing-select-country',
      'ca-billing-differs',
    ].forEach(function (id) {
      var node = document.getElementById(id);
      if (!node) return;
      node.disabled = false;
      node.readOnly = false;
      node.removeAttribute('aria-disabled');
    });
  }

  function billingEl(id) {
    return document.getElementById(id);
  }

  function billingIsUnitedStates() {
    var s = billingEl('billing-select-country');
    return s && s.value === 'United States';
  }

  function billingSyncStateFields() {
    var us = billingEl('billing-wrap-state-us');
    var intl = billingEl('billing-wrap-state-intl');
    if (billingIsUnitedStates()) {
      if (us) us.style.display = '';
      if (intl) intl.style.display = 'none';
    } else {
      if (us) us.style.display = 'none';
      if (intl) intl.style.display = '';
    }
  }

  function billingRebuildCountryOptions(preferredValue) {
    var all = window.MDJ_COUNTRY_NAMES || [];
    var sel = billingEl('billing-select-country');
    if (!sel) return;
    var prev = preferredValue != null ? preferredValue : sel.value;
    sel.innerHTML = '';
    all.forEach(function (name) {
      var o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });
    if (prev && Array.from(sel.options).some(function (o) {
      return o.value === prev;
    })) {
      sel.value = prev;
    } else if (all.indexOf('United States') >= 0) {
      sel.value = 'United States';
    }
  }

  function billingPopulateUSStates() {
    var sel = billingEl('billing-select-state-us');
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

  function initBillingAddressSelectors() {
    billingPopulateUSStates();
    billingRebuildCountryOptions('United States');
    var ctry = billingEl('billing-select-country');
    if (ctry && ctry.dataset.mdjBillingInit !== '1') {
      ctry.dataset.mdjBillingInit = '1';
      ctry.addEventListener('change', function () {
        billingRebuildCountryOptions(ctry.value);
        billingSyncStateFields();
      });
    }
    billingSyncStateFields();
  }

  function hydrateBillingAddress(addr) {
    if ((billingEl('billing-input-street'))) billingEl('billing-input-street').value = addr.street || '';
    if ((billingEl('billing-input-apt'))) billingEl('billing-input-apt').value = addr.apt || '';
    if ((billingEl('billing-input-city'))) billingEl('billing-input-city').value = addr.city || '';
    if ((billingEl('billing-input-zip'))) billingEl('billing-input-zip').value = addr.zip || '';
    billingRebuildCountryOptions(normalizeCountryLabel(addr.country));
    if (billingEl('billing-select-country')) {
      billingEl('billing-select-country').value = normalizeCountryLabel(addr.country);
    }
    billingSyncStateFields();
    var st = addr.state || '';
    if (billingIsUnitedStates()) {
      if (billingEl('billing-select-state-us')) billingEl('billing-select-state-us').value = st;
    } else if (billingEl('billing-input-state-intl')) {
      billingEl('billing-input-state-intl').value = st;
    }
  }

  function billingStateForSave() {
    if (billingIsUnitedStates()) {
      var sel = billingEl('billing-select-state-us');
      return sel ? String(sel.value || '').trim() : '';
    }
    var intl = billingEl('billing-input-state-intl');
    return intl ? String(intl.value || '').trim() : '';
  }

  function billingCountryForSave() {
    var sel = billingEl('billing-select-country');
    return sel ? String(sel.value || '').trim() : '';
  }

  function billingDiffersFromHome() {
    var cb = document.getElementById('ca-billing-differs');
    return !!(cb && cb.checked);
  }

  function syncBillingAddressPanel() {
    var block = document.getElementById('ca-billing-address-block');
    if (block) block.hidden = !billingDiffersFromHome();
  }

  function wireBillingAddressToggle() {
    var cb = document.getElementById('ca-billing-differs');
    if (!cb || cb.dataset.mdjWired === '1') return;
    cb.dataset.mdjWired = '1';
    cb.addEventListener('change', syncBillingAddressPanel);
  }

  function initProfileAddressSelectors() {
    if (typeof window.mdjInitAccountAddressSelectors === 'function') {
      window.mdjInitAccountAddressSelectors();
    }
  }

  function hydrateProfileAddress(addr) {
    if (typeof window.mdjHydrateAccountAddress === 'function') {
      window.mdjHydrateAccountAddress({
        address_street: addr.street || '',
        address_apt: addr.apt || '',
        address_city: addr.city || '',
        address_state: addr.state || '',
        address_zip: addr.zip || '',
        address_country: normalizeCountryLabel(addr.country),
      });
      return;
    }
    var el;
    if ((el = document.getElementById('input-street'))) el.value = addr.street || '';
    if ((el = document.getElementById('input-apt'))) el.value = addr.apt || '';
    if ((el = document.getElementById('input-city'))) el.value = addr.city || '';
    if ((el = document.getElementById('input-zip'))) el.value = addr.zip || '';
    if ((el = document.getElementById('select-country'))) el.value = normalizeCountryLabel(addr.country);
    if ((el = document.getElementById('select-state-us'))) el.value = addr.state || '';
    if ((el = document.getElementById('input-state-intl'))) el.value = addr.state || '';
  }

  function normalizeUsername(s) {
    if (s == null) return null;
    var t0 = String(s).trim().replace(/^@+/, '');
    return t0 || null;
  }

  async function upsertClientProfile(uid, data, email, meta) {
    var client = db();
    if (!client) throw new Error('No database');
    var existing = null;
    try {
      var er = await client.from('client_profiles').select('*').eq('user_id', uid).maybeSingle();
      existing = er && er.data ? er.data : null;
    } catch (e) { /* ignore */ }

    var row = Object.assign({}, existing || {}, {
      user_id: uid,
      full_name: data.full_name || null,
      username: data.username == null || data.username === '' ? null : normalizeUsername(data.username),
      phone: data.phone || null,
      email: email || (existing && existing.email) || null,
      city: data.address_city || null,
      address_street: data.address_street || null,
      address_apt: data.address_apt || null,
      address_state: data.address_state || null,
      address_zip: data.address_zip || null,
      address_country: data.address_country || null,
      billing_name_on_card: data.billing_name_on_card || null,
      billing_same_as_home: data.billing_same_as_home !== false,
      billing_street: data.billing_street || null,
      billing_apt: data.billing_apt || null,
      billing_city: data.billing_city || null,
      billing_state: data.billing_state || null,
      billing_zip: data.billing_zip || null,
      billing_country: data.billing_country || null,
      notify_email_bookings: data.notify_email_bookings !== false,
      notify_email_marketing: data.notify_email_marketing !== false,
      notify_sms: data.notify_sms !== false,
    });
    if (data.language_preference === 'es' || data.language_preference === 'en') {
      row.language_preference = data.language_preference;
    }
    if (data.avatar_url) {
      row.avatar_url = data.avatar_url;
      row.photo_url = data.avatar_url;
    }

    var res = await client.from('client_profiles').upsert(row, { onConflict: 'user_id' });
    if (res.error) throw res.error;
  }

  async function loadProfile(session) {
    var client = db();
    if (!client || !session) return;
    var uid = session.user.id;
    var meta = session.user.user_metadata || {};
    var cpRes = await client.from('client_profiles').select('*').eq('user_id', uid).maybeSingle();
    var cp = cpRes && cpRes.data ? cpRes.data : null;

    var fullName = cp && cp.full_name ? String(cp.full_name) : (meta.full_name || '');
    var parts =
      typeof window.mdjSplitFullNameToParts === 'function'
        ? window.mdjSplitFullNameToParts(fullName)
        : { first: fullName, middle: '', last: '' };

    var el;
    if ((el = document.getElementById('ca-name-first'))) el.value = parts.first || '';
    if ((el = document.getElementById('ca-name-middle'))) el.value = parts.middle || '';
    if ((el = document.getElementById('ca-name-last'))) el.value = parts.last || '';
    if ((el = document.getElementById('ca-username'))) {
      el.value = cp && cp.username ? String(cp.username).replace(/^@+/, '') : (meta.username || '');
    }
    if ((el = document.getElementById('ca-email'))) el.value = session.user.email || '';
    if ((el = document.getElementById('ca-email-current'))) el.value = session.user.email || '';
    if ((el = document.getElementById('ca-phone'))) {
      el.value = cp && cp.phone ? String(cp.phone) : (meta.phone || '');
      el.disabled = false;
      if (typeof window.mdjAttachPhoneUSFormatting === 'function') window.mdjAttachPhoneUSFormatting(el);
    }
    if ((el = document.getElementById('ca-billing-name-on-card'))) {
      el.value = cp && cp.billing_name_on_card ? String(cp.billing_name_on_card) : (meta.billing_name_on_card || '');
    }

    var addr = cp
      ? {
          street: cp.address_street || '',
          apt: cp.address_apt || '',
          city: cp.city || '',
          state: cp.address_state || '',
          zip: cp.address_zip || '',
          country: cp.address_country || '',
        }
      : {
          street: meta.address_street || '',
          apt: meta.address_apt || '',
          city: meta.address_city || meta.addr_city || '',
          state: meta.address_state || '',
          zip: meta.address_zip || '',
          country: meta.address_country || '',
        };

    hydrateProfileAddress(addr);

    var billingDiffers = cp && cp.billing_same_as_home === false;
    var billingCb = document.getElementById('ca-billing-differs');
    if (billingCb) billingCb.checked = billingDiffers;
    if (billingDiffers) {
      hydrateBillingAddress({
        street: (cp && cp.billing_street) || '',
        apt: (cp && cp.billing_apt) || '',
        city: (cp && cp.billing_city) || '',
        state: (cp && cp.billing_state) || '',
        zip: (cp && cp.billing_zip) || '',
        country: (cp && cp.billing_country) || '',
      });
    }
    syncBillingAddressPanel();

    var avatarUrl =
      (cp && (cp.avatar_url || cp.photo_url)) ||
      meta.avatar_url ||
      meta.picture ||
      '';
    if (avatarUrl) {
      applyAvatarAll(avatarUrl);
    }

    syncOverview(session);

    if ((el = document.getElementById('ca-notify-bookings'))) el.checked = !(cp && cp.notify_email_bookings === false);
    if ((el = document.getElementById('ca-notify-marketing'))) el.checked = !(cp && cp.notify_email_marketing === false);
    if ((el = document.getElementById('ca-notify-sms'))) el.checked = !(cp && cp.notify_sms === false);
  }

  async function saveProfile(session, statusId, returnOverview) {
    var client = db();
    if (!client || !session) return;
    var status = document.getElementById(statusId || 'ca-save-status');
    var btn = document.getElementById('ca-save-btn');
    var join =
      typeof window.mdjJoinFullNameFromParts === 'function'
        ? window.mdjJoinFullNameFromParts
        : function (a, b, c) {
            return [a, b, c].filter(Boolean).join(' ');
          };

    var fullName = join(
      (document.getElementById('ca-name-first') || {}).value,
      (document.getElementById('ca-name-middle') || {}).value,
      (document.getElementById('ca-name-last') || {}).value,
    );

    var stateVal =
      typeof window.mdjGetAddressStateForSave === 'function'
        ? window.mdjGetAddressStateForSave()
        : (function () {
            var us = document.getElementById('select-state-us');
            var intl = document.getElementById('input-state-intl');
            if (us && us.offsetParent !== null) return us.value;
            if (intl) return intl.value;
            return '';
          })();
    var countryVal =
      typeof window.mdjGetAddressCountryForSave === 'function'
        ? window.mdjGetAddressCountryForSave()
        : (document.getElementById('select-country') || {}).value;

    var differs = billingDiffersFromHome();
    var payload = {
      full_name: fullName,
      username: (document.getElementById('ca-username') || {}).value,
      phone: (document.getElementById('ca-phone') || {}).value,
      address_street: (document.getElementById('input-street') || {}).value,
      address_apt: (document.getElementById('input-apt') || {}).value,
      address_city: (document.getElementById('input-city') || {}).value,
      address_state: stateVal,
      address_zip: (document.getElementById('input-zip') || {}).value,
      address_country: countryVal,
      billing_name_on_card: (document.getElementById('ca-billing-name-on-card') || {}).value,
      billing_same_as_home: !differs,
      billing_street: differs ? (document.getElementById('billing-input-street') || {}).value : '',
      billing_apt: differs ? (document.getElementById('billing-input-apt') || {}).value : '',
      billing_city: differs ? (document.getElementById('billing-input-city') || {}).value : '',
      billing_state: differs ? billingStateForSave() : '',
      billing_zip: differs ? (document.getElementById('billing-input-zip') || {}).value : '',
      billing_country: differs ? billingCountryForSave() : '',
      notify_email_bookings: !!(document.getElementById('ca-notify-bookings') || {}).checked,
      notify_email_marketing: !!(document.getElementById('ca-notify-marketing') || {}).checked,
      notify_sms: !!(document.getElementById('ca-notify-sms') || {}).checked,
    };

    if (btn) btn.disabled = true;
    setStatus(status, t('client-account-saving', 'Saving…'), true);
    try {
      var meta = session.user.user_metadata || {};
      await upsertClientProfile(session.user.id, payload, session.user.email, meta);
      await client.auth.updateUser({
        data: Object.assign({}, meta, {
          full_name: fullName,
          username: normalizeUsername(payload.username) || '',
          phone: payload.phone,
          address_street: payload.address_street,
          address_apt: payload.address_apt,
          address_city: payload.address_city,
          address_state: payload.address_state,
          address_zip: payload.address_zip,
          address_country: payload.address_country,
          billing_name_on_card: payload.billing_name_on_card,
          billing_same_as_home: payload.billing_same_as_home,
          billing_street: payload.billing_street,
          billing_apt: payload.billing_apt,
          billing_city: payload.billing_city,
          billing_state: payload.billing_state,
          billing_zip: payload.billing_zip,
          billing_country: payload.billing_country,
        }),
      });
      setStatus(status, t('client-account-saved', 'Profile saved.'), true);
      syncOverview(session);
      if (typeof window.checkSessionForNav === 'function') await window.checkSessionForNav();
      if (returnOverview) goToOverview();
    } catch (e) {
      setStatus(status, (e && e.message) || t('client-account-save-fail', 'Could not save.'), false);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function uploadAvatar(session, file) {
    var client = db();
    var feedback = document.getElementById('ca-avatar-feedback');
    if (!client || !session || !file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setStatus(feedback, t('client-account-avatar-type', 'Use JPG, PNG, or WebP.'), false);
      return;
    }
    setStatus(feedback, t('client-account-avatar-uploading', 'Uploading photo…'), true);
    try {
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      if (!/^(jpe?g|png|webp)$/.test(ext)) ext = 'jpg';
      var filePath = session.user.id + '/avatar.' + ext;
      var up = await client.storage.from('avatars').upload(filePath, file, { upsert: true, cacheControl: '3600' });
      if (up.error) throw up.error;
      var pub = client.storage.from('avatars').getPublicUrl(filePath);
      var baseUrl = pub.data.publicUrl;
      var finalUrl = baseUrl + '?v=' + Date.now();
      await client.auth.updateUser({
        data: Object.assign({}, session.user.user_metadata || {}, { avatar_url: finalUrl }),
      });
      await upsertClientProfile(
        session.user.id,
        { avatar_url: baseUrl.split('?')[0] },
        session.user.email,
        session.user.user_metadata,
      );
      applyAvatarAll(finalUrl);
      if (typeof window.mdjHeaderVipApplyPhotoUrl === 'function') {
        window.mdjHeaderVipApplyPhotoUrl(baseUrl);
      }
      setStatus(feedback, t('client-account-avatar-saved', 'Photo updated.'), true);
      syncOverview(session);
      if (typeof window.checkSessionForNav === 'function') await window.checkSessionForNav();
      goToOverview();
    } catch (e) {
      setStatus(feedback, (e && e.message) || t('client-account-avatar-fail', 'Upload failed.'), false);
    }
  }

  var caSession = null;

  function tFmt(key, fallback, vars) {
    var s = t(key, fallback);
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach(function (k) {
        s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(vars[k]));
      });
    }
    return s;
  }

  function cardBrandMarkup(brand) {
    var b = String(brand || '').toLowerCase();
    if (b === 'visa') {
      return '<svg viewBox="0 0 48 16" aria-hidden="true"><text x="2" y="12" font-size="11" font-weight="800" fill="#1A1F71">VISA</text></svg>';
    }
    if (b === 'mastercard') {
      return '<svg viewBox="0 0 48 16" aria-hidden="true"><circle cx="18" cy="8" r="6" fill="#EB001B"/><circle cx="26" cy="8" r="6" fill="#F79E1B" fill-opacity="0.95"/></svg>';
    }
    if (b === 'amex' || b === 'american express') {
      return '<span class="ca-saved-card-row__brand-text">AMEX</span>';
    }
    return '<span class="ca-saved-card-row__brand-text">' + escapeHtml(b || 'CARD') + '</span>';
  }

  function formatCardExpiry(month, year) {
    var m = Number(month);
    var y = Number(year);
    if (!m || !y) return '—';
    var yy = y >= 100 ? String(y).slice(-2) : String(y);
    return (m < 10 ? '0' + m : String(m)) + '/' + yy;
  }

  function renderSavedCards(cards) {
    var list = document.getElementById('ca-saved-cards-list');
    var empty = document.getElementById('ca-saved-cards-empty');
    var loading = document.getElementById('ca-saved-cards-loading');
    var addBtn = document.getElementById('ca-add-card');
    if (loading) loading.hidden = true;
    if (!list) return;

    if (!cards || !cards.length) {
      list.innerHTML = '';
      list.hidden = true;
      if (empty) empty.hidden = false;
      if (addBtn) addBtn.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    if (addBtn) addBtn.hidden = true;
    list.hidden = false;
    list.innerHTML = cards
      .map(function (card) {
        var exp = formatCardExpiry(card.exp_month, card.exp_year);
        return (
          '<article class="ca-saved-card-row" data-pm-id="' +
          escapeHtml(card.id) +
          '">' +
          '<div class="ca-saved-card-row__brand">' +
          cardBrandMarkup(card.brand) +
          '</div>' +
          '<div class="ca-saved-card-row__lines">' +
          '<p class="ca-saved-card-row__ending">' +
          escapeHtml(tFmt('client-account-card-ending', 'Ending in … {last4}', { last4: card.last4 || '····' })) +
          '</p>' +
          '<p class="ca-saved-card-row__exp">' +
          escapeHtml(
            tFmt('client-account-card-expires', 'Expires {month}/{year}', {
              month: exp.split('/')[0] || '—',
              year: exp.split('/')[1] || '—',
            }),
          ) +
          '</p>' +
          '</div>' +
          '<div class="ca-saved-card-row__actions">' +
          '<button type="button" data-ca-card-update>' +
          escapeHtml(t('client-account-card-update', 'Update')) +
          '</button>' +
          '<button type="button" data-ca-card-delete>' +
          escapeHtml(t('client-account-card-delete', 'Delete')) +
          '</button>' +
          '</div>' +
          '</article>'
        );
      })
      .join('');

    list.querySelectorAll('[data-ca-card-update]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (caSession) openBillingPortal(caSession);
      });
    });
    list.querySelectorAll('[data-ca-card-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('[data-pm-id]');
        var pmId = row && row.getAttribute('data-pm-id');
        if (pmId && caSession) detachPaymentMethod(caSession, pmId);
      });
    });
  }

  async function loadPaymentMethods(session) {
    var loading = document.getElementById('ca-saved-cards-loading');
    var empty = document.getElementById('ca-saved-cards-empty');
    var list = document.getElementById('ca-saved-cards-list');
    var status = document.getElementById('ca-card-status');
    var url = fnUrl('get-buyer-payment-methods');
    if (loading) loading.hidden = false;
    if (empty) empty.hidden = true;
    if (list) list.hidden = true;
    setStatus(status, '', true);

    if (!url) {
      if (loading) loading.hidden = true;
      if (empty) empty.hidden = false;
      setStatus(status, t('client-account-billing-config', 'Billing service not configured.'), false);
      return;
    }

    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: edgeInvokeHeaders(session),
        body: JSON.stringify({ action: 'list' }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || data.ok === false) {
        throw new Error(edgeFnError(data, res, 'Load failed'));
      }
      renderSavedCards(data.cards || []);
    } catch (e) {
      if (loading) loading.hidden = true;
      if (empty) empty.hidden = false;
      setStatus(status, (e && e.message) || t('client-account-billing-fail', 'Could not load cards.'), false);
    }
  }

  async function detachPaymentMethod(session, paymentMethodId) {
    if (!window.confirm(t('client-account-card-delete-confirm', 'Remove this card from your account?'))) return;
    var status = document.getElementById('ca-card-status');
    var url = fnUrl('get-buyer-payment-methods');
    if (!url) {
      setStatus(status, t('client-account-billing-config', 'Billing service not configured.'), false);
      return;
    }
    setStatus(status, t('client-account-saving', 'Saving…'), true);
    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: edgeInvokeHeaders(session),
        body: JSON.stringify({ action: 'detach', payment_method_id: paymentMethodId }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || data.ok === false) {
        throw new Error(edgeFnError(data, res, 'Detach failed'));
      }
      setStatus(status, t('client-account-card-deleted', 'Card removed.'), true);
      await loadPaymentMethods(session);
    } catch (e) {
      setStatus(status, (e && e.message) || t('client-account-card-delete-fail', 'Could not remove card.'), false);
    }
  }

  async function openBillingPortal(session) {
    var status = document.getElementById('ca-card-status');
    var url = fnUrl('create-buyer-billing-portal');
    if (!url) {
      setStatus(status, t('client-account-billing-config', 'Billing service not configured.'), false);
      return;
    }
    setStatus(status, t('client-account-billing-opening', 'Opening secure billing…'), true);
    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: edgeInvokeHeaders(session),
        body: JSON.stringify({ return_url: window.location.href }),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !data.url) {
        throw new Error(edgeFnError(data, res, 'Portal failed'));
      }
      window.location.href = data.url;
    } catch (e) {
      setStatus(status, (e && e.message) || t('client-account-billing-fail', 'Could not open billing portal.'), false);
    }
  }

  async function changeEmail(session) {
    var status = document.getElementById('ca-email-status');
    var btn = document.getElementById('ca-email-btn');
    var newEmail = ((document.getElementById('ca-email-new') || {}).value || '').trim();
    var confirmEmail = ((document.getElementById('ca-email-confirm') || {}).value || '').trim();
    var current = ((document.getElementById('ca-email-current') || {}).value || '').trim();

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setStatus(status, t('client-account-email-invalid', 'Enter a valid email address.'), false);
      return;
    }
    if (newEmail !== confirmEmail) {
      setStatus(status, t('client-account-email-match', 'Emails do not match.'), false);
      return;
    }
    if (current && newEmail.toLowerCase() === current.toLowerCase()) {
      setStatus(status, t('client-account-email-same', 'That is already your current email.'), false);
      return;
    }

    var client = db();
    if (!client) return;
    if (btn) btn.disabled = true;
    setStatus(status, t('client-account-email-sending', 'Sending confirmation…'), true);
    try {
      var up = await client.auth.updateUser({ email: newEmail });
      if (up.error) throw up.error;
      setStatus(
        status,
        t('client-account-email-sent', 'Check your new inbox for a confirmation link. Your current email stays active until you confirm.'),
        true,
      );
      document.getElementById('ca-email-new').value = '';
      document.getElementById('ca-email-confirm').value = '';
      goToOverview();
    } catch (e) {
      setStatus(status, (e && e.message) || t('client-account-email-fail', 'Could not update email.'), false);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function changePassword(session) {
    var status = document.getElementById('ca-password-status');
    var p1 = (document.getElementById('ca-password-new') || {}).value || '';
    var p2 = (document.getElementById('ca-password-confirm') || {}).value || '';
    if (p1.length < 8) {
      setStatus(status, t('client-account-password-short', 'Password must be at least 8 characters.'), false);
      return;
    }
    if (p1 !== p2) {
      setStatus(status, t('client-account-password-match', 'Passwords do not match.'), false);
      return;
    }
    var client = db();
    if (!client) return;
    try {
      var up = await client.auth.updateUser({ password: p1 });
      if (up.error) throw up.error;
      setStatus(status, t('client-account-password-saved', 'Password updated.'), true);
      document.getElementById('ca-password-new').value = '';
      document.getElementById('ca-password-confirm').value = '';
      goToOverview();
    } catch (e) {
      setStatus(status, (e && e.message) || t('client-account-password-fail', 'Could not update password.'), false);
    }
  }

  async function init() {
    if (typeof window.initI18n === 'function') window.initI18n();
    var client = db();
    if (!client) return;
    var sessWrap = await client.auth.getSession();
    var session = sessWrap && sessWrap.data && sessWrap.data.session;
    if (!session) {
      window.location.href = './login.html?next=' + encodeURIComponent(window.location.pathname);
      return;
    }

    caSession = session;
    initProfileAddressSelectors();
    initBillingAddressSelectors();
    wireBillingAddressToggle();
    enableProfileFields();
    enableBillingFields();
    await loadProfile(session);
    await loadClientEventTables(session);
    await loadRewards(session);
    wirePanelNav();
    wireCancelOverview();
    switchPanel('overview');

    var saveBtn = document.getElementById('ca-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', function () {
      saveProfile(session, 'ca-save-status', true);
    });

    var fileInput = document.getElementById('ca-avatar-file');
    document.querySelectorAll('[data-ca-photo-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (fileInput) fileInput.click();
      });
    });
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) uploadAvatar(session, fileInput.files[0]);
      });
    }

    var addCardBtn = document.getElementById('ca-add-card');
    if (addCardBtn) {
      addCardBtn.addEventListener('click', function () {
        openBillingPortal(session);
      });
    }

    var billingBtn = document.getElementById('ca-save-billing-btn');
    if (billingBtn) {
      billingBtn.addEventListener('click', function () {
        saveProfile(session, 'ca-billing-status');
      });
    }

    var notifyBtn = document.getElementById('ca-save-notify-btn');
    if (notifyBtn) {
      notifyBtn.addEventListener('click', function () {
        saveProfile(session, 'ca-notify-status');
      });
    }

    var emailBtn = document.getElementById('ca-email-btn');
    if (emailBtn) {
      emailBtn.addEventListener('click', function () {
        changeEmail(session);
      });
    }

    var passBtn = document.getElementById('ca-password-btn');
    if (passBtn) {
      passBtn.addEventListener('click', function () {
        changePassword(session);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
