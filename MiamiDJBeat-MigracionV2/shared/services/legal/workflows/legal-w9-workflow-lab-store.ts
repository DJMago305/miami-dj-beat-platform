/** LC-7 — Shared in-memory W-9 workflow lab store */

import {
  createInMemoryLegalW9WorkflowService,
  type InMemoryLegalW9WorkflowService,
} from '../in-memory/in-memory-legal-w9-workflow-service';

let sharedLabService: InMemoryLegalW9WorkflowService | null = null;

export function getSharedLegalW9WorkflowService(): InMemoryLegalW9WorkflowService {
  if (!sharedLabService) {
    sharedLabService = createInMemoryLegalW9WorkflowService({ seedDemo: true });
  }
  return sharedLabService;
}

export function resetSharedLegalW9WorkflowServiceForTests(): void {
  sharedLabService = null;
}
