/** LC-6 — Legal document instance immutability helpers */

import type { LegalDocumentInstance } from './legal-document-instance-types';

export function freezeLegalDocumentInstance(instance: LegalDocumentInstance): LegalDocumentInstance {
  return Object.freeze({
    ...instance,
    recipient: Object.freeze({ ...instance.recipient }),
    owner: Object.freeze({ ...instance.owner }),
    signatureRequirement: Object.freeze({ ...instance.signatureRequirement }),
    metadata: Object.freeze({ ...instance.metadata }),
  });
}

export function cloneLegalDocumentInstance(instance: LegalDocumentInstance): LegalDocumentInstance {
  return freezeLegalDocumentInstance({
    ...instance,
    recipient: { ...instance.recipient },
    owner: { ...instance.owner },
    signatureRequirement: { ...instance.signatureRequirement },
    metadata: { ...instance.metadata },
  });
}

export function parseLegalDocumentInstanceSequence(id: string): number | null {
  const match = /^LDI-(\d+)$/.exec(id.trim());
  if (!match) {
    return null;
  }

  const numeric = Number.parseInt(match[1], 10);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return null;
  }

  return numeric;
}

export function bumpSequenceFloor(currentSequence: number, instanceId: string): number {
  const parsed = parseLegalDocumentInstanceSequence(instanceId);
  if (parsed === null) {
    return currentSequence;
  }
  return Math.max(currentSequence, parsed);
}
