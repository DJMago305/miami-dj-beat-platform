/**
 * MDJPRO - Client Portal Logic
 * Handles real-time event tracking, installments, and feedback.
 */

function portalEscapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function portalDeleteLead(leadId, btn) {
    if (!confirm('¿Eliminar esta orden? Esta acción no se puede deshacer.')) return;
    var db = window.getSupabaseClient ? window.getSupabaseClient() : null;
    if (!db) { alert('Error: no se pudo conectar.'); return; }
    var origText = btn.textContent;
    btn.textContent = '...';
    btn.disabled = true;
    try {
        // Delete associated EBO first (avoid orphan)
        await db.from('event_builder_orders').delete().eq('lead_id', leadId);
        // Delete the lead
        var { error } = await db.from('leads').delete().eq('id', leadId);
        if (error) throw error;
        var row = btn.closest('tr');
        if (row) row.remove();
    } catch (e) {
        alert('Error al eliminar: ' + (e.message || e));
        btn.textContent = origText;
        btn.disabled = false;
    }
}

async function mdjPortalFetchCheckoutJson(resp) {
    var text = await resp.text();
    var data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch (e) {
        throw new Error(text && text.slice ? text.slice(0, 280) : 'Invalid payment response');
    }
    if (!resp.ok) {
        var err = (data && (data.error || data.detail || data.message)) || (text && text.slice ? text.slice(0, 280) : '') || 'HTTP ' + resp.status;
        throw new Error(typeof err === 'string' ? err : String(err));
    }
    if (data && data.ok === false && (data.error || data.detail)) {
        throw new Error(String(data.error || data.detail));
    }
    return data;
}

function portalCalcEventDepositUsd(totalUsd) {
    var bal = parseFloat(totalUsd);
    if (!isFinite(bal) || bal < 0) bal = 0;
    return Math.max(bal * 0.3, 150);
}

function portalCorpZelleEmail() {
    return (typeof window.MDB_OFFICIAL_CONTACT_EMAIL === 'string' && window.MDB_OFFICIAL_CONTACT_EMAIL) || 'miamidjbeat@gmail.com';
}

function portalZelleMemoForLead(leadId) {
    return 'MDJB-' + String(leadId).slice(0, 8).toUpperCase();
}

function portalClearLeadPendingShell() {
    portalDisarmLeadPendingFailsafe();
    try {
        document.documentElement.removeAttribute('data-portal-lead-pending');
    } catch (e) { /* ignore */ }
    try {
        document.body.classList.remove('portal-resolving-session');
    } catch (e2) { /* ignore */ }
}

var _portalFailsafeTimer = null;

/** Si ?lead= sigue oculto tras timeout, revelar UI y mostrar acceso denegado (evita pantalla negra). */
function portalArmLeadPendingFailsafe(ms) {
    if (_portalFailsafeTimer) clearTimeout(_portalFailsafeTimer);
    _portalFailsafeTimer = setTimeout(function () {
        var stillHidden =
            document.documentElement.hasAttribute('data-portal-lead-pending') ||
            document.body.classList.contains('portal-resolving-session');
        if (!stillHidden) return;
        console.warn('[portal] lead pending failsafe — revealing shell');
        portalClearLeadPendingShell();
        try {
            var head = document.querySelector('.portal-header');
            var main = document.querySelector('main');
            var title = portalT('portal-lead-access-denied-title');
            var body =
                portalT('portal-pick-event-intro') +
                ' ' +
                portalT('portal-lead-access-denied-body');
            var hub = portalT('portal-lead-access-denied-back-hub');
            if (head) {
                head.innerHTML =
                    '<div class="container" style="padding: 40px 20px;">' +
                    '<div style="font-size: 48px; margin-bottom: 20px;">⏳</div>' +
                    '<h1 style="font-size: 22px; margin-bottom: 12px;">' +
                    portalEscapeHtml(title) +
                    '</h1>' +
                    '<p style="opacity:0.85;max-width:520px;margin:0 auto 24px;line-height:1.5;">' +
                    portalEscapeHtml(body) +
                    '</p>' +
                    '<a href="./client-portal.html" class="btn primary" style="display:inline-block;padding:14px 28px;border-radius:50px;font-weight:900;">' +
                    portalEscapeHtml(hub) +
                    '</a></div>';
            }
            if (main) main.innerHTML = '';
        } catch (eDeny) {
            void eDeny;
        }
    }, typeof ms === 'number' ? ms : 12000);
}

function portalDisarmLeadPendingFailsafe() {
    if (_portalFailsafeTimer) {
        clearTimeout(_portalFailsafeTimer);
        _portalFailsafeTimer = null;
    }
}

var PORTAL_HUB_STORAGE_KEY = 'mdj_portal_hub_v1';

function portalRememberHubLeads(sessionUserId, leads) {
    if (!sessionUserId) return;
    try {
        var ids = [];
        var rows = {};
        (leads || []).forEach(function (L) {
            if (L && L.id) {
                var sid = String(L.id);
                ids.push(sid);
                rows[sid] = L;
            }
        });
        sessionStorage.setItem(
            PORTAL_HUB_STORAGE_KEY,
            JSON.stringify({ uid: String(sessionUserId), ids: ids, rows: rows, ts: Date.now() })
        );
    } catch (eHub) {
        void eHub;
    }
}

function portalHubLeadSnapshot(sessionUserId, leadId) {
    if (!sessionUserId || !leadId) return null;
    try {
        var raw = sessionStorage.getItem(PORTAL_HUB_STORAGE_KEY);
        if (!raw) return null;
        var o = JSON.parse(raw);
        if (!o || String(o.uid) !== String(sessionUserId)) return null;
        if (Date.now() - Number(o.ts || 0) > 86400000) return null;
        return (o.rows && o.rows[String(leadId)]) || null;
    } catch (eS) {
        return null;
    }
}

function portalHubLeadGranted(sessionUserId, leadId) {
    if (!sessionUserId || !leadId) return false;
    try {
        var raw = sessionStorage.getItem(PORTAL_HUB_STORAGE_KEY);
        if (!raw) return false;
        var o = JSON.parse(raw);
        if (!o || String(o.uid) !== String(sessionUserId)) return false;
        if (Date.now() - Number(o.ts || 0) > 86400000) return false;
        return (o.ids || []).some(function (id) {
            return String(id) === String(leadId);
        });
    } catch (eG) {
        return false;
    }
}

/** Espera hidratación JWT (misma idea que hub «Mis eventos»). */
async function portalWaitForAuthSession(db, maxAttempts) {
    if (!db) return null;
    var attempts = typeof maxAttempts === 'number' ? maxAttempts : 10;
    for (var i = 0; i < attempts; i++) {
        try {
            var res = await db.auth.getSession();
            var session = res && res.data && res.data.session;
            if (session && session.user) return session;
            var gu = await db.auth.getUser();
            if (gu && gu.data && gu.data.user) {
                return { user: gu.data.user };
            }
        } catch (eS) {
            void eS;
        }
        await new Promise(function (r) {
            setTimeout(r, 140 * (i + 1));
        });
    }
    return null;
}

