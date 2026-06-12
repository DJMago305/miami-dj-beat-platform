/**
 * BOOTH-MANUAL-016 — Manual interactivo MDJPRO: contexto de página + identidad ligera para Booth.
 * Solo activo en /manuals/MDJPRO_Manual/{lang}/index.html
 */
(function () {
    'use strict';

    var m = /\/manuals\/MDJPRO_Manual\/([a-z]{2})\//i.exec(location.pathname || '');
    if (!m) return;

    var lang = m[1].toLowerCase();
    var hash = (location.hash || '').replace(/^#/, '') || '00-intro.md';

    window.__mdjBoothManualContext = {
        surface: 'mdjpro-manual',
        lang: lang,
        chapterId: hash,
        manualBase: '../../../manuals/MDJPRO_Manual/' + lang + '/index.html',
        webRoot: '../../../',
        downloadsUrl: '../../../downloads.html',
    };

    function syncHash() {
        if (!window.__mdjBoothManualContext) return;
        window.__mdjBoothManualContext.chapterId =
            (location.hash || '').replace(/^#/, '') || '00-intro.md';
    }

    window.addEventListener('hashchange', syncHash);

    async function hydrateIdentity() {
        if (!window.supabase || typeof window.mdjClassifyPlatformIdentity !== 'function') return;
        try {
            var sessionRes = await window.supabase.auth.getSession();
            var session = sessionRes && sessionRes.data && sessionRes.data.session;
            if (!session || !session.user) return;

            var uid = session.user.id;
            var djRes = await window.supabase
                .from('dj_profiles')
                .select('role,plan,plan_type,is_premium,subscription_status,stage_name,plan_status')
                .eq('user_id', uid)
                .maybeSingle();
            var clRes = await window.supabase
                .from('client_profiles')
                .select('user_id,buyer_billing_tier')
                .eq('user_id', uid)
                .maybeSingle();

            window.__mdjLastPlatformIdentity = window.mdjClassifyPlatformIdentity({
                user: session.user,
                djRow: djRes.data || null,
                clientRow: clRes.data || null,
            });

            var stage = djRes.data && djRes.data.stage_name;
            var emailName =
                session.user.email && session.user.email.split('@')[0]
                    ? session.user.email.split('@')[0]
                    : '';
            window.__mdjBoothDisplayName = stage || emailName || 'Member';
        } catch (_e) {
            /* guest manual OK */
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hydrateIdentity);
    } else {
        hydrateIdentity();
    }
})();
