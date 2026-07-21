/** LC-9 — Shared in-memory legal audit trail lab store */

import { createLegalAuditRecorder, type LegalAuditRecorder } from './legal-audit-recorder';
import type { LegalAuditTrailPort } from './legal-audit-trail-port';
import { createSystemLegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import { createInMemoryLegalAuditTrail } from '../in-memory/in-memory-legal-audit-trail';

let sharedAuditTrail: ReturnType<typeof createInMemoryLegalAuditTrail> | null = null;

export function getSharedLegalAuditTrail(): ReturnType<typeof createInMemoryLegalAuditTrail> {
  if (!sharedAuditTrail) {
    sharedAuditTrail = createInMemoryLegalAuditTrail({
      clock: createSystemLegalDocumentInstanceClock(),
    });
  }
  return sharedAuditTrail;
}

export function createLegalAuditRecorderFromTrail(
  auditTrail?: LegalAuditTrailPort,
): LegalAuditRecorder {
  const clock = createSystemLegalDocumentInstanceClock();
  return createLegalAuditRecorder({
    auditTrail,
    clock,
  });
}

export function resetSharedLegalAuditTrailForTests(): void {
  sharedAuditTrail = null;
}
