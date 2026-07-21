/** In-memory legal store — TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001 */

import type {
  AcceptanceRecord,
  AuditEvent,
  ComplianceProfile,
  IntroductionRecord,
  LegalDocument,
  LegalNotification,
  LegalProfile,
  SignaturePackage,
  SignatureRecord,
  SigningSession,
  TaxProfile,
} from '../contracts/legal-entities';
import type {
  AcceptanceRecordId,
  ComplianceProfileId,
  IntroductionRecordId,
  LegalDocumentId,
  LegalNotificationId,
  LegalProfileId,
  SignaturePackageId,
  SignatureRecordId,
  SigningSessionId,
  TaxProfileId,
} from '../contracts/legal-ids';
import { createLegalFixtureSeedState } from './legal-fixtures';

export type InMemoryLegalStoreState = {
  profiles: Map<LegalProfileId, LegalProfile>;
  documents: Map<LegalDocumentId, LegalDocument>;
  packages: Map<SignaturePackageId, SignaturePackage>;
  signingSessions: Map<SigningSessionId, SigningSession>;
  signatureRecords: Map<SignatureRecordId, SignatureRecord>;
  acceptanceRecords: Map<AcceptanceRecordId, AcceptanceRecord>;
  taxProfiles: Map<TaxProfileId, TaxProfile>;
  complianceProfiles: Map<ComplianceProfileId, ComplianceProfile>;
  introductions: Map<IntroductionRecordId, IntroductionRecord>;
  auditEvents: AuditEvent[];
  notifications: Map<LegalNotificationId, LegalNotification>;
};

function cloneState(state: InMemoryLegalStoreState): InMemoryLegalStoreState {
  return {
    profiles: new Map(state.profiles),
    documents: new Map(state.documents),
    packages: new Map(state.packages),
    signingSessions: new Map(state.signingSessions),
    signatureRecords: new Map(state.signatureRecords),
    acceptanceRecords: new Map(state.acceptanceRecords),
    taxProfiles: new Map(state.taxProfiles),
    complianceProfiles: new Map(state.complianceProfiles),
    introductions: new Map(state.introductions),
    auditEvents: [...state.auditEvents],
    notifications: new Map(state.notifications),
  };
}

/** Mutable in-memory legal aggregate store — lab only, no persistence. */
export class InMemoryLegalStore {
  private state: InMemoryLegalStoreState;

  constructor(initialState?: InMemoryLegalStoreState) {
    this.state = initialState ? cloneState(initialState) : createEmptyInMemoryLegalStoreState();
  }

  reset(): void {
    this.state = createEmptyInMemoryLegalStoreState();
  }

  seedFixtures(): void {
    this.state = createLegalFixtureSeedState();
  }

  getSnapshot(): InMemoryLegalStoreState {
    return cloneState(this.state);
  }

  getProfile(profileId: LegalProfileId): LegalProfile | undefined {
    return this.state.profiles.get(profileId);
  }

  getDocument(documentId: LegalDocumentId): LegalDocument | undefined {
    return this.state.documents.get(documentId);
  }

  getPackage(packageId: SignaturePackageId): SignaturePackage | undefined {
    return this.state.packages.get(packageId);
  }

  getSigningSession(sessionId: SigningSessionId): SigningSession | undefined {
    return this.state.signingSessions.get(sessionId);
  }

  listProfiles(): readonly LegalProfile[] {
    return Object.freeze([...this.state.profiles.values()]);
  }

  listPackagesForProfile(profileId: LegalProfileId): readonly SignaturePackage[] {
    return Object.freeze(
      [...this.state.packages.values()].filter(
        (pkg) => pkg.recipientProfileId === profileId || pkg.signers.some((signer) => signer.signerProfileId === profileId),
      ),
    );
  }
}

export function createEmptyInMemoryLegalStoreState(): InMemoryLegalStoreState {
  return {
    profiles: new Map(),
    documents: new Map(),
    packages: new Map(),
    signingSessions: new Map(),
    signatureRecords: new Map(),
    acceptanceRecords: new Map(),
    taxProfiles: new Map(),
    complianceProfiles: new Map(),
    introductions: new Map(),
    auditEvents: [],
    notifications: new Map(),
  };
}

/** @deprecated Use InMemoryLegalStoreState */
export type LegalInMemoryStoreState = InMemoryLegalStoreState;

/** @deprecated Use InMemoryLegalStore */
export class LegalInMemoryStore extends InMemoryLegalStore {}

export function createEmptyLegalStoreState(): InMemoryLegalStoreState {
  return createEmptyInMemoryLegalStoreState();
}

export function createSeededLegalInMemoryStore(): InMemoryLegalStore {
  return new InMemoryLegalStore(createLegalFixtureSeedState());
}
