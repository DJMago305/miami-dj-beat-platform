/** LC-7 — W-9 request immutability helpers */

import type { LegalW9Request } from './legal-w9-request-types';

export function freezeLegalW9Request(request: LegalW9Request): LegalW9Request {
  return Object.freeze({
    ...request,
    recipient: Object.freeze({ ...request.recipient }),
    requestedBy: Object.freeze({ ...request.requestedBy }),
    metadata: Object.freeze({ ...request.metadata }),
  });
}

export function cloneLegalW9Request(request: LegalW9Request): LegalW9Request {
  return freezeLegalW9Request({
    ...request,
    recipient: { ...request.recipient },
    requestedBy: { ...request.requestedBy },
    metadata: { ...request.metadata },
  });
}

export function parseLegalW9RequestSequence(id: string): number | null {
  const match = /^W9R-(\d+)$/.exec(id.trim());
  if (!match) {
    return null;
  }
  const numeric = Number.parseInt(match[1], 10);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return null;
  }
  return numeric;
}

export function formatLegalW9RequestId(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError('W-9 request sequence must be a positive integer.');
  }
  return `W9R-${String(sequence).padStart(6, '0')}`;
}

export function bumpW9RequestSequenceFloor(currentSequence: number, requestId: string): number {
  const parsed = parseLegalW9RequestSequence(requestId);
  if (parsed === null) {
    return currentSequence;
  }
  return Math.max(currentSequence, parsed);
}

export function isValidLegalW9RequestId(value: string): boolean {
  return /^W9R-\d{6,}$/.test(value.trim());
}
