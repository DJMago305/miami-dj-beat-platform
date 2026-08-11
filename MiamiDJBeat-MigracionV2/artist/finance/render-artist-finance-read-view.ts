/**
 * MOD-204 Financial Slice — Artist Wallet & Earnings Read View (DOM).
 * READ-ONLY — filter chips only; no payout request / transfer / forms.
 */

import type {
  FinancialBalanceReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';
import {
  ARTIST_WALLET_RELEASE_FILTERS,
  toArtistWalletReadViewModel,
  type ArtistPendingReleaseDTO,
  type ArtistWalletReadViewModel,
  type ArtistWalletReleaseFilter,
} from './artist-finance-read-view-model';

export type ArtistFinanceReadViewData = {
  readonly balance?: FinancialBalanceReadDTO | null;
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly pendingReleases?: readonly ArtistPendingReleaseDTO[];
};

export type RenderArtistFinanceReadViewOptions = {
  readonly sourceLabel?: string;
  readonly initialFilter?: ArtistWalletReleaseFilter;
};

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function renderSummary(vm: ArtistWalletReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-artist-finance-read__summary';
  section.dataset.mdjArtistFinanceSection = 'summary';

  const chips: readonly [string, string][] = [
    ['Available', money(vm.summary.availableUsd)],
    ['Pending release', money(vm.summary.pendingReleaseUsd)],
    ['Pending gigs', String(vm.summary.pendingCount)],
    ['Processed', String(vm.summary.processedCount)],
    ['Released', String(vm.summary.releasedCount)],
  ];

  for (const [label, value] of chips) {
    const chip = document.createElement('div');
    chip.className = 'mdj-artist-finance-read__summary-chip';
    const k = document.createElement('span');
    k.className = 'mdj-artist-finance-read__summary-label';
    k.textContent = label;
    const v = document.createElement('strong');
    v.className = 'mdj-artist-finance-read__summary-value';
    v.textContent = value;
    chip.append(k, v);
    section.append(chip);
  }
  return section;
}

function renderFilters(
  active: ArtistWalletReleaseFilter,
  onFilter: (next: ArtistWalletReleaseFilter) => void,
): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'mdj-artist-finance-read__filters';
  bar.dataset.mdjArtistFinanceSection = 'filters';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Filter wallet by release status');

  for (const status of ARTIST_WALLET_RELEASE_FILTERS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mdj-artist-finance-read__filter${status === active ? ' is-active' : ''}`;
    btn.dataset.mdjWalletFilter = status;
    btn.textContent = status;
    btn.setAttribute('aria-pressed', status === active ? 'true' : 'false');
    btn.addEventListener('click', () => onFilter(status));
    bar.append(btn);
  }
  return bar;
}

function renderCard(card: ArtistWalletReadViewModel['cards'][number]): HTMLElement {
  const article = document.createElement('article');
  article.className = 'mdj-artist-finance-read__card';
  article.dataset.mdjWalletRowId = card.rowId;
  article.dataset.mdjReleaseStatus = card.releaseStatus;

  const title = document.createElement('h3');
  title.className = 'mdj-artist-finance-read__card-title';
  title.textContent = card.eventLabel;

  const badge = document.createElement('span');
  badge.className = `mdj-artist-finance-read__badge mdj-artist-finance-read__badge--${card.releaseStatus}`;
  badge.textContent = card.releaseStatus;

  const meta = document.createElement('dl');
  meta.className = 'mdj-artist-finance-read__meta';
  const pairs: readonly [string, string][] = [
    ['Amount', card.amountLabel],
    ['Event date', card.eventDate],
    ['Kind', card.kindLabel],
    ['When', card.occurredAt],
    ['Staff note', card.staffNote],
  ];
  for (const [label, value] of pairs) {
    const row = document.createElement('div');
    row.className = 'mdj-artist-finance-read__row';
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    row.append(dt, dd);
    meta.append(row);
  }

  const note = document.createElement('p');
  note.className = 'mdj-artist-finance-read__note';
  note.textContent =
    'Read-only wallet — payout requests and transfers are not available in this slice.';

  article.append(title, badge, meta, note);
  return article;
}

function renderCards(vm: ArtistWalletReadViewModel): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-artist-finance-read__cards';
  section.dataset.mdjArtistFinanceSection = 'cards';

  if (vm.cards.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mdj-artist-finance-read__empty';
    empty.textContent = 'No wallet rows for this filter.';
    section.append(empty);
    return section;
  }

  for (const card of vm.cards) section.append(renderCard(card));
  return section;
}

export function renderArtistFinanceReadView(
  container: HTMLElement,
  data: ArtistFinanceReadViewData,
  options?: RenderArtistFinanceReadViewOptions,
): ArtistWalletReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'fetchArtistWalletBalance';
  let filter: ArtistWalletReleaseFilter = options?.initialFilter ?? 'All';

  const root = document.createElement('article');
  root.className = 'mdj-artist-finance-read';
  root.dataset.mdjComponent = 'ArtistFinanceReadView';
  root.dataset.mdjMod = 'MOD-204-FIN';
  root.setAttribute('aria-label', 'Artist wallet and earnings read view');

  const paint = (): ArtistWalletReadViewModel => {
    const vm = toArtistWalletReadViewModel({
      balance: data.balance,
      transactions: data.transactions,
      pendingReleases: data.pendingReleases,
      filter,
    });

    const eyebrow = document.createElement('p');
    eyebrow.className = 'mdj-artist-finance-read__eyebrow';
    eyebrow.textContent = `MOD-204 Financial · Wallet & earnings · ${sourceLabel}`;

    const heading = document.createElement('h2');
    heading.className = 'mdj-artist-finance-read__title';
    heading.textContent = 'Wallet & Earnings';

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
