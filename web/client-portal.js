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

/** Stripe Edge: parse JSON y propagar mensaje de error del cuerpo (resp.ok obligatorio). */
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
        'portal-welcome-recognized-sub': 'Welcome to your events panel.',
        'portal-default-tagline': 'Welcome to your events panel.',
        'portal-pick-event-intro': 'Choose an event to open your dashboard.',
        'portal-no-events-title': 'No events linked to this account yet',
        'portal-no-events-body': 'When you book with Miami DJ Beat, your timeline and payments will appear here.',
        'portal-no-events-cta': 'Explore services & booking',
        'portal-events-title': 'My events',
        'portal-events-upcoming': 'Upcoming',
        'portal-events-past': 'Past & history',
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
        'portal-invoice-pdf-busy': 'Opening…'
    },
    es: {
        'portal-welcome-recognized': '¡Hola, {name}!',
        'portal-welcome-recognized-sub': 'Bienvenido a tu panel de eventos.',
        'portal-default-tagline': 'Bienvenido a tu panel de eventos.',
        'portal-pick-event-intro': 'Elige un evento para abrir tu panel.',
        'portal-no-events-title': 'Aún no hay eventos vinculados a esta cuenta',
        'portal-no-events-body': 'Cuando reserves con Miami DJ Beat, tu cronograma y pagos aparecerán aquí.',
        'portal-no-events-cta': 'Ver servicios y reservas',
        'portal-events-title': 'Mis eventos',
        'portal-events-upcoming': 'Próximos',
        'portal-events-past': 'Pasados e historial',
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
        'portal-invoice-pdf-busy': 'Abriendo…'
    }
};

