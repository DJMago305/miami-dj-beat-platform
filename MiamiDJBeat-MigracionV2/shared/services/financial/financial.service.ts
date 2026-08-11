/**
 * Financial service — READ-ONLY fetching (Paso 2).
 * Injectable data port: SELECT-shaped reads only. No charge / record / refund writers.
 * Isolated from OFTL (`shared/services/finance/`).
 */

import { createApiError } from '../../api/runtime/errors';
import type {
  ApiFailure,
  ApiMetadata,
  ApiResponse,
  RequestContext,
  SessionReaderPort,
} from '../../api/runtime';
import type {
  FinancialBalanceReadDTO,
  FinancialVisibilityAudience,
  PaymentReceiptReadDTO,
  TransactionHistoryDTO,
} from '../../types/financial.types';
import {
  asRestRows,
  buildArtistWalletBalance,
  buildClientBalance,
  buildStaffMasterBalance,
  filterReceiptsForClient,
  mapDjLedgerRowToTransaction,
  mapLeadRowToClientTransaction,
  mapLeadRowToPaymentReceipt,
  redactReceiptForAudience,
} from './financial.map-rows';

export type FinancialFetchOptions = {
  readonly timeoutMs?: number;
  readonly context?: Partial<RequestContext>;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
};

export type FinancialServiceErrorCode =
  | 'FINANCIAL_SESSION_REQUIRED'
  | 'FINANCIAL_FORBIDDEN'
  | 'FINANCIAL_SUBJECT_REQUIRED'
  | 'FINANCIAL_PARSE_ERROR';

export type FetchOwnPaymentReceiptsResult = {
  readonly receipts: readonly PaymentReceiptReadDTO[];
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly balance: FinancialBalanceReadDTO;
};

export type FetchArtistWalletBalanceResult = {
  readonly balance: FinancialBalanceReadDTO;
  readonly transactions: readonly TransactionHistoryDTO[];
};

export type FetchMasterFinancialLedgerResult = {
  readonly receipts: readonly PaymentReceiptReadDTO[];
  readonly transactions: readonly TransactionHistoryDTO[];
  readonly balance: FinancialBalanceReadDTO;
};

export type FinancialService = {
  /** Client portal — own receipts + cobro history + due/paid balance. */
  readonly fetchOwnPaymentReceipts: (
    options: FinancialFetchOptions & { readonly clientUserId: string },
  ) => Promise<ApiResponse<FetchOwnPaymentReceiptsResult>>;
  /** Artist portal — wallet available + pending release + ledger history. */
  readonly fetchArtistWalletBalance: (
    options: FinancialFetchOptions & {
      readonly artistUserId: string;
      readonly artistProfileId?: string | null;
    },
  ) => Promise<ApiResponse<FetchArtistWalletBalanceResult>>;
  /** Staff portal — master financial ledger (receipts + txs + company totals). */
  readonly fetchMasterFinancialLedger: (
    options?: FinancialFetchOptions & {
      readonly audience?: Extract<FinancialVisibilityAudience, 'staff_seller' | 'staff_full'>;
    },
  ) => Promise<ApiResponse<FetchMasterFinancialLedgerResult>>;
};

