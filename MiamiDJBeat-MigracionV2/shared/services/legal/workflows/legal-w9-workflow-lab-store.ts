/** LC-7 — Shared in-memory W-9 workflow lab store */

import { createLegalAuditRecorder } from '../audit/legal-audit-recorder';
import {
  getSharedLegalAuditTrail,
  resetSharedLegalAuditTrailForTests,
} from '../audit/legal-audit-lab-store';
import { createSystemLegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import {
  createInMemoryLegalDocumentInstanceService,
} from '../in-memory/in-memory-legal-document-instance-service';
import { createInMemoryLegalDocumentStorage } from '../in-memory/in-memory-legal-document-storage';
import {
  createInMemoryLegalW9WorkflowService,
  type InMemoryLegalW9WorkflowService,
} from '../in-memory/in-memory-legal-w9-workflow-service';

let sharedLabService: InMemoryLegalW9WorkflowService | null = null;

export function getSharedLegalW9WorkflowService(): InMemoryLegalW9WorkflowService {
  if (!sharedLabService) {
    const clock = createSystemLegalDocumentInstanceClock();
    const auditTrail = getSharedLegalAuditTrail();
    const auditRecorder = createLegalAuditRecorder({ auditTrail, clock });
    const instanceService = createInMemoryLegalDocumentInstanceService({ clock, auditRecorder });
    const storage = createInMemoryLegalDocumentStorage({ clock });
    sharedLabService = createInMemoryLegalW9WorkflowService({
      seedDemo: true,
      clock,
      instanceService,
      storage,
      auditRecorder,
    });
  }
  return sharedLabService;
}

export function resetSharedLegalW9WorkflowServiceForTests(): void {
  sharedLabService = null;
  resetSharedLegalAuditTrailForTests();
}
