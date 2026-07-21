/** LC-9 — Legal audit event types */

import type { LegalAuditAction } from './legal-audit-action';

export const LEGAL_AUDIT_ENTITY_TYPES = [
  'legal_document_instance',
  'w9_request',
  'legal_document_submission',
  'legal_template',
  'legal_template_asset',
] as const;

export type LegalAuditEntityType = (typeof LEGAL_AUDIT_ENTITY_TYPES)[number];

export const LEGAL_AUDIT_OUTCOMES = ['success', 'denied', 'failed'] as const;

export type LegalAuditOutcome = (typeof LEGAL_AUDIT_OUTCOMES)[number];

export type LegalAuditActorType = 'staff' | 'artist' | 'client' | 'system' | 'external';

export type LegalAuditActorRole =
  | 'owner'
  | 'manager'
  | 'seller'
  | 'artist'
  | 'client'
  | 'system';

export type LegalAuditActor = {
  readonly actorType: LegalAuditActorType;
  readonly actorId: string;
  readonly role: LegalAuditActorRole;
  readonly portal: 'staff' | 'artist' | 'client' | 'system';
  readonly displayName?: string;
};

export type LegalAuditStateSnapshot = Readonly<
  Record<string, string | number | boolean | null>
>;

export type LegalAuditEventId = string;

export type LegalAuditCorrelationId = string;

export type LegalAuditEventMetadata = Readonly<
  Record<string, string | number | boolean | null>
>;

export type LegalAuditEvent = {
  readonly id: LegalAuditEventId;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly actor: LegalAuditActor;
  readonly action: LegalAuditAction;
  readonly entityType: LegalAuditEntityType;
  readonly entityId: string;
  readonly relatedEntityIds: Readonly<Record<string, string>>;
  readonly previousState?: LegalAuditStateSnapshot;
  readonly nextState?: LegalAuditStateSnapshot;
  readonly outcome: LegalAuditOutcome;
  readonly reasonCode?: string;
  readonly correlationId?: LegalAuditCorrelationId;
  readonly requestId?: string;
  readonly metadata: LegalAuditEventMetadata;
};

export type AppendLegalAuditEventInput = {
  readonly id?: LegalAuditEventId;
  readonly actor: LegalAuditActor;
  readonly action: LegalAuditAction;
  readonly entityType: LegalAuditEntityType;
  readonly entityId: string;
  readonly relatedEntityIds?: Readonly<Record<string, string>>;
  readonly previousState?: LegalAuditStateSnapshot;
  readonly nextState?: LegalAuditStateSnapshot;
  readonly outcome: LegalAuditOutcome;
  readonly reasonCode?: string;
  readonly correlationId?: LegalAuditCorrelationId;
  readonly requestId?: string;
  readonly metadata?: LegalAuditEventMetadata;
};

export type ListLegalAuditEventsFilter = {
  readonly entityType?: LegalAuditEntityType;
  readonly entityId?: string;
  readonly actorId?: string;
  readonly action?: LegalAuditAction;
  readonly correlationId?: LegalAuditCorrelationId;
  readonly fromOccurredAt?: string;
  readonly toOccurredAt?: string;
  readonly limit?: number;
};