/** Injectable read port — SELECT only (tests inject fixtures). */
export type FinancialDataPort = {
  readonly selectLeadsForClient: (
    clientUserId: string,
    options?: FinancialFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectLeadsForStaff: (options?: FinancialFetchOptions) => Promise<ApiResponse<unknown>>;
  readonly selectLeadsAssignedToArtist: (
    input: { readonly artistProfileId?: string | null; readonly artistUserId?: string | null },
    options?: FinancialFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectDjLedgerForArtist: (
    artistUserId: string,
    options?: FinancialFetchOptions,
  ) => Promise<ApiResponse<unknown>>;
  readonly selectDjLedgerForStaff: (options?: FinancialFetchOptions) => Promise<ApiResponse<unknown>>;
};

export type CreateFinancialServiceInput = {
  readonly dataPort: FinancialDataPort;
  readonly sessionReader?: SessionReaderPort;
};

function buildFailure(
  code: FinancialServiceErrorCode,
  message: string,
  status: number,
  metadata: ApiMetadata,
): ApiFailure {
  return Object.freeze({
    ok: false,
    status,
    error: createApiError(
      code === 'FINANCIAL_PARSE_ERROR' ? 'API_PARSE_ERROR' : 'API_INVALID_PAYLOAD',
      message,
      status,
      code,
    ),
    metadata,
  });
}

function emptyMetadata(context?: Partial<RequestContext>): ApiMetadata {
  const requestId = context?.requestId ?? 'financial_precheck';
  const correlationId = context?.correlationId ?? 'financial_precheck';
  return Object.freeze({
    requestId,
    correlationId,
    durationMs: 0,
    attempt: 1,
    context: Object.freeze({
      requestId,
      correlationId,
      portal: context?.portal,
      sessionId: context?.sessionId ?? null,
      actorType: context?.actorType ?? 'guest',
    }),
  });
}

function requireSession(
  sessionReader: SessionReaderPort | undefined,
  options?: FinancialFetchOptions,
): ApiFailure | null {
  if ((sessionReader?.getAuthorizationHeader() ?? null) !== null) {
    return null;
  }
  return buildFailure(
    'FINANCIAL_SESSION_REQUIRED',
    'Financial read requires an active session.',
    401,
    emptyMetadata(options?.context),
  );
}

export function createFinancialService(input: CreateFinancialServiceInput): FinancialService {
  const { dataPort, sessionReader } = input;

  const service: FinancialService = {
    async fetchOwnPaymentReceipts(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const clientUserId = options.clientUserId?.trim() ?? '';
      if (!clientUserId) {
        return buildFailure(
          'FINANCIAL_SUBJECT_REQUIRED',
          'clientUserId is required for fetchOwnPaymentReceipts.',
          400,
          emptyMetadata(options.context),
        );
      }

      const result = await dataPort.selectLeadsForClient(clientUserId, options);
      if (!result.ok) return result;

      const rows = asRestRows(result.data);
      const receipts = filterReceiptsForClient(
        rows.map((row) => mapLeadRowToPaymentReceipt(row, 'client_own')),
        clientUserId,
      );
      const transactions = Object.freeze(
        rows
          .filter((row) => row.client_user_id === clientUserId)
          .map((row) => mapLeadRowToClientTransaction(row, 'client_own')),
      );
      const balance = buildClientBalance(rows, clientUserId);

      return Object.freeze({
        ok: true as const,
        status: result.status,
        data: Object.freeze({ receipts, transactions, balance }),
        metadata: result.metadata,
      });
    },

    async fetchArtistWalletBalance(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const artistUserId = options.artistUserId?.trim() ?? '';
      if (!artistUserId) {
        return buildFailure(
          'FINANCIAL_SUBJECT_REQUIRED',
          'artistUserId is required for fetchArtistWalletBalance.',
          400,
          emptyMetadata(options.context),
        );
      }

      const artistProfileId = options.artistProfileId ?? null;

      const [ledgerResult, leadsResult] = await Promise.all([
        dataPort.selectDjLedgerForArtist(artistUserId, options),
        dataPort.selectLeadsAssignedToArtist({ artistProfileId, artistUserId }, options),
      ]);

      if (!ledgerResult.ok) return ledgerResult;
      if (!leadsResult.ok) return leadsResult;

      const ledgerRows = asRestRows(ledgerResult.data);
      const leadRows = asRestRows(leadsResult.data);

      const transactions = Object.freeze(
        ledgerRows.map((row) => mapDjLedgerRowToTransaction(row, 'artist_wallet')),
      );
      const balance = buildArtistWalletBalance({
        artistUserId,
        artistProfileId,
        ledgerRows,
        assignedLeadRows: leadRows,
      });

      return Object.freeze({
        ok: true as const,
        status: 200,
        data: Object.freeze({ balance, transactions }),
        metadata: ledgerResult.metadata,
      });
    },

    async fetchMasterFinancialLedger(options) {
      const sessionFail = requireSession(sessionReader, options);
      if (sessionFail) return sessionFail;

      const audience = options?.audience ?? 'staff_full';
      if (audience !== 'staff_seller' && audience !== 'staff_full') {
        return buildFailure(
          'FINANCIAL_FORBIDDEN',
          'Master ledger requires staff audience.',
          403,
          emptyMetadata(options?.context),
        );
      }

      const [leadsResult, ledgerResult] = await Promise.all([
        dataPort.selectLeadsForStaff(options),
        dataPort.selectDjLedgerForStaff(options),
      ]);

      if (!leadsResult.ok) return leadsResult;
      if (!ledgerResult.ok) return ledgerResult;

      const leadRows = asRestRows(leadsResult.data);
      const ledgerRows = asRestRows(ledgerResult.data);

      const receipts = Object.freeze(
        leadRows.map((row) =>
          redactReceiptForAudience(mapLeadRowToPaymentReceipt(row, audience), audience),
        ),
      );

      const clientTx = leadRows.map((row) => mapLeadRowToClientTransaction(row, audience));
      const ledgerTx = ledgerRows.map((row) => mapDjLedgerRowToTransaction(row, audience));
      const transactions = Object.freeze([...clientTx, ...ledgerTx]);

      const balance = buildStaffMasterBalance(leadRows, audience);

      return Object.freeze({
        ok: true as const,
        status: 200,
        data: Object.freeze({ receipts, transactions, balance }),
        metadata: leadsResult.metadata,
      });
    },
  };

  return Object.freeze(service);
}

/** Guard: public surface must not expose writers. */
export function listFinancialServiceReadMethods(): readonly string[] {
  return Object.freeze([
    'fetchOwnPaymentReceipts',
    'fetchArtistWalletBalance',
    'fetchMasterFinancialLedger',
  ]);
}
