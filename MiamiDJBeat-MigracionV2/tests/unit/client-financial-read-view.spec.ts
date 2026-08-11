/**
 * MOD-103 Financial Slice — Client Payment Receipts Read View tests.
 * READ-ONLY — no pay now / upload / refund / Stripe checkout.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialService } from '../../shared/services/financial/index';
import { LAB_CLIENT_RECEIPTS } from '../../client/finance/client-finance-read-fixtures';
import {
  filterReceiptsByStatus,
  maskPaymentReference,
  toClientFinanceReadViewModel,
} from '../../client/finance/client-finance-read-view-model';
import { renderClientFinanceReadView } from '../../client/finance/render-client-finance-read-view';
import {
  mountClientFinanceReadSlice,
  mountClientFinanceReadSliceSync,
} from '../../client/finance/mount-client-finance-read-slice';
import { renderClientDashboardMvp } from '../../client/render-client-dashboard-mvp';

describe('MOD-103 Financial — view model', () => {
  it('summarizes paid / outstanding and masks references', () => {
    expect(maskPaymentReference('cs_test_partial_abc')).toBe('cs_tes…_abc');
    const vm = toClientFinanceReadViewModel({
      receipts: LAB_CLIENT_RECEIPTS.receipts,
      transactions: LAB_CLIENT_RECEIPTS.transactions,
      balance: LAB_CLIENT_RECEIPTS.balance,
    });
    expect(vm.summary.receiptCount).toBe(LAB_CLIENT_RECEIPTS.receipts.length);
    expect(vm.summary.totalPaidUsd).toBeGreaterThan(0);
    expect(vm.summary.totalDueUsd).toBeGreaterThan(0);
    expect(vm.cards.length).toBe(vm.summary.receiptCount);
  });

  it('filters Verified / Completed', () => {
    const verified = filterReceiptsByStatus(LAB_CLIENT_RECEIPTS.receipts, 'Verified');
    expect(verified.every((r) => r.transactionStatus === 'Verified')).toBe(true);
    const completed = filterReceiptsByStatus(LAB_CLIENT_RECEIPTS.receipts, 'Completed');
    expect(completed.every((r) => r.transactionStatus === 'Completed')).toBe(true);
  });
});

describe('MOD-103 Financial — renderClientFinanceReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders summary, filters, and receipt cards', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientFinanceReadView(host, {
      receipts: LAB_CLIENT_RECEIPTS.receipts,
      transactions: LAB_CLIENT_RECEIPTS.transactions,
      balance: LAB_CLIENT_RECEIPTS.balance,
    });

    expect(host.querySelector('[data-mdj-component="ClientFinanceReadView"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-mod="MOD-103-FIN"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-finance-section="summary"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-finance-section="filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-client-finance-section="cards"]')).not.toBeNull();
    expect(host.textContent).toContain('Payment Receipts');
    expect(host.textContent).toContain('Receipt preview (read-only)');
  });

  it('Completed filter narrows cards (display-only)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientFinanceReadView(host, {
      receipts: LAB_CLIENT_RECEIPTS.receipts,
      transactions: LAB_CLIENT_RECEIPTS.transactions,
      balance: LAB_CLIENT_RECEIPTS.balance,
    });

    host.querySelector<HTMLButtonElement>('[data-mdj-receipt-filter="Completed"]')?.click();
    const cards = host.querySelectorAll('[data-mdj-payment-status]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-payment-status')).toBe('Completed');
    }
  });

  it('contains no pay/upload/refund writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderClientFinanceReadView(host, {
      receipts: LAB_CLIENT_RECEIPTS.receipts,
      balance: LAB_CLIENT_RECEIPTS.balance,
    });

    expect(host.querySelectorAll('form, input, textarea, select, button[type="submit"]')).toHaveLength(
      0,
    );
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\bpay now\b|\bpagar ahora\b|\bupload receipt\b|\brequest refund\b/);
    expect(host.querySelector('[data-mdj-action], [data-mdj-writer]')).toBeNull();
  });
});

describe('MOD-103 Financial — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places receipts in client-payments slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    expect(main.querySelector('[data-mdj-client-section="client-payments"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ClientFinanceReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-client-finance-host="mod-103-fin"]')).not.toBeNull();
  });

  it('async mount prefers FinancialService.fetchOwnPaymentReceipts', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderClientDashboardMvp(main);

    const live = LAB_CLIENT_RECEIPTS.receipts.filter((r) => r.transactionStatus === 'Completed');
    const financialService = {
      fetchOwnPaymentReceipts: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({
            receipts: live,
            transactions: LAB_CLIENT_RECEIPTS.transactions,
            balance: LAB_CLIENT_RECEIPTS.balance,
          }),
          metadata: Object.freeze({
            requestId: 't',
            correlationId: 'c',
            durationMs: 1,
            attempt: 1,
            context: Object.freeze({ requestId: 't', correlationId: 'c' }),
          }),
        }),
      ),
    } as unknown as FinancialService;

    const result = await mountClientFinanceReadSlice({
      mainRegion: main,
      financialService,
    });
    expect(result.source).toBe('service');
    expect(result.receiptCount).toBe(live.length);
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountClientFinanceReadSliceSync(main);
    renderClientDashboardMvp(main);

    const result = await mountClientFinanceReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.receiptCount).toBe(LAB_CLIENT_RECEIPTS.receipts.length);
  });
});
