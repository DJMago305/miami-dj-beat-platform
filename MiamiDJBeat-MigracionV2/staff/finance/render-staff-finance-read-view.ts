/**
 * MOD-301 Financial Slice — Staff Master Financial Ledger Read View (DOM).
 * READ-ONLY — filter chips only; no approve / charge / refund / forms.
 */

import type {
  FinancialBalanceReadDTO,
  FinancialVisibilityAudience,
  PaymentReceiptReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';
import {
  STAFF_FINANCE_METHOD_FILTERS,
  STAFF_FINANCE_STATUS_FILTERS,
  toStaffFinanceReadViewModel,
  type StaffFinanceMethodFilter,
  type StaffFinanceReadViewModel,
  type StaffFinanceStatusFilter,
} from './staff-finance-read-view-model';

export type StaffFinanceReadViewData = {
  readonly receipts: readonly PaymentReceiptReadDTO[];
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly balance?: FinancialBalanceReadDTO | null;
  readonly audience?: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'>;
};

export type RenderStaffFinanceReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialStatusFilter?: StaffFinanceStatusFilter;
  readonly initialMethodFilter?: StaffFinanceMethodFilter;
};

function createSummaryChip(label: string, value: string): HTMLElement {
  const chip = document.createElement('div');
  chip.className = 'mdj-staff-finance-read__summary-chip';
  const k = document.createElement('span');
  k.className = 'mdj-staff-finance-read__summary-label';
  k.textContent = label;
  const v = document.createElement('strong');
  v.className = 'mdj-staff-finance-read__summary-value';
  v.textContent = value;
  chip.append(k, v);
  return chip;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function renderSummary(vm: StaffFinanceReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-staff-finance-read__summary';
  section.dataset.mdjStaffFinanceSection = 'summary';
  section.append(
    createSummaryChip('Receipts', String(vm.summary.receiptCount)),
    createSummaryChip('Transactions', String(vm.summary.transactionCount)),
    createSummaryChip('Collected', money(vm.summary.totalPaidUsd)),
    createSummaryChip('Outstanding', money(vm.summary.totalDueUsd)),
    createSummaryChip('Pending', String(vm.summary.byStatus.Pending)),
    createSummaryChip('Verified', String(vm.summary.byStatus.Verified)),
    createSummaryChip('Completed', String(vm.summary.byStatus.Completed)),
    createSummaryChip('Zelle', String(vm.summary.byMethod.Zelle ?? 0)),
    createSummaryChip('Stripe', String(vm.summary.byMethod.StripeCard ?? 0)),
  );
  return section;
}

function renderFilterBar(
  sectionKey: string,
  ariaLabel: string,
  values: readonly string[],
  active: string,
  dataAttr: string,
  onPick: (next: string) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-staff-finance-read__filters';
  bar.dataset.mdjStaffFinanceSection = sectionKey;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', ariaLabel);

  for (const value of values) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-staff-finance-read__filter${value === active ? ' is-active' : ''}`;
    btn.setAttribute(dataAttr, value);
    btn.textContent = value === 'BankTransfer' ? 'Bank Transfer' : value === 'StripeCard' ? 'Stripe / Card' : value;
    btn.setAttribute('aria-pressed', value === active ? 'true' : 'false');
    btn.addEventListener('click', () => onPick(value));
    bar.append(btn);
  }
  return bar;
}

function renderRow(row: StaffFinanceReadViewModel['rows'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-staff-finance-read__row-card';
  article.dataset.mdjTransactionId = row.transactionId;
  article.dataset.mdjPaymentStatus = row.transactionStatus;
  article.dataset.mdjPaymentMethod = row.method;

  const title = document.createElement('h3');
  title.className = 'mdj-staff-finance-read__row-title';
  title.textContent = row.label;

  const badge = document.createElement('span');
  badge.className = `mdj-staff-finance-read__badge mdj-staff-finance-read__badge--${row.transactionStatus}`;
  badge.textContent = row.transactionStatus;

  const method = document.createElement('span');
  method.className = 'mdj-staff-finance-read__method';
  method.textContent = row.method;

  const meta = document.createElement('dl');
  meta.className = 'mdj-staff-finance-read__meta';
  const pairs: readonly [string, string][] = [
    ['Amount', row.amountLabel],
    ['Client', row.clientLabel],
    ['Artist', row.artistLabel],
    ['Kind', row.kind],
    ['When', row.occurredAt],
    ['Reference', row.referenceLabel ?? '—'],
  ];
  for (const [label, value] of pairs) {
    const wrap = document.createElement('div');
    wrap.className = 'mdj-staff-finance-read__pair';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    wrap.append(dt, dd);
    meta.append(wrap);
  }

  const note = document.createElement('p');
  note.className = 'mdj-staff-finance-read__note';
  note.textContent = row.piiIsolated
    ? 'Sensitive payment references isolated for staff_seller audience.'
    : 'Read-only ledger row — transactional actions not available in this slice.';

  article.append(title, badge, method, meta, note);
  return article;
}

function renderRows(vm: StaffFinanceReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-staff-finance-read__rows';
  section.dataset.mdjStaffFinanceSection = 'rows';

  if (vm.rows.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-staff-finance-read__empty';
    empty.textContent = 'No transactions for this filter.';
    section.append(empty);
    return section;
  }

  for (const row of vm.rows) section.append(renderRow(row));
  return section;
}

export function renderStaffFinanceReadView(
  container: HTMLElement,
  data: StaffFinanceReadViewData,
  options?: RenderStaffFinanceReadViewOptions,
): StaffFinanceReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchMasterFinancialLedger';
  let statusFilter: StaffFinanceStatusFilter = options?.initialStatusFilter ?? 'All';
  let methodFilter: StaffFinanceMethodFilter = options?.initialMethodFilter ?? 'All';

  const root = document.createElement('article');
  root.className = 'mdj-staff-finance-read';
  root.dataset.mdjComponent = 'StaffFinanceReadView';
  root.dataset.mdjMod = 'MOD-301-FIN';
  root.setAttribute('aria-label', 'Staff master financial ledger read view');

  const paint = (): StaffFinanceReadViewModel => {
    const vm = toStaffFinanceReadViewModel({
      receipts: data.receipts,
      transactions: data.transactions,
      balance: data.balance,
      audience: data.audience ?? 'staff_full',
      statusFilter,
      methodFilter,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-staff-finance-read__eyebrow';
    eyebrow.textContent = `MOD-301 Financial · Master ledger · ${sourceLabel} · audience ${vm.audience}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-staff-finance-read__title';
    heading.textContent = 'Master Financial Ledger';

    root.replaceChildren(
      eyebrow,
      heading,
      renderSummary(vm),
      renderFilterBar(
        'status-filters',
        'Filter by payment status',
        STAFF_FINANCE_STATUS_FILTERS,
        statusFilter,
        'data-mdj-finance-status-filter',
        (next) => {
          statusFilter = next as StaffFinanceStatusFilter;
          paint();
        },
      ),
      renderFilterBar(
        'method-filters',
        'Filter by payment method',
        STAFF_FINANCE_METHOD_FILTERS,
        methodFilter,
        'data-mdj-finance-method-filter',
        (next) => {
          methodFilter = next as StaffFinanceMethodFilter;
          paint();
        },
      ),
      renderRows(vm),
    );

    for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
      el.remove();
    }

    return vm;
  };

  container.replaceChildren(root);
  return paint();
}
