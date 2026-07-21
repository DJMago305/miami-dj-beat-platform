/** Legal provider factory — TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001 */

import type { LegalProfileId } from '../contracts/legal-ids';
import type { LegalExpedienteSnapshotResult } from '../contracts/legal-projections';
import type { LegalServicePorts } from '../contracts/legal-service-ports';
import {
  createInMemoryLegalService,
  type InMemoryLegalService,
} from '../in-memory/in-memory-legal-service';
import { LEGAL_FIXTURE_PROFILE_IDS } from '../in-memory/legal-fixtures';
import type { LegalViewerContext, SafeExpedienteView } from '../in-memory/legal-access-policy';
import type { LegalStatusResolution } from '../in-memory/legal-status-resolver';
import type { ImplementedLegalProviderMode, LegalProviderMode } from './legal-provider-mode';
import { IMPLEMENTED_LEGAL_PROVIDER_MODES } from './legal-provider-mode';

export class LegalProviderFactoryError extends Error {
  readonly code: 'LEGAL_PROVIDER_MODE_UNSUPPORTED' | 'LEGAL_PROVIDER_CONFIG_INVALID';

  constructor(code: LegalProviderFactoryError['code'], message: string) {
    super(message);
    this.name = 'LegalProviderFactoryError';
    this.code = code;
  }
}

export type ResolveLegalProviderInput = {
  readonly mode: LegalProviderMode;
};

/** Read-only provider context — no store exposure to portals. */
export type LegalProviderContext = {
  readonly mode: ImplementedLegalProviderMode;
  readonly ports: LegalServicePorts;
  readonly getExpedienteSnapshotSync: (legalProfileId: LegalProfileId) => LegalExpedienteSnapshotResult;
  readonly projectExpedienteForViewer: (
    legalProfileId: LegalProfileId,
    context: LegalViewerContext,
  ) => SafeExpedienteView | null;
  readonly resolveLegalStatusForProfile: (legalProfileId: LegalProfileId) => LegalStatusResolution | null;
  readonly listFixtureProfileIds: () => readonly LegalProfileId[];
};

function isImplementedMode(mode: LegalProviderMode): mode is ImplementedLegalProviderMode {
  return (IMPLEMENTED_LEGAL_PROVIDER_MODES as readonly string[]).includes(mode);
}

function createInMemoryProviderContext(service: InMemoryLegalService): LegalProviderContext {
  return Object.freeze({
    mode: 'IN_MEMORY',
    ports: Object.freeze({
      profile: service.profile,
      documents: service.documents,
      tax: service.tax,
      compliance: service.compliance,
      introduction: service.introduction,
      packages: service.packages,
      audit: service.audit,
      staff: service.staff,
    }),
    getExpedienteSnapshotSync: (legalProfileId) => service.getExpedienteSnapshotSync(legalProfileId),
    projectExpedienteForViewer: (legalProfileId, context) =>
      service.projectExpedienteForViewer(legalProfileId, context),
    resolveLegalStatusForProfile: (legalProfileId) => service.resolveLegalStatusForProfile(legalProfileId),
    listFixtureProfileIds: () => Object.freeze(Object.values(LEGAL_FIXTURE_PROFILE_IDS)),
  });
}

export function resolveLegalProvider(input: ResolveLegalProviderInput): LegalProviderContext {
  if (!isImplementedMode(input.mode)) {
    throw new LegalProviderFactoryError(
      'LEGAL_PROVIDER_MODE_UNSUPPORTED',
      `Legal provider mode "${input.mode}" is not implemented in the V2 lab.`,
    );
  }

  if (input.mode === 'IN_MEMORY') {
    return createInMemoryProviderContext(createInMemoryLegalService());
  }

  throw new LegalProviderFactoryError(
    'LEGAL_PROVIDER_CONFIG_INVALID',
    `Unable to resolve legal provider for mode "${input.mode}".`,
  );
}

/** Alias requested by ticket wording. */
export const createLegalProvider = resolveLegalProvider;

export type LegalProviderContextForTests = {
  readonly service: InMemoryLegalService;
  readonly context: LegalProviderContext;
};

/** Test-only helper to assert fixture immutability without exposing store to portals. */
export function createInMemoryLegalProviderForTests(): LegalProviderContextForTests {
  const service = createInMemoryLegalService();
  return Object.freeze({
    service,
    context: createInMemoryProviderContext(service),
  });
}
