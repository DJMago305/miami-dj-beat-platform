/**
 * MOD-301 Financial Slice — Staff Master Financial Ledger Read View tests.
 * READ-ONLY — no approve / charge / refund controls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialService } from '../../shared/services/financial/index';
import { LAB_STAFF_MASTER_FINANCE } from '../../staff/finance/staff-finance-read-fixtures';
import {
  filterTransactions,
  toStaffFinanceReadViewModel,
} from '../../staff/finance/staff-finance-read-view-model';
import { renderStaffFinanceReadView } from '../../staff/finance/render-staff-finance-read-view';
import {
  mountStaffFinanceReadSlice,
  mountStaffFinanceReadSliceSync,
} from '../../staff/finance/mount-staff-finance-read-slice';
import { getDefaultStaffDashboardDataProvider } from '../../staff/data/staff-dashboard-data-provider';
import { renderStaffDashboardMvp } from '../../staff/render-staff-dashboard-mvp';

describe('MOD-301 Financial — view model', () => {
  it('summarizes collected / outstanding and method counts', () => {
    const vm = toStaffFinanceReadViewModel({
      receipts: LAB_STAFF_MASTER_FINANCE.receipts,
      transactions: LAB_STAFF_MASTER_FINANCE.transactions,
      balance: LAB_STAFF_MASTER_FINANCE.balance,
      audience: 'staff_full',
    });
    expect(vm.summary.receiptCount).toBe(LAB_STAFF_MASTER_FINANCE.receipts.length);
    expect(vm.summary.transactionCount).toBe(LAB_STAFF_MASTER_FINANCE.transactions.length);
    expect(vm.summary.totalPaidUsd).toBeGreaterThan(0);
    expect(vm.summary.byStatus.Pending).toBeGreaterThan(0);
    expect((vm.summary.byMethod.Zelle ?? 0) + (vm.summary.byMethod.StripeCard ?? 0)).toBeGreaterThan(
      0,
    );
  });

  it('filters by Completed status', () => {
    const completed = filterTransactions(
      LAB_STAFF_MASTER_FINANCE.transactions,
      'Completed',
      'All',
    );
    expect(completed.every((t) => t.transactionStatus === 'Completed')).toBe(true);
  });

  it('isolates sensitive references for staff_seller', () => {
    const vm = toStaffFinanceReadViewModel({
      receipts: LAB_STAFF_MASTER_FINANCE.receipts,
      transactions: LAB_STAFF_MASTER_FINANCE.transactions,
      balance: LAB_STAFF_MASTER_FINANCE.balance,
      audience: 'staff_seller',
      methodFilter: 'StripeCard',
    });
    expect(vm.rows.length).toBeGreaterThan(0);
    expect(vm.rows.every((r) => r.piiIsolated)).toBe(true);
    expect(vm.rows.every((r) => r.referenceLabel === null || !String(r.referenceLabel).includes('cs_test'))).toBe(
      true,
    );
  });
});

describe('MOD-301 Financial — renderStaffFinanceReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders summary, status/method filters, and rows', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffFinanceReadView(host, {
      receipts: LAB_STAFF_MASTER_FINANCE.receipts,
      transactions: LAB_STAFF_MASTER_FINANCE.transactions,
      balance: LAB_STAFF_MASTER_FINANCE.balance,
      audience: 'staff_full',
    });

    expect(host.querySelector('[data-mdj-component="StaffFinanceReadView"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-mod="MOD-301-FIN"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-finance-section="summary"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-finance-section="status-filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-finance-section="method-filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-staff-finance-section="rows"]')).not.toBeNull();
    expect(host.textContent).toContain('Master Financial Ledger');
  });

  it('Verified status filter narrows rows (display-only)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffFinanceReadView(host, {
      receipts: LAB_STAFF_MASTER_FINANCE.receipts,
      transactions: LAB_STAFF_MASTER_FINANCE.transactions,
      balance: LAB_STAFF_MASTER_FINANCE.balance,
      audience: 'staff_full',
    });

    host.querySelector<HTMLButtonElement>('[data-mdj-finance-status-filter="Verified"]')?.click();
    const cards = host.querySelectorAll('[data-mdj-payment-status]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-payment-status')).toBe('Verified');
    }
  });

  it('contains no approve/charge/refund writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderStaffFinanceReadView(host, {
      receipts: LAB_STAFF_MASTER_FINANCE.receipts,
      transactions: LAB_STAFF_MASTER_FINANCE.transactions,
      audience: 'staff_full',
    });

    expect(host.querySelectorAll('form, input, textarea, select, button[type="submit"]')).toHaveLength(
      0,
    );
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\bapprove payment\b|\brefund now\b|\brecord payment\b|\bmark as paid\b/);
    expect(host.querySelector('[data-mdj-action], [data-mdj-writer]')).toBeNull();
  });
});

describe('MOD-301 Financial — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places ledger in master-finance slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    expect(main.querySelector('[data-mdj-staff-section="master-finance"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="StaffFinanceReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-staff-finance-host="mod-301-fin"]')).not.toBeNull();
  });

  it('async mount prefers FinancialService.fetchMasterFinancialLedger', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    const liveTx = LAB_STAFF_MASTER_FINANCE.transactions.filter(
      (t) => t.transactionStatus === 'Completed',
    );
    const financialService = {
      fetchMasterFinancialLedger: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({
            receipts: LAB_STAFF_MASTER_FINANCE.receipts,
            transactions: liveTx,
            balance: LAB_STAFF_MASTER_FINANCE.balance,
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

    const result = await mountStaffFinanceReadSlice({
      mainRegion: main,
      financialService,
      audience: 'staff_full',
    });
    expect(result.source).toBe('service');
    expect(result.transactionCount).toBe(liveTx.length);
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountStaffFinanceReadSliceSync(main);
    renderStaffDashboardMvp(main, getDefaultStaffDashboardDataProvider());

    const result = await mountStaffFinanceReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.transactionCount).toBe(LAB_STAFF_MASTER_FINANCE.transactions.length);
  });
});
