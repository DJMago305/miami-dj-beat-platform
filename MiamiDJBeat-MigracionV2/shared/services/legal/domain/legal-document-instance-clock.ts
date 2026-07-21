/** LC-6 — Injectable clock for deterministic legal document instance tests */

export type LegalDocumentInstanceClock = {
  readonly now: () => string;
};

export function createSystemLegalDocumentInstanceClock(): LegalDocumentInstanceClock {
  return Object.freeze({
    now: () => new Date().toISOString(),
  });
}

export function createFixedLegalDocumentInstanceClock(isoTimestamp: string): LegalDocumentInstanceClock {
  return Object.freeze({
    now: () => isoTimestamp,
  });
}
