/**
 * Account / client billing — payment method UI gate.
 *
 * Historically the Payment Method row was hard-disabled. Operators can re-lock
 * the Stripe/PayPal row by setting:
 *   window.MDJ_PAYMENT_GATEWAY_PENDING_ROLLOUT = true
 * before this script loads (rare). Default is false = buttons active.
 *
 * Server keys (not in this repo): Supabase Edge / functions use STRIPE_SECRET_KEY;
 * publishable flows may use Vercel or hosting env for STRIPE_PUBLISHABLE_KEY where applicable.
 */
(function () {
    'use strict';

    /* TOTAL-FREEDOM: default unlocked. Operators may set window.MDJ_PAYMENT_GATEWAY_PENDING_ROLLOUT = true before this script to re-lock UI. */
    if (typeof window.MDJ_PAYMENT_GATEWAY_PENDING_ROLLOUT === 'undefined') {
        window.MDJ_PAYMENT_GATEWAY_PENDING_ROLLOUT = false;
    }

    function gatewayLocked() {
        return window.MDJ_PAYMENT_GATEWAY_PENDING_ROLLOUT === true;
    }

    function wireZelleSetup() {
        var btn = document.getElementById('btn-zelle-setup-flow');
        var panel = document.getElementById('zelle-flow-panel');
        if (!btn || !panel) return;
        btn.addEventListener('click', function (e) {
            e.preventDefault();
            var hidden = panel.style.display === 'none' || panel.style.display === '';
            panel.style.display = hidden ? 'block' : 'none';
        });
    }

    function wireAccountSettingsPayments() {
        wireZelleSetup();

        var card = document.getElementById('btn-payment-connect-stripe');
        var paypal = document.getElementById('btn-payment-connect-paypal');
        if (!card && !paypal) return;

        function goBilling() {
            window.location.href = './client-billing.html#saved-payments';
        }

        if (gatewayLocked()) {
            if (card) {
                card.classList.add('disabled');
                card.setAttribute('aria-disabled', 'true');
            }
            if (paypal) {
                paypal.classList.add('disabled');
                paypal.setAttribute('aria-disabled', 'true');
            }
            return;
        }

        if (card) {
            card.classList.remove('disabled');
            card.removeAttribute('aria-disabled');
            card.addEventListener('click', function (e) {
                e.preventDefault();
                goBilling();
            });
        }
        if (paypal) {
            paypal.classList.remove('disabled');
            paypal.removeAttribute('aria-disabled');
            paypal.addEventListener('click', function (e) {
                e.preventDefault();
                goBilling();
            });
        }
    }

    function wireClientBillingPage() {
        var btn = document.getElementById('client-billing-launch-setup');
        if (!btn) return;
        if (gatewayLocked()) {
            btn.disabled = true;
            return;
        }
        btn.disabled = false;
        btn.addEventListener('click', function () {
            window.location.href = './account-settings.html#account-payment-methods';
        });
    }

    function scrollPaymentHash() {
        if (!window.location.hash || window.location.hash.indexOf('account-payment-methods') === -1) return;
        var el = document.getElementById('account-payment-methods');
        if (el) {
            try {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (e) {
                el.scrollIntoView(true);
            }
        }
    }

    function init() {
        wireAccountSettingsPayments();
        wireClientBillingPage();
        scrollPaymentHash();
        document.addEventListener('languageChanged', function () {
            scrollPaymentHash();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
