/** OFTL data contracts — core entities — TICKET-V2-OFTL-DC-1-CORE-FINANCIAL-CONTRACTS-001 */

import type {
  CompanyFinancialCategory,
  CounterpartyType,
  FinancialDirection,
  FinancialLegDirection,
  FinancialObligationKind,
  FinancialOperationType,
  LegLedgerBucket,
  ObligationLifecycleStatus,
  OwnerFinancialSourceSystem,
  PaymentMethod,
  PaymentProvider,
  TransactionLegRole,
  TransactionLifecycleStatus,
} from './oftl-enums';
import type {
  ClientProfileId,
  DjProfileId,
  FinancialObligationId,
  IdempotencyKey,
  LeadId,
  MdjUserId,
  OwnerFinancialTransactionId,
  OwnerTransactionLegId,
  StaffInvoiceId,
  TransactionGroupId,
} from './oftl-ids';
import type {
  FinanceAuthorizationContext,
  FinancialAuditMetadata,
  FinancialPartyRef,
  FinancialSourceReference,
  MoneyAmount,
  OftlContractSchemaVersion,
} from './oftl-primitives';

/** OFTL-C-001 — money owed (payable or receivable). Not a payment executed. */
export type FinancialObligation = {
  readonly schemaVersion: OftlContractSchemaVersion;
  readonly financialObligationId: FinancialObligationId;
  readonly obligationKind: FinancialObligationKind;
  readonly obligationStatus: ObligationLifecycleStatus;
  readonly creditorParty: FinancialPartyRef;
  readonly debtorParty: FinancialPartyRef;
  readonly sourceReference: FinancialSourceReference;
  readonly originalAmount: MoneyAmount;
  readonly pendingAmount: MoneyAmount;
  readonly effectiveDate: string;
  readonly dueDate?: string;
  readonly leadId?: LeadId;
  readonly djProfileId?: DjProfileId;
  readonly clientProfileId?: ClientProfileId;
  readonly staffInvoiceId?: StaffInvoiceId;
  readonly eventRef?: string;
  readonly venueRef?: string;
  readonly concept: string;
  readonly notes?: string;
  readonly recordedByUserId: MdjUserId;
  readonly auditMetadata?: FinancialAuditMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** OFTL-C-002 — payment or receipt executed (Owner capture). Not the obligation itself. */
export type OwnerFinancialTransaction = {
  readonly schemaVersion: OftlContractSchemaVersion;
  readonly ownerFinancialTransactionId: OwnerFinancialTransactionId;
  readonly transactionGroupId: TransactionGroupId;
  readonly idempotencyKey: IdempotencyKey;
  readonly sourceSystem: OwnerFinancialSourceSystem;
  readonly sourceRecordId?: string;
  readonly lifecycleStatus: TransactionLifecycleStatus;
  readonly direction: FinancialDirection;
  readonly operationType: FinancialOperationType;
  readonly companyCategory: CompanyFinancialCategory;
  readonly paymentMethod: PaymentMethod;
  readonly paymentProvider?: PaymentProvider;
  readonly externalReference?: string;
  readonly totalAmount: MoneyAmount;
  readonly counterpartyType?: CounterpartyType;
  readonly counterpartyUserId?: MdjUserId;
  readonly djProfileId?: DjProfileId;
  readonly clientProfileId?: ClientProfileId;
  readonly leadId?: LeadId;
  readonly staffInvoiceId?: StaffInvoiceId;
  readonly linkedFinancialObligationId?: FinancialObligationId;
  readonly eventRef?: string;
  readonly venueRef?: string;
  readonly concept: string;
  readonly notes?: string;
  readonly workDate?: string;
  readonly paymentDate?: string;
  readonly effectiveDate: string;
  readonly recordedAt: string;
  readonly parentTransactionId?: OwnerFinancialTransactionId;
  readonly reversalOfId?: OwnerFinancialTransactionId;
  readonly transactionLegIds: readonly OwnerTransactionLegId[];
  readonly authorizationContext: FinanceAuthorizationContext;
  readonly auditMetadata?: FinancialAuditMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** OFTL-C-003 — materialized financial leg within a transaction (not a separate aggregate root). */
export type OwnerTransactionLeg = {
  readonly schemaVersion: OftlContractSchemaVersion;
  readonly ownerTransactionLegId: OwnerTransactionLegId;
  readonly ownerFinancialTransactionId: OwnerFinancialTransactionId;
  readonly transactionGroupId: TransactionGroupId;
  readonly legRole: TransactionLegRole;
  readonly legDirection: FinancialLegDirection;
  readonly ledgerBucket: LegLedgerBucket;
  readonly companyCategory?: CompanyFinancialCategory;
  readonly party?: FinancialPartyRef;
  readonly amount: MoneyAmount;
  readonly financialObligationId?: FinancialObligationId;
  readonly operationType: FinancialOperationType;
  readonly concept?: string;
  readonly auditMetadata?: FinancialAuditMetadata;
  readonly createdAt: string;
  readonly updatedAt: string;
};
