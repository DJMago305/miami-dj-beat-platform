/**
 * MOD-204 Financial Slice — Artist Wallet & Earnings Read View tests.
 * READ-ONLY — no payout request / transfer controls.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinancialService } from '../../shared/services/financial/index';
import { LAB_ARTIST_WALLET } from '../../artist/finance/artist-finance-read-fixtures';
import {
  filterArtistWalletCards,
  toArtistWalletReadViewModel,
} from '../../artist/finance/artist-finance-read-view-model';
import { renderArtistFinanceReadView } from '../../artist/finance/render-artist-finance-read-view';
import {
  mountArtistFinanceReadSlice,
  mountArtistFinanceReadSliceSync,
} from '../../artist/finance/mount-artist-finance-read-slice';
import { renderArtistDashboardMvp } from '../../artist/render-artist-dashboard-mvp';

describe('MOD-204 Financial — view model', () => {
  it('summarizes available, pending release, and card buckets', () => {
    const vm = toArtistWalletReadViewModel({
      balance: LAB_ARTIST_WALLET.balance,
      transactions: LAB_ARTIST_WALLET.transactions,
      pendingReleases: LAB_ARTIST_WALLET.pendingReleases,
    });
    expect(vm.summary.availableUsd).toBe(545);
    expect(vm.summary.pendingReleaseUsd).toBeGreaterThan(0);
    expect(vm.summary.pendingCount).toBe(LAB_ARTIST_WALLET.pendingReleases.length);
    expect(vm.summary.releasedCount).toBeGreaterThan(0);
    expect(vm.cards.length).toBe(
      LAB_ARTIST_WALLET.pendingReleases.length + LAB_ARTIST_WALLET.transactions.length,
    );
  });

  it('filters Pending / Released / Completed', () => {
    const all = toArtistWalletReadViewModel({
      balance: LAB_ARTIST_WALLET.balance,
      transactions: LAB_ARTIST_WALLET.transactions,
      pendingReleases: LAB_ARTIST_WALLET.pendingReleases,
    }).cards;
    expect(filterArtistWalletCards(all, 'Pending').every((c) => c.releaseStatus === 'Pending')).toBe(
      true,
    );
    expect(
      filterArtistWalletCards(all, 'Released').every((c) => c.releaseStatus === 'Released'),
    ).toBe(true);
    expect(
      filterArtistWalletCards(all, 'Completed').every((c) => c.releaseStatus === 'Completed'),
    ).toBe(true);
  });
});

describe('MOD-204 Financial — renderArtistFinanceReadView', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders summary, filters, and cards', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistFinanceReadView(host, {
      balance: LAB_ARTIST_WALLET.balance,
      transactions: LAB_ARTIST_WALLET.transactions,
      pendingReleases: LAB_ARTIST_WALLET.pendingReleases,
    });

    expect(host.querySelector('[data-mdj-component="ArtistFinanceReadView"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-mod="MOD-204-FIN"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-finance-section="summary"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-finance-section="filters"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-artist-finance-section="cards"]')).not.toBeNull();
    expect(host.textContent).toContain('Wallet & Earnings');
  });

  it('Released filter narrows cards (display-only)', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistFinanceReadView(host, {
      balance: LAB_ARTIST_WALLET.balance,
      transactions: LAB_ARTIST_WALLET.transactions,
      pendingReleases: LAB_ARTIST_WALLET.pendingReleases,
    });

    host.querySelector<HTMLButtonElement>('[data-mdj-wallet-filter="Released"]')?.click();
    const cards = host.querySelectorAll('[data-mdj-release-status]');
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.getAttribute('data-mdj-release-status')).toBe('Released');
    }
  });

  it('contains no payout-request / transfer writers', () => {
    const host = document.querySelector<HTMLElement>('#host');
    expect(host).not.toBeNull();
    if (!host) return;

    renderArtistFinanceReadView(host, {
      balance: LAB_ARTIST_WALLET.balance,
      transactions: LAB_ARTIST_WALLET.transactions,
      pendingReleases: LAB_ARTIST_WALLET.pendingReleases,
    });

    expect(host.querySelectorAll('form, input, textarea, select, button[type="submit"]')).toHaveLength(
      0,
    );
    const text = host.textContent?.toLowerCase() ?? '';
    expect(text).not.toMatch(/\brequest payout\b|\bwithdraw now\b|\btransfer funds\b/);
    expect(host.querySelector('[data-mdj-action], [data-mdj-writer]')).toBeNull();
  });
});

describe('MOD-204 Financial — dashboard mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main data-mdj-shell-region="main"></main>';
  });

  it('sync mount places wallet in artist-wallet slot', () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    expect(main.querySelector('[data-mdj-artist-section="artist-wallet"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-component="ArtistFinanceReadView"]')).not.toBeNull();
    expect(main.querySelector('[data-mdj-artist-finance-host="mod-204-fin"]')).not.toBeNull();
  });

  it('async mount prefers FinancialService.fetchArtistWalletBalance', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    renderArtistDashboardMvp(main);

    const liveTx = LAB_ARTIST_WALLET.transactions.filter((t) => t.kind === 'dj_payout');
    const financialService = {
      fetchArtistWalletBalance: vi.fn(async () =>
        Object.freeze({
          ok: true as const,
          status: 200,
          data: Object.freeze({
            balance: LAB_ARTIST_WALLET.balance,
            transactions: liveTx,
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

    const result = await mountArtistFinanceReadSlice({
      mainRegion: main,
      financialService,
    });
    expect(result.source).toBe('service');
    expect(result.transactionCount).toBe(liveTx.length);
  });

  it('async mount falls back to lab mock without service', async () => {
    const main = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]');
    expect(main).not.toBeNull();
    if (!main) return;

    mountArtistFinanceReadSliceSync(main);
    renderArtistDashboardMvp(main);

    const result = await mountArtistFinanceReadSlice({ mainRegion: main });
    expect(result.source).toBe('mock');
    expect(result.transactionCount).toBe(LAB_ARTIST_WALLET.transactions.length);
  });
});
