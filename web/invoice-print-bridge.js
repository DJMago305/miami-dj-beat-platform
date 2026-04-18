/**
 * Native print invoice flow: pass sale data via sessionStorage, then open invoice-template-print.html.
 * No jsPDF — user prints or saves PDF from the browser.
 */
(function (global) {
    var KEY = 'mdj_invoice_sale_v1';
    global.MDJ_INVOICE_SALE_STORAGE_KEY = KEY;

    /**
     * @typedef {Object} MdjInvoiceSalePayload
     * @property {1} v
     * @property {string} [ref] e.g. #INV-abc12345
     * @property {string} [dateStr] human-readable date
     * @property {string} billTo newline-separated address block
     * @property {string} eventLoc newline-separated event / venue block
     * @property {{ desc: string, qty: number, unit: number }[]} lines
     * @property {number} [taxPct] default 7
     * @property {string} [notes]
     * @property {string} [sourceReturnUrl] optional link for "Back" on template
     */

    global.mdjWriteInvoiceSalePayload = function (payload) {
        try {
            if (!payload || payload.v !== 1) throw new Error('invalid payload');
            sessionStorage.setItem(KEY, JSON.stringify(payload));
        } catch (e) {
            console.warn('[mdjWriteInvoiceSalePayload]', e);
        }
    };

    global.mdjNavigateToInvoicePrint = function () {
        global.location.href = './invoice-template-print.html';
    };

    /** Write payload and navigate — primary entry for Sale → Invoice. */
    global.mdjOpenInvoicePrint = function (payload) {
        global.mdjWriteInvoiceSalePayload(payload);
        global.mdjNavigateToInvoicePrint();
    };
})(typeof window !== 'undefined' ? window : globalThis);
