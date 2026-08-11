/**
 * MOD-301 Financial Slice — mount Staff Master Financial Ledger into staff dashboard.
 * Lab default: LAB_STAFF_MASTER_FINANCE. Optional: FinancialService.fetchMasterFinancialLedger.
 */

import type { FinancialService } from '../../shared/services/financial/index';
import type {
  FinancialBalanceReadDTO,
  FinancialVisibilityAudience,
  PaymentReceiptReadDTO,
  TransactionHistoryDTO,
} from '../../shared/types/financial.types';
import { LAB_STAFF_MASTER_FINANCE } from './staff-finance-read-fixtures';
import { renderStaffFinanceReadView } from './render-staff-finance-read-view';
import {
  annotateStaffMountSourceLabel,
  staffDomainAccessAllowed,
  type StaffSessionWiringInjection,
} from '../session/staff-session-wiring-pilot';

export type MountStaffFinanceReadSliceInput = {
  readonly mainRegion: HTMLElement;
  readonly financialService?: FinancialService | null;
  readonly audience?: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'>;
  readonly sessionWiring?: StaffSessionWiringInjection | null;
  readonly fallback?: {
    readonly receipts: readonly PaymentReceiptReadDTO[];
    readonly transactions: readonly TransactionHistoryDTO[];
    readonly balance?: FinancialBalanceReadDTO | null;
  };
};

export type MountStaffFinanceReadSliceResult = {
  readonly ok: true;
  readonly source: 'service' | 'mock';
  readonly transactionCount: number;
};

function resolveSlot(mainRegion: HTMLElement): HTMLElement | null {
  return mainRegion.querySelector<HTMLElement>('[data-mdj-staff-section="master-finance"]');
}

function fillSlot(
  slot: HTMLElement,
  payload: {
    readonly receipts: readonly PaymentReceiptReadDTO[];
    readonly transactions: readonly TransactionHistoryDTO[];
    readonly balance?: FinancialBalanceReadDTO | null;
    readonly audience: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'>;
    readonly sourceLabel: string;
  },
): void {
  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Master Finance';

  const panel = document.createElement('div');
  panel.className = 'mdj-staff-finance-read-host';
  panel.dataset.mdjStaffFinanceHost = 'mod-301-fin';

  slot.replaceChildren(title, panel);
  renderStaffFinanceReadView(
    panel,
    {
      receipts: payload.receipts,
      transactions: payload.transactions,
      balance: payload.balance,
      audience: payload.audience,
    },
    { sourceLabel: payload.sourceLabel },
  );
}

export async function mountStaffFinanceReadSlice(
  input: MountStaffFinanceReadSliceInput,
): Promise<MountStaffFinanceReadSliceResult> {
  const slot = resolveSlot(input.mainRegion);
  if (!slot) {
    throw new Error('MOD-301-FIN: master-finance section slot missing');
  }

  const audience =
    input.audience ??
    (input.sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : 'staff_full');
  const fallback = input.fallback ?? LAB_STAFF_MASTER_FINANCE;
  let receipts = fallback.receipts;
  let transactions = fallback.transactions;
  let balance = fallback.balance ?? null;
  let source: 'service' | 'mock' = 'mock';

  if (input.financialService && staffDomainAccessAllowed(input.sessionWiring, 'financial')) {
    try {
      const result = await input.financialService.fetchMasterFinancialLedger({ audience });
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
    audience,
    sourceLabel: annotateStaffMountSourceLabel(
      source === 'service' ? 'live fetchMasterFinancialLedger' : 'lab mock',
      input.sessionWiring,
      'financial',
    ),
  });

  return Object.freeze({
    ok: true as const,
    source,
    transactionCount: transactions.length,
  });
}

export function mountStaffFinanceReadSliceSync(
  mainRegion: HTMLElement,
  fallback = LAB_STAFF_MASTER_FINANCE,
  audience: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'> = 'staff_full',
  sessionWiring?: StaffSessionWiringInjection | null,
): void {
  const slot = resolveSlot(mainRegion);
  if (!slot) return;
  const resolvedAudience =
    sessionWiring?.context.sessionRole === 'staff_seller' ? 'staff_seller' : audience;
  fillSlot(slot, {
    receipts: fallback.receipts,
    transactions: fallback.transactions,
    balance: fallback.balance,
    audience: resolvedAudience,
    sourceLabel: annotateStaffMountSourceLabel('lab mock', sessionWiring, 'financial'),
  });
}
