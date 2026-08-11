/**
 * MOD-103 Financial Slice — Client Payment Receipts Read View (DOM).
 * READ-ONLY — filter chips only; no pay now / upload / refund / Stripe checkout.
 */

import type {
  FinancialBalanceReadDTO,
  PaymentReceiptReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';
import {
  CLIENT_RECEIPT_STATUS_FILTERS,
  toClientFinanceReadViewModel,
  type ClientFinanceReadViewModel,
  type ClientReceiptStatusFilter,
} from './client-finance-read-view-model';

export type ClientFinanceReadViewData = {
  readonly receipts: readonly PaymentReceiptReadDTO[];
  readonly transactions?: readonly TransactionHistoryDTO[];
  readonly balance?: FinancialBalanceReadDTO | null;
};

export type RenderClientFinanceReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialFilter?: ClientReceiptStatusFilter;
};

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function renderSummary(vm: ClientFinanceReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-finance-read__summary';
  section.dataset.mdjClientFinanceSection = 'summary';

  const chips: readonly [string, string][] = [
    ['Receipts', String(vm.summary.receiptCount)],
    ['Paid', money(vm.summary.totalPaidUsd)],
    ['Outstanding', money(vm.summary.totalDueUsd)],
    ['Pending', String(vm.summary.byStatus.Pending ?? 0)],
    ['Verified', String(vm.summary.byStatus.Verified ?? 0)],
    ['Completed', String(vm.summary.byStatus.Completed ?? 0)],
  ];

  for (const [label, value] of chips) {
    const chip = document.createElement('div');
    chip.className = 'mdj-client-finance-read__summary-chip';
    const k = document.createElement('span');
    k.className = 'mdj-client-finance-read__summary-label';
    k.textContent = label;
    const v = document.createElement('strong');
    v.className = 'mdj-client-finance-read__summary-value';
    v.textContent = value;
    chip.append(k, v);
    section.append(chip);
  }
  return section;
}

function renderFilters(
  active: ClientReceiptStatusFilter,
  onFilter: (next: ClientReceiptStatusFilter) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-client-finance-read__filters';
  bar.dataset.mdjClientFinanceSection = 'filters';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter receipts by status');

  for (const status of CLIENT_RECEIPT_STATUS_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-client-finance-read__filter${status === active ? ' is-active' : ''}`;
    btn.dataset.mdjReceiptFilter = status;
    btn.textContent = status;
    btn.setAttribute('aria-pressed', status === active ? 'true' : 'false');
    btn.addEventListener('click', () => onFilter(status));
    bar.append(btn);
  }
  return bar;
}

function renderCard(card: ClientFinanceReadViewModel['cards'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-client-finance-read__card';
  article.dataset.mdjReceiptId = card.receiptId;
  article.dataset.mdjPaymentStatus = card.transactionStatus;

  const title = document.createElement('h3');
  title.className = 'mdj-client-finance-read__card-title';
  title.textContent = card.bookingLabel;

  const badge = document.createElement('span');
  badge.className = `mdj-client-finance-read__badge mdj-client-finance-read__badge--${card.transactionStatus}`;
  badge.textContent = card.transactionStatus;

  const method = document.createElement('span');
  method.className = 'mdj-client-finance-read__method';
  method.textContent = card.method;

  const meta = document.createElement('dl');
  meta.className = 'mdj-client-finance-read__meta';
  const pairs: readonly [string, string][] = [
    ['Paid', card.amountPaidLabel],
    ['Outstanding', card.amountDueLabel],
    ['Event date', card.eventDate],
    ['Paid at', card.paidAt],
    ['Breakdown', card.breakdownLabel],
    ['Reference', card.referenceLabel],
    ['Preview', card.previewLabel],
  ];
  for (const [label, value] of pairs) {
    const row = document.createElement('div');
    row.className = 'mdj-client-finance-read__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    meta.append(row);
  }

  const note = document.createElement('p');
  note.className = 'mdj-client-finance-read__note';
  note.textContent =
    'Read-only receipts — checkout, proof upload, and refunds are not available in this slice.';

  article.append(title, badge, method, meta, note);
  return article;
}

function renderCards(vm: ClientFinanceReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-finance-read__cards';
  section.dataset.mdjClientFinanceSection = 'cards';

  if (vm.cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-client-finance-read__empty';
    empty.textContent = 'No receipts for this filter.';
    section.append(empty);
    return section;
  }

  for (const card of vm.cards) section.append(renderCard(card));
  return section;
}

export function renderClientFinanceReadView(
  container: HTMLElement,
  data: ClientFinanceReadViewData,
  options?: RenderClientFinanceReadViewOptions,
): ClientFinanceReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchOwnPaymentReceipts';
  let filter: ClientReceiptStatusFilter = options?.initialFilter ?? 'All';

  const root = document.createElement('article');
  root.className = 'mdj-client-finance-read';
  root.dataset.mdjComponent = 'ClientFinanceReadView';
  root.dataset.mdjMod = 'MOD-103-FIN';
  root.setAttribute('aria-label', 'Client payment receipts read view');

  const paint = (): ClientFinanceReadViewModel => {
    const vm = toClientFinanceReadViewModel({
      receipts: data.receipts,
      transactions: data.transactions,
      balance: data.balance,
      filter,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-client-finance-read__eyebrow';
    eyebrow.textContent = `MOD-103 Financial · Receipts & payment history · ${sourceLabel}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-client-finance-read__title';
    heading.textContent = 'Payment Receipts';

    root.replaceChildren(
      eyebrow,
      heading,
      renderSummary(vm),
      renderFilters(filter, (next) => {
        filter = next;
        paint();
      }),
      renderCards(vm),
    );

    for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
      el.remove();
    }

    return vm;
  };

  container.replaceChildren(root);
  return paint();
}