function portalLang() {
    if (window.i18n && window.i18n.currentLang) return window.i18n.currentLang === 'es' ? 'es' : 'en';
    var h = document.documentElement && String(document.documentElement.lang || '').toLowerCase();
    return h.indexOf('es') === 0 ? 'es' : 'en';
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

/** Misma heurística que el header VIP (URL pública real). */
function portalIsRealPhotoUrl(url) {
    if (!url || !String(url).trim()) return false;
    var u = String(url).trim();
    if (/placeholder|dj-avatar-placeholder\.png/i.test(u)) return false;
    return /^https?:\/\//i.test(u) || u.indexOf('data:image/') === 0;
}

function portalGetAvatarUrl(session, clientProfile) {
    var meta = session && session.user && session.user.user_metadata ? session.user.user_metadata : {};
    var u = meta.avatar_url || meta.picture || meta.picture_url;
    if (portalIsRealPhotoUrl(u)) return String(u).split('?')[0];
    if (clientProfile) {
        var c = (clientProfile.avatar_url || clientProfile.photo_url || '').trim();
        if (portalIsRealPhotoUrl(c)) return c.split('?')[0];
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

/**
 * Lista de leads para sesión autenticada: prioriza public.leads.client_user_id = auth user id;
 * fusiona con filas legacy solo vinculadas por email. Orden por created_at.
 */
async function portalFetchLeadsForLoggedInUser(db, sessionUserId, emailNorm) {
    var cols = 'id, event_type, event_date, status, created_at';
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
            .eq('email', emailNorm)
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

/** Omit Stripe / token wiring from browser selects (Edge + webhooks use service_role). */
var MDJ_LEADS_SAFE_COLUMNS =
    'id,email,full_name,phone,event_date,location,gate_code,contact_person,budget,status,notes,lead_outcome,lead_outcome_reason,event_type,assigned_dj_id,assigned_dj_name,client_contact,name,client_name,service_type,created_at,payment_status,balance_paid,total_amount,client_user_id';

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
            var jwtRole = String(
                (sessM.user.app_metadata && sessM.user.app_metadata.role) ||
                    (sessM.user.user_metadata && sessM.user.user_metadata.user_type) ||
                    ''
            ).toLowerCase();
            var prM = await dbM.from('dj_profiles').select('role').eq('user_id', sessM.user.id).maybeSingle();
            var djRole = String((prM && prM.data && prM.data.role) || '').toUpperCase();
            var staffOk =
                jwtRole === 'admin' ||
                jwtRole === 'manager' ||
                djRole === 'MANAGER' ||
                djRole === 'ADMIN';
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
            var jwtGuest = String(
                (sessGuest.user.app_metadata && sessGuest.user.app_metadata.role) ||
                    (sessGuest.user.user_metadata && sessGuest.user.user_metadata.user_type) ||
                    ''
            ).toLowerCase();
            var prGuest = await dbGuest.from('dj_profiles').select('role').eq('user_id', sessGuest.user.id).maybeSingle();
            var djRoleGuest = String((prGuest && prGuest.data && prGuest.data.role) || '').toUpperCase();
            var staffGuestOk =
                jwtGuest === 'admin' ||
                jwtGuest === 'manager' ||
                djRoleGuest === 'MANAGER' ||
                djRoleGuest === 'ADMIN';
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
            await this.waitForSupabaseClient(6000);
            var dbGate = typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null;
            var sessGate = null;
            if (dbGate) {
                var rg = await dbGate.auth.getSession();
                sessGate = rg && rg.data && rg.data.session;
                if (!sessGate || !sessGate.user) {
                    try {
                        var ug = await dbGate.auth.getUser();
                        if (ug && ug.data && ug.data.user) {
                            sessGate = { user: ug.data.user };
                        }
                    } catch (eG) { /* ignore */ }
                }
            }
            if (!sessGate || !sessGate.user) {
                this.showLeadLoginRequired(leadId);
                return;
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
        banner.innerHTML = `🛠 MODO MANAGER ACTIVO - Los cambios que realices se reflejarán al cliente en tiempo real.`;
        document.body.prepend(banner);
        const header = document.querySelector('.header');
        if (header) header.style.marginTop = "40px";
    },

    showLeadLoginRequired(leadId) {
        try {
            document.body.classList.remove('portal-resolving-session');
        } catch (e0) { /* ignore */ }
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
        try {
            document.body.classList.remove('portal-resolving-session');
        } catch (e1) { /* ignore */ }
        var head = document.querySelector('.portal-header');
        var main = document.querySelector('main');
        var title = portalT('portal-lead-access-denied-title');
        var body = portalT('portal-lead-access-denied-body');
        var back = portalT('portal-lead-access-denied-back');
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
                '<a href="./index.html" class="btn primary" style="display:inline-block;padding:14px 28px;border-radius:50px;font-weight:900;">' +
                portalEscapeHtml(back) +
                '</a></div>';
        }
        if (main) main.innerHTML = '';
        try {
            window.history.replaceState({}, '', window.location.pathname + '?access_denied=1');
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
            try {
                const { data: rowPeek, error: eEm } = await db
                    .from('leads')
                    .select('email, client_user_id')
                    .eq('id', leadId)
                    .maybeSingle();
                if (eEm || !rowPeek) {
                    this.showLeadAccessDenied();
                    return;
                }
                var rowEmail = rowPeek.email ? String(rowPeek.email).trim().toLowerCase() : '';
                var emailOk = rowEmail && rowEmail === sessionEmail;
                var uidOk =
                    sessionUserId &&
                    rowPeek.client_user_id &&
                    String(rowPeek.client_user_id) === sessionUserId;
                if (!emailOk && !uidOk) {
                    this.showLeadAccessDenied();
                    return;
                }
            } catch (e1) {
                this.showLeadAccessDenied();
                return;
            }
        }

        try {
            if (db) {
                const { data, error } = await db
                    .from('leads')
                    .select(MDJ_LEADS_SAFE_COLUMNS)
                    .eq('id', leadId)
                    .single();
                if (data) leadData = data;
                else if (!this.isManager && error) {
                    var ec = String(error.code || '');
                    if (ec === 'PGRST116' || ec === '42501') {
                        this.showLeadAccessDenied();
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn("Supabase fetch failed, using local fallback");
        }

        if (!leadData) {
            if (!this.isManager) {
                this.showLeadAccessDenied();
                return;
            }
            const saved = localStorage.getItem(`lead_${leadId}`);
            leadData = saved ? JSON.parse(saved) : {
                id: leadId,
                email: "client@example.com",
                event_type: "Evento Corporativo",
                event_date: "2026-12-31",
                location: "Miami Beach Convention Center",
                contact_person: "Gerardo V.",
                gate_code: "1234#",
                total_amount: 0,
                balance_paid: 0,
                payment_status: "UNPAID",
                status: "CONFIRMED",
                created_at: new Date(Date.now() - 72 * 3600000).toISOString()
            };
        }

        this.currentLead = leadData;
        await this.loadLeadItems(leadId);
        await this.fetchClientProfile(leadData.email);
        this.renderLeadInfo();
        this.startCountdown();
        if (this.isManager) {
            this.setupManagerBillingBarrier();
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
            var lp = this.clientProfile && this.clientProfile.language_preference;
            if ((lp === 'es' || lp === 'en') && window.i18n && typeof window.i18n.setLanguage === 'function') {
                window.i18n.setLanguage(lp);
            }
        } catch (eLang) { /* ignore */ }
        this.renderLoyaltyBadge(this.clientProfile?.total_events_booked || 1);
        this.renderCart();
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
        if (this.currentLead.notes) {
            try {
                const parsed = JSON.parse(this.currentLead.notes);
                items = parsed.selected_services || [
                    { name: "DJ Performance (6 Hours)", price: 800, qty: 1 },
                    { name: "Sistema de Audio RCF Pro", price: 400, qty: 1 }
                ];
                meetings = parsed.meetings || [
                    { title: "Sita Telefónica", date: "Finalizada", status: "past" },
                    { title: "Visita Técnica Venue", date: "Mañana - 2:00 PM", status: "upcoming", location: "Doral, FL" }
                ];
            } catch (e) {
                items = [{ name: "DJ Performance (6 Hours)", price: 800, qty: 1 }];
                meetings = [{ title: "Cita Inicial", date: "Pendiente", status: "upcoming" }];
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

        container.innerHTML = this.meetings.map((m, index) => `
            <div class="cart-item" style="flex-direction: column; align-items: flex-start; ${m.status === 'past' ? 'opacity: 0.5' : ''}">
                <div style="display:flex; justify-content:space-between; width:100%;">
                    <span class="val">${m.title}</span>
                    ${this.isManager ? `<button onclick="PortalApp.removeMeeting(${index})" style="background:none; border:none; color:red; cursor:pointer;">×</button>` : ''}
                </div>
                <span class="fineprint">${m.date}</span>
                ${m.location ? `<span class="fineprint">📍 ${m.location}</span>` : ''}
            </div>
        `).join('');

        if (this.isManager) {
            const addBtn = document.createElement('button');
            addBtn.className = "btn-pill";
            addBtn.style.width = "100%";
            addBtn.style.marginTop = "10px";
            addBtn.textContent = "+ Programar Cita/Sita";
            addBtn.onclick = () => this.addMeetingPrompt();
            container.appendChild(addBtn);
        }
    },

    addMeetingPrompt() {
        const title = prompt("Título de la cita (Ej: Visita técnica):");
        if (!title) return;
        const date = prompt("Día y hora (Ej: Lunes 4:00 PM):");
        const location = prompt("Ubicación (opcional):");

        this.meetings.push({ title, date, location, status: "upcoming" });
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
        if (subEl) subEl.textContent = portalT('portal-welcome-recognized-sub');
        this.renderPortalWelcomeAvatar();
        document.getElementById('log-location').textContent = l.location;
        document.getElementById('log-datetime').textContent = `${l.event_date} - 7:00 PM`;
        document.getElementById('log-gate').textContent = l.gate_code || "A confirmar";
        var contactLine = l.contact_person && String(l.contact_person).trim()
            ? portalFirstNameOnly(String(l.contact_person).trim())
            : portalT('portal-log-contact-placeholder');
        document.getElementById('log-contact').textContent = contactLine;

        const eventDate = new Date(l.event_date);
        const deadline = new Date(eventDate);
        deadline.setDate(deadline.getDate() - 3);
        document.getElementById('pay-deadline').textContent = deadline.toLocaleDateString();

        if (new Date() > eventDate) {
            document.getElementById('feedback-card').style.display = 'block';
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
            var bust = url.indexOf('?') >= 0 ? url : url + '?v=' + Date.now();
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
            var r = await fetch(base + '/functions/v1/verify-client-billing-unlock', {
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

        var pt = document.getElementById('pay-total');
        var pp = document.getElementById('pay-paid');
        var pb = document.getElementById('pay-balance');
        var pf = document.getElementById('pay-progress');
        if (pt) pt.textContent = `$${total.toFixed(2)}`;
        if (pp) pp.textContent = `$${paid.toFixed(2)}`;
        if (pb) pb.textContent = `$${balance.toFixed(2)}`;
        if (pf) pf.style.width = `${progress}%`;

        // Payment status badge
        const pStatus = l.payment_status || 'UNPAID';
        const statusColors = { PAID: '#22c55e', PARTIAL: '#f59e0b', PENDING: '#c5a059', UNPAID: '#ef4444' };
        const payStatusEl = document.getElementById('pay-status-badge');
        if (payStatusEl) {
            payStatusEl.textContent = pStatus;
            payStatusEl.style.color = statusColors[pStatus] || '#fff';
        }

        var oldPay = document.getElementById('btn-stripe-pay');
        if (oldPay) oldPay.remove();
        var mgrPay = document.getElementById('btn-manager-stripe-link');
        if (mgrPay) mgrPay.remove();
        if (!this.isManager) {
            var abx = document.getElementById('btn-add-abono');
            if (abx) abx.remove();
        }

        // Show Stripe pay button to CLIENT if balance > 0 and not PAID
        if (!this.isManager && balance > 0 && pStatus !== 'PAID') {
            this.showStripePayButton(balance);
        }

        if (this.isManager && balance > 0 && this.getManagerBillingUnlocked()) {
            this.showManagerStripeLinkButton(balance);
        }

        var oldInv = document.getElementById('btn-portal-invoice-pdf');
        if (oldInv) oldInv.remove();
        if (total > 0.009 && typeof window.mdjOpenInvoicePrint === 'function') {
            var invBtn = document.createElement('button');
            invBtn.type = 'button';
            invBtn.id = 'btn-portal-invoice-pdf';
            invBtn.className = 'btn secondary full';
            invBtn.style.marginTop = '10px';
            invBtn.textContent = portalT('portal-invoice-pdf-cta');
            var self = this;
            invBtn.onclick = function () {
                void self.openNativeInvoicePrint();
            };
            var payHost = document.getElementById('portal-pay-cta-host');
            if (payHost && payHost.parentNode) {
                payHost.parentNode.insertBefore(invBtn, payHost.nextSibling);
            }
        }

        this.exportFinanceMeta();
        this.updateReservationBonusBanner();
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
            ? `<span style="font-size:18px;">💳</span> ${portalT('portal-pay-now')} &nbsp;·&nbsp; $${balance.toFixed(2)}`
            : `<span style="font-size:16px;">💳</span> Pagar saldo ($${balance.toFixed(2)}) — Stripe`;
        btn.onclick = () => this.payDepositStripe(balance);
        host.appendChild(btn);
    },

    async payDepositStripe(balance) {
        const btn = document.getElementById('btn-stripe-pay');
        if (btn) { btn.textContent = 'Conectando con Stripe...'; btn.disabled = true; }

        try {
            // Deposit = 30% of balance or minimum $150
            const depositAmount = Math.max(Math.round(balance * 0.30 * 100), 15000);
            const CHECKOUT_FN = 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/create-event-payment';

            const resp = await fetch(CHECKOUT_FN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

            // Redirect to Stripe Checkout
            window.location.href = result.url;
        } catch (err) {
            alert('Error al conectar con Stripe: ' + err.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `<span style="font-size:18px;">💳</span> ${portalT('portal-pay-now')} · Reintentar`;
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
            // Update lead payment_status to PARTIAL (full confirmation comes via webhook)
            const db = window.getSupabaseClient();
            if (db) {
                const newPaid = (parseFloat(this.currentLead.balance_paid) || 0) +
                    Math.max(parseFloat(this.currentLead.total_amount) * 0.30, 150);
                await db.from('leads').update({
                    payment_status: 'PARTIAL',
                    balance_paid: newPaid,
                }).eq('id', this.currentLead.id);
                this.currentLead.payment_status = 'PARTIAL';
                this.currentLead.balance_paid = newPaid;
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
            var CHECKOUT_FN = 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/create-event-payment';
            var balNum = parseFloat(balance);
            if (isNaN(balNum) || balNum <= 0) balNum = 0.01;
            var amountCents = Math.max(Math.round(balNum * 100), 100);
            var resp = await fetch(CHECKOUT_FN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
        const target = new Date(this.currentLead.event_date).getTime();
        const update = () => {
            const now = new Date().getTime();
            const diff = target - now;
            if (diff < 0) {
                var doneTxt = portalEscapeHtml(portalT('portal-event-finished'));
                document.getElementById('countdown').innerHTML = "<span class='btn-pill'>" + doneTxt + '</span>';
                return;
            }

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            document.getElementById('days').textContent = d.toString().padStart(2, '0');
            document.getElementById('hours').textContent = h.toString().padStart(2, '0');
            document.getElementById('mins').textContent = m.toString().padStart(2, '0');
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

    initChat() {
        // Listen for new messages in real-time via Supabase
        // In this demo, we use a simple interval/mock
        this.addChatMessage({
            sender: 'manager',
            text: '¡Hola! Estoy listo para ayudarte con tu evento.',
            lang: 'es',
            translated: 'Hi! I am ready to help you with your event.'
        });
    },

    async handleChatMessage() {
        const input = document.getElementById('chat-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        const sender = this.isManager ? 'manager' : 'client';

        // AI Bridge: Translation + Auto-Correct
        const processed = await this.aiBridgeProcess(text, sender);

        this.addChatMessage({
            sender: sender,
            text: processed.corrected,
            lang: this.currentLead.lang || 'es',
            translated: processed.translated
        });

        // Sync to Supabase in real app:
        // await supabase.from('messages').insert([{ lead_id: id, sender, text: processed.corrected, translated: processed.translated }]);
    },

    async aiBridgeProcess(text, sender) {
        // Simple AI Simulation for Auto-correct and Translation
        let corrected = text;

        if (sender === 'manager') {
            // Manager speaks ES -> Auto-correct ES + Translate to EN
            corrected = text
                .replace(/\bola\b/gi, "Hola")
                .replace(/\bkliente\b/gi, "cliente")
                .replace(/\bestas\b/gi, "estás")
                .replace(/\bestamos\b/gi, "estamos");

            const translation = await this.mockTranslate(corrected, 'en');
            return { corrected, translated: translation };
        } else {
            // Client speaks EN -> Translate to ES
            const translation = await this.mockTranslate(text, 'es');
            return { corrected: text, translated: translation };
        }
    },

    mockTranslate(text, targetLang) {
        const dictionary = {
            'hola': 'Hello',
            'estás': 'are you',
            'estamos': 'we are',
            'como': 'how',
            'cliente': 'client',
            'hi': 'hola',
            'how are you': '¿cómo estás?',
            'payment': 'pago',
            'total': 'total',
            'confirmed': 'confirmado',
            'event': 'evento'
        };

        let translated = text;
        const lower = text.toLowerCase();

        Object.keys(dictionary).forEach(key => {
            if (lower.includes(key)) {
                translated = translated.replace(new RegExp(key, 'gi'), dictionary[key]);
            }
        });

        if (translated === text) {
            translated = targetLang === 'en' ? `[AI Trans: ${text}]` : `[Traducción: ${text}]`;
        }

        return translated;
    },

    addChatMessage(msg) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const isMe = (this.isManager && msg.sender === 'manager') || (!this.isManager && msg.sender === 'client');
        const displayedText = (this.isManager && msg.sender === 'client') || (!this.isManager && msg.sender === 'manager')
            ? msg.translated : msg.text;

        const div = document.createElement('div');
        div.style = `max-width: 80%; padding: 10px; border-radius: 12px; font-size: 14px; ${isMe ? 'align-self: flex-end; background: var(--gold); color: #000;' : 'align-self: flex-start; background: rgba(255,255,255,0.1); color: #fff;'}`;

        div.innerHTML = `
            <strong>${msg.sender === 'manager' ? 'Admin' : 'Cliente'}:</strong><br>
            ${displayedText}
            ${!isMe ? `<br><small style="opacity:0.5; font-size: 10px;">Org: ${msg.text}</small>` : ''}
        `;

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
                var lp0 = clientRow && clientRow.language_preference;
                if ((lp0 === 'es' || lp0 === 'en') && window.i18n && typeof window.i18n.setLanguage === 'function') {
                    window.i18n.setLanguage(lp0);
                }
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
                var path1 = (window.location.pathname || '/client-portal.html').split('?')[0];
                window.location.replace(path1 + '?lead=' + encodeURIComponent(leads[0].id));
                return true;
            }
            if (leads.length > 1) {
                try {
                    document.body.classList.remove('portal-resolving-session');
                } catch (eHub) { /* ignore */ }
                this._sessionSnapshot = session;
                this.clientProfile = clientRow || this.clientProfile;
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
        var displayName = portalResolveWelcomeName(session || null, clientRow || null, null);
        var head = document.querySelector('.portal-header');
        if (!head) return;
        this._sessionSnapshot = session || this._sessionSnapshot;
        this.clientProfile = clientRow || this.clientProfile;
        this.currentLead = null;
        head.innerHTML =
            '<div class="container" style="padding: 32px 20px 20px;">' +
            '<div id="loyalty-tier-container"></div>' +
            '<div class="portal-header-identity portal-header-identity--solo" style="display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;margin-bottom:8px;">' +
            '<div id="portal-welcome-avatar" class="portal-welcome-avatar" aria-hidden="true"></div>' +
            '<div style="text-align:center;">' +
            '<div style="font-size: 36px; margin-bottom: 10px;">🎧</div>' +
            '<h1 id="client-welcome" style="font-size: 26px; margin-bottom: 8px; line-height: 1.35;">' +
            portalEscapeHtml(portalT('portal-welcome-recognized', displayName)) +
            '</h1>' +
            '<p id="client-welcome-sub" style="opacity: 0.85;">' + portalEscapeHtml(portalT('portal-welcome-recognized-sub')) + '</p>' +
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

        function cardHtml(l) {
            var dt = l.event_date ? portalEscapeHtml(String(l.event_date)) : '—';
            var ty = l.event_type ? portalEscapeHtml(String(l.event_type)) : 'Event';
            var st = l.status ? portalEscapeHtml(String(l.status)) : '';
            var href = '?lead=' + encodeURIComponent(l.id);
            return (
                '<a href="' +
                href +
                '" class="portal-event-card" style="display:block;padding:14px 18px;margin-bottom:10px;border-radius:14px;text-decoration:none;color:#fff;border:1px solid rgba(197,160,89,0.35);background:rgba(197,160,89,0.08);">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">' +
                '<div><strong style="color:var(--gold);">' +
                ty +
                '</strong><div class="fineprint" style="margin-top:4px;opacity:0.75;">' +
                portalEscapeHtml(portalT('portal-events-date')) +
                ': ' +
                dt +
                '</div></div>' +
                '<div style="text-align:right;"><span class="fineprint" style="opacity:0.65;">' +
                portalEscapeHtml(portalT('portal-events-status')) +
                '</span><br><span style="font-weight:800;">' +
                st +
                '</span><br><span style="font-size:12px;color:var(--gold);font-weight:800;">' +
                portalEscapeHtml(portalT('portal-events-open')) +
                ' →</span></div></div></a>'
            );
        }

        var sectionUp =
            '<h3 style="margin:0 0 12px;font-size:15px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(197,160,89,0.9);">' +
            portalEscapeHtml(portalT('portal-events-upcoming')) +
            '</h3><div class="portal-events-sublist">' +
            (upcoming.length
                ? upcoming.map(cardHtml).join('')
                : '<p class="fineprint" style="opacity:0.6;">—</p>') +
            '</div>';
        var sectionPast =
            '<h3 style="margin:24px 0 12px;font-size:15px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.45);">' +
            portalEscapeHtml(portalT('portal-events-past')) +
            '</h3><div class="portal-events-sublist portal-events-sublist--past">' +
            (past.length ? past.map(cardHtml).join('') : '<p class="fineprint" style="opacity:0.45;">—</p>') +
            '</div>';

        var main = document.querySelector('main');
        if (main) {
            main.innerHTML =
                '<div class="container" style="padding: 20px 0 60px;max-width:720px;margin:0 auto;">' +
                '<div class="info-card" style="margin-bottom:20px;">' +
                '<h2 style="margin:0 0 6px;font-size:22px;">' +
                portalEscapeHtml(portalT('portal-events-title')) +
                '</h2>' +
                '<p class="fineprint" style="opacity:0.7;margin:0;">' +
                portalEscapeHtml(portalT('portal-pick-event-intro')) +
                '</p></div>' +
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
        var head = document.querySelector('.portal-header');
        if (!head) return;
        this._sessionSnapshot = session || this._sessionSnapshot;
        this.clientProfile = clientRow || this.clientProfile;
        this.currentLead = null;
        head.innerHTML =
            '<div class="container" style="padding: 40px 20px;">' +
            '<div class="portal-header-identity portal-header-identity--solo" style="display:flex;align-items:center;justify-content:center;gap:18px;flex-wrap:wrap;margin-bottom:12px;">' +
            '<div id="portal-welcome-avatar" class="portal-welcome-avatar" aria-hidden="true"></div>' +
            '<div style="text-align:center;">' +
            '<div style="font-size: 42px; margin-bottom: 16px;">🎧</div>' +
            '<h1 id="client-welcome" style="font-size: 26px; margin-bottom: 12px; line-height: 1.35;">' +
            portalEscapeHtml(portalT('portal-welcome-recognized', displayName)) +
            '</h1>' +
            '<p id="client-welcome-sub" style="opacity: 0.85;">' + portalEscapeHtml(portalT('portal-welcome-recognized-sub')) + '</p>' +
            '</div></div>';
        this.renderPortalWelcomeAvatar();
        var main = document.querySelector('main');
        if (main) {
            main.innerHTML =
                '<div class="container" style="padding: 20px 0 60px;">' +
                '<div class="info-card" style="max-width: 560px; margin: 0 auto; text-align: center;">' +
                '<h3 style="margin-bottom: 12px;">' + portalEscapeHtml(portalT('portal-no-events-title')) + '</h3>' +
                '<p class="fineprint" style="margin-bottom: 22px; line-height: 1.5;">' + portalEscapeHtml(portalT('portal-no-events-body')) + '</p>' +
                '<a href="./jobs.html" class="btn primary" style="display: inline-block;">' + portalEscapeHtml(portalT('portal-no-events-cta')) + '</a>' +
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
            <div class="container" style="padding: 40px 20px;">
                <div style="font-size: 48px; margin-bottom: 20px;">🎧</div>
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
            var CHECKOUT_FN = 'https://hkuvuqupbxwkiykxvqdr.supabase.co/functions/v1/create-event-payment';
            var amountCents = Math.max(Math.round(amt * 100), 100);
            var resp = await fetch(CHECKOUT_FN, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

document.addEventListener('DOMContentLoaded', () => PortalApp.init());
