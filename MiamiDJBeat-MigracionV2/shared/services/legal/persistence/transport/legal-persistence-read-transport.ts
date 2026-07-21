/** LC-11 — Legal persistence read transport */

import type { ApiClientPublicApi } from '../../../../api/runtime/types';
import { validateLegalPersistenceReadEnvelope } from '../validation/legal-persistence-row-validation';
import {
  legalPersistenceError,
  legalPersistenceSuccess,
  type LegalPersistenceResult,
} from '../legal-persistence-errors';
import type { LegalPersistenceReadEnvelope } from '../schema/legal-persistence-row-types';
import type { LegalReadFixtureStore } from '../fixtures/legal-read-fixture-store';
import {
  decodeReadCursor,
  encodeReadCursor,
  normalizeReadLimit,
} from '../legal-persistence-page';
import { sortAuditRowsBySequence } from '../shared/legal-read-repository-helpers';

export type LegalPersistenceReadTransport = {
  callRpc<T>(
    functionName: string,
    params?: Record<string, unknown>,
  ): Promise<LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>>;
};

export const LEGAL_READ_RPC_NAMES = Object.freeze({
  templates: 'legal_read_templates',
  templateVersions: 'legal_read_template_versions',
  templateAssets: 'legal_read_template_assets',
  instances: 'legal_read_instances',
  w9Requests: 'legal_read_w9_requests',
  submissions: 'legal_read_submissions',
  auditEvents: 'legal_read_audit_events',
});

function paginateEnvelope<T>(
  rows: readonly T[],
  params: Record<string, unknown> = {},
): LegalPersistenceReadEnvelope<T> {
  const limitResult = normalizeReadLimit(typeof params.limit === 'number' ? params.limit : undefined);
  const limit = limitResult.ok ? limitResult.value : 25;
  const cursorResult = decodeReadCursor(typeof params.cursor === 'string' ? params.cursor : undefined);
  const offset = cursorResult.ok ? cursorResult.value : 0;
  const slice = rows.slice(offset, offset + limit);
  const nextOffset = offset + slice.length;
  const hasMore = nextOffset < rows.length;
  return Object.freeze({
    data: Object.freeze([...slice]),
    next_cursor: hasMore ? encodeReadCursor(nextOffset) : null,
    has_more: hasMore,
  });
}

export function createFixtureLegalPersistenceReadTransport(
  store: LegalReadFixtureStore,
): LegalPersistenceReadTransport {
  return Object.freeze({
    async callRpc<T>(
      functionName: string,
      params: Record<string, unknown> = {},
    ): Promise<LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>> {
      switch (functionName) {
        case LEGAL_READ_RPC_NAMES.templates:
          return legalPersistenceSuccess(
            paginateEnvelope(store.templates, params),
          ) as LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>;
        case LEGAL_READ_RPC_NAMES.templateVersions:
          return legalPersistenceSuccess(
            paginateEnvelope(
              store.templateVersions.filter(
                (row) =>
                  !params.template_id || row.template_business_id === String(params.template_id),
              ),
              params,
            ),
          ) as LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>;
        case LEGAL_READ_RPC_NAMES.templateAssets:
          return legalPersistenceSuccess(
            paginateEnvelope(
              store.templateAssets.filter(
                (row) =>
                  !params.template_id || row.template_business_id === String(params.template_id),
              ),
              params,
            ),
          ) as LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>;
        case LEGAL_READ_RPC_NAMES.instances:
          return legalPersistenceSuccess(
            paginateEnvelope(store.instances, params),
          ) as LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>;
        case LEGAL_READ_RPC_NAMES.w9Requests:
          return legalPersistenceSuccess(
            paginateEnvelope(store.w9Requests, params),
          ) as LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>;
        case LEGAL_READ_RPC_NAMES.submissions:
          return legalPersistenceSuccess(
            paginateEnvelope(store.submissions, params),
          ) as LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>;
        case LEGAL_READ_RPC_NAMES.auditEvents:
          return legalPersistenceSuccess(
            paginateEnvelope(sortAuditRowsBySequence(store.auditEvents), params),
          ) as LegalPersistenceResult<LegalPersistenceReadEnvelope<T>>;
        default:
          return legalPersistenceError(
            'persistence_transport_error',
            `Unknown legal read RPC: ${functionName}`,
          );
      }
    },
  });
}

export function createApiClientLegalPersistenceReadTransport(
  apiClient: ApiClientPublicApi,
): LegalPersistenceReadTransport {
  return Object.freeze({
    async callRpc(functionName, params = {}) {
      const response = await apiClient.rpc<LegalPersistenceReadEnvelope<unknown>>(functionName, params);
      if (!response.ok) {
        return legalPersistenceError(
          'persistence_transport_error',
          response.error?.message ?? 'Legal persistence RPC failed.',
          Object.freeze({ status: response.status }),
        );
      }
      return validateLegalPersistenceReadEnvelope(response.data);
    },
  });
}
