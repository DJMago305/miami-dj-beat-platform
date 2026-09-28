/* Comisión por clientes referidos -- panel del DJ en la pestaña Flujo (dj-dashboard.html).
   Distinto del "Comisiones Referidos (vía QR/Enlaces)" que ya existe en el KPI grid --
   ese viene de dj_ledger/atribución por enlace; esto viene de referral_sale_commissions
   (dj_client_affiliations: el DJ dueño del cliente cobra comisión cuando ese cliente
   compra OTRO evento). Lectura directa via supabase.from(...) -- mismo patrón que el
   resto de paneles de esta sesión, sin RPC intermedia; la RLS
   (referral_sale_commissions_dj_owner_read) ya limita esto a las filas propias del DJ. */
(function () {
    function money(n) {
        var v = Number(n) || 0;
        return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function statusLabel(status) {
        var map = {
            pending: 'Pendiente',
            pending_tier_review: 'En revisión',
            paid: 'Pagada',
        };
        return map[status] || status || 'Pendiente';
    }

    window.mdjLoadReferralOwnerCommissions = async function () {
        var card = document.getElementById('referral-owner-commissions-card');
        var body = document.getElementById('referral-owner-commissions-body');
        var totalEl = document.getElementById('referral-owner-total');
        if (!card || !body || !totalEl) return;

        var db = window.getSupabaseClient && window.getSupabaseClient();
        if (!db) return;

        try {
            var auth = await db.auth.getUser();
            var uid = auth && auth.data && auth.data.user && auth.data.user.id;
            if (!uid) return;

            var prof = await db.from('dj_profiles').select('id').eq('user_id', uid).maybeSingle();
            var djId = prof && prof.data && prof.data.id;
            if (!djId) return;

            var res = await db
                .from('referral_sale_commissions')
                .select('id, is_first_event, tier_key, comision_referido_usd, status, calculado_en')
                .eq('owner_dj_id', djId)
                .not('comision_referido_usd', 'is', null)
                .order('calculado_en', { ascending: false })
                .limit(50);

            if (res.error || !res.data || !res.data.length) {
                card.style.display = 'none';
                return;
            }

            var rows = res.data;
            var total = rows.reduce(function (acc, r) { return acc + (Number(r.comision_referido_usd) || 0); }, 0);
            totalEl.textContent = money(total);

            body.innerHTML = rows.map(function (r) {
                var d = r.calculado_en ? new Date(r.calculado_en).toLocaleDateString('es-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                var tier = r.tier_key || 'evento';
                var evTag = r.is_first_event ? '1er evento del cliente' : 'evento recurrente';
                return '<tr>' +
                    '<td style="font-weight:700; color:#fff;">' + d + '</td>' +
                    '<td><div style="font-weight:700;">' + tier + '</div><div style="font-size:10px; opacity:0.4;">' + evTag + '</div></td>' +
                    '<td style="font-weight:900; color:#00ff88;">' + money(r.comision_referido_usd) + '</td>' +
                    '<td><span class="status-pill ' + (r.status || 'pending') + '">' + statusLabel(r.status) + '</span></td>' +
                    '</tr>';
            }).join('');

            card.style.display = '';
        } catch (e) {
            console.warn('[dj-referral-commissions]', e && e.message ? e.message : e);
        }
    };

    document.addEventListener('DOMContentLoaded', function () {
        // Se dispara junto con la pestaña Flujo -- mismo momento que mdjLoadFlowTab().
        var tryLoad = function () {
            if (typeof window.getSupabaseClient === 'function' && window.getSupabaseClient()) {
                window.mdjLoadReferralOwnerCommissions();
            } else {
                setTimeout(tryLoad, 400);
            }
        };
        setTimeout(tryLoad, 600);
    });
})();
