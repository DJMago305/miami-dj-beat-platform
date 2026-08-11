/**
 * MOD-103 Financial Slice — mount Client Payment Receipts into client dashboard.
 * Lab default: LAB_CLIENT_RECEIPTS. Optional: FinancialService.fetchOwnPaymentReceipts.
 * Paso 5: session gate + client_id scope for live reads.
 */

import type { FinancialService } from '../../shared/services/financial/index';
import type {
  FinancialBalanceReadDTO,
  PaymentReceiptReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';
import { LAB_CLIENT_RECEIPTS } from './client-finance-read-fixtures';
import { renderClientFinanceReadView } from './render-client-finance-read-view';
import {
  annotateClientMountSourceLabel,
  clientDomainAccessAllowed,
  resolveClientScopedUserId,
  type ClientSessionWiringInjection,
} from '../session/client-session-wiring-pilot';

export type MountClientFinanceReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly financialService?: FinancialService | null;
  readonly clientUserId?: string;
  readonly sessionWiring?: ClientSessionWiringInjection | null;
  readonly fallback?: {
    readonly receipts: readonly PaymentReceiptReadDTO[];
    readonly transactions?: readonly TransactionHistoryDTO[];
    readonly balance?: FinancialBalanceReadDTO | null;
  };
};

export type MountClientFinanceReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly receiptCount: number;
  readonly scopedClientUserId?: string;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-client-section="client-payments"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly receipts: readonly PaymentReceiptReadDTO[];
    readonly transactions?: readonly TransactionHistoryDTO[];
    readonly balance?: FinancialBalanceReadDTO | null;
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'My Payments';

  const panel = document.createElement('div');
  panel.className = 'mdj-client-finance-read-host';
  panel.dataset.mdjClientFinanceHost = 'mod-103-fin';

  slot.replaceChildren(title, panel);
  renderClientFinanceReadView(
    panel,
    {
      receipts: payload.receipts,
      transactions: payload.transactions,
      balance: payload.balance,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountClientFinanceReadSlice(
  input: MountClientFinanceReadSliceInput,
): Promise<MountClientFinanceReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-103-FIN: client-payments section slot missing');
  }

  const fallback = input.fallback ?? LAB_CLIENT_RECEIPTS;
  let receipts = fallback.receipts;
  let transactions = fallback.transactions;
  let balance = fallback.balance ?? null;
  let source: 'service' | 'mock' = 'mock';
  const scopedClientUserId = resolveClientScopedUserId(
    input.sessionWiring,
    input.clientUserId,
    LAB_CLIENT_RECEIPTS.clientUserId,
  );

  if (input.financialService && clientDomainAccessAllowed(input.sessionWiring, 'financial')) {
    try {
      const result = await input.financialService.fetchOwnPaymentReceipts({
        clientUserId: scopedClientUserId,
      });
      if (result.ok && result.data) {
        receipts = result.data.receipts;
        transactions = result.data.transactions;
        balance = result.data.balance;
        source = 'service';
      }
    } catch {
      source = 'mock';
      receipts = fallback.receipts;
      transactions = fallback.transactions;
      balance = fallback.balance ?? null;
    }
  }

  fillSlot(slot, {
    receipts,
    transactions,
    balance,
    sourceLabel: annotateClientMountSourceLabel(
      source === 'service' ? 'live fetchOwnPaymentReceipts' : 'lab mock',
      input.sessionWiring,
      'financial',
    ),
  });

  return Object.freeze({
    ok: true as const,
    source,
    receiptCount: receipts.length,
    scopedClientUserId,
  });
}

export function mountClientFinanceReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_CLIENT_RECEIPTS,
  sessionWiring?: ClientSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  fillSlot(slot, {
    receipts: fallback.receipts,
    transactions: fallback.transactions,
    balance: fallback.balance,
    sourceLabel: annotateClientMountSourceLabel('lab mock', sessionWiring, 'financial'),
  });
}
