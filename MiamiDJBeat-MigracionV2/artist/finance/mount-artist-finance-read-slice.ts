/**
 * MOD-204 Financial Slice — mount Artist Wallet into artist dashboard.
 * Lab default: LAB_ARTIST_WALLET. Optional: FinancialService.fetchArtistWalletBalance.
 * Paso 4: session gate + assigned_dj_id scope for live reads.
 */

import type { FinancialService } from '../../shared/services/financial/index';
import type {
  FinancialBalanceReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';
import { LAB_ARTIST_WALLET } from './artist-finance-read-fixtures';
import type { ArtistPendingReleaseDTO } from './artist-finance-read-view-model';
import { renderArtistFinanceReadView } from './render-artist-finance-read-view';
import {
  annotateArtistMountSourceLabel,
  artistDomainAccessAllowed,
  resolveArtistScopedUserId,
  type ArtistSessionWiringInjection,
} from '../session/artist-session-wiring-pilot';

export type MountArtistFinanceReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly financialService?: FinancialService | null;
  readonly artistUserId?: string;
  readonly artistProfileId?: string | null;
  readonly sessionWiring?: ArtistSessionWiringInjection | null;
  readonly fallback?: {
    readonly balance: FinancialBalanceReadDTO;
    readonly transactions: readonly TransactionHistoryDTO[];
    readonly pendingReleases?: readonly ArtistPendingReleaseDTO[];
  };
};

export type MountArtistFinanceReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly transactionCount: number;
  readonly scopedArtistUserId?: string;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-artist-section="artist-wallet"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly balance: FinancialBalanceReadDTO | null;
    readonly transactions: readonly TransactionHistoryDTO[];
    readonly pendingReleases?: readonly ArtistPendingReleaseDTO[];
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'My Wallet';

  const panel = document.createElement('div');
  panel.className = 'mdj-artist-finance-read-host';
  panel.dataset.mdjArtistFinanceHost = 'mod-204-fin';

  slot.replaceChildren(title, panel);
  renderArtistFinanceReadView(
    panel,
    {
      balance: payload.balance,
      transactions: payload.transactions,
      pendingReleases: payload.pendingReleases,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountArtistFinanceReadSlice(
  input: MountArtistFinanceReadSliceInput,
): Promise<MountArtistFinanceReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-204-FIN: artist-wallet section slot missing');
  }

  const fallback = input.fallback ?? LAB_ARTIST_WALLET;
  let balance: FinancialBalanceReadDTO | null = fallback.balance;
  let transactions = fallback.transactions;
  let pendingReleases = fallback.pendingReleases;
  let source: 'service' | 'mock' = 'mock';
  const scopedArtistUserId = resolveArtistScopedUserId(
    input.sessionWiring,
    input.artistUserId,
    LAB_ARTIST_WALLET.artistUserId,
  );

  if (input.financialService && artistDomainAccessAllowed(input.sessionWiring, 'financial')) {
    try {
      const result = await input.financialService.fetchArtistWalletBalance({
        artistUserId: scopedArtistUserId,
        artistProfileId: input.artistProfileId ?? LAB_ARTIST_WALLET.artistProfileId,
      });
      if (result.ok && result.data) {
        balance = result.data.balance;
        transactions = result.data.transactions;
        pendingReleases = undefined;
        source = 'service';
      }
    } catch {
      source = 'mock';
      balance = fallback.balance;
      transactions = fallback.transactions;
      pendingReleases = fallback.pendingReleases;
    }
  }

  fillSlot(slot, {
    balance,
    transactions,
    pendingReleases,
    sourceLabel: annotateArtistMountSourceLabel(
      source === 'service' ? 'live fetchArtistWalletBalance' : 'lab mock',
      input.sessionWiring,
      'financial',
    ),
  });

  return Object.freeze({
    ok: true as const,
    source,
    transactionCount: transactions.length,
    scopedArtistUserId,
  });
}

export function mountArtistFinanceReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_ARTIST_WALLET,
  sessionWiring?: ArtistSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  fillSlot(slot, {
    balance: fallback.balance,
    transactions: fallback.transactions,
    pendingReleases: fallback.pendingReleases,
    sourceLabel: annotateArtistMountSourceLabel('lab mock', sessionWiring, 'financial'),
  });
}
