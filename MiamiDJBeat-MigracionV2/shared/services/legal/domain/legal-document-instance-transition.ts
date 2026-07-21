/** LC-6 — Legal document instance status transitions */

import {
  legalDocumentInstanceError,
  transitionErrorMetadata,
  type LegalDocumentInstanceResult,
} from './legal-document-instance-errors';
import { freezeLegalDocumentInstance } from './legal-document-instance-immutability';
import type { LegalDocumentInstance } from './legal-document-instance-types';
import {
  isTerminalLegalDocumentInstanceStatus,
  type LegalDocumentInstanceStatus,
} from './legal-document-instance-status';

const ALLOWED_TRANSITIONS = {
  draft: ['pending', 'cancelled'],
  pending: ['sent', 'cancelled', 'expired'],
  sent: ['viewed', 'signed', 'rejected', 'expired', 'cancelled'],
  viewed: ['signed', 'rejected', 'expired', 'cancelled'],
  signed: [],
  rejected: [],
  expired: [],
  cancelled: [],
} as const satisfies Record<
  LegalDocumentInstanceStatus,
  readonly LegalDocumentInstanceStatus[]
>;

const STATUS_TIMESTAMP_FIELD: Readonly<
  Partial<
    Record<
      LegalDocumentInstanceStatus,
      keyof Pick<
        LegalDocumentInstance,
        'sentAt' | 'viewedAt' | 'signedAt' | 'rejectedAt' | 'cancelledAt' | 'expiredAt'
      >
    >
  >
> = Object.freeze({
  sent: 'sentAt',
  viewed: 'viewedAt',
  signed: 'signedAt',
  rejected: 'rejectedAt',
  cancelled: 'cancelledAt',
  expired: 'expiredAt',
});

export function canTransitionLegalDocumentStatus(
  currentStatus: LegalDocumentInstanceStatus,
  nextStatus: LegalDocumentInstanceStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return false;
  }
  if (isTerminalLegalDocumentInstanceStatus(currentStatus)) {
    return false;
  }
  return (ALLOWED_TRANSITIONS[currentStatus] as readonly LegalDocumentInstanceStatus[]).includes(
    nextStatus,
  );
}

export function transitionLegalDocumentInstanceStatus(
  instance: LegalDocumentInstance,
  nextStatus: LegalDocumentInstanceStatus,
  updatedAt: string,
): LegalDocumentInstanceResult<LegalDocumentInstance> {
  if (isTerminalLegalDocumentInstanceStatus(instance.status)) {
    return legalDocumentInstanceError(
      'already_terminal',
      `Instance ${instance.id} is terminal (${instance.status}).`,
      Object.freeze({ status: instance.status }),
    );
  }

  if (instance.status === nextStatus) {
    return legalDocumentInstanceError(
      'invalid_status_transition',
      `Instance ${instance.id} is already ${nextStatus}.`,
      transitionErrorMetadata(instance.status, nextStatus),
    );
  }

  if (!canTransitionLegalDocumentStatus(instance.status, nextStatus)) {
    return legalDocumentInstanceError(
      'invalid_status_transition',
      `Cannot transition ${instance.id} from ${instance.status} to ${nextStatus}.`,
      transitionErrorMetadata(instance.status, nextStatus),
    );
  }

  const timestampField = STATUS_TIMESTAMP_FIELD[nextStatus];
  const nextInstance = freezeLegalDocumentInstance({
    ...instance,
    recipient: { ...instance.recipient },
    owner: { ...instance.owner },
    signatureRequirement: { ...instance.signatureRequirement },
    metadata: { ...instance.metadata },
    status: nextStatus,
    updatedAt,
    ...(timestampField ? { [timestampField]: updatedAt } : {}),
  });

  return Object.freeze({ ok: true, value: nextInstance });
}