/** Primer nombre para saludo humano: quita @, minúsculas salvo la inicial (ej. @WENDY → Wendy). */
function portalFirstNameOnly(str) {
    var cleaned = String(str || '')
        .replace(/@+/g, ' ')
        .trim();
    var parts = cleaned.split(/\s+/).filter(function (x) {
        return !!x;
    });
    if (!parts.length) return '';
    var w = parts[0];
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Short display e.g. "Wendy Example" → "Wendy E." (legacy; saludos usan portalFirstNameOnly) */
function portalFormatShortName(fullName) {
    var parts = String(fullName || '')
        .trim()
        .split(/\s+/)
        .filter(function (x) {
            return !!x;
        });
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    var first = parts[0];
    var last = parts[parts.length - 1];
    if (first === last) return first;
    return first + ' ' + last.charAt(0).toUpperCase() + '.';
}

var PORTAL_I18N_FB = {
    en: {
        'portal-welcome-recognized': 'Hello, {name}!',
        'portal-welcome-recognized-sub':
            'You are part of the Miami DJ Beat family. From here you can book, rent, or shop — and your dates, payments, and details will stay in one place, with us beside you every step of the way.',
        'portal-welcome-sub-family':
            'You are part of the Miami DJ Beat family. This is your home to plan events, rent gear, and browse the shop. Whatever you book with us, you will see it here — clear, calm, and in one place. We are with you.',
        'portal-welcome-sub-returning':
            'So good to see you here again. If you need a service, a product, or just a quick hello, we are here for you — same family, same care.',
        'portal-welcome-sub-lead':
            'Below is your event at a glance: payments, logistics, and the basics in one place. If anything comes up, your team is one message away — on chat or your event contact. We have your back.',
        'portal-default-tagline': 'Welcome to your client portal.',
        'portal-pick-event-intro': 'Choose an event to open your dashboard.',
        'portal-no-events-title': 'No events linked to this account yet',
        'portal-no-events-body':
            'When you book with us, your timeline and payments will show up here, in one place, with the same care as always. Until then, take a look at services, rentals, or the shop — we are here for you.',
        'portal-no-events-cta': 'Explore services & booking',
        'portal-cart-empty-services': 'No services added to this event yet.',
        'portal-event-datetime-pending': 'Date / time pending',
        'portal-events-title': 'My events',
        'portal-events-upcoming': 'Upcoming',
        'portal-events-past': 'History',
        'portal-events-open': 'Open',
        'portal-events-status': 'Status',
        'portal-events-date': 'Date',
        'portal-guest-title': 'Access your portal',
        'portal-guest-body': 'Enter the email you used when booking to see your event status.',
        'portal-guest-search': 'Find my event',
        'portal-guest-searching': 'Searching…',
        'portal-guest-not-found': 'We could not find events for that email.',
        'portal-guest-error': 'Connection error. Please try again.',
        'portal-financial-title': 'Financial summary',
        'portal-financial-subtitle': 'Contract, payments, and balance in one place.',
        'portal-financial-contract-total': 'Total contract',
        'portal-financial-deposit-paid': 'Payments to date (deposit / installments)',
        'portal-financial-balance-label': 'Balance due',
        'portal-financial-deadline-label': 'Final payment due date',
        'portal-payment-stripe-note': 'Card payments are processed securely by Stripe (PCI DSS). We never store your full card number in this portal.',
        'portal-payment-paypal-soon': 'PayPal: integration in progress — use the card payment button for now.',
        'portal-zelle-title': 'Pay deposit with Zelle',
        'portal-zelle-recipient': 'Recipient',
        'portal-zelle-amount': 'Deposit amount',
        'portal-zelle-memo': 'Memo (required)',
        'portal-zelle-copy': 'Copy instructions',
        'portal-zelle-sent': 'I sent the Zelle payment',
        'portal-zelle-pending': 'Zelle pending verification — we will confirm once received.',
        'portal-zelle-sent-ok': 'Thanks! Your team will verify the deposit shortly.',
        'portal-zelle-sent-fail': 'Could not register your Zelle payment. Try again or contact your manager.',
        'portal-payment-security-title': 'Saved payment methods',
        'portal-payment-security-body': 'To save or update cards securely for future events, use the billing section on your account (Stripe Customer).',
        'portal-payment-security-link': 'Billing & payment methods →',
        'portal-reservation-bonus-line': 'Immediate reservation bonus (48h+)',
        'portal-reservation-bonus-banner': '<strong>Immediate reservation bonus applied.</strong> Because this booking has been open 48+ hours with no payment yet, we applied a <strong>${amount}</strong> courtesy credit to your pack total. It is reflected in “Discounts / credits” and in your deposit calculation.',
        'portal-pay-now': 'PAY NOW',
        'portal-lead-login-required-title': 'Private event',
        'portal-lead-login-required-body': 'To view your contract, payments, and assigned DJ details, sign in with the email you used when booking.',
        'portal-lead-login-required-cta': 'Sign in',
        'portal-lead-access-denied-title': 'Not available on this account',
        'portal-lead-access-denied-body': 'This event is not linked to your email. Sign in with the account you used to book, or contact support.',
        'portal-lead-access-denied-back': 'Back to home',
        'portal-lead-access-denied-back-hub': 'Back to my events',
        'portal-welcome-name-fallback': 'Friend',
        'portal-log-contact-placeholder': 'On file with your booking',
        'portal-dup-wedding-banner':
            'Hello, {name}! We see two different wedding dates on your account. If one celebration is before or after your wedding, we would love to host it — but please correct what that event actually is in your details. We would rather you did not get married twice in the same month!',
        'portal-dup-wedding-cta': 'How to fix event types',
        'portal-dup-wedding-fix-title': 'Clarify your celebrations',
        'portal-dup-wedding-fix-intro':
            'Pick a clearer category for one of the events (for example Pre-Wedding Party, Engagement, or After-Party). Saving updates your record for the team.',
        'portal-dup-wedding-save': 'Save type',
        'portal-dup-wedding-saved': 'Updated.',
        'portal-dup-wedding-save-err': 'Could not save. Try again or message your manager in chat.',
        'portal-manager-billing-lock-title': 'Billing & payment methods locked',
        'portal-manager-billing-lock-body':
            'For PCI and privacy, payment details and manual payment tools stay hidden until the client account password is verified. Use Stripe payment links or automated flows — do not type the client’s card or bank data here.',
        'portal-manager-billing-unlock-cta': 'Unlock with client password',
        'portal-manager-billing-password-prompt':
            'Client account password (the email on this lead must match the Miami DJ Beat login):',
        'portal-manager-billing-fail': 'Could not verify. Check the password or try again later.',
        'portal-manager-billing-config-miss': 'Payment unlock is not available (missing site configuration).',
        'portal-manager-stripe-link-cta': 'Generate Stripe payment link (for client)',
        'portal-manager-stripe-link-busy': 'Creating link…',
        'portal-manager-stripe-link-copied': 'Payment link copied. Send it only to the client by a channel you already use with them. Never ask them to type card data in chat.',
        'portal-manager-stripe-link-prompt': 'Copy this link and send it to the client:',
        'portal-manager-stripe-link-fail': 'Could not create the payment link. Try again or use the automated flow from the client account.',
        'portal-invoice-pdf-cta': 'Open invoice (print / PDF)',
        'portal-invoice-pdf-error': 'Could not open the invoice page. Refresh and try again, or contact support.',
        'portal-invoice-pdf-busy': 'Opening…',
        'portal-staff-hub-title': 'Bookings supervision',
        'portal-staff-hub-sub': 'Staff mode: open any client event. Links open in supervision mode.',
        'portal-staff-hub-empty': 'No leads found.',
        'portal-staff-hub-col-event': 'Event',
        'portal-staff-hub-col-client': 'Client',
        'portal-staff-hub-col-date': 'Date',
        'portal-staff-hub-col-status': 'Status',
        'portal-staff-hub-open': 'Open portal'
    },
    es: {
        'portal-welcome-recognized': '¡Hola, {name}!',
        'portal-welcome-recognized-sub':
            'Eres parte de la familia Miami DJ Beat. Desde aquí reservas, rentas o compras en el shop, y verás en un solo lugar fechas, pagos y el detalle de lo que tengas con nosotros — con el mismo cariño de siempre, paso a paso.',
        'portal-welcome-sub-family':
            'Eres parte de la familia Miami DJ Beat. Este es tu espacio, con el mismo trato de casa: aquí armas tu fiesta, rentas equipo o miras el shop, y en este panel vas viendo, con calma, el calendario, los pagos y lo que tengas en marcha. No estás solo: estamos contigo.',
        'portal-welcome-sub-returning':
            'Qué alegría verte otra vez por aquí, de corazón. Si hoy te interesa un servicio, un producto o solo charlar, aquí estamos: la misma familia MDJ, con el mismo cuidado de siempre.',
        'portal-welcome-sub-lead':
            'Más abajo tienes, en un solo vistazo, la logística, los pagos y el resumen de esta reserva. Lo que te surja, estamos a un mensaje: el chat o el contacto de tu evento. El mismo equipo, el mismo cuidado de familia.',
        'portal-default-tagline': 'Portal del cliente',
        'portal-pick-event-intro': 'Elige un evento para abrir tu panel.',
        'portal-no-events-title': 'Aún no hay eventos vinculados a esta cuenta',
        'portal-no-events-body':
            'Cuando reserves con nosotros, en familia, tu calendario y tus pagos quedarán claros en este panel. Mientras tanto, pasea por servicios, rentas o el shop: aquí te esperamos.',
        'portal-no-events-cta': 'Ver servicios y reservas',
        'portal-cart-empty-services': 'Aún no hay servicios en el paquete de este evento.',
        'portal-event-datetime-pending': 'Fecha y hora pendientes',
        'portal-events-title': 'Mis eventos',
        'portal-events-upcoming': 'Próximos',
        'portal-events-past': 'Historial',
        'portal-events-open': 'Abrir',
        'portal-events-status': 'Estado',
        'portal-events-date': 'Fecha',
        'portal-guest-title': 'Accede a tu Portal',
        'portal-guest-body': 'Ingresa el email que usaste al reservar para ver el estado de tu evento.',
        'portal-guest-search': 'Buscar mi evento',
        'portal-guest-searching': 'Buscando…',
        'portal-guest-not-found': 'No encontramos eventos para ese email.',
        'portal-guest-error': 'Error de conexión. Intenta de nuevo.',
        'portal-financial-title': 'Resumen financiero',
        'portal-financial-subtitle': 'Contrato, pagos y saldo en un solo lugar.',
        'portal-financial-contract-total': 'Total del contrato',
        'portal-financial-deposit-paid': 'Pagos realizados (depósito / abonos)',
        'portal-financial-balance-label': 'Saldo pendiente',
        'portal-financial-deadline-label': 'Fecha límite pago final',
        'portal-payment-stripe-note': 'Pagos con tarjeta procesados de forma segura por Stripe (PCI DSS). No almacenamos el número completo de tu tarjeta en este portal.',
        'portal-payment-paypal-soon': 'PayPal: en integración; mientras tanto usa el botón de pago con tarjeta.',
        'portal-zelle-title': 'Pagar depósito con Zelle',
        'portal-zelle-recipient': 'Destinatario',
        'portal-zelle-amount': 'Monto del depósito',
        'portal-zelle-memo': 'Nota / memo (obligatorio)',
        'portal-zelle-copy': 'Copiar instrucciones',
        'portal-zelle-sent': 'Ya envié el pago por Zelle',
        'portal-zelle-pending': 'Zelle pendiente de verificación — confirmaremos al recibirlo.',
        'portal-zelle-sent-ok': '¡Gracias! Tu equipo verificará el depósito en breve.',
        'portal-zelle-sent-fail': 'No se pudo registrar el pago Zelle. Intenta de nuevo o contacta a tu manager.',
        'portal-payment-security-title': 'Métodos de pago guardados',
        'portal-payment-security-body': 'Para guardar o actualizar tarjetas de forma segura para futuros eventos, usa la sección de facturación de tu cuenta (Stripe Customer).',
        'portal-payment-security-link': 'Facturación y métodos de pago →',
        'portal-reservation-bonus-line': 'Bono de reserva inmediata (48h+)',
        'portal-reservation-bonus-banner': '<strong>Bono de Reserva Inmediata activo.</strong> Como esta reserva lleva más de 48 horas sin pago, aplicamos un crédito de cortesía de <strong>${amount}</strong> a tu pack. Ya está reflejado en “Descuentos/Créditos” y en el cálculo del depósito.',
        'portal-pay-now': 'PAGAR AHORA',
        'portal-lead-login-required-title': 'Evento privado',
        'portal-lead-login-required-body': 'Para ver contrato, pagos y detalles del DJ, inicia sesión con el correo que usaste al reservar.',
        'portal-lead-login-required-cta': 'Iniciar sesión',
        'portal-lead-access-denied-title': 'No disponible con esta cuenta',
        'portal-lead-access-denied-body': 'Este evento no está vinculado a tu correo. Usa la cuenta con la que reservaste o contacta a soporte.',
        'portal-lead-access-denied-back': 'Volver al inicio',
        'portal-lead-access-denied-back-hub': 'Volver a mis eventos',
        'portal-welcome-name-fallback': 'Amigo',
        'portal-log-contact-placeholder': 'En tu reserva (no mostramos el correo aquí)',
        'portal-dup-wedding-banner':
            '¡Hola, {name}! Veo que tienes dos fechas de boda distintas. Si quieres hacer una fiesta de celebración antes o después de casarte, estaremos muy contentos de hacerlo, pero debes corregir de qué se trata esa fiesta en tus ajustes. ¡No queremos que te cases dos veces el mismo mes!',
        'portal-dup-wedding-cta': 'Cómo corregir el tipo de evento',
        'portal-dup-wedding-fix-title': 'Aclara tus celebraciones',
        'portal-dup-wedding-fix-intro':
            'Elige una categoría más clara para uno de los eventos (por ejemplo Pre-Wedding Party, Engagement o After-Party). Al guardar, actualizamos tu registro para el equipo.',
        'portal-dup-wedding-save': 'Guardar tipo',
        'portal-dup-wedding-saved': 'Listo, actualizado.',
        'portal-dup-wedding-save-err': 'No se pudo guardar. Intenta de nuevo o escribe a tu manager en el chat.',
        'portal-manager-billing-lock-title': 'Facturación y métodos de pago bloqueados',
        'portal-manager-billing-lock-body':
            'Por privacidad y PCI, los detalles de pago y herramientas manuales quedan ocultos hasta verificar la contraseña de la cuenta del cliente. Usa enlaces de pago Stripe o flujos automáticos: no ingreses datos de tarjeta o banco del cliente aquí.',
        'portal-manager-billing-unlock-cta': 'Desbloquear con contraseña del cliente',
        'portal-manager-billing-password-prompt':
            'Contraseña de la cuenta del cliente (el email del lead debe coincidir con el login MDJ):',
        'portal-manager-billing-fail': 'No se pudo verificar. Revisa la contraseña o intenta más tarde.',
        'portal-manager-billing-config-miss': 'Desbloqueo no disponible (falta configuración del sitio).',
        'portal-manager-stripe-link-cta': 'Generar enlace de pago Stripe (para el cliente)',
        'portal-manager-stripe-link-busy': 'Creando enlace…',
        'portal-manager-stripe-link-copied':
            'Enlace de pago copiado. Envíaselo solo al cliente por un canal que ya usen con él. Nunca pidas datos de tarjeta por chat.',
        'portal-manager-stripe-link-prompt': 'Copia este enlace y envíaselo al cliente:',
        'portal-manager-stripe-link-fail': 'No se pudo crear el enlace de pago. Reintenta o usa el flujo automático desde la cuenta del cliente.',
        'portal-invoice-pdf-cta': 'Abrir factura (imprimir / PDF)',
        'portal-invoice-pdf-error': 'No se pudo abrir la factura. Actualiza la página e inténtalo de nuevo, o escribe a soporte.',
        'portal-invoice-pdf-busy': 'Abriendo…',
        'portal-staff-hub-title': 'Supervisión de pedidos',
        'portal-staff-hub-sub': 'Modo staff: abre cualquier evento de cliente. Los enlaces abren en modo supervisión.',
        'portal-staff-hub-empty': 'No hay leads todavía.',
        'portal-staff-hub-col-event': 'Evento',
        'portal-staff-hub-col-client': 'Cliente',
        'portal-staff-hub-col-date': 'Fecha',
        'portal-staff-hub-col-status': 'Estado',
        'portal-staff-hub-open': 'Abrir portal'
    }
};

function portalLang() {
    if (window.i18n && window.i18n.currentLang) return window.i18n.currentLang === 'es' ? 'es' : 'en';
    var h = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return h.indexOf('es') === 0 ? 'es' : 'en';
}

/** Never override ES|EN from the header / mdjpro_lang when switching tabs. Profile lang only if unset. */
function portalApplyLanguagePreferenceIfUnset(pref) {
    if (pref !== 'es' && pref !== 'en') return;
    if (!window.i18n || typeof window.i18n.setLanguage !== 'function') return;
    try {
        var stored = localStorage.getItem('mdjpro_lang');
        if (stored === 'es' || stored === 'en') return;
    } catch (eStore) {
        void eStore;
    }
    window.i18n.setLanguage(pref);
}

function portalT(key, name) {
    var loc = portalLang();
    var tpl = '';
    try {
        if (window.i18n && typeof window.i18n.t === 'function') {
            tpl = window.i18n.t(key);
        }
    } catch (e) { /* ignore */ }
    if (!tpl) tpl = (PORTAL_I18N_FB[loc] && PORTAL_I18N_FB[loc][key]) || PORTAL_I18N_FB.en[key] || '';
    if (name != null && name !== '') tpl = tpl.replace(/\{name\}/g, String(name));
    else tpl = tpl.replace(/\{name\}/g, '');
    return tpl;
}

function portalTAmount(key, amountUsd) {
    var s = portalT(key);
    var amt = parseFloat(amountUsd) || 0;
    return s.replace(/\$\{amount\}/g, '$' + amt.toFixed(2));
}

/** Normaliza rutas Storage (misma idea que mdj-shared-header). */
function portalNormalizeAvatarUrl(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    if (/placeholder|dj-avatar-placeholder\.png/i.test(s)) return '';
    if (/^https?:\/\//i.test(s)) return s;
    if (s.indexOf('data:image/') === 0 || s.indexOf('blob:') === 0) return s;
    var base =
        typeof window.MDB_SUPABASE_URL === 'string' && window.MDB_SUPABASE_URL
            ? String(window.MDB_SUPABASE_URL).replace(/\/$/, '')
            : '';
    if (base && s.indexOf('storage/v1') !== -1) {
        var path = s.indexOf('/') === 0 ? s : '/' + s.replace(/^\/+/, '');
        return base + path;
    }
    if (base && s.indexOf('/') === 0 && s.indexOf('/storage/') === 0) {
        return base + s;
    }
    return s;
}

/** Misma heurística que el header VIP (URL pública real). */
function portalIsRealPhotoUrl(url) {
    var u = portalNormalizeAvatarUrl(url);
    if (!u) return false;
    if (/placeholder|dj-avatar-placeholder\.png/i.test(u)) return false;
    return /^https?:\/\//i.test(u) || u.indexOf('data:image/') === 0 || u.indexOf('blob:') === 0;
}

function portalGetAvatarUrl(session, clientProfile) {
    var meta = session && session.user && session.user.user_metadata ? session.user.user_metadata : {};
    var u = portalNormalizeAvatarUrl(meta.avatar_url || meta.picture || meta.picture_url);
    if (portalIsRealPhotoUrl(u)) return u;
    if (clientProfile) {
        var c = portalNormalizeAvatarUrl(clientProfile.avatar_url || clientProfile.photo_url || '');
        if (portalIsRealPhotoUrl(c)) return c;
    }
    return '';
}

function portalComputeInitials(displayName, email) {
    var d = String(displayName || '').trim();
    if (d) {
        var w = d.split(/\s+/).filter(Boolean);
        if (w.length >= 2) return (w[0].charAt(0) + w[w.length - 1].charAt(0)).toUpperCase();
        if (w.length === 1 && w[0].length >= 2) return w[0].substring(0, 2).toUpperCase();
        if (w.length === 1) return w[0].charAt(0).toUpperCase();
    }
    var e = String(email || '').split('@')[0] || '';
    if (e.length >= 2) return e.substring(0, 2).toUpperCase();
    return e ? e.charAt(0).toUpperCase() : '?';
}

function portalFormatHandleDisplay(raw) {
    if (!raw || !String(raw).trim()) return '';
    var t = String(raw).trim().replace(/^@+/, '');
    if (!t) return '';
    return '@' + t;
}

function portalEventDayStartMs(eventDate) {
    if (!eventDate) return null;
    var s = String(eventDate).trim();
    var m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    var d = m ? new Date(m[1] + 'T12:00:00') : new Date(s);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

function portalLeadIsPast(lead) {
    var ms = portalEventDayStartMs(lead && lead.event_date);
    if (ms == null) return false;
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return ms < t.getTime();
}

/** Boda / wedding-like (para detector anti-duplicados). */
function portalLeadIsWeddingType(lead) {
    var t = String(lead && lead.event_type ? lead.event_type : '').toLowerCase();
    return /\b(wedding|boda|matrimon|casam(iento)?|nupcial|nuptial|bridal)\b/i.test(t);
}

/**
 * Dos bodas con fechas dentro de ~12 meses → posible error de categoría.
 * @returns {{ first: object, second: object } | null}
 */
function portalDetectDoubleWeddingWithinTwelveMonths(leads) {
    var cand = (leads || []).filter(function (L) {
        return portalLeadIsWeddingType(L) && portalEventDayStartMs(L.event_date) != null;
    });
    if (cand.length < 2) return null;
    var maxGapMs = 366 * 24 * 60 * 60 * 1000;
    cand.sort(function (a, b) {
        return portalEventDayStartMs(a.event_date) - portalEventDayStartMs(b.event_date);
    });
    var i, j;
    for (i = 0; i < cand.length; i++) {
        for (j = i + 1; j < cand.length; j++) {
            var da = portalEventDayStartMs(cand[i].event_date);
            var db = portalEventDayStartMs(cand[j].event_date);
            if (Math.abs(db - da) <= maxGapMs) {
                return { first: cand[i], second: cand[j] };
            }
        }
    }
    return null;
}

/**
 * Saludo: solo primer nombre (trato de anfitrión). Sin @, sin apellidos, sin correo en pantalla.
 */
function portalResolveWelcomeName(session, clientProfile, lead) {
    var meta = session && session.user && session.user.user_metadata ? session.user.user_metadata : {};
    if (clientProfile && clientProfile.full_name && String(clientProfile.full_name).trim()) {
        var a = portalFirstNameOnly(String(clientProfile.full_name).trim());
        if (a) return a;
    }
    if (meta.full_name && String(meta.full_name).trim()) {
        var b = portalFirstNameOnly(String(meta.full_name).trim());
        if (b) return b;
    }
    if (meta.display_name && String(meta.display_name).trim()) {
        var c = portalFirstNameOnly(String(meta.display_name).trim());
        if (c) return c;
    }
    if (meta.artistic_name && String(meta.artistic_name).trim()) {
        var d = portalFirstNameOnly(String(meta.artistic_name).trim());
        if (d) return d;
    }
    if (lead && lead.contact_person && String(lead.contact_person).trim()) {
        var e = portalFirstNameOnly(String(lead.contact_person).trim());
        if (e) return e;
    }
    return portalT('portal-welcome-name-fallback') || 'Friend';
}

/** Cliente con historial en DB (p. ej. al menos un evento contabilizado) → saludo de retorno. */
function portalIsReturningHabitualClient(clientRow) {
    if (!clientRow) return false;
    var n = parseInt(String(clientRow.total_events_booked == null ? 0 : clientRow.total_events_booked), 10);
    return n > 0;
}

/**
 * Párrafo bajo «¡Hola, nombre!»: family (nuevo) | habitual (retorno) | detalle (lead).
 * @param {"empty"|"hub"|"lead"} ctx
 */
function portalWelcomeSubI18nKey(ctx, clientRow) {
    if (ctx === 'lead') return 'portal-welcome-sub-lead';
    /* Hub = varias reservas: siempre tono de retorno. Empty: retorno si el perfil acumula eventos en DB. */
    if (ctx === 'hub' || portalIsReturningHabitualClient(clientRow)) {
        return 'portal-welcome-sub-returning';
    }
    return 'portal-welcome-sub-family';
}

/**
 * Lista de leads para sesión autenticada: prioriza public.leads.client_user_id = auth user id;
 * fusiona con filas legacy solo vinculadas por email. Orden por created_at.
 */
async function portalFetchLeadsForLoggedInUser(db, sessionUserId, emailNorm) {
    var cols =
        'id,email,client_user_id,event_type,event_date,event_start_time,event_end_time,location,status,created_at,payment_status,balance_paid,total_amount';
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
    var lastErr = null;
    if (sessionUserId) {
        var r1 = await db
            .from('leads')
            .select(cols)
            .eq('client_user_id', sessionUserId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (r1.error) lastErr = r1.error;
        absorb(r1.data);
    }
    if (emailNorm) {
        var r2 = await db
            .from('leads')
            .select(cols)
            .ilike('email', emailNorm)
            .order('created_at', { ascending: false })
            .limit(50);
        if (r2.error && !lastErr) lastErr = r2.error;
        absorb(r2.data);
    }
    rows.sort(function (a, b) {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    if (rows.length > 50) rows = rows.slice(0, 50);
    return { data: rows, error: rows.length ? null : lastErr };
}

/** ¿Este lead pertenece a la sesión? Peek por id + lista hub (misma regla que «Mis eventos»). */
async function portalSessionOwnsLead(db, leadId, sessionUserId, sessionEmail) {
    if (!db || !leadId) return false;
    if (sessionUserId && portalHubLeadGranted(sessionUserId, leadId)) return true;
    try {
        var peek = await db.from('leads').select('email, client_user_id').eq('id', leadId).maybeSingle();
        if (peek.data) {
            var rowEmail = peek.data.email ? String(peek.data.email).trim().toLowerCase() : '';
            var emailOk = rowEmail && sessionEmail && rowEmail === sessionEmail;
            var uidOk =
                sessionUserId &&
                peek.data.client_user_id &&
                String(peek.data.client_user_id) === String(sessionUserId);
            if (emailOk || uidOk) return true;
        }
    } catch (eP) { /* ignore */ }
    var q = await portalFetchLeadsForLoggedInUser(db, sessionUserId, sessionEmail);
    var leads = q.data || [];
    if (leads.length && sessionUserId) {
        portalRememberHubLeads(sessionUserId, leads);
    }
    return leads.some(function (L) {
        return L && String(L.id) === String(leadId);
    });
}

/** Admin / manager / seller: JWT + fila dj_profiles (roles en minúsculas). */
async function mdjPortalResolveStaff(db, user) {
    if (!db || !user) return false;
    var appR = String((user.app_metadata && user.app_metadata.role) || '').toLowerCase();
    if (appR === 'admin' || appR === 'manager' || appR === 'seller') return true;
    var ut = String((user.user_metadata && user.user_metadata.user_type) || '').toLowerCase();
    if (ut === 'admin' || ut === 'manager' || ut === 'seller') return true;
    try {
        var pr = await db.from('dj_profiles').select('role').eq('user_id', user.id).maybeSingle();
        var dr = String((pr && pr.data && pr.data.role) || '').toLowerCase();
        return dr === 'admin' || dr === 'manager' || dr === 'seller';
    } catch (e) {
        return false;
    }
}

/** ?mode=manager | staff | supervision — hub de supervisión sin ?lead */
function mdjPortalStaffModeRequested(params) {
    var m = (params.get('mode') || '').toLowerCase();
    return m === 'manager' || m === 'staff' || m === 'supervision';
}

/** Demo con datos ficticios (solo manager): requiere ?demo=1 */
function mdjPortalDemoManagerRequested() {
    try {
        return new URLSearchParams(window.location.search).get('demo') === '1';
    } catch (eD) {
        return false;
    }
}

/** Solo columnas que el hub ya lee vía RLS; sin gate_code / assigned_dj / deposit_required_usd. */
var MDJ_LEADS_HUB_COLUMNS =
    'id,email,client_user_id,event_type,event_date,status,created_at,payment_status,balance_paid,total_amount';

var MDJ_LEADS_BROWSER_COLUMNS =
    'id,email,client_user_id,full_name,phone,event_type,event_date,event_start_time,event_end_time,status,created_at,location,notes,payment_status,balance_paid,total_amount,assigned_staff_id,assigned_staff_name';

var MDJ_LEADS_SAFE_COLUMNS = MDJ_LEADS_BROWSER_COLUMNS;

async function portalFetchLeadRowById(db, leadId) {
    if (!db || !leadId) return { data: null, error: null };
    var tiers = [MDJ_LEADS_HUB_COLUMNS, MDJ_LEADS_BROWSER_COLUMNS];
    var lastErr = null;
    var merged = null;
    for (var t = 0; t < tiers.length; t++) {
        var cols = tiers[t];
        for (var attempt = 0; attempt < 2; attempt++) {
            var res = await db.from('leads').select(cols).eq('id', leadId).maybeSingle();
            if (res.data) {
                merged = merged ? Object.assign(merged, res.data) : res.data;
                if (t === tiers.length - 1) {
                    return { data: merged, error: null };
                }
                break;
            }
            lastErr = res.error || null;
            if (lastErr) {
                var msg = String(lastErr.message || lastErr.details || lastErr.hint || '');
                if (/does not exist|42703|deposit_required_usd|gate_code|assigned_dj|contact_person|budget/i.test(msg)) {
                    break;
                }
            }
            if (attempt < 1) {
                await new Promise(function (r) {
                    setTimeout(r, 280);
                });
            }
        }
    }
    if (merged) return { data: merged, error: null };
    return { data: null, error: lastErr };
}

const PortalApp = {
    /** Lead abierto 48h+ sin pago → crédito de enganche (portal + IA pueden referenciarlo). */
    RESERVATION_BONUS_HOURS: 48,
    RESERVATION_BONUS_USD: 75,

    /** Evita mostrar el formulario de email si Supabase aún no está listo pero el usuario ya tiene sesión. */
    async waitForSupabaseClient(maxMs) {
        var step = 50;
        var waited = 0;
        maxMs = typeof maxMs === 'number' ? maxMs : 5000;
        while (waited <= maxMs) {
            if (typeof window.getSupabaseClient === 'function' && window.getSupabaseClient()) return true;
            await new Promise(function (r) {
                setTimeout(r, step);
            });
            waited += step;
        }
        return false;
    },

    _localeRefreshWired: false,
    currentLead: null,
    items: [],
    installments: [],
    isManager: false,
    clientProfile: null,
    _sessionSnapshot: null,

    getNotesObject() {
        if (!this.currentLead || !this.currentLead.notes) return {};
        try {
            var n = JSON.parse(this.currentLead.notes);
            return typeof n === 'object' && n !== null ? n : {};
        } catch (e) {
            return {};
        }
    },

    getHoursSinceLeadCreated() {
        if (!this.currentLead || !this.currentLead.created_at) return null;
        var created = new Date(this.currentLead.created_at);
        if (isNaN(created.getTime())) return null;
        return (Date.now() - created.getTime()) / 3600000;
    },

    computeReservationBonusUsd() {
        if (this.isManager || !this.currentLead) return 0;
        var st = this.currentLead.payment_status || 'UNPAID';
        if (st === 'PAID') return 0;
        var paid = parseFloat(this.currentLead.balance_paid) || 0;
        if (paid > 0) return 0;
        var hours = this.getHoursSinceLeadCreated();
        if (hours == null || hours < this.RESERVATION_BONUS_HOURS) return 0;
        var n = this.getNotesObject();
        if (n.reservation_bonus_opt_out === true) return 0;
        return this.RESERVATION_BONUS_USD;
    },

    /**
     * Single source of truth for cart subtotal, discounts, FL tax, and total — must match PDF invoice lines.
     */
    computePortalCartTotals() {
        var sub = 0;
        (this.items || []).forEach(function (item) {
            sub += (parseFloat(item.price) || 0) * (parseInt(item.qty, 10) || 1);
        });
        var discount = 0;
        var discountNote = '';
        const refEligible =
            this.clientProfile?.source_ref && this.clientProfile?.discount_eligible !== false;
        if (refEligible) {
            discount += 30;
            discountNote += '• Crédito referido MDJ (1ª compra): -$30.00<br>';
        }
        if ((this.clientProfile?.total_events_booked || 0) > 0) {
            const loyaltyDisc = sub * 0.05;
            discount += loyaltyDisc;
            discountNote += '• Beneficio Cliente Oficial (5%): -$' + loyaltyDisc.toFixed(2) + '<br>';
        }
        var bonusUsd = this.computeReservationBonusUsd();
        if (bonusUsd > 0) {
            discount += bonusUsd;
            discountNote += '• ' + portalT('portal-reservation-bonus-line') + ': -$' + bonusUsd.toFixed(2) + '<br>';
        }
        if (discount > sub) discount = sub;
        const tax = (sub - discount) * 0.07;
        const total = sub - discount + tax;
        return { sub, discount, discountNote, tax, total };
    },

    updateReservationBonusBanner() {
        var el = document.getElementById('portal-reservation-bonus-banner');
        if (!el) return;
        var usd = this.computeReservationBonusUsd();
        if (usd > 0 && !this.isManager) {
            el.classList.add('is-visible');
            el.innerHTML = portalTAmount('portal-reservation-bonus-banner', usd);
        } else {
            el.classList.remove('is-visible');
            el.innerHTML = '';
        }
    },

    exportFinanceMeta() {
        try {
            if (!this.currentLead) {
                delete window.__MDJ_PORTAL_FINANCE__;
                return;
            }
            var total = parseFloat(this.currentLead.total_amount) || 0;
            var paid = parseFloat(this.currentLead.balance_paid) || 0;
            var bonus = this.computeReservationBonusUsd();
            window.__MDJ_PORTAL_FINANCE__ = {
                leadId: this.currentLead.id,
                totalContract: total,
                depositPaid: paid,
                balanceDue: Math.max(0, total - paid),
                paymentStatus: this.currentLead.payment_status || 'UNPAID',
                reservationBonusEligible: bonus > 0,
                reservationBonusUsd: bonus,
                hoursSinceLeadCreated: this.getHoursSinceLeadCreated(),
                stripeCheckout: true,
                paypalComingSoon: true,
                savedMethodsHint: './client-billing.html'
            };
        } catch (e) {
            delete window.__MDJ_PORTAL_FINANCE__;
        }
    },

    wireLocaleRefresh() {
        if (this._localeRefreshWired) return;
        this._localeRefreshWired = true;
        var self = this;
        function applyPortalLocale() {
            try {
                if (window.i18n && typeof window.i18n.updateUI === 'function') {
                    window.i18n.updateUI();
                }
            } catch (e0) { /* ignore */ }
            if (self.currentLead) {
                try {
                    self.renderLeadInfo();
                } catch (e1) { /* ignore */ }
                try {
                    self.renderCart();
                } catch (e2) { /* ignore */ }
                try {
                    self.updatePayments();
                } catch (e3) { /* ignore */ }
            }
        }
        document.addEventListener('languageChanged', applyPortalLocale);
        window.addEventListener('storage', function (e) {
            if (!e || (e.key !== 'mdjpro_lang' && e.key !== 'mdj_lang_sync_tick')) return;
            if (e.key === 'mdjpro_lang' && e.newValue && window.i18n) {
                window.i18n.currentLang = e.newValue === 'es' ? 'es' : 'en';
            }
            if (e.key === 'mdj_lang_sync_tick') {
                try {
                    var v = localStorage.getItem('mdjpro_lang');
                    if (window.i18n && v) {
                        window.i18n.currentLang = v === 'es' ? 'es' : 'en';
                    }
                } catch (ex) { /* ignore */ }
            }
            applyPortalLocale();
        });
    },

    async init() {
        this.wireLocaleRefresh();
        const params = new URLSearchParams(window.location.search);
        const leadId = params.get('lead');
        this.isManager = params.get('mode') === 'manager';

        if (leadId && params.get('access_denied') === '1') {
            try {
                window.history.replaceState(
                    {},
                    '',
                    window.location.pathname + '?lead=' + encodeURIComponent(leadId)
                );
            } catch (eAd) {
                void eAd;
            }
        }

        if (leadId) {
            try {
                document.body.classList.add('portal-resolving-session');
            } catch (eRs) { /* ignore */ }
            portalArmLeadPendingFailsafe(14000);
        }

        if (this.isManager && leadId) {
            await this.waitForSupabaseClient(8000);
            var dbM = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
            if (!dbM) {
                this.showLeadAccessDenied();
                return;
            }
            var sm = await dbM.auth.getSession();
            var sessM = sm && sm.data && sm.data.session;
            if (!sessM || !sessM.user) {
                window.location.href =
                    './login.html?redirect=client-portal&lead=' +
                    encodeURIComponent(leadId) +
                    '&mode=manager';
                return;
            }
            var staffOk = await mdjPortalResolveStaff(dbM, sessM.user);
            if (!staffOk) {
                this.showLeadAccessDenied();
                return;
            }
        }

        var guestManager = this.isManager && params.get('guest') === '1' && !leadId;
        if (guestManager) {
            await this.waitForSupabaseClient(8000);
            var dbGuest = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
            if (!dbGuest) {
                this.showLeadAccessDenied();
                return;
            }
            var smGuest = await dbGuest.auth.getSession();
            var sessGuest = smGuest && smGuest.data && smGuest.data.session;
            if (!sessGuest || !sessGuest.user) {
                window.location.href =
                    './login.html?redirect=' +
                    encodeURIComponent('client-portal.html?mode=manager&guest=1');
                return;
            }
            var staffGuestOk = await mdjPortalResolveStaff(dbGuest, sessGuest.user);
            if (!staffGuestOk) {
                this.showLeadAccessDenied();
                return;
            }
            try {
                document.body.classList.remove('portal-resolving-session');
            } catch (eGuest) { /* ignore */ }
            this.renderGuestManagerEmergencyScreen();
            return;
        }

        if (!leadId && mdjPortalStaffModeRequested(params)) {
            await this.waitForSupabaseClient(8000);
            var dbHub = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
            if (!dbHub) {
                this.showLeadAccessDenied();
                return;
            }
            var smHub = await dbHub.auth.getSession();
            var sessHub = smHub && smHub.data && smHub.data.session;
            if (!sessHub || !sessHub.user) {
                window.location.href =
                    './login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
                return;
            }
            var staffHubOk = await mdjPortalResolveStaff(dbHub, sessHub.user);
            if (!staffHubOk) {
                this.showLeadAccessDenied();
                return;
            }
            try {
                document.body.classList.remove('portal-resolving-session');
            } catch (eHub0) {
                void eHub0;
            }
            this.isManager = true;
            this.showManagerNotice();
            await this.renderStaffSupervisionHub(dbHub);
            return;
        }

        if (!leadId && (params.get('access_denied') === '1' || params.get('forbidden') === '1')) {
            this.showLeadAccessDenied();
            return;
        }

        if (!leadId) {
            try {
                document.body.classList.add('portal-resolving-session');
            } catch (e0) { /* ignore */ }
            await this.waitForSupabaseClient(10000);
            var resolved = false;
            var ar;
            for (ar = 0; ar < 12; ar++) {
                resolved = await this.tryResolvePortalFromSession();
                if (resolved) return;
                await new Promise(function (r) {
                    setTimeout(r, 280);
                });
            }
            try {
                document.body.classList.remove('portal-resolving-session');
            } catch (e1) { /* ignore */ }
            this.showNoLeadScreen();
            return;
        }

        if (this.isManager) {
            this.showManagerNotice();
        }

        if (!this.isManager) {
            await this.waitForSupabaseClient(10000);
            var dbGate = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
            var sessGate = await portalWaitForAuthSession(dbGate, 12);
            if (!sessGate || !sessGate.user) {
                this.showLeadLoginRequired(leadId);
                return;
            }
            if (
                leadId &&
                sessGate.user.id &&
                portalHubLeadGranted(sessGate.user.id, leadId)
            ) {
                portalClearLeadPendingShell();
            }
        }

        await this.loadLeadData(leadId);
        this.setupEventListeners();

        // Handle Stripe payment return
        await this.handlePaymentReturn();
    },

    showManagerNotice() {
        const banner = document.createElement('div');
        banner.style = "background: var(--gold); color: #000; text-align: center; padding: 10px; font-weight: 800; position: fixed; top: 0; left: 0; right: 0; z-index: 10000; font-size: 14px;";
        banner.innerHTML = `🛠 MODO STAFF (supervisión) — Los cambios en un evento abierto se reflejan al cliente cuando aplica.`;
        document.body.prepend(banner);
        const header = document.querySelector('.header');
        if (header) header.style.marginTop = "40px";
    },

    async renderStaffSupervisionHub(db) {
        try {
            document.body.classList.remove('portal-resolving-session');
        } catch (e0) {
            void e0;
        }
        var head = document.querySelector('.portal-header');
        var main = document.querySelector('main');
        if (head) {
            head.innerHTML =
                '<div class="container" style="padding: 32px 20px 16px;">' +
                '<h1 style="margin:0 0 8px;font-size:26px;">' +
                portalEscapeHtml(portalT('portal-staff-hub-title')) +
                '</h1>' +
                '<p class="fineprint" style="opacity:0.85;max-width:720px;margin:0 auto;line-height:1.5;">' +
                portalEscapeHtml(portalT('portal-staff-hub-sub')) +
                '</p></div>';
        }
        var rows = [];
        try {
            var res = await db
                .from('leads')
                .select(MDJ_LEADS_SAFE_COLUMNS)
                .order('created_at', { ascending: false })
                .limit(300);
            if (res.data) rows = res.data;
            if (res.error) console.warn('staff hub leads', res.error);
        } catch (eL) {
            console.warn('renderStaffSupervisionHub', eL);
        }
        var base = (window.location.pathname || 'client-portal.html').split('?')[0];
        function rowHtml(L) {
            var id = L.id ? String(L.id) : '';
            var href =
                base +
                '?lead=' +
                encodeURIComponent(id) +
                '&mode=manager';
            var et = L.event_type ? portalEscapeHtml(String(L.event_type)) : '—';
            var nm = L.full_name || L.name || L.client_name || '';
            var em = L.email ? portalEscapeHtml(String(L.email)) : '—';
            var dt = L.event_date ? portalEscapeHtml(String(L.event_date)) : '—';
            var st = L.status ? portalEscapeHtml(String(L.status)) : '—';
            var who = portalEscapeHtml(nm ? String(nm) : em);
            return (
                '<tr style="border-bottom:1px solid rgba(255,255,255,0.08);">' +
                '<td style="padding:12px 10px;vertical-align:top;">' +
                et +
                '</td>' +
                '<td style="padding:12px 10px;vertical-align:top;"><strong>' +
                who +
                '</strong><br><span class="fineprint" style="opacity:0.75;">' +
                em +
                '</span></td>' +
                '<td style="padding:12px 10px;vertical-align:top;">' +
                dt +
                '</td>' +
                '<td style="padding:12px 10px;vertical-align:top;">' +
                st +
                '</td>' +
                '<td style="padding:12px 10px;vertical-align:top;"><a href="' +
                href +
                '" class="btn primary" style="display:inline-block;padding:8px 14px;font-size:13px;font-weight:800;">' +
                portalEscapeHtml(portalT('portal-staff-hub-open')) +
                '</a></td></tr>'
            );
        }
        var tableBody = rows.length ? rows.map(rowHtml).join('') : '<tr><td colspan="5" class="fineprint" style="padding:24px;">' + portalEscapeHtml(portalT('portal-staff-hub-empty')) + '</td></tr>';
        if (main) {
            main.innerHTML =
                '<div class="container" style="padding: 20px 16px 80px; max-width: 960px; margin: 0 auto;">' +
                '<div style="overflow-x:auto;border-radius:14px;border:1px solid rgba(197,160,89,0.25);background:rgba(0,0,0,0.2);">' +
                '<table style="width:100%;border-collapse:collapse;font-size:14px;">' +
                '<thead><tr style="text-align:left;background:rgba(197,160,89,0.12);">' +
                '<th style="padding:12px 10px;">' +
                portalEscapeHtml(portalT('portal-staff-hub-col-event')) +
                '</th>' +
                '<th style="padding:12px 10px;">' +
                portalEscapeHtml(portalT('portal-staff-hub-col-client')) +
                '</th>' +
                '<th style="padding:12px 10px;">' +
                portalEscapeHtml(portalT('portal-staff-hub-col-date')) +
                '</th>' +
                '<th style="padding:12px 10px;">' +
                portalEscapeHtml(portalT('portal-staff-hub-col-status')) +
                '</th>' +
                '<th style="padding:12px 10px;"></th>' +
                '</tr></thead><tbody>' +
                tableBody +
                '</tbody></table></div></div>';
        }
        try {
            var hdr = document.querySelector('.header');
            if (hdr) hdr.style.marginTop = '40px';
        } catch (eH) {
            void eH;
        }
    },

    showLeadLoginRequired(leadId) {
        portalClearLeadPendingShell();
        var loginUrl = './login.html?redirect=client-portal&lead=' + encodeURIComponent(leadId || '');
        var head = document.querySelector('.portal-header');
        var main = document.querySelector('main');
        var title = portalT('portal-lead-login-required-title');
        var body = portalT('portal-lead-login-required-body');
        var cta = portalT('portal-lead-login-required-cta');
        if (head) {
            head.innerHTML =
                '<div class="container" style="padding: 40px 20px;">' +
                '<div style="font-size: 48px; margin-bottom: 20px;">🔒</div>' +
                '<h1 style="font-size: 26px; margin-bottom: 12px;">' +
                portalEscapeHtml(title) +
                '</h1>' +
                '<p style="opacity: 0.85; max-width: 520px; margin: 0 auto 24px; line-height: 1.5;">' +
                portalEscapeHtml(body) +
                '</p>' +
                '<a href="' +
                portalEscapeHtml(loginUrl) +
                '" class="btn primary" style="display:inline-block;padding:14px 28px;border-radius:50px;font-weight:900;">' +
                portalEscapeHtml(cta) +
                '</a></div>';
        }
        if (main) main.innerHTML = '';
    },

    showLeadAccessDenied() {
        portalClearLeadPendingShell();
        var head = document.querySelector('.portal-header');
        var main = document.querySelector('main');
        var title = portalT('portal-lead-access-denied-title');
        var body = portalT('portal-lead-access-denied-body');
        var back = portalT('portal-lead-access-denied-back');
        var backHub = portalT('portal-lead-access-denied-back-hub');
        if (head) {
            head.innerHTML =
                '<div class="container" style="padding: 40px 20px;">' +
                '<div style="font-size: 48px; margin-bottom: 20px;">🛡️</div>' +
                '<h1 style="font-size: 26px; margin-bottom: 12px;">' +
                portalEscapeHtml(title) +
                '</h1>' +
                '<p style="opacity: 0.85; max-width: 520px; margin: 0 auto 24px; line-height: 1.5;">' +
                portalEscapeHtml(body) +
                '</p>' +
                '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">' +
                '<a href="./client-portal.html" class="btn primary" style="display:inline-block;padding:14px 28px;border-radius:50px;font-weight:900;">' +
                portalEscapeHtml(backHub) +
                '</a>' +
                '<a href="./index.html" class="btn secondary" style="display:inline-block;padding:14px 28px;border-radius:50px;font-weight:800;">' +
                portalEscapeHtml(back) +
                '</a></div>';
        }
        if (main) main.innerHTML = '';
        try {
            var denyParams = new URLSearchParams(window.location.search);
            var denyLead = denyParams.get('lead');
            var denyQs = denyLead
                ? '?lead=' + encodeURIComponent(denyLead) + '&access_denied=1'
                : '?access_denied=1';
            window.history.replaceState({}, '', window.location.pathname + denyQs);
        } catch (eH) { /* ignore */ }
    },

    async loadLeadData(leadId) {
        let leadData = null;
        const db = window.getSupabaseClient();

        if (!this.isManager && db) {
            var sessionEmail = '';
            var sessionUserId = '';
            try {
                const { data: sessWrap } = await db.auth.getSession();
                var u = sessWrap && sessWrap.session && sessWrap.session.user;
                if (!u) {
                    const gu = await db.auth.getUser();
                    u = gu && gu.data && gu.data.user;
                }
                sessionEmail = u && u.email ? String(u.email).trim().toLowerCase() : '';
                sessionUserId = u && u.id ? String(u.id) : '';
            } catch (e0) { /* ignore */ }
            if (!sessionEmail) {
                this.showLeadLoginRequired(leadId);
                return;
            }
            var accessOk =
                (sessionUserId && portalHubLeadGranted(sessionUserId, leadId)) || false;
            for (var att = 0; att < 3 && !accessOk; att++) {
                accessOk = await portalSessionOwnsLead(db, leadId, sessionUserId, sessionEmail);
                if (accessOk) break;
                if (att < 2) {
                    await new Promise(function (r) {
                        setTimeout(r, 350);
                    });
                    try {
                        var gu2 = await db.auth.getUser();
                        var u2 = gu2 && gu2.data && gu2.data.user;
                        if (u2 && u2.email) sessionEmail = String(u2.email).trim().toLowerCase();
                        if (u2 && u2.id) sessionUserId = String(u2.id);
                    } catch (eR) { /* ignore */ }
                }
            }
            if (!accessOk) {
                this.showLeadAccessDenied();
                return;
            }
        }

        try {
            if (db) {
                var fetchErr = null;
                for (var fAtt = 0; fAtt < 3; fAtt++) {
                    var fetched = await portalFetchLeadRowById(db, leadId);
                    if (fetched.data) {
                        leadData = fetched.data;
                        fetchErr = null;
                        break;
                    }
                    fetchErr = fetched.error;
                    if (fAtt < 2) {
                        await new Promise(function (r) {
                            setTimeout(r, 400);
                        });
                    }
                }
        if (!leadData && !this.isManager && fetchErr) {
            var ec = String(fetchErr.code || '');
            var hubOk =
                sessionUserId && portalHubLeadGranted(sessionUserId, leadId);
            if ((ec === 'PGRST116' || ec === '42501') && !hubOk) {
                this.showLeadAccessDenied();
                return;
            }
        }
            }
        } catch (e) {
            console.warn("Supabase fetch failed, using local fallback");
        }

        if (!leadData) {
            var hubSnap =
                sessionUserId && portalHubLeadGranted(sessionUserId, leadId)
                    ? portalHubLeadSnapshot(sessionUserId, leadId)
                    : null;
            if (hubSnap) {
                leadData = Object.assign({ id: leadId }, hubSnap);
            }
        }
        if (!leadData && db && sessionUserId && sessionEmail) {
            try {
                var hubList = await portalFetchLeadsForLoggedInUser(db, sessionUserId, sessionEmail);
                var fromList = (hubList.data || []).find(function (L) {
                    return L && String(L.id) === String(leadId);
                });
                if (fromList) {
                    leadData = Object.assign({ id: leadId }, fromList);
                }
            } catch (eList) {
                void eList;
            }
        }

        if (!leadData) {
            if (!this.isManager) {
                var hubStillOk =
                    sessionUserId && portalHubLeadGranted(sessionUserId, leadId);
                if (!hubStillOk) {
                    this.showLeadAccessDenied();
                    return;
                }
                var snap2 = portalHubLeadSnapshot(sessionUserId, leadId);
                leadData = snap2
                    ? Object.assign({ id: leadId }, snap2)
                    : {
                          id: leadId,
                          event_type: 'Event',
                          event_date: '',
                          status: 'CONFIRMED',
                          payment_status: 'UNPAID',
                          balance_paid: 0,
                          total_amount: 0
                      };
            } else {
                var demoMgr = mdjPortalDemoManagerRequested();
                const saved = localStorage.getItem(`lead_${leadId}`);
                if (saved) {
                    try {
                        leadData = JSON.parse(saved);
                    } catch (eParse) {
                        leadData = null;
                    }
                }
                if (!leadData && demoMgr) {
                    leadData = {
                        id: leadId,
                        email: 'client@example.com',
                        event_type: 'Evento Corporativo',
                        event_date: '2026-12-31',
                        location: 'Miami Beach Convention Center',
                        contact_person: 'Gerardo V.',
                        gate_code: '1234#',
                        total_amount: 0,
                        balance_paid: 0,
                        payment_status: 'UNPAID',
                        status: 'CONFIRMED',
                        created_at: new Date(Date.now() - 72 * 3600000).toISOString()
                    };
                }
                if (!leadData) {
                    leadData = {
                        id: leadId,
                        email: '',
                        event_type: '',
                        event_date: '',
                        location: '',
                        contact_person: '',
                        gate_code: '',
                        total_amount: 0,
                        balance_paid: 0,
                        payment_status: 'UNPAID',
                        status: 'NEW',
                        notes: null
                    };
                }
            }
        }

        if (db && leadData && leadId && (leadData.notes === undefined || leadData.notes === null)) {
            try {
                var noteOnly = await db.from('leads').select('notes').eq('id', leadId).maybeSingle();
                if (noteOnly && !noteOnly.error && noteOnly.data && Object.prototype.hasOwnProperty.call(noteOnly.data, 'notes')) {
                    leadData.notes = noteOnly.data.notes;
                }
            } catch (eNotes) {
                void eNotes;
            }
        }

        this.currentLead = leadData;
        try {
            await this.loadLeadItems(leadId);
            await this.fetchClientProfile(leadData.email);
            this.renderLeadInfo();
            this.updatePayments();
            this.startCountdown();
            if (this.isManager) {
                this.setupManagerBillingBarrier();
            }
        } catch (renderErr) {
            console.error('[portal] loadLeadData render failed', renderErr);
            if (
                !this.isManager &&
                !(sessionUserId && portalHubLeadGranted(sessionUserId, leadId))
            ) {
                this.showLeadAccessDenied();
            }
        } finally {
            try {
                document.body.classList.remove('portal-resolving-session');
            } catch (eDone) { /* ignore */ }
            portalClearLeadPendingShell();
        }
    },

    async fetchClientProfile(email) {
        this.clientProfile = null;
        this._sessionSnapshot = null;
        try {
            const db = window.getSupabaseClient();
            if (!db) return;
            const { data: sessWrap } = await db.auth.getSession();
            this._sessionSnapshot = sessWrap && sessWrap.session ? sessWrap.session : null;
            try {
                var gu = await db.auth.getUser();
                if (gu && gu.data && gu.data.user && this._sessionSnapshot && this._sessionSnapshot.user) {
                    this._sessionSnapshot.user = gu.data.user;
                }
            } catch (guErr) { /* ignore */ }
            var uid = this._sessionSnapshot && this._sessionSnapshot.user && this._sessionSnapshot.user.id;
            if (uid) {
                this._myUserId = uid; // store for chat RLS
                var pr = await db.from('client_profiles').select('*').eq('user_id', uid).maybeSingle();
                if (pr.data) this.clientProfile = pr.data;
            }
            if (!this.clientProfile && email) {
                var pr2 = await db.from('client_profiles').select('*').eq('email', email).maybeSingle();
                if (pr2.data) this.clientProfile = pr2.data;
            }
        } catch (e) {
            console.warn('Client profile fetch skipped', e);
        }
        try {
            portalApplyLanguagePreferenceIfUnset(
                this.clientProfile && this.clientProfile.language_preference
            );
        } catch (eLang) { /* ignore */ }
        this.renderLoyaltyBadge(this.clientProfile?.total_events_booked || 1);
        this.renderCart();
        if (typeof this.renderPortalWelcomeAvatar === 'function') {
            this.renderPortalWelcomeAvatar();
        }
    },

    async loadLoyaltyTier(email) {
        if (!email) return;
        let eventCount = 1;
        try {
            const db = window.getSupabaseClient();
            if (db) {
                const { count, error } = await db
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('email', email);
                if (!error) eventCount = count || 1;
            }
        } catch (e) {
            console.warn("Could not fetch event count for loyalty");
        }

        this.renderLoyaltyBadge(eventCount);
    },

    renderLoyaltyBadge(count) {
        const container = document.getElementById('loyalty-tier-container');
        if (!container) return;

        let tierClass = 'tier-new';
        let tierName = 'Nuevo Cliente';
        let icon = '🌱';

        if (count >= 10) {
            tierClass = 'tier-diamond';
            tierName = 'Partner Diamante';
            icon = '💎';
        } else if (count >= 5) {
            tierClass = 'tier-gold';
            tierName = 'Socio Oro';
            icon = '🏆';
        } else if (count >= 2) {
            tierClass = 'tier-silver';
            tierName = 'Miembro Plata';
            icon = '🥈';
        }

        container.innerHTML = `
            <div class="loyalty-badge ${tierClass}">
                <span>${icon}</span>
                <span>${tierName}</span>
                <span style="opacity: 0.6; font-size: 10px; margin-left: 5px;">(${count} eventos)</span>
            </div>
        `;
    },

    async loadLeadItems(leadId) {
        let items = [];
        let meetings = [];

        // Try event_builder_orders.lines first (staff-edited lines take priority)
        try {
            var dbLI = window.getSupabaseClient ? window.getSupabaseClient() : null;
            if (dbLI) {
                var { data: ebo } = await dbLI
                    .from('event_builder_orders')
                    .select('lines')
                    .eq('lead_id', leadId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (ebo && Array.isArray(ebo.lines) && ebo.lines.length) {
                    items = ebo.lines.map(function(l) {
                        var qty   = parseInt(l.quantity || l.qty, 10) || 1;
                        var price = parseFloat(l.unit_price_usd || l.price) || 0;
                        return { name: l.name || '', price: price, qty: qty };
                    });
                }
            }
        } catch (eEbo) { /* fallback below */ }

        // Fallback: leads.notes.selected_services
        if (!items.length && this.currentLead.notes) {
            try {
                const parsed = JSON.parse(this.currentLead.notes);
                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                    items = Array.isArray(parsed.selected_services) ? parsed.selected_services : [];
                    meetings = Array.isArray(parsed.meetings) ? parsed.meetings : [];
                }
            } catch (e) {
                items = [];
                meetings = [];
            }
        }

        this.items = items;
        this.meetings = meetings;
        this.renderCart();
        this.renderCalendar();
    },

    renderCalendar() {
        const container = document.getElementById('calendar-widget');
        if (!container) return;

        // ── Excel-style header — 5 columnas + acción ──
        var colsManager = this.isManager ? ' cal-grid--with-action' : '';
        var headerHtml =
            '<div class="cal-grid cal-grid--header' + colsManager + '">' +
            '<div class="cal-cell">Lugar</div>' +
            '<div class="cal-cell">Hora</div>' +
            '<div class="cal-cell">Fecha</div>' +
            '<div class="cal-cell">Persona de Contacto</div>' +
            '<div class="cal-cell">Código de Entrada</div>' +
            (this.isManager ? '<div class="cal-cell cal-cell--action"></div>' : '') +
            '</div>';

        if (!this.meetings || this.meetings.length === 0) {
            container.innerHTML =
                headerHtml +
                '<div class="cal-empty-row">' +
                '<div class="cal-empty-msg">No hay citas programadas aún.<br>' +
                '<span style="font-size:11px;opacity:0.5;">Your manager will schedule a consultation with you shortly.</span>' +
                '</div>' +
                '</div>';
        } else {
            var self = this;
            var rowsHtml = this.meetings.map(function (m, index) {
                var isPast = m.status === 'past';
                var removeBtn = '';
                if (self.isManager) {
                    removeBtn = '<div class="cal-cell cal-cell--action">' +
                        '<button class="cal-remove-btn" onclick="PortalApp.removeMeeting(' + index + ')">&#10005;</button>' +
                        '</div>';
                }
                return '<div class="cal-grid cal-grid--row' + colsManager + (isPast ? ' cal-row--past' : '') + '">' +
                    '<div class="cal-cell">' + portalEscapeHtml(m.location || '—') + '</div>' +
                    '<div class="cal-cell cal-cell--mono">' + portalEscapeHtml(m.time || m.date || '—') + '</div>' +
                    '<div class="cal-cell cal-cell--mono">' + portalEscapeHtml(m.fecha || '') + '</div>' +
                    '<div class="cal-cell">' + portalEscapeHtml(m.contact || '—') + '</div>' +
                    '<div class="cal-cell cal-cell--code">' + portalEscapeHtml(m.gate_code || '—') + '</div>' +
                    removeBtn +
                    '</div>';
            }).join('');
            container.innerHTML = headerHtml + rowsHtml;
        }

        if (this.isManager) {
            var addBtn = document.createElement('button');
            addBtn.className = 'pf-pay-btn pf-pay-btn--ghost';
            addBtn.style.marginTop = '12px';
            addBtn.textContent = '+ Schedule Appointment';
            addBtn.onclick = function () { window.PortalApp.addMeetingPrompt(); };
            container.appendChild(addBtn);
        }
    },

    addMeetingPrompt() {
        const location = prompt('Lugar (Ej: Wynwood Arts District, Miami):');
        if (!location) return;
        const time = prompt('Hora (Ej: 4:00 PM):');
        if (!time) return;
        const fecha = prompt('Fecha (Ej: Sábado 14 Jun 2026):');
        if (!fecha) return;
        const contact = prompt('Persona de contacto (nombre y teléfono):');
        const gate_code = prompt('Código de entrada (dejar vacío si no aplica):');

        this.meetings.push({
            location: location.trim(),
            time: time.trim(),
            fecha: fecha.trim(),
            contact: (contact || '').trim() || '—',
            gate_code: (gate_code || '').trim() || '—',
            status: 'upcoming'
        });
        this.renderCalendar();
        this.syncCalendar();
    },

    removeMeeting(index) {
        if (confirm("¿Eliminar esta cita?")) {
            this.meetings.splice(index, 1);
            this.renderCalendar();
            this.syncCalendar();
        }
    },

    async syncCalendar() {
        const existingNotes = this.currentLead.notes ? JSON.parse(this.currentLead.notes) : {};
        existingNotes.meetings = this.meetings;
        this.currentLead.notes = JSON.stringify(existingNotes);
        this.syncLead();
    },

    renderLeadInfo() {
        const l = this.currentLead;
        var welcomeEl = document.getElementById('client-welcome');
        var subEl = document.getElementById('client-welcome-sub');
        var nameWelcome = portalResolveWelcomeName(this._sessionSnapshot, this.clientProfile, l);

        if (welcomeEl) welcomeEl.textContent = portalT('portal-welcome-recognized', nameWelcome);
        if (subEl) {
            subEl.textContent = portalT(portalWelcomeSubI18nKey('lead', this.clientProfile));
            subEl.style.lineHeight = '1.55';
            subEl.style.maxWidth = 'min(640px, 92vw)';
            subEl.style.margin = '0 auto';
            subEl.style.opacity = '0.9';
        }
        this.renderPortalWelcomeAvatar();
        var logLoc = document.getElementById('log-location');
        var logDt = document.getElementById('log-datetime');
        var logGate = document.getElementById('log-gate');
        var logContact = document.getElementById('log-contact');
        var payDeadline = document.getElementById('pay-deadline');
        if (logLoc) logLoc.textContent = l.location || portalT('portal-log-contact-placeholder');
        if (logDt) {
            var rawDt = l.event_date != null ? String(l.event_date).trim() : '';
            if (!rawDt) {
                logDt.textContent = portalT('portal-event-datetime-pending');
            } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDt)) {
                logDt.textContent = rawDt;
            } else {
                var evParse = new Date(rawDt);
                if (!isNaN(evParse.getTime())) {
                    var ymd = rawDt.length >= 10 ? rawDt.slice(0, 10) : rawDt;
                    var hasClock =
                        /T\d{2}:\d{2}/.test(rawDt) &&
                        !/T00:00:00(\.0+)?(Z)?$/i.test(rawDt.replace(/\.\d+/, ''));
                    var hh = evParse.getHours();
                    var mm = evParse.getMinutes();
                    var hasRealTime = hasClock || hh !== 0 || mm !== 0;
                    if (hasRealTime) {
                        logDt.textContent = evParse.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
                    } else {
                        logDt.textContent = ymd;
                    }
                } else {
                    logDt.textContent = rawDt;
                }
            }
        }
        var logTimeIn  = document.getElementById('log-timein');
        var logTimeOut = document.getElementById('log-timeout');
        if (logTimeIn)  logTimeIn.textContent  = l.event_start_time || '—';
        if (logTimeOut) logTimeOut.textContent = l.event_end_time   || '—';
        if (logGate) logGate.textContent = l.gate_code || 'A confirmar';
        var contactLine = l.contact_person && String(l.contact_person).trim()
            ? portalFirstNameOnly(String(l.contact_person).trim())
            : portalT('portal-log-contact-placeholder');
        if (logContact) logContact.textContent = contactLine;

        if (payDeadline && l.event_date) {
            const eventDate = new Date(l.event_date);
            if (!isNaN(eventDate.getTime())) {
                const deadline = new Date(eventDate);
                deadline.setDate(deadline.getDate() - 3);
                payDeadline.textContent = deadline.toLocaleDateString();
                var feedbackCard = document.getElementById('feedback-card');
                if (feedbackCard && new Date() > eventDate) {
                    feedbackCard.style.display = 'block';
                }
            }
        }

        if (this.isManager) {
            this.makeLogisticsEditable();
        }
    },

    /** Avatar circular (misma fuente que header VIP: JWT + client_profiles). */
    renderPortalWelcomeAvatar: function () {
        var el = document.getElementById('portal-welcome-avatar');
        if (!el) return;
        var s = this._sessionSnapshot;
        var cp = this.clientProfile;
        var url = portalGetAvatarUrl(s, cp);
        var nm = portalResolveWelcomeName(s, cp, this.currentLead);
        var initials = portalComputeInitials(nm, s && s.user && s.user.email ? s.user.email : '');
        if (portalIsRealPhotoUrl(url)) {
            var bust = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + Date.now();
            el.style.display = '';
            el.classList.remove('portal-welcome-avatar--initials');
            el.innerHTML =
                '<span class="portal-vip-avatar-ring">' +
                '<img src="' +
                portalEscapeHtml(bust) +
                '" alt="" class="portal-vip-avatar-img" data-portal-av-init="' +
                portalEscapeHtml(initials) +
                '" /></span>';
            var img = el.querySelector('img.portal-vip-avatar-img');
            if (img) {
                img.addEventListener(
                    'error',
                    function onAvErr() {
                        img.removeEventListener('error', onAvErr);
                        var init = img.getAttribute('data-portal-av-init') || '?';
                        el.classList.add('portal-welcome-avatar--initials');
                        el.innerHTML =
                            '<span class="portal-vip-avatar-ring portal-vip-avatar-ring--init">' +
                            '<span class="portal-vip-avatar-initials">' +
                            portalEscapeHtml(init) +
                            '</span></span>';
                    },
                    { once: true }
                );
            }
        } else {
            el.style.display = '';
            el.classList.add('portal-welcome-avatar--initials');
            el.innerHTML =
                '<span class="portal-vip-avatar-ring portal-vip-avatar-ring--init">' +
                '<span class="portal-vip-avatar-initials">' +
                portalEscapeHtml(initials) +
                '</span></span>';
        }
    },

    getManagerBillingUnlocked: function () {
        if (!this.isManager || !this.currentLead || !this.currentLead.id) return true;
        try {
            return sessionStorage.getItem('mdj_portal_staff_billing_' + this.currentLead.id) === '1';
        } catch (e) {
            return false;
        }
    },

    setupManagerBillingBarrier: function () {
        if (!this.isManager) return;
        var card = document.getElementById('portal-financial-card');
        if (!card) return;
        var old = document.getElementById('mdj-manager-billing-mask');
        if (old) old.remove();
        if (this.getManagerBillingUnlocked()) {
            card.style.position = '';
            return;
        }
        card.style.position = 'relative';
        var mask = document.createElement('div');
        mask.id = 'mdj-manager-billing-mask';
        mask.setAttribute('role', 'dialog');
        mask.setAttribute('aria-label', 'Facturación bloqueada');
        mask.style.cssText = [
            'position:absolute',
            'inset:0',
            'z-index:30',
            'border-radius:inherit',
            'background:rgba(6,10,18,0.88)',
            'backdrop-filter:blur(4px)',
            '-webkit-backdrop-filter:blur(4px)',
            'display:flex',
            'flex-direction:column',
            'align-items:center',
            'justify-content:center',
            'padding:24px',
            'text-align:center',
            'gap:14px',
            'box-sizing:border-box'
        ].join(';');
        mask.innerHTML =
            '<p style="margin:0;font-size:15px;font-weight:900;color:var(--gold);">' +
            portalEscapeHtml(portalT('portal-manager-billing-lock-title')) +
            '</p>' +
            '<p style="margin:0;font-size:13px;opacity:0.9;line-height:1.45;max-width:420px;">' +
            portalEscapeHtml(portalT('portal-manager-billing-lock-body')) +
            '</p>' +
            '<button type="button" class="btn primary" id="mdj-manager-billing-unlock-btn" style="margin-top:6px;">' +
            portalEscapeHtml(portalT('portal-manager-billing-unlock-cta')) +
            '</button>';
        card.appendChild(mask);
        var self = this;
        var ub = document.getElementById('mdj-manager-billing-unlock-btn');
        if (ub) {
            ub.onclick = function () {
                void self.promptManagerBillingUnlock();
            };
        }
    },

    clearManagerBillingBarrier: function () {
        var m = document.getElementById('mdj-manager-billing-mask');
        if (m) m.remove();
        var c = document.getElementById('portal-financial-card');
        if (c) c.style.position = '';
    },

    promptManagerBillingUnlock: async function () {
        var pw = prompt(portalT('portal-manager-billing-password-prompt'));
        if (pw == null || !String(pw).length) return;
        var db = window.getSupabaseClient();
        if (!db || !this.currentLead) return;
        var sm = await db.auth.getSession();
        var tok = sm && sm.data && sm.data.session && sm.data.session.access_token;
        if (!tok) return;
        var base = (typeof window.MDB_SUPABASE_URL === 'string' && window.MDB_SUPABASE_URL)
            ? window.MDB_SUPABASE_URL.replace(/\/$/, '')
            : '';
        var key = typeof window.MDB_SUPABASE_ANON_KEY === 'string' ? window.MDB_SUPABASE_ANON_KEY : '';
        if (!base || !key) {
            alert(portalT('portal-manager-billing-config-miss'));
            return;
        }
        try {
            var fnVerify =
                typeof window.mdbSupabaseFunctionUrl === 'function'
                    ? window.mdbSupabaseFunctionUrl('verify-client-billing-unlock')
                    : base + '/functions/v1/verify-client-billing-unlock';
            var r = await fetch(fnVerify, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + tok,
                    apikey: key
                },
                body: JSON.stringify({ lead_id: this.currentLead.id, client_password: String(pw) })
            });
            var j = await r.json().catch(function () {
                return {};
            });
            if (!j || !j.ok) {
                alert(portalT('portal-manager-billing-fail'));
                return;
            }
            sessionStorage.setItem('mdj_portal_staff_billing_' + this.currentLead.id, '1');
            this.clearManagerBillingBarrier();
            this.updatePayments();
        } catch (e) {
            alert(portalT('portal-manager-billing-fail'));
        }
    },

    makeLogisticsEditable() {
        const labels = ['log-location', 'log-gate', 'log-contact'];
        labels.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.cursor = 'pointer';
            el.style.borderBottom = '1px dashed var(--gold)';
            el.title = "Click para editar (Manager)";
            el.onclick = () => {
                const newVal = prompt(`Editar ${id}:`, el.textContent);
                if (newVal !== null) {
                    el.textContent = newVal;
                    this.saveLogistics(id, newVal);
                }
            };
        });
    },

    async saveLogistics(fieldId, val) {
        const fieldMap = { 'log-location': 'location', 'log-gate': 'gate_code', 'log-contact': 'contact_person' };
        const dbField = fieldMap[fieldId];
        if (dbField) {
            this.currentLead[dbField] = val;
            this.syncLead();
        }
    },

    renderCart() {
        const container = document.getElementById('cart-container');
        if (!container) {
            return;
        }

        // Wire Edit Package button with the current lead ID
        var editBtn = document.getElementById('btn-edit-package');
        if (editBtn && this.currentLead && this.currentLead.id) {
            var editHref = './services.html?edit_event=' + encodeURIComponent(this.currentLead.id);
            editBtn.href = editHref;
            // If payment is already started, show a warning tooltip
            var paid = parseFloat((this.currentLead || {}).balance_paid) || 0;
            if (paid > 0.01) {
                editBtn.title = 'A deposit has been paid — contact us to modify a confirmed booking';
                editBtn.style.opacity = '0.45';
                editBtn.style.pointerEvents = 'none';
                editBtn.textContent = '\u2700 Locked (deposit paid)';
            }
        }
        if (!this.items.length) {
            container.innerHTML =
                '<p class="fineprint" style="margin:0;padding:12px 0;text-align:center;opacity:0.9;">' +
                portalEscapeHtml(portalT('portal-cart-empty-services')) +
                '</p>';
        } else {
            container.innerHTML = this.items.map((item, index) => {
                const itemTotal = item.price * item.qty;
                return `
                <div class="cart-item">
                    <div>
                        <strong>${item.name}</strong><br>
                        <small class="fineprint">Cant: ${item.qty}</small>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="val">$${itemTotal.toFixed(2)}</span>
                        ${this.isManager ? `<button onclick="PortalApp.removeItem(${index})" style="background:none; border:none; color:red; cursor:pointer; font-weight:bold;">×</button>` : ''}
                    </div>
                </div>
            `;
            }).join('');
        }

        if (this.isManager) {
            const addBtn = document.createElement('button');
            addBtn.className = "btn primary full";
            addBtn.style.marginTop = "10px";
            addBtn.style.opacity = "0.8";
            addBtn.textContent = "+ Agregar Servicio (Catálogo)";
            addBtn.onclick = () => this.addServicePrompt();
            container.appendChild(addBtn);
        }

        const ft = this.computePortalCartTotals();
        const sub = ft.sub;
        const discount = ft.discount;
        const discountNote = ft.discountNote;
        const tax = ft.tax;
        const total = ft.total;

        document.getElementById('cart-subtotal').textContent = `$${sub.toFixed(2)}`;

        // Show Discount row if applicable
        const discRow = document.getElementById('cart-discount-row');
        const discVal = document.getElementById('cart-discount');
        if (discount > 0) {
            if (discRow) discRow.style.display = 'flex';
            if (discVal) discVal.innerHTML = `<span style="color:var(--gold);">${discountNote}</span>`;
        } else if (discRow) {
            discRow.style.display = 'none';
        }

        document.getElementById('cart-tax').textContent = `$${tax.toFixed(2)}`;
        document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;

        this.currentLead.total_amount = total;
        this.updatePayments();
    },

    addServicePrompt() {
        const name = prompt("Nombre del servicio:");
        if (!name) return;
        const price = parseFloat(prompt("Precio ($):", "100"));
        if (isNaN(price)) return;

        this.items.push({ name, price, qty: 1 });
        this.renderCart();
        this.syncItems();
    },

    removeItem(index) {
        if (confirm("¿Eliminar este servicio?")) {
            this.items.splice(index, 1);
            this.renderCart();
            this.syncItems();
        }
    },

    async syncItems() {
        const existingNotes = this.currentLead.notes ? JSON.parse(this.currentLead.notes) : {};
        existingNotes.selected_services = this.items;
        this.currentLead.notes = JSON.stringify(existingNotes);
        this.syncLead();
    },

    async syncLead() {
        try {
            const db = window.getSupabaseClient();
            if (db) {
                const { error } = await db.from('leads').update(this.currentLead).eq('id', this.currentLead.id);
                if (error) throw error;
                console.log("Lead synced successfully");
            } else {
                throw new Error('no client');
            }
        } catch (e) {
            console.warn("Syncing to localStorage only");
            localStorage.setItem(`lead_${this.currentLead.id}`, JSON.stringify(this.currentLead));
        }
        this.updatePayments();
    },

    updatePayments() {
        const l = this.currentLead;
        const paid = parseFloat(l.balance_paid) || 0;
        const total = parseFloat(l.total_amount) || 0;
        const balance = total - paid;
        const progress = total > 0 ? (paid / total) * 100 : 0;
        const pStatus = l.payment_status || 'UNPAID';

        // Zone 1: summary row elements (in static HTML)
        var depositForSummary = l.deposit_required_usd != null && isFinite(parseFloat(l.deposit_required_usd))
            ? parseFloat(l.deposit_required_usd)
            : portalCalcEventDepositUsd(total);

        var pt  = document.getElementById('pay-total');
        var pp  = document.getElementById('pay-paid');
        var pb  = document.getElementById('pay-balance');
        var pf  = document.getElementById('pay-progress');
        var pds = document.getElementById('pay-deposit-summary');
        var prs = document.getElementById('pay-remaining-summary');
        if (pt)  pt.textContent  = `$${total.toFixed(2)}`;
        if (pp)  pp.textContent  = `$${paid.toFixed(2)}`;
        if (pb)  pb.textContent  = `$${balance.toFixed(2)}`;
        if (pf)  pf.style.width  = `${progress}%`;
        if (pds) {
            if (pStatus === 'PAID') {
                pds.textContent = 'Paid in full';
                pds.style.color = '#4ade80';
            } else if (paid >= depositForSummary - 0.01) {
                pds.textContent = `$${depositForSummary.toFixed(2)} ✓`;
                pds.style.color = '#4ade80';
            } else {
                pds.textContent = `$${depositForSummary.toFixed(2)}`;
            }
        }
        if (prs) {
            if (pStatus === 'PAID') {
                prs.textContent = '$0.00';
                prs.style.color = '#4ade80';
            } else {
                var remaining = Math.max(0, total - depositForSummary);
                prs.textContent = `$${remaining.toFixed(2)}`;
            }
        }

        // Status badge
        const statusColors = { PAID: '#22c55e', PARTIAL: '#f59e0b', PENDING: '#c5a059', PENDING_ZELLE: '#c5a059', UNPAID: '#ef4444' };
        const payStatusEl = document.getElementById('pay-status-badge');
        if (payStatusEl) {
            payStatusEl.textContent = pStatus;
            payStatusEl.style.color = statusColors[pStatus] || '#fff';
        }

        // Zone 2 + 3: dynamic deposit/action section
        this.renderPaymentZones({ total, paid, balance, pStatus });

        // Manager billing link (legacy host, still used for manager-only overlay)
        if (this.isManager && balance > 0 && this.getManagerBillingUnlocked()) {
            this.showManagerStripeLinkButton(balance);
        }

        // Invoice PDF button
        var oldInv = document.getElementById('btn-portal-invoice-pdf');
        if (oldInv) oldInv.remove();
        if (total > 0.009 && typeof window.mdjOpenInvoicePrint === 'function') {
            var invBtn = document.createElement('button');
            invBtn.type = 'button';
            invBtn.id = 'btn-portal-invoice-pdf';
            invBtn.className = 'pf-invoice-btn';
            invBtn.textContent = portalT('portal-invoice-pdf-cta');
            var pz = document.getElementById('portal-payment-zones');
            if (pz) pz.appendChild(invBtn);
            var self = this;
            invBtn.onclick = function () { void self.openNativeInvoicePrint(); };
        }

        this.exportFinanceMeta();
        this.updateReservationBonusBanner();
    },

    /**
     * Renders the dynamic deposit / payment action zones (2 + 3) into #portal-payment-zones.
     * States: UNPAID → deposit action; PENDING_ZELLE → awaiting confirmation; PARTIAL → final balance; PAID → complete.
     */
    renderPaymentZones({ total, paid, balance, pStatus }) {
        var host = document.getElementById('portal-payment-zones');
        if (!host) return;
        host.innerHTML = '';

        // Skip for managers — they use the legacy manager billing button
        if (this.isManager) return;

        var l = this.currentLead || {};
        var depositUsd = l.deposit_required_usd != null && isFinite(parseFloat(l.deposit_required_usd))
            ? parseFloat(l.deposit_required_usd)
            : portalCalcEventDepositUsd(total);

        // Apply active discount (coupon or referral) to deposit
        var activeDiscount = this._activeDiscount || null;
        var referralDiscount = this._getReferralDiscount(total);
        // Coupon takes precedence over referral if both present
        var appliedDiscount = activeDiscount || referralDiscount;
        var discountCents = appliedDiscount ? (appliedDiscount.discount_cents || 0) : 0;
        var depositAfterDiscount = Math.max(0, depositUsd - discountCents / 100);

        // Due date = event_date - 7 days (or TBD)
        var dueDateStr = 'TBD';
        if (l.event_date) {
            try {
                var ed = new Date(l.event_date + 'T12:00:00');
                ed.setDate(ed.getDate() - 7);
                dueDateStr = ed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            } catch (e) { /* ignore */ }
        }

        var zelleEmail = portalCorpZelleEmail();
        var zelleMemo = portalZelleMemoForLead(l.id);

        if (pStatus === 'PAID') {
            host.innerHTML =
                '<div class="pf-zone pf-zone--paid">' +
                '<div class="pf-paid-mark">&#10003;</div>' +
                '<div class="pf-paid-title">Paid in full</div>' +
                '<div class="pf-paid-amount">$' + total.toFixed(2) + '</div>' +
                '<div class="pf-paid-note">Thank you. We look forward to your event!</div>' +
                '</div>';
            return;
        }

        if (pStatus === 'PENDING_ZELLE') {
            host.innerHTML =
                '<div class="pf-zone pf-zone--pending">' +
                '<div class="pf-pending-icon">&#9203;</div>' +
                '<div class="pf-pending-title">Zelle transfer pending confirmation</div>' +
                '<div class="pf-pending-note">Deposit $' + depositUsd.toFixed(2) + ' — a team member will verify and confirm your booking within 24 hours.</div>' +
                '<div class="pf-pending-note" style="margin-top:8px;opacity:0.5;">Keep your Zelle screenshot as proof of payment. Reference: <span style="font-family:monospace;">' + portalEscapeHtml(zelleMemo) + '</span></div>' +
                '</div>' +
                '<div class="pf-zone pf-zone--remaining">' +
                '<div class="pf-row"><span class="pf-label">Remaining balance</span><span class="pf-val">$' + (total - depositUsd).toFixed(2) + '</span></div>' +
                '<div class="pf-row"><span class="pf-label">Final payment due</span><span class="pf-val">' + portalEscapeHtml(dueDateStr) + '</span></div>' +
                '</div>';
            return;
        }

        if (pStatus === 'PARTIAL' || (paid > 0.01 && balance > 0.01)) {
            // Deposit confirmed, balance remaining
            var remainHtml =
                '<div class="pf-zone pf-zone--confirmed">' +
                '<div class="pf-confirmed-mark">&#10003; Deposit received</div>' +
                '<div class="pf-confirmed-amount">$' + paid.toFixed(2) + ' confirmed</div>' +
                '</div>' +
                '<div class="pf-zone pf-zone--remaining">' +
                '<div class="pf-remaining-title">Final payment</div>' +
                '<div class="pf-row"><span class="pf-label">Remaining balance</span><span class="pf-val pf-val--due">$' + balance.toFixed(2) + '</span></div>' +
                '<div class="pf-row"><span class="pf-label">Due by</span><span class="pf-val">' + portalEscapeHtml(dueDateStr) + '</span></div>' +
                '</div>';
            host.insertAdjacentHTML('beforeend', remainHtml);

            // Final balance stripe button
            var self = this;
            var finalBtn = document.createElement('button');
            finalBtn.type = 'button';
            finalBtn.id = 'btn-stripe-pay';
            finalBtn.className = 'pf-pay-btn pf-pay-btn--ghost';
            finalBtn.textContent = 'Pay Final Balance · $' + balance.toFixed(2);
            finalBtn.onclick = function () { void self.payDepositStripe(balance); };
            var remZone = host.querySelector('.pf-zone--remaining');
            if (remZone) remZone.appendChild(finalBtn);
            return;
        }

        // Default: UNPAID — show deposit action zone
        var discountBadge = '';
        if (appliedDiscount) {
            var discLabel = appliedDiscount.source === 'referral'
                ? 'Referral discount applied'
                : ('Code <span class="pf-mono">' + portalEscapeHtml(appliedDiscount.code) + '</span> applied');
            discountBadge =
                '<div class="pf-discount-applied">' +
                '<span class="pf-discount-mark">&#10003;</span> ' + discLabel +
                ' &minus;$' + (discountCents / 100).toFixed(2) +
                '</div>';
        }

        var depositHtml =
            '<div class="pf-zone pf-zone--deposit">' +
            '<div class="pf-deposit-label">Reserve Your Date</div>' +
            '<div class="pf-deposit-note">A deposit is required to confirm your booking</div>' +
            '<div class="pf-deposit-amount">$' + depositAfterDiscount.toFixed(2) + '</div>' +
            (discountCents > 0
                ? '<div class="pf-deposit-original">was $' + depositUsd.toFixed(2) + '</div>'
                : '') +
            '<div class="pf-deposit-pct">30% of contract · minimum $150</div>' +
            discountBadge +
            '</div>';
        host.insertAdjacentHTML('beforeend', depositHtml);

        // Coupon code input (only when no active discount yet)
        if (!appliedDiscount) {
            var couponHtml =
                '<div class="pf-coupon-row" id="pf-coupon-row">' +
                '<input type="text" id="pf-coupon-input" class="pf-coupon-input" placeholder="Promo / discount code" maxlength="40" autocomplete="off" spellcheck="false">' +
                '<button type="button" class="pf-coupon-apply" id="pf-coupon-apply">Apply</button>' +
                '</div>' +
                '<div class="pf-coupon-msg" id="pf-coupon-msg"></div>';
            host.insertAdjacentHTML('beforeend', couponHtml);
            var self0 = this;
            var applyBtn = document.getElementById('pf-coupon-apply');
            var couponInput = document.getElementById('pf-coupon-input');
            if (applyBtn && couponInput) {
                applyBtn.onclick = function () {
                    var code = (couponInput.value || '').trim();
                    if (code) void self0.applyCouponCode(code, Math.round(total * 100));
                };
                couponInput.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter') applyBtn.click();
                });
            }
        } else {
            // Show remove discount link
            var removeHtml = '<div class="pf-coupon-remove"><button type="button" id="pf-coupon-remove">Remove discount</button></div>';
            host.insertAdjacentHTML('beforeend', removeHtml);
            var self0b = this;
            var removeBtn = document.getElementById('pf-coupon-remove');
            if (removeBtn) {
                removeBtn.onclick = function () {
                    self0b._activeDiscount = null;
                    self0b.renderPaymentZones({ total: total, paid: paid, balance: balance, pStatus: pStatus });
                };
            }
        }

        // Stripe pay button
        var self = this;
        var stripeBtn = document.createElement('button');
        stripeBtn.type = 'button';
        stripeBtn.id = 'btn-stripe-pay';
        stripeBtn.className = 'pf-pay-btn';
        stripeBtn.textContent = 'Pay Deposit via Card · $' + depositAfterDiscount.toFixed(2);
        stripeBtn.onclick = function () { void self.payDepositStripe(depositAfterDiscount); };
        var depZone = host.querySelector('.pf-zone--deposit');
        if (depZone) depZone.appendChild(stripeBtn);

        // Zelle secondary
        var zelleHtml =
            '<div class="pf-divider">or pay by bank transfer (Zelle)</div>' +
            '<div class="pf-zone pf-zone--zelle" id="portal-zelle-block">' +
            '<div class="pf-zelle-row"><span class="pf-label">Recipient</span><span class="pf-val">' + portalEscapeHtml(zelleEmail) + '</span></div>' +
            '<div class="pf-zelle-row"><span class="pf-label">Amount</span><span class="pf-val">$' + depositAfterDiscount.toFixed(2) + '</span></div>' +
            '<div class="pf-zelle-row"><span class="pf-label">Memo</span><span class="pf-val pf-mono">' + portalEscapeHtml(zelleMemo) + '</span></div>' +
            '<div class="pf-zelle-note">Keep your Zelle confirmation screenshot. A team member will verify your payment and confirm your event booking.</div>' +
            '<div class="pf-zelle-actions"></div>' +
            '</div>';
        host.insertAdjacentHTML('beforeend', zelleHtml);

        var zelleActions = host.querySelector('.pf-zelle-actions');
        if (zelleActions) {
            var copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'pf-zelle-btn';
            copyBtn.textContent = 'Copy Zelle Info';
            copyBtn.onclick = function () {
                var text = 'Miami DJ Beat — Zelle deposit\nRecipient: ' + zelleEmail +
                    '\nAmount: $' + depositUsd.toFixed(2) + ' USD\nMemo: ' + zelleMemo;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(function () {});
                } else {
                    window.prompt('Copy Zelle info:', text);
                }
                copyBtn.textContent = 'Copied!';
                setTimeout(function () { copyBtn.textContent = 'Copy Zelle Info'; }, 2000);
            };
            zelleActions.appendChild(copyBtn);

            var sentBtn = document.createElement('button');
            sentBtn.type = 'button';
            sentBtn.className = 'pf-zelle-btn pf-zelle-btn--sent';
            sentBtn.textContent = 'I sent it \u2192';
            var self2 = this;
            sentBtn.onclick = function () { void self2.markZelleDepositSent(); };
            zelleActions.appendChild(sentBtn);
        }

        // Zone 3: remaining balance
        var remainingHtml =
            '<div class="pf-zone pf-zone--remaining">' +
            '<div class="pf-row"><span class="pf-label">Remaining balance</span><span class="pf-val">$' + (total - depositUsd).toFixed(2) + '</span></div>' +
            '<div class="pf-row"><span class="pf-label">Final payment due</span><span class="pf-val">' + portalEscapeHtml(dueDateStr) + ' &nbsp;<span class="pf-due-note">(1 week before event)</span></span></div>' +
            '</div>';
        host.insertAdjacentHTML('beforeend', remainingHtml);

        // Security footer
        host.insertAdjacentHTML('beforeend',
            '<div class="pf-security">' +
            '&#128274; Card payments via Stripe (PCI DSS). No card numbers stored on this portal.' +
            '</div>'
        );
    },

    /**
     * Returns referral discount object from localStorage (monetization.js system).
     * Only for the first purchase; returns null if already used or no referral stored.
     */
    _getReferralDiscount(totalUsd) {
        try {
            var refId = window.localStorage.getItem('mdb_referral_dj_id');
            if (!refId) return null;
            var used = window.localStorage.getItem('mdb_client_referral_discount_used');
            if (used === '1') return null;
            var paidBefore = parseFloat((this.currentLead || {}).balance_paid) || 0;
            if (paidBefore > 0.01) return null; // already paid something, discount used
            // $30 max referral discount (mirrors monetization.js CLIENT_FIRST_REFERRAL_DISCOUNT_CENTS)
            var discCents = Math.min(3000, Math.round(totalUsd * 100));
            return {
                source: 'referral',
                code: 'QR/REF',
                label: 'Referral discount (first booking)',
                discount_cents: discCents,
                referral_dj_id: refId
            };
        } catch (e) {
            return null;
        }
    },

    /**
     * Validates a promo/discount code via Supabase RPC (server-side — not fakeable).
     * On success: stores in this._activeDiscount and re-renders payment zones.
     */
    async applyCouponCode(code, orderCents) {
        var msgEl = document.getElementById('pf-coupon-msg');
        var applyBtn = document.getElementById('pf-coupon-apply');
        if (msgEl) { msgEl.textContent = 'Validating…'; msgEl.className = 'pf-coupon-msg pf-coupon-msg--loading'; }
        if (applyBtn) applyBtn.disabled = true;

        try {
            var db = window.getSupabaseClient ? window.getSupabaseClient() : null;
            if (!db) throw new Error('Database not available');

            var { data, error } = await db.rpc('mdj_validate_discount_code', {
                p_code: code.trim().toUpperCase(),
                p_order_cents: orderCents || 0
            });

            if (error) throw new Error(error.message);

            if (!data || !data.valid) {
                if (msgEl) {
                    msgEl.textContent = (data && data.error) ? data.error : 'Invalid code';
                    msgEl.className = 'pf-coupon-msg pf-coupon-msg--error';
                }
                if (applyBtn) applyBtn.disabled = false;
                return;
            }

            // Valid — store and re-render
            this._activeDiscount = {
                source: 'coupon',
                code: data.code,
                label: data.label || data.code,
                discount_cents: data.discount_cents || 0
            };

            // Re-render so discount appears in the UI
            var l = this.currentLead || {};
            var paid = parseFloat(l.balance_paid) || 0;
            var total = parseFloat(l.total_amount) || 0;
            var pStatus = l.payment_status || 'UNPAID';
            this.renderPaymentZones({ total, paid, balance: total - paid, pStatus });

        } catch (err) {
            if (msgEl) {
                msgEl.textContent = 'Could not validate code. Try again.';
                msgEl.className = 'pf-coupon-msg pf-coupon-msg--error';
            }
            if (applyBtn) applyBtn.disabled = false;
        }
    },

    /**
     * Payload for native print invoice (invoice-template-print.html) — aligned with `computePortalCartTotals`.
     * @param {{ includeReturnUrl?: boolean }} opts
     */
    buildInvoiceSalePayload(opts) {
        opts = opts || {};
        var L = this.currentLead || {};
        var ft = this.computePortalCartTotals();
        var lines = [];
        (this.items || []).forEach(function (item) {
            var q = parseInt(item.qty, 10) || 1;
            var unit = parseFloat(item.price) || 0;
            var lineTot = q * unit;
            if (lineTot <= 0 && unit <= 0) return;
            lines.push({ desc: (item.name || 'Service').toString(), qty: q, unit: unit });
        });
        if (ft.discount > 0.009) {
            lines.push({ desc: 'Discounts & credits (MDJ)', qty: 1, unit: -ft.discount });
        }
        if (lines.length === 0) {
            var subPre = Math.max(0, ft.sub - ft.discount);
            if (subPre > 0.009) {
                lines.push({ desc: 'Event services (per contract)', qty: 1, unit: subPre });
            }
        }
        var idStr = L.id != null ? String(L.id) : 'pending';
        var ref = '#INV-' + idStr.replace(/-/g, '').slice(0, 12);
        var dateStr = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        function billBlock(lead) {
            var o = [];
            var company = (lead.client_company_name || lead.renting_company || lead.company_name || '')
                .toString()
                .trim();
            var name = (lead.name || lead.full_name || lead.contact_person || lead.client_name || '')
                .toString()
                .trim();
            var bill = (
                lead.client_billing_address ||
                lead.billing_address ||
                lead.client_address ||
                ''
            )
                .toString()
                .trim();
            if (company) o.push(company);
            if (name) o.push(name);
            if (bill) o.push(bill);
            var em = (lead.email || lead.client_contact || '').toString().trim();
            if (em) o.push(em);
            return o.length ? o.join('\n') : 'Client';
        }
        function eventBlock(lead) {
            var evName = (
                lead.event_name ||
                lead.event_title ||
                lead.job_name ||
                lead.event_type ||
                ''
            )
                .toString()
                .trim();
            var venue = (
                lead.event_location ||
                lead.location ||
                lead.venue ||
                lead.venue_address ||
                ''
            )
                .toString()
                .trim();
            var parts = [];
            if (evName) parts.push(evName);
            if (venue) parts.push(venue);
            var dt = (lead.event_date != null ? String(lead.event_date) : '').trim();
            var tm = (lead.event_time || lead.event_start_time || lead.start_time || '').toString().trim();
            var when = [dt, tm].filter(Boolean).join(' · ');
            if (when) parts.push(when);
            return parts.length ? parts.join('\n') : 'Event';
        }

        var payload = {
            v: 1,
            ref: ref,
            dateStr: dateStr,
            billTo: billBlock(L),
            eventLoc: eventBlock(L),
            lines: lines,
            taxPct: 7,
            notes:
                'Thank you for your business. This document is a record of the transaction. For questions, reply by email.'
        };
        if (opts.includeReturnUrl && L.id) {
            payload.sourceReturnUrl = './client-portal.html?lead=' + encodeURIComponent(L.id);
        }
        return payload;
    },

    openNativeInvoicePrint() {
        if (!this.currentLead) return;
        if (typeof window.mdjOpenInvoicePrint !== 'function') {
            try {
                window.location.href = './invoice-template-print.html';
            } catch (e) { /* ignore */ }
            return;
        }
        window.mdjOpenInvoicePrint(this.buildInvoiceSalePayload({ includeReturnUrl: true }));
    },

    showStripePayButton(balance) {
        var host = document.getElementById('portal-pay-cta-host');
        if (!host || !this.currentLead) return;
        var paid = parseFloat(this.currentLead.balance_paid) || 0;
        var st = this.currentLead.payment_status || 'UNPAID';
        var needsGold = st === 'UNPAID' || paid < 0.01;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-stripe-pay';
        btn.className = needsGold ? 'portal-pay-now-gold' : 'portal-pay-secondary';
        btn.innerHTML = needsGold
            ? `Pay Now &nbsp;·&nbsp; $${balance.toFixed(2)}`
            : `Pay balance — $${balance.toFixed(2)}`;
        btn.onclick = () => this.payDepositStripe(balance);
        host.appendChild(btn);
    },

    showZellePayBlock(balance) {
        var host = document.getElementById('portal-pay-cta-host');
        if (!host || !this.currentLead) return;
        var l = this.currentLead;
        var pStatus = l.payment_status || 'UNPAID';
        var depositUsd =
            l.deposit_required_usd != null && isFinite(parseFloat(l.deposit_required_usd))
                ? parseFloat(l.deposit_required_usd)
                : portalCalcEventDepositUsd(balance);
        var email = portalCorpZelleEmail();
        var memo = portalZelleMemoForLead(l.id);
        var wrap = document.createElement('div');
        wrap.id = 'portal-zelle-block';
        wrap.className = 'portal-zelle-block';
        wrap.style.cssText = '';
        wrap.innerHTML =
            '<p style="margin:0 0 10px;font-weight:600;color:rgba(255,255,255,0.7);font-size:11px;text-transform:uppercase;letter-spacing:0.07em;">' +
            portalEscapeHtml(portalT('portal-zelle-title')) +
            '</p>' +
            '<ul class="logistics-list" style="margin:0 0 12px;">' +
            '<li><span class="label">' +
            portalEscapeHtml(portalT('portal-zelle-recipient')) +
            '</span><span class="val" style="font-size:13px;">' +
            portalEscapeHtml(email) +
            '</span></li>' +
            '<li><span class="label">' +
            portalEscapeHtml(portalT('portal-zelle-amount')) +
            '</span><span class="val">$' +
            depositUsd.toFixed(2) +
            '</span></li>' +
            '<li><span class="label">' +
            portalEscapeHtml(portalT('portal-zelle-memo')) +
            '</span><span class="val" style="font-family:monospace;">' +
            portalEscapeHtml(memo) +
            '</span></li>' +
            '</ul>' +
            (pStatus === 'PENDING_ZELLE'
                ? '<p class="fineprint" style="margin:0 0 10px;opacity:0.9;">' +
                  portalEscapeHtml(portalT('portal-zelle-pending')) +
                  '</p>'
                : '') +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;"></div>';
        var actions = wrap.lastElementChild;
        if (actions) {
            var copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'portal-pay-secondary';
            copyBtn.textContent = portalT('portal-zelle-copy');
            var self = this;
            copyBtn.onclick = function () {
                var text =
                    'Miami DJ Beat — Zelle deposit\nRecipient: ' +
                    email +
                    '\nAmount: $' +
                    depositUsd.toFixed(2) +
                    ' USD\nMemo: ' +
                    memo;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).catch(function () {});
                } else {
                    window.prompt('Zelle', text);
                }
            };
            actions.appendChild(copyBtn);
            if (pStatus !== 'PENDING_ZELLE') {
                var sentBtn = document.createElement('button');
                sentBtn.type = 'button';
                sentBtn.className = 'portal-pay-now-gold';
                sentBtn.textContent = portalT('portal-zelle-sent');
                sentBtn.onclick = function () {
                    void self.markZelleDepositSent();
                };
                actions.appendChild(sentBtn);
            }
        }
        host.appendChild(wrap);
    },

    async markZelleDepositSent() {
        if (!this.currentLead || !this.currentLead.id) return;
        var db = window.getSupabaseClient();
        if (!db) {
            alert(portalT('portal-zelle-sent-fail'));
            return;
        }
        try {
            var r = await db.rpc('client_mark_event_zelle_sent', { p_lead_id: this.currentLead.id });
            var data = r.data;
            if (r.error) throw r.error;
            if (data && data.ok === false) throw new Error(String(data.error || 'rpc_failed'));
            this.currentLead.payment_status = 'PENDING_ZELLE';
            alert(portalT('portal-zelle-sent-ok'));
            this.updatePayments();
        } catch (e) {
            alert(portalT('portal-zelle-sent-fail'));
        }
    },

    async payDepositStripe(balance) {
        const btn = document.getElementById('btn-stripe-pay');
        if (btn) { btn.textContent = 'Conectando con Stripe...'; btn.disabled = true; }

        try {
            // Deposit = 30% of balance or minimum $150
            const depositAmount = Math.max(Math.round(balance * 0.30 * 100), 15000);
            const CHECKOUT_FN =
                typeof window.mdbSupabaseFunctionUrl === 'function'
                    ? window.mdbSupabaseFunctionUrl('create-event-payment')
                    : '';
            if (!CHECKOUT_FN) throw new Error('Supabase URL no configurada');

            const resp = await fetch(CHECKOUT_FN, {
                method: 'POST',
                headers:
                    typeof window.mdjSupabaseAnonInvokeHeaders === 'function'
                        ? window.mdjSupabaseAnonInvokeHeaders()
                        : { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: this.currentLead.id,
                    amount_cents: depositAmount,
                    description:
                        'Depósito de Reserva — ' +
                        String(this.currentLead.event_type != null ? this.currentLead.event_type : 'Evento') +
                        ' · ' +
                        String(this.currentLead.event_date != null ? this.currentLead.event_date : 'TBD'),
                }),
            });

            const result = await mdjPortalFetchCheckoutJson(resp);
            if (!result || !result.url) throw new Error((result && result.error) || 'No se pudo crear la sesión de pago');

            // Open Stripe Checkout in a new tab — keeps the portal open
            window.open(result.url, '_blank', 'noopener,noreferrer');
            if (btn) {
                btn.disabled = false;
                btn.textContent = `Pay Now · $${balance.toFixed(2)}`;
            }
        } catch (err) {
            alert('Error al conectar con Stripe: ' + err.message);
            if (btn) {
                btn.disabled = false;
                btn.textContent = `Pay Now · $${balance.toFixed(2)} — Retry`;
            }
        }
    },

    async handlePaymentReturn() {
        const params = new URLSearchParams(window.location.search);
        const paymentStatus = params.get('payment');
        if (!paymentStatus) return;

        // Clean URL
        window.history.replaceState({}, '', window.location.pathname + '?lead=' + this.currentLead.id);

        if (paymentStatus === 'success') {
            // Fuente de verdad: stripe-webhook suma balance_paid; no escribir aquí (evita doble conteo).
            const db = window.getSupabaseClient();
            if (db && this.currentLead && this.currentLead.id) {
                const leadId = this.currentLead.id;
                const beforePaid = parseFloat(this.currentLead.balance_paid) || 0;
                for (let attempt = 0; attempt < 5; attempt++) {
                    const res = await db
                        .from('leads')
                        .select(MDJ_LEADS_SAFE_COLUMNS)
                        .eq('id', leadId)
                        .maybeSingle();
                    if (res.data) {
                        Object.assign(this.currentLead, res.data);
                        const nowPaid = parseFloat(res.data.balance_paid) || 0;
                        const st = String(res.data.payment_status || '').toUpperCase();
                        if (nowPaid > beforePaid || st === 'PARTIAL' || st === 'PAID') break;
                    }
                    if (attempt < 4) {
                        await new Promise(function (r) {
                            setTimeout(r, 1500);
                        });
                    }
                }
            }

            this.updatePayments();

            if (typeof window.mdjOpenInvoicePrint === 'function' && this.currentLead) {
                try {
                    window.mdjOpenInvoicePrint(
                        this.buildInvoiceSalePayload({ includeReturnUrl: true })
                    );
                    return;
                } catch (eR) {
                    console.error('mdjOpenInvoicePrint', eR);
                }
            }

            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#22c55e;color:#000;padding:16px 28px;border-radius:16px;font-weight:900;font-size:15px;z-index:99999;box-shadow:0 8px 32px rgba(34,197,94,0.4);text-align:center;';
            toast.innerHTML = '✅ ¡Pago recibido!<br><small style="font-weight:600;">Tu depósito ha sido procesado. ¡Tu evento está confirmado!</small>';
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.transition = 'opacity 0.5s'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 6000);
        } else if (paymentStatus === 'cancelled') {
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(197,160,89,0.4);color:#fff;padding:14px 28px;border-radius:16px;font-weight:700;font-size:14px;z-index:99999;';
            toast.textContent = '⚠️ Pago cancelado. Puedes intentarlo nuevamente cuando desees.';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 4000);
        }
    },

    /** Cobro vía enlace Stripe (PCI): el staff no ingresa datos bancarios. */
    showManagerStripeLinkButton(balance) {
        var host = document.getElementById('portal-pay-cta-host');
        if (!host) return;
        var btn = document.getElementById('btn-manager-stripe-link');
        if (!btn) {
            btn = document.createElement('button');
            btn.type = 'button';
            btn.id = 'btn-manager-stripe-link';
            btn.className = 'btn secondary full';
            btn.style.marginTop = '10px';
            btn.textContent = portalT('portal-manager-stripe-link-cta');
            var self = this;
            btn.onclick = function () {
                void self.managerGenerateClientStripeLink(balance);
            };
            host.appendChild(btn);
        }
    },

    async managerGenerateClientStripeLink(balance) {
        var btn = document.getElementById('btn-manager-stripe-link');
        if (btn) {
            btn.disabled = true;
            btn.textContent = portalT('portal-manager-stripe-link-busy');
        }
        try {
            if (!this.currentLead || !this.currentLead.id) {
                throw new Error('Lead ID missing');
            }
            var CHECKOUT_FN =
                typeof window.mdbSupabaseFunctionUrl === 'function'
                    ? window.mdbSupabaseFunctionUrl('create-event-payment')
                    : '';
            if (!CHECKOUT_FN) throw new Error('Supabase URL no configurada');
            var balNum = parseFloat(balance);
            if (isNaN(balNum) || balNum <= 0) balNum = 0.01;
            var amountCents = Math.max(Math.round(balNum * 100), 100);
            var resp = await fetch(CHECKOUT_FN, {
                method: 'POST',
                headers:
                    typeof window.mdjSupabaseAnonInvokeHeaders === 'function'
                        ? window.mdjSupabaseAnonInvokeHeaders()
                        : { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: this.currentLead.id,
                    amount_cents: amountCents,
                    description:
                        'Pago de evento — ' +
                        String(this.currentLead.event_type != null ? this.currentLead.event_type : 'Evento') +
                        ' · ' +
                        String(this.currentLead.event_date != null ? this.currentLead.event_date : 'TBD')
                })
            });
            var result = await mdjPortalFetchCheckoutJson(resp);
            if (!result || !result.url) {
                throw new Error((result && result.error) || 'checkout');
            }
            var url = String(result.url);
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(url);
                    alert(portalT('portal-manager-stripe-link-copied'));
                } else {
                    window.prompt(portalT('portal-manager-stripe-link-prompt'), url);
                }
            } catch (clip) {
                window.prompt(portalT('portal-manager-stripe-link-prompt'), url);
            }
        } catch (e) {
            alert(portalT('portal-manager-stripe-link-fail'));
        }
        if (btn) {
            btn.disabled = false;
            btn.textContent = portalT('portal-manager-stripe-link-cta');
        }
    },

    startCountdown() {
        var countdownEl = document.getElementById('countdown');
        if (!countdownEl || !this.currentLead || !this.currentLead.event_date) return;
        const target = new Date(this.currentLead.event_date).getTime();
        if (!isFinite(target)) return;
        const update = () => {
            const now = new Date().getTime();
            const diff = target - now;
            if (diff < 0) {
                var doneTxt = portalEscapeHtml(portalT('portal-event-finished'));
                countdownEl.innerHTML = "<span class='btn-pill'>" + doneTxt + '</span>';
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            var daysEl = document.getElementById('days');
            var hoursEl = document.getElementById('hours');
            var minsEl = document.getElementById('mins');
            if (daysEl) daysEl.textContent = d.toString().padStart(2, '0');
            if (hoursEl) hoursEl.textContent = h.toString().padStart(2, '0');
            if (minsEl) minsEl.textContent = m.toString().padStart(2, '0');
        };
        update();
        setInterval(update, 60000);
    },

    setupEventListeners() {
        // ... previous listeners ...
        const stars = document.querySelectorAll('.star');
        let selectedRating = 0;

        stars.forEach(star => {
            star.addEventListener('click', () => {
                selectedRating = parseInt(star.dataset.val);
                stars.forEach((s, i) => s.classList.toggle('active', i < selectedRating));
                const feedbackDiv = document.getElementById('low-rating-feedback');
                if (feedbackDiv) feedbackDiv.style.display = (selectedRating < 5) ? 'block' : 'none';
            });
        });

        document.getElementById('submit-review')?.addEventListener('click', async () => {
            if (selectedRating === 0) return alert("Por favor selecciona una calificación.");
            alert("¡Gracias por tu reseña! Ha sido enviada al equipo de MDJPRO.");
        });

        // Chat Listeners
        const chatSend = document.getElementById('chat-send');
        const chatInput = document.getElementById('chat-input');

        chatSend?.addEventListener('click', () => this.handleChatMessage());
        chatInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleChatMessage();
        });

        this.initChat();
    },

    async initChat() {
        var leadId = this.currentLead && this.currentLead.id;
        if (!leadId) return;
        var db = window.getSupabaseClient ? window.getSupabaseClient() : null;
        if (!db) return;

        // 0. Update chat header with the assigned staff member
        var assignedName = (this.currentLead && this.currentLead.assigned_staff_name) || null;
        var titleEl   = document.getElementById('chat-section-title');
        var handlerEl = document.getElementById('chat-handler-name');
        if (titleEl) {
            titleEl.textContent = '💬 ' + (this.isManager ? 'Client Chat' : 'Chat with Your Event Handler');
        }
        if (handlerEl) {
            if (assignedName) {
                handlerEl.textContent = 'Handling your event: ' + assignedName;
                handlerEl.style.color = 'rgba(212,175,55,0.75)';
            } else {
                handlerEl.textContent = 'Assigned handler: Miami DJ Beat Team';
            }
        }

        // 1. Load existing messages
        try {
            var { data: msgs, error } = await db
                .from('portal_messages')
                .select('id, sender_role, body, created_at')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: true })
                .limit(100);

            var container = document.getElementById('chat-messages');
            if (container) container.innerHTML = ''; // clear "Iniciando canal…"

            if (!error && msgs && msgs.length > 0) {
                msgs.forEach((row) => this.addChatMessage({ sender: row.sender_role, body: row.body, ts: row.created_at }));
            } else {
                // Welcome message — only shown locally, not saved
                this.addChatMessage({ sender: 'manager', body: 'Hi! I\'m ready to help you with your event. Send me any question.', ts: null, local: true });
            }
        } catch (e) {
            console.warn('[portal-chat] load failed', e);
        }

        if (!this._myUserId) {
            this.addChatMessage({
                sender: 'system',
                body: 'Inicia sesión para usar el chat.',
                ts: null,
                local: true
            });
        }

        // 2. Subscribe to real-time new messages for this lead
        if (this._chatChannel) {
            try { db.removeChannel(this._chatChannel); } catch (e) { void e; }
        }
        var self = this;
        this._chatChannel = db
            .channel('portal-chat-' + leadId)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'portal_messages',
                filter: 'lead_id=eq.' + leadId
            }, function (payload) {
                var row = payload.new;
                // Skip echoing our own inserts (already shown optimistically)
                if (row && row.sender_id === self._myUserId) return;
                self.addChatMessage({ sender: row.sender_role, body: row.body, ts: row.created_at });
            })
            .subscribe();
    },

    async handleChatMessage() {
        var input = document.getElementById('chat-input');
        var sendBtn = document.getElementById('chat-send');
        var text = (input.value || '').trim();
        if (!text) return;

        var leadId = this.currentLead && this.currentLead.id;
        if (!leadId) return;

        input.value = '';
        if (sendBtn) sendBtn.disabled = true;

        var senderRole = this.isManager ? 'manager' : 'client';

        // Optimistic render
        this.addChatMessage({ sender: senderRole, body: text, ts: new Date().toISOString(), local: true });

        // Persist to Supabase (email: trigger pg_net + optional Edge invoke; no bloquea el chat)
        try {
            var db = window.getSupabaseClient ? window.getSupabaseClient() : null;
            if (db) {
                var ins = await db
                    .from('portal_messages')
                    .insert({
                        lead_id: leadId,
                        sender_id: this._myUserId,
                        sender_role: senderRole,
                        body: text
                    })
                    .select('id, lead_id, sender_id, sender_role, body, created_at')
                    .single();
                if (ins.error) {
                    console.error('[portal-chat] insert failed', ins.error);
                    this.addChatMessage({
                        sender: 'system',
                        body: 'No se pudo enviar el mensaje. Recarga la página o contacta a Miami DJ Beat.',
                        ts: null,
                        local: true
                    });
                } else if (ins.data && db.functions && typeof db.functions.invoke === 'function') {
                    db.functions
                        .invoke('notify-portal-message', { body: { record: ins.data } })
                        .then(function (r) {
                            if (r && r.error) {
                                console.warn('[portal-chat] email notify invoke', r.error);
                            }
                        })
                        .catch(function (eInv) {
                            console.warn('[portal-chat] email notify invoke failed', eInv);
                        });
                }
            }
        } catch (e) {
            void e;
        }

        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    },

    addChatMessage(msg) {
        var container = document.getElementById('chat-messages');
        if (!container) return;

        var isMe = (this.isManager && msg.sender === 'manager') || (!this.isManager && msg.sender === 'client');
        var isSystem = msg.sender === 'system';

        var div = document.createElement('div');

        if (isSystem) {
            div.style.cssText = 'text-align:center;font-size:11px;color:rgba(255,80,80,0.7);padding:6px 0;';
            div.textContent = msg.body;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
            return;
        }

        div.style.cssText = 'max-width:80%;padding:10px 13px;border-radius:12px;font-size:13px;line-height:1.5;' +
            (isMe
                ? 'align-self:flex-end;background:#d4af37;color:#0a0a0a;border-bottom-right-radius:3px;'
                : 'align-self:flex-start;background:rgba(255,255,255,0.09);color:#fff;border-bottom-left-radius:3px;');

        var label = msg.sender === 'manager' ? 'Manager' : 'You';
        var tsStr = '';
        if (msg.ts) {
            try {
                tsStr = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) { void e; }
        }

        div.innerHTML =
            '<div style="font-size:10px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;opacity:0.55;margin-bottom:4px;">' +
            portalEscapeHtml(label) + (tsStr ? ' · ' + tsStr : '') +
            '</div>' +
            portalEscapeHtml(msg.body);

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    /**
     * Sesión activa sin ?lead=: resuelve por email del usuario — sin formulario de email.
     */
    async tryResolvePortalFromSession() {
        try {
            var db = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
            if (!db) return false;
            var session = null;
            var attempt = 0;
            while (attempt < 5 && (!session || !session.user)) {
                var res = await db.auth.getSession();
                session = res.data && res.data.session;
                if (!session || !session.user) {
                    try {
                        var ur = await db.auth.getUser();
                        if (ur && ur.data && ur.data.user) {
                            session = { user: ur.data.user };
                        }
                    } catch (eU) { /* ignore */ }
                }
                if (session && session.user) break;
                await new Promise(function (r) {
                    setTimeout(r, 120 * (attempt + 1));
                });
                attempt++;
            }
            if (!session || !session.user) return false;
            /* 3-BUILDING GUARD: eject staff/owner from client building immediately (JWT-only, no DB). */
            var _cpRole = String((session.user.app_metadata && session.user.app_metadata.role) || '').toLowerCase();
            if (_cpRole === 'owner') {
                window.location.href = './account-profile.html?from_client_portal=1';
                return true;
            }
            if (_cpRole === 'admin' || _cpRole === 'manager' || _cpRole === 'seller') {
                window.location.href = './admin-dashboard.html?from_client_portal=1';
                return true;
            }
            var email = String(session.user.email || '').trim().toLowerCase();
            if (!email) return false;

            var clientRow = null;
            try {
                var rUid = await db.from('client_profiles').select('*').eq('user_id', session.user.id).maybeSingle();
                if (rUid.data) clientRow = rUid.data;
                if (!clientRow) {
                    var rEm = await db.from('client_profiles').select('*').eq('email', email).maybeSingle();
                    if (rEm.data) clientRow = rEm.data;
                }
            } catch (e) { /* ignore */ }

            try {
                portalApplyLanguagePreferenceIfUnset(clientRow && clientRow.language_preference);
            } catch (eLang0) { /* ignore */ }

            var q = await portalFetchLeadsForLoggedInUser(db, session.user.id, email);

            if (q.error) {
                console.warn('portal leads query', q.error);
                this._sessionSnapshot = session;
                this.clientProfile = clientRow || this.clientProfile;
                this.showLoggedInNoEvents(session, clientRow);
                return true;
            }
            var leads = q.data || [];
            if (leads.length === 1) {
                // Enrich the single lead with order_status before redirecting
                try {
                    var eboS = await db.from('event_builder_orders')
                        .select('order_status')
                        .eq('lead_id', leads[0].id)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (eboS.data && eboS.data.order_status) {
                        leads[0] = Object.assign({}, leads[0], { order_status: eboS.data.order_status });
                    }
                } catch(eSingle) { /* fallback */ }
                portalRememberHubLeads(session.user.id, leads);
                var path1 = (window.location.pathname || '/client-portal.html').split('?')[0];
                window.location.replace(path1 + '?lead=' + encodeURIComponent(leads[0].id));
                return true;
            }
            if (leads.length > 1) {
                portalRememberHubLeads(session.user.id, leads);
                try {
                    document.body.classList.remove('portal-resolving-session');
                } catch (eHub) { /* ignore */ }
                this._sessionSnapshot = session;
                this.clientProfile = clientRow || this.clientProfile;
                // Enrich leads with order_status from event_builder_orders
                var leadIds = leads.map(function(l){ return l.id; });
                try {
                    var eboQ = await db.from('event_builder_orders')
                        .select('lead_id, order_status')
                        .in('lead_id', leadIds);
                    if (eboQ.data && eboQ.data.length) {
                        var eboMap = {};
                        eboQ.data.forEach(function(r){ eboMap[r.lead_id] = r.order_status; });
                        leads = leads.map(function(l){
                            return Object.assign({}, l, { order_status: eboMap[l.id] || null });
                        });
                    }
                } catch(eEbo) { /* fallback: no order_status */ }
                this.showMyEventsHub(session, clientRow, leads);
                return true;
            }
            this.showLoggedInNoEvents(session, clientRow);
            return true;
        } catch (err) {
            console.warn('tryResolvePortalFromSession', err);
            try {
                document.body.classList.remove('portal-resolving-session');
            } catch (e2) { /* ignore */ }
            return false;
        }
    },

    /**
     * Varios leads: lista "Mis eventos" con próximos / pasados (sin redirigir solo al primero).
     */
    showMyEventsHub(session, clientRow, leads) {
        try {
            document.body.classList.remove('portal-resolving-session');
        } catch (e0) { /* ignore */ }
        if (session && session.user && session.user.id) {
            portalRememberHubLeads(session.user.id, leads);
        }
        var displayName = portalResolveWelcomeName(session || null, clientRow || null, null);
        var head = document.querySelector('.portal-header');
        if (!head) return;
        this._sessionSnapshot = session || this._sessionSnapshot;
        this.clientProfile = clientRow || this.clientProfile;
        this.currentLead = null;
        var subKeyHub = portalWelcomeSubI18nKey('hub', clientRow || null);
        head.innerHTML =
            '<div class="container" style="padding: 32px 20px 20px;">' +
            '<div id="loyalty-tier-container"></div>' +
            '<div class="portal-header-identity portal-header-identity--solo" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;margin-bottom:8px;">' +
            '<div id="portal-welcome-avatar" class="portal-welcome-avatar" aria-hidden="true"></div>' +
            '<div style="text-align:center;max-width:min(640px,92vw);">' +
            '<h1 id="client-welcome" style="font-size: 26px; margin-bottom: 8px; line-height: 1.35;">' +
            portalEscapeHtml(portalT('portal-welcome-recognized', displayName)) +
            '</h1>' +
            '<p id="client-welcome-sub" style="opacity:0.9;line-height:1.55;margin:0 auto;">' +
            portalEscapeHtml(portalT(subKeyHub)) +
            '</p>' +
            '</div></div></div>';
        this.renderPortalWelcomeAvatar();
        try {
            this.renderLoyaltyBadge(this.clientProfile && this.clientProfile.total_events_booked ? this.clientProfile.total_events_booked : leads.length);
        } catch (eL) { /* ignore */ }

        var upcoming = (leads || []).filter(function (L) {
            return !portalLeadIsPast(L);
        });
        var past = (leads || []).filter(function (L) {
            return portalLeadIsPast(L);
        });

        var TH = 'padding:9px 14px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#fff;background:rgba(197,160,89,0.50);border:1px solid rgba(197,160,89,0.30);text-align:left;white-space:nowrap;';
        var TD = 'padding:10px 14px;font-size:14px;font-weight:600;color:#d4af37;border:1px solid rgba(197,160,89,0.12);background:rgba(0,0,0,0.15);';

        function rowHtml(l) {
            var dt   = l.event_date ? portalEscapeHtml(String(l.event_date).replace(/-/g, ' / ')) : '—';
            var EVENT_TYPE_DISPLAY = { 'After-Party': 'After Party' };
            var rawTy = l.event_type ? String(l.event_type) : 'Event';
            var ty = portalEscapeHtml(EVENT_TYPE_DISPLAY[rawTy] || rawTy);
            var loc  = l.location        ? portalEscapeHtml(String(l.location))             : '—';
            var tin  = l.event_start_time ? portalEscapeHtml(String(l.event_start_time))    : '—';
            var tout = l.event_end_time   ? portalEscapeHtml(String(l.event_end_time))      : '—';
            var ORDER_LABELS = { pending:'Pendiente', in_review:'En Revisión', confirmed:'Confirmado', cancelled:'Cancelado' };
            var ORDER_COLORS = { pending:'#ffb400', in_review:'#7eb8f7', confirmed:'#00c878', cancelled:'#ff6060' };
            // Fallback map for raw lead statuses (no order created yet)
            var LEAD_STATUS_LABELS = { NEW:'Pendiente', MATCHED:'En Revisión', CONFIRMED:'Confirmado', CANCELLED:'Cancelado' };
            var LEAD_STATUS_COLORS = { NEW:'#ffb400', MATCHED:'#7eb8f7', CONFIRMED:'#00c878', CANCELLED:'#ff6060' };
            var rawSt = l.order_status || null;
            var rawLeadSt = l.status ? String(l.status).toUpperCase() : null;
            var stLabel = rawSt
                ? (ORDER_LABELS[rawSt] || rawSt)
                : (rawLeadSt ? (LEAD_STATUS_LABELS[rawLeadSt] || rawLeadSt) : '—');
            var stColor = rawSt
                ? (ORDER_COLORS[rawSt] || '#d4af37')
                : (rawLeadSt ? (LEAD_STATUS_COLORS[rawLeadSt] || '#d4af37') : '#d4af37');
            var st = '<span style="color:' + stColor + ';font-weight:700;">' + stLabel + '</span>';
            var lid  = l.id ? String(l.id).slice(0,8).toUpperCase() : '—';
            var href      = './client-portal.html?lead=' + encodeURIComponent(l.id);
            var hrefOrder = './client-portal.html?lead=' + encodeURIComponent(l.id);
            var leadPill =
                '<span style="font-family:monospace;font-size:13px;font-weight:700;color:#fff;letter-spacing:0.05em;">#' + lid + '</span>';
            var btns =
                '<a href="' + hrefOrder + '" style="display:inline-block;padding:6px 10px;border-radius:6px;border:1px solid rgba(197,160,89,0.6);background:rgba(197,160,89,0.45);color:#fff;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;vertical-align:middle;">Ver Orden</a>' +
                '&nbsp;<button onclick="portalDeleteLead(\'' + l.id + '\',this)" style="display:inline-block;padding:6px 12px;border-radius:6px;border:1px solid rgba(220,60,60,0.6);background:rgba(220,60,60,0.45);color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;box-sizing:border-box;vertical-align:middle;min-width:64px;text-align:center;overflow:hidden;flex-shrink:0;">Delete</button>';
            return '<tr>' +
                '<td style="' + TD + '">' + leadPill + '</td>' +
                '<td style="' + TD + '">' + ty + '</td>' +
                '<td style="' + TD + 'white-space:nowrap;">' + dt + '</td>' +
                '<td style="' + TD + 'white-space:nowrap;">' + tin + '</td>' +
                '<td style="' + TD + 'white-space:nowrap;">' + tout + '</td>' +
                '<td style="' + TD + 'word-break:break-word;white-space:normal;">' + loc + '</td>' +
                '<td style="' + TD + 'color:inherit;">' + st + '</td>' +
                '<td style="' + TD + 'white-space:nowrap;">' + btns + '</td>' +
                '</tr>';
        }

        function buildTable(rows) {
            var emptyRow = !rows.length
                ? '<tr><td colspan="8" style="' + TD + 'text-align:center;color:rgba(255,255,255,0.35);font-style:italic;">Sin registros</td></tr>'
                : '';
            return '<div style="overflow-x:auto;">' +
                '<table style="width:100%;border-collapse:collapse;table-layout:fixed;">' +
                '<colgroup>' +
                '<col style="width:92px;">' +
                '<col style="width:115px;">' +
                '<col style="width:122px;">' +
                '<col style="width:76px;">' +
                '<col style="width:76px;">' +
                '<col>' +
                '<col style="width:112px;">' +
                '<col style="width:185px;">' +
                '</colgroup>' +
                '<thead><tr>' +
                '<th style="' + TH + '">Lead</th>' +
                '<th style="' + TH + '">Tipo de Evento</th>' +
                '<th style="' + TH + '">Fecha</th>' +
                '<th style="' + TH + '">Time In</th>' +
                '<th style="' + TH + '">Time Out</th>' +
                '<th style="' + TH + '">Ubicación</th>' +
                '<th style="' + TH + '">Estado Lead</th>' +
                '<th style="' + TH + '">Acciones</th>' +
                '</tr></thead>' +
                '<tbody>' + (rows.length ? rows.map(rowHtml).join('') : emptyRow) + '</tbody>' +
                '</table></div>';
        }

        var sectionUp =
            '<h3 style="margin:0 0 12px;font-size:15px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(197,160,89,0.9);">' +
            portalEscapeHtml(portalT('portal-events-upcoming')) +
            '</h3>' + buildTable(upcoming);
        var sectionPast =
            '<h3 style="margin:24px 0 12px;font-size:15px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);">' +
            portalEscapeHtml(portalT('portal-events-past')) +
            '</h3>' + buildTable(past);

        var main = document.querySelector('main');
        if (main) {
            main.innerHTML =
                '<div style="width:100%;max-width:none;padding:20px 32px 60px;box-sizing:border-box;">' +
                '<div id="events-list" class="portal-events-list">' +
                sectionUp +
                sectionPast +
                '</div></div>';
            this.portalInjectDupWeddingIfNeeded(leads, session, clientRow, main);
        }
        try {
            var cb = document.getElementById('countdown');
            if (cb) cb.style.display = 'none';
        } catch (eC) { /* ignore */ }
    },

    portalBuildEventTypeSelectOptions(lead) {
        var cur = String(lead && lead.event_type ? lead.event_type : '').trim();
        var choices = [
            'Wedding / Social',
            'Boda / Social',
            'Premium Wedding',
            'Pre-Wedding Party',
            'Engagement',
            'After-Party',
            'Private Party',
            'Corporate Event',
            'Other / Custom'
        ];
        var html = '';
        var i;
        var hasExact = false;
        for (i = 0; i < choices.length; i++) {
            if (choices[i] === cur) hasExact = true;
        }
        if (cur && !hasExact) {
            html +=
                '<option value="' +
                portalEscapeHtml(cur) +
                '" selected>' +
                portalEscapeHtml(cur) +
                '</option>';
        }
        for (i = 0; i < choices.length; i++) {
            var c = choices[i];
            var sel = cur === c || String(cur).toLowerCase() === String(c).toLowerCase() ? ' selected' : '';
            html += '<option value="' + portalEscapeHtml(c) + '"' + sel + '>' + portalEscapeHtml(c) + '</option>';
        }
        return html;
    },

    portalInjectDupWeddingIfNeeded(leads, session, clientRow, main) {
        var dup = portalDetectDoubleWeddingWithinTwelveMonths(leads);
        if (!dup || !main) return;
        var intro = main.querySelector('.container > .info-card');
        var listEl = document.getElementById('events-list');
        if (!intro || !listEl) return;
        var firstName = portalResolveWelcomeName(session || null, clientRow || null, null);
        var msg = portalT('portal-dup-wedding-banner', firstName);
        var banner = document.createElement('div');
        banner.className = 'info-card portal-dup-wedding-banner-wrap';
        banner.style.cssText =
            'margin-bottom:18px;border:1px solid rgba(255,200,120,0.45);background:rgba(197,160,89,0.14);';
        banner.innerHTML =
            '<p style="margin:0 0 12px;line-height:1.55;font-size:15px;">' +
            portalEscapeHtml(msg) +
            '</p>' +
            '<a href="#portal-event-type-cleanup" class="btn secondary" style="display:inline-block;text-decoration:none;">' +
            portalEscapeHtml(portalT('portal-dup-wedding-cta')) +
            '</a>';
        intro.insertAdjacentElement('afterend', banner);

        var self = this;
        function rowBlock(lead) {
            var id = String(lead.id);
            return (
                '<div style="padding:14px;margin-bottom:12px;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.22);">' +
                '<div class="fineprint" style="opacity:0.8;margin-bottom:6px;">' +
                portalEscapeHtml(portalT('portal-events-date')) +
                ': ' +
                portalEscapeHtml(String(lead.event_date || '—')) +
                '</div>' +
                '<select id="portal-hub-type-' +
                portalEscapeHtml(id) +
                '" style="width:100%;max-width:380px;padding:10px;border-radius:10px;margin:8px 0;background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(197,160,89,0.35);">' +
                self.portalBuildEventTypeSelectOptions(lead) +
                '</select>' +
                '<button type="button" class="btn primary" style="margin-top:8px;" data-portal-hub-save="' +
                portalEscapeHtml(id) +
                '">' +
                portalEscapeHtml(portalT('portal-dup-wedding-save')) +
                '</button>' +
                '<p class="fineprint" id="portal-hub-type-msg-' +
                portalEscapeHtml(id) +
                '" style="margin-top:8px;display:none;" aria-live="polite"></p></div>'
            );
        }

        var fix = document.createElement('div');
        fix.id = 'portal-event-type-cleanup';
        fix.className = 'info-card';
        fix.style.marginTop = '8px';
        fix.innerHTML =
            '<h3 style="margin:0 0 8px;font-size:18px;">' +
            portalEscapeHtml(portalT('portal-dup-wedding-fix-title')) +
            '</h3>' +
            '<p class="fineprint" style="line-height:1.5;margin-bottom:16px;opacity:0.88;">' +
            portalEscapeHtml(portalT('portal-dup-wedding-fix-intro')) +
            '</p>' +
            rowBlock(dup.first) +
            rowBlock(dup.second);
        listEl.insertAdjacentElement('afterend', fix);

        fix.querySelectorAll('[data-portal-hub-save]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var lid = btn.getAttribute('data-portal-hub-save');
                if (lid) void self.portalSaveHubEventType(lid);
            });
        });
    },

    async portalSaveHubEventType(leadId) {
        var sel = document.getElementById('portal-hub-type-' + leadId);
        var msgEl = document.getElementById('portal-hub-type-msg-' + leadId);
        if (!sel) return;
        var newType = String(sel.value || '').trim();
        if (!newType) return;
        try {
            var db = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
            if (!db) throw new Error('no db');
            var res = await db.from('leads').update({ event_type: newType }).eq('id', leadId);
            if (res.error) throw res.error;
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.style.color = 'rgba(180,255,200,0.95)';
                msgEl.textContent = portalT('portal-dup-wedding-saved');
            }
            setTimeout(function () {
                window.location.reload();
            }, 900);
        } catch (e) {
            if (msgEl) {
                msgEl.style.display = 'block';
                msgEl.style.color = 'rgba(255,160,160,0.95)';
                msgEl.textContent = portalT('portal-dup-wedding-save-err');
            }
        }
    },

    showLoggedInNoEvents(session, clientRow) {
        try {
            document.body.classList.remove('portal-resolving-session');
        } catch (eR) { /* ignore */ }
        var displayName = portalResolveWelcomeName(session || null, clientRow || null, null);
        var subKeyEmpty = portalWelcomeSubI18nKey('empty', clientRow || null);
        var head = document.querySelector('.portal-header');
        if (!head) return;
        this._sessionSnapshot = session || this._sessionSnapshot;
        this.clientProfile = clientRow || this.clientProfile;
        this.currentLead = null;
        head.innerHTML =
            '<div class="container" style="padding: 40px 20px;">' +
            '<div class="portal-header-identity portal-header-identity--solo" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;margin-bottom:12px;">' +
            '<div id="portal-welcome-avatar" class="portal-welcome-avatar" aria-hidden="true"></div>' +
            '<div style="text-align:center;max-width:min(640px,92vw);margin:0 auto;">' +
            '<h1 id="client-welcome" style="font-size: 26px; margin-bottom: 12px; line-height: 1.35;">' +
            portalEscapeHtml(portalT('portal-welcome-recognized', displayName)) +
            '</h1>' +
            '<p id="client-welcome-sub" style="opacity:0.9;line-height:1.55;margin:0;">' +
            portalEscapeHtml(portalT(subKeyEmpty)) +
            '</p>' +
            '</div></div></div>';
        this.renderPortalWelcomeAvatar();
        var main = document.querySelector('main');
        if (main) {
            main.innerHTML =
                '<div class="container" style="padding: 20px 0 60px;">' +
                '<div class="info-card" style="max-width: 560px; margin: 0 auto; text-align: center;">' +
                '<h3 style="margin-bottom: 12px;">' + portalEscapeHtml(portalT('portal-no-events-title')) + '</h3>' +
                '<p class="fineprint" style="margin-bottom: 22px; line-height: 1.5;">' + portalEscapeHtml(portalT('portal-no-events-body')) + '</p>' +
                '<a href="./rentals.html" class="btn primary" style="display: inline-block;">' + portalEscapeHtml(portalT('portal-no-events-cta')) + '</a>' +
                '</div></div>';
        }
    },

    showNoLeadScreen() {
        try {
            document.body.classList.remove('portal-resolving-session');
        } catch (eG) { /* ignore */ }
        var guestTitle = portalT('portal-guest-title');
        var guestBody = portalT('portal-guest-body');
        var guestSearch = portalT('portal-guest-search');
        document.querySelector('.portal-header').innerHTML = `
            <div class="container" style="padding: 40px 20px; text-align: center;">
                <div class="portal-portal-guest-mark" aria-hidden="true" style="width:88px;height:88px;margin:0 auto 20px;border-radius:50%;border:2px solid rgba(197,160,89,0.85);background:rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;overflow:hidden;box-shadow:0 0 0 2px rgba(0,0,0,0.35),0 6px 24px rgba(197,160,89,0.2);">
                    <img src="./assets/branding/logo-transparent.png" alt="" width="64" height="64" style="object-fit:contain;display:block;"/>
                </div>
                <h1 style="font-size: 28px; margin-bottom: 10px;">${portalEscapeHtml(guestTitle)}</h1>
                <p style="opacity: 0.7; margin-bottom: 30px;">${portalEscapeHtml(guestBody)}</p>
                <div style="max-width: 400px; margin: 0 auto;">
                    <input type="email" id="portal-email-input" placeholder="tu@email.com"
                        style="width: 100%; padding: 14px 20px; border-radius: 50px; border: 1px solid rgba(197,160,89,0.4); background: rgba(255,255,255,0.05); color: #fff; font-size: 16px; margin-bottom: 15px; box-sizing: border-box;">
                    <button onclick="PortalApp.searchByEmail()" class="btn primary"
                        style="width: 100%; padding: 14px; border-radius: 50px; font-size: 16px; font-weight: 900;">
                        🔍 ${portalEscapeHtml(guestSearch)}
                    </button>
                    <p id="portal-search-status" style="margin-top: 15px; font-size: 14px; opacity: 0.7;"></p>
                </div>
            </div>
        `;
        document.querySelector('main').innerHTML = '';
    },

    renderGuestManagerEmergencyScreen() {
        this.isManager = true;
        this.showManagerNotice();
        var head = document.querySelector('.portal-header');
        if (head) {
            head.innerHTML =
                '<div class="container" style="padding:28px 20px 20px;">' +
                '<div style="font-size:40px;margin-bottom:12px;">⚡</div>' +
                '<h1 style="margin:0 0 8px;font-size:24px;">Guest payment (emergency)</h1>' +
                '<p class="fineprint" style="opacity:0.9;max-width:640px;margin:0 auto;line-height:1.5;">' +
                'Create a minimal lead with the client email and amount, then open a Stripe payment link. ' +
                'No client login required. Also: <a href="./manual-invoice-generator.html" style="color:var(--gold);font-weight:800;">Manual invoice (print/PDF) →</a>' +
                '</p></div>';
        }
        var main = document.querySelector('main');
        if (main) {
            main.innerHTML =
                '<div class="container" style="max-width:560px;margin:0 auto;padding:20px 16px 80px;">' +
                '<div class="info-card" style="border-color:var(--gold);">' +
                '<h3 style="color:var(--gold);margin-top:0;">Stripe link + lead</h3>' +
                '<p class="fineprint" style="margin-bottom:16px;">Client email (where Stripe sends the receipt)</p>' +
                '<label class="fineprint">Email</label>' +
                '<input type="email" id="mdj-guest-email" placeholder="cliente@email.com" ' +
                'style="width:100%;box-sizing:border-box;padding:12px 14px;margin:6px 0 14px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,0.25);color:#fff;">' +
                '<label class="fineprint">Amount (USD)</label>' +
                '<input type="number" id="mdj-guest-amount" min="1" step="0.01" placeholder="500" ' +
                'style="width:100%;box-sizing:border-box;padding:12px 14px;margin:6px 0 14px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,0.25);color:#fff;">' +
                '<label class="fineprint">Description (optional)</label>' +
                '<input type="text" id="mdj-guest-desc" placeholder="Event / service label" ' +
                'style="width:100%;box-sizing:border-box;padding:12px 14px;margin:6px 0 18px;border-radius:12px;border:1px solid var(--line);background:rgba(0,0,0,0.25);color:#fff;">' +
                '<button type="button" class="btn primary" id="mdj-guest-stripe-btn" style="width:100%;font-weight:900;">Create lead + payment link</button>' +
                '<p id="mdj-guest-status" class="fineprint" style="margin-top:14px;text-align:center;"></p>' +
                '</div>' +
                '<p class="fineprint" style="text-align:center;margin-top:20px;opacity:0.75;">' +
                '<a href="./admin-quick-invoice.html">Quick invoice page (bookmark)</a></p>' +
                '</div>';
        }
        var self = this;
        var btn = document.getElementById('mdj-guest-stripe-btn');
        if (btn) {
            btn.onclick = function () {
                void self.guestCreateLeadAndStripeLink();
            };
        }
    },

    async guestCreateLeadAndStripeLink() {
        var statusEl = document.getElementById('mdj-guest-status');
        var emailEl = document.getElementById('mdj-guest-email');
        var amtEl = document.getElementById('mdj-guest-amount');
        var descEl = document.getElementById('mdj-guest-desc');
        var email = emailEl && emailEl.value ? String(emailEl.value).trim().toLowerCase() : '';
        var amt = amtEl ? parseFloat(amtEl.value) : NaN;
        var desc = descEl && descEl.value ? String(descEl.value).trim() : '';
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            if (statusEl) statusEl.textContent = 'Enter a valid client email.';
            return;
        }
        if (isNaN(amt) || amt < 1) {
            if (statusEl) statusEl.textContent = 'Enter amount USD (minimum 1).';
            return;
        }
        var db = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
        if (!db) {
            if (statusEl) statusEl.textContent = 'Database not available.';
            return;
        }
        if (statusEl) statusEl.textContent = 'Creating lead…';
        var payload = {
            email: email,
            total_amount: amt,
            balance_paid: 0,
            payment_status: 'UNPAID',
            event_type: 'Guest (manual)',
            event_date: new Date().toISOString().slice(0, 10),
            status: 'NEW',
            source: 'guest_emergency',
            notes: JSON.stringify({
                guest_emergency: true,
                manager_note: desc || undefined
            })
        };
        try {
            var insRes = await db.from('leads').insert([payload]).select('id').single();
            var rowIns = insRes.data;
            var errIns = insRes.error;
            if (errIns || !rowIns || !rowIns.id) {
                if (statusEl) {
                    statusEl.textContent =
                        (errIns && errIns.message) ||
                        'Could not create lead (check permissions / RLS). Use manual-invoice-generator.html or admin-quick-invoice.html.';
                }
                return;
            }
            var newId = rowIns.id;
            var CHECKOUT_FN =
                typeof window.mdbSupabaseFunctionUrl === 'function'
                    ? window.mdbSupabaseFunctionUrl('create-event-payment')
                    : '';
            if (!CHECKOUT_FN) {
                if (statusEl) statusEl.textContent = 'Supabase URL not configured.';
                return;
            }
            var amountCents = Math.max(Math.round(amt * 100), 100);
            var resp = await fetch(CHECKOUT_FN, {
                method: 'POST',
                headers:
                    typeof window.mdjSupabaseAnonInvokeHeaders === 'function'
                        ? window.mdjSupabaseAnonInvokeHeaders()
                        : { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: newId,
                    amount_cents: amountCents,
                    description: desc || 'Miami DJ Beat — payment (guest)'
                })
            });
            var result = await mdjPortalFetchCheckoutJson(resp);
            if (!result || !result.url) {
                throw new Error((result && result.error) || 'No payment URL');
            }
            var url = String(result.url);
            if (statusEl) statusEl.innerHTML = 'Lead created. <strong style="color:var(--gold);">Copy link below.</strong>';
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(url);
                    window.alert('Payment link copied. Send it only to the client.\n\n' + url);
                } else {
                    window.prompt('Copy payment link:', url);
                }
            } catch (eC) {
                window.prompt('Copy payment link:', url);
            }
            try {
                window.history.replaceState(
                    {},
                    '',
                    './client-portal.html?lead=' + encodeURIComponent(newId) + '&mode=manager'
                );
            } catch (eH) { /* ignore */ }
        } catch (e) {
            if (statusEl) statusEl.textContent = String(e && e.message ? e.message : e);
        }
    },

    async searchByEmail() {
        const email = document.getElementById('portal-email-input')?.value.trim().toLowerCase();
        const statusEl = document.getElementById('portal-search-status');
        if (!email) return;

        if (statusEl) statusEl.textContent = portalT('portal-guest-searching');

        try {
            const db = window.getSupabaseClient();
            if (!db) throw new Error('no db');
            const { data, error } = await db
                .from('leads')
                .select('id, event_type, event_date, status')
                .eq('email', email)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error || !data || data.length === 0) {
                if (statusEl) statusEl.textContent = '❌ ' + portalT('portal-guest-not-found');
                return;
            }

            if (data.length === 1) {
                window.location.href =
                    './login.html?redirect=client-portal&lead=' + encodeURIComponent(data[0].id);
            } else {
                const list = data.map(l => {
                    const href =
                        './login.html?redirect=client-portal&lead=' + encodeURIComponent(l.id);
                    return `
                    <a href="${href}" style="display:block; padding: 12px 20px; margin-bottom: 10px;
                        background: rgba(197,160,89,0.1); border: 1px solid rgba(197,160,89,0.3);
                        border-radius: 15px; text-decoration: none; color: #fff;">
                        <strong>${portalEscapeHtml(String(l.event_type || ''))}</strong> — ${portalEscapeHtml(String(l.event_date || ''))}
                        <span style="float:right; font-size:12px; color: var(--gold);">${portalEscapeHtml(String(l.status || ''))}</span>
                    </a>`;
                }).join('');
                if (statusEl) statusEl.innerHTML = `<div style="margin-top:10px;">${list}</div>`;
            }
        } catch (e) {
            if (statusEl) statusEl.textContent = portalT('portal-guest-error');
        }
    },

    showError(msg) {
        document.body.innerHTML = `<div style="padding: 100px; text-align:center;"><h2>${msg}</h2><a href="index.html">Volver al inicio</a></div>`;
    }
};

document.addEventListener('DOMContentLoaded', function () {
    PortalApp.init().catch(function (err) {
        console.error('[portal] init failed', err);
        portalClearLeadPendingShell();
        try {
            PortalApp.showLeadAccessDenied();
        } catch (e2) {
            void e2;
        }
    });
});
