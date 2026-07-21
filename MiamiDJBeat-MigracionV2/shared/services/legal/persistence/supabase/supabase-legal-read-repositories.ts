/** LC-11 — Supabase-compatible legal read repositories (simulated) */

import {
  mapLegalAuditEventRowToDomain,
  mapLegalDocumentInstanceRowToDomain,
  mapLegalDocumentSubmissionRowToDomain,
  mapLegalTemplateAssetRowToDomain,
  mapLegalTemplateRowToDomain,
  mapLegalTemplateVersionRowToDomain,
  mapLegalW9RequestRowToDomain,
  mapRowsToDomainList,
} from '../mappers/legal-persistence-mappers';
import type {
  LegalAuditReadRepositoryPort,
  LegalDocumentInstanceReadRepositoryPort,
  LegalDocumentSubmissionReadRepositoryPort,
  LegalReadPersistenceRepositories,
  LegalTemplateReadRepositoryPort,
  LegalW9RequestReadRepositoryPort,
} from '../ports/legal-read-repository-ports';
import {
  canReadDeletedSubmissions,
  matchesRecipientScope,
  type LegalReadAccessContext,
} from '../legal-read-access-context';
import {
  resolveAuditRecipientIdFromRelatedEntityIds,
} from '../shared/legal-audit-related-entity-ids';
import {
  canReadAuditEventForContext,
  ensureAuditReadAccess,
  ensureDeletedSubmissionAccess,
  ensureFiscalReadAccess,
  ensureTemplateCatalogAccess,
  filterActiveSubmissions,
  findActiveW9Row,
  notFound,
  resolvePagination,
  sortAuditRowsBySequence,
} from '../shared/legal-read-repository-helpers';
import { legalPersistenceSuccess, type LegalPersistenceResult } from '../legal-persistence-errors';
import type { LegalAuditEventListQuery } from '../legal-persistence-query-types';
import type {
  LegalAuditEventRow,
  LegalDocumentInstanceRow,
  LegalDocumentSubmissionRow,
  LegalTemplateAssetRow,
  LegalTemplateRow,
  LegalTemplateVersionRow,
  LegalW9RequestRow,
} from '../schema/legal-persistence-row-types';
import {
  LEGAL_READ_RPC_NAMES,
  type LegalPersistenceReadTransport,
} from '../transport/legal-persistence-read-transport';

async function fetchTransportRows<T>(
  transport: LegalPersistenceReadTransport,
  rpcName: string,
  params: Record<string, unknown> = {},
): Promise<LegalPersistenceResult<readonly T[]>> {
  const collected: T[] = [];
  let cursor: string | undefined;
  do {
    const response = await transport.callRpc<T>(rpcName, {
      ...params,
      ...(cursor ? { cursor } : {}),
      limit: 100,
    });
    if (!response.ok) {
      return response;
    }
    collected.push(...response.value.data);
    cursor = response.value.next_cursor ?? undefined;
  } while (cursor);
  return legalPersistenceSuccess(Object.freeze(collected));
}

function filterByRecipient<
  T extends { readonly recipient_type: string; readonly recipient_id: string },
>(rows: readonly T[], context: LegalReadAccessContext): readonly T[] {
  if (context.portal === 'staff' && (context.role === 'owner' || context.role === 'manager')) {
    return rows;
  }
  if (context.portal === 'artist') {
    return Object.freeze(rows.filter((row) => matchesRecipientScope(context, row.recipient_id)));
  }
  return Object.freeze([]);
}

export function createSupabaseLegalReadRepositories(input: {
  readonly transport: LegalPersistenceReadTransport;
}): LegalReadPersistenceRepositories {
  const { transport } = input;

  const templates: LegalTemplateReadRepositoryPort = {
    async getTemplateById(context, templateId) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalTemplateRow>(transport, LEGAL_READ_RPC_NAMES.templates);
      if (!rows.ok) return rows;
      const row = rows.value.find((item) => item.business_id === templateId.trim());
      if (!row) return notFound('Template', templateId);
      return mapLegalTemplateRowToDomain(row);
    },
    async getTemplateVersionById(context, templateVersionId) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalTemplateVersionRow>(
        transport,
        LEGAL_READ_RPC_NAMES.templateVersions,
      );
      if (!rows.ok) return rows;
      const row = rows.value.find((item) => item.business_id === templateVersionId.trim());
      if (!row) return notFound('Template version', templateVersionId);
      return mapLegalTemplateVersionRowToDomain(row);
    },
    async listTemplates(context, query) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalTemplateRow>(transport, LEGAL_READ_RPC_NAMES.templates);
      if (!rows.ok) return rows;
      const filtered = rows.value.filter((row) => (query?.category ? row.category === query.category : true));
      const page = resolvePagination(filtered, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalTemplateRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async listTemplateVersions(context, templateId, query) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalTemplateVersionRow>(
        transport,
        LEGAL_READ_RPC_NAMES.templateVersions,
        { template_id: templateId.trim() },
      );
      if (!rows.ok) return rows;
      const page = resolvePagination(rows.value, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalTemplateVersionRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async listTemplateAssets(context, templateId, query) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalTemplateAssetRow>(
        transport,
        LEGAL_READ_RPC_NAMES.templateAssets,
        { template_id: templateId.trim() },
      );
      if (!rows.ok) return rows;
      const page = resolvePagination(rows.value, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalTemplateAssetRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async getTemplateAssetMetadata(context, assetKey) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalTemplateAssetRow>(
        transport,
        LEGAL_READ_RPC_NAMES.templateAssets,
      );
      if (!rows.ok) return rows;
      const row = rows.value.find((item) => item.asset_key === assetKey.trim());
      if (!row) return notFound('Template asset', assetKey);
      return mapLegalTemplateAssetRowToDomain(row);
    },
  };

  const instances: LegalDocumentInstanceReadRepositoryPort = {
    async getInstanceById(context, instanceId) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalDocumentInstanceRow>(
        transport,
        LEGAL_READ_RPC_NAMES.instances,
      );
      if (!rows.ok) return rows;
      const row = rows.value.find((item) => item.business_id === instanceId.trim());
      if (!row) return notFound('Document instance', instanceId);
      if (!matchesRecipientScope(context, row.recipient_id) && context.portal !== 'staff') {
        return notFound('Document instance', instanceId);
      }
      return mapLegalDocumentInstanceRowToDomain(row);
    },
    async listInstances(context, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalDocumentInstanceRow>(
        transport,
        LEGAL_READ_RPC_NAMES.instances,
      );
      if (!rows.ok) return rows;
      let filtered = filterByRecipient(rows.value, context);
      if (query?.recipientType) {
        filtered = Object.freeze(filtered.filter((row) => row.recipient_type === query.recipientType));
      }
      if (query?.recipientId) {
        filtered = Object.freeze(filtered.filter((row) => row.recipient_id === query.recipientId));
      }
      if (query?.status) filtered = Object.freeze(filtered.filter((row) => row.status === query.status));
      if (query?.templateId) {
        filtered = Object.freeze(filtered.filter((row) => row.template_id === query.templateId));
      }
      const page = resolvePagination(filtered, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalDocumentInstanceRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async listInstancesByRecipient(context, recipientType, recipientId, query) {
      return instances.listInstances(context, { ...query, recipientType, recipientId });
    },
    async listInstancesByTemplate(context, templateId, query) {
      return instances.listInstances(context, { ...query, templateId });
    },
    async listInstancesByStatus(context, status, query) {
      return instances.listInstances(context, { ...query, status });
    },
  };

  const w9Requests: LegalW9RequestReadRepositoryPort = {
    async getW9RequestById(context, requestId) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalW9RequestRow>(
        transport,
        LEGAL_READ_RPC_NAMES.w9Requests,
      );
      if (!rows.ok) return rows;
      const row = rows.value.find((item) => item.business_id === requestId.trim());
      if (!row || !matchesRecipientScope(context, row.recipient_id)) {
        return notFound('W-9 request', requestId);
      }
      return mapLegalW9RequestRowToDomain(row);
    },
    async listW9Requests(context, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalW9RequestRow>(
        transport,
        LEGAL_READ_RPC_NAMES.w9Requests,
      );
      if (!rows.ok) return rows;
      let filtered = filterByRecipient(rows.value, context);
      if (query?.status) filtered = Object.freeze(filtered.filter((row) => row.status === query.status));
      const page = resolvePagination(filtered, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalW9RequestRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async listW9RequestsByRecipient(context, recipientType, recipientId, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalW9RequestRow>(
        transport,
        LEGAL_READ_RPC_NAMES.w9Requests,
      );
      if (!rows.ok) return rows;
      const scoped = Object.freeze(
        rows.value.filter(
          (row) => row.recipient_type === recipientType && row.recipient_id === recipientId,
        ),
      );
      const visible = filterByRecipient(scoped, context);
      const page = resolvePagination(visible, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalW9RequestRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async listW9RequestsByStatus(context, status, query) {
      return w9Requests.listW9Requests(context, { ...query, status });
    },
    async findActiveW9RequestByRecipientAndTemplate(context, recipientType, recipientId, templateId) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalW9RequestRow>(
        transport,
        LEGAL_READ_RPC_NAMES.w9Requests,
      );
      if (!rows.ok) return rows;
      const row = findActiveW9Row(rows.value, recipientType, recipientId, templateId);
      if (!row || !matchesRecipientScope(context, row.recipient_id)) {
        return legalPersistenceSuccess(null);
      }
      const mapped = mapLegalW9RequestRowToDomain(row);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(mapped.value);
    },
  };

  const listSubmissionRows = async (
    context: LegalReadAccessContext,
    rows: readonly LegalDocumentSubmissionRow[],
    query?: Parameters<LegalDocumentSubmissionReadRepositoryPort['listSubmissions']>[1],
  ) => {
    const visible = Object.freeze(
      rows.filter((row) => matchesRecipientScope(context, row.recipient_id)),
    );
    const page = resolvePagination(visible, query);
    if (!page.ok) return page;
    const mapped = mapRowsToDomainList(page.value.items, mapLegalDocumentSubmissionRowToDomain);
    if (!mapped.ok) return mapped;
    return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
  };

  const submissions: LegalDocumentSubmissionReadRepositoryPort = {
    async getSubmissionById(context, submissionId) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalDocumentSubmissionRow>(
        transport,
        LEGAL_READ_RPC_NAMES.submissions,
      );
      if (!rows.ok) return rows;
      const row = rows.value.find((item) => item.business_id === submissionId.trim());
      if (!row) return notFound('Submission', submissionId);
      if (!matchesRecipientScope(context, row.recipient_id)) {
        return notFound('Submission', submissionId);
      }
      if (row.status === 'deleted' && !canReadDeletedSubmissions(context)) {
        return notFound('Submission', submissionId);
      }
      return mapLegalDocumentSubmissionRowToDomain(row);
    },
    async listSubmissions(context, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalDocumentSubmissionRow>(
        transport,
        LEGAL_READ_RPC_NAMES.submissions,
      );
      if (!rows.ok) return rows;
      return listSubmissionRows(context, filterActiveSubmissions(rows.value), query);
    },
    async listSubmissionsByInstance(context, instanceId, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalDocumentSubmissionRow>(
        transport,
        LEGAL_READ_RPC_NAMES.submissions,
      );
      if (!rows.ok) return rows;
      const scoped = filterActiveSubmissions(
        rows.value.filter((row) => row.document_instance_business_id === instanceId.trim()),
      );
      return listSubmissionRows(context, scoped, query);
    },
    async listSubmissionsByWorkflow(context, workflowId, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalDocumentSubmissionRow>(
        transport,
        LEGAL_READ_RPC_NAMES.submissions,
      );
      if (!rows.ok) return rows;
      const scoped = filterActiveSubmissions(
        rows.value.filter((row) => row.workflow_business_id === workflowId.trim()),
      );
      return listSubmissionRows(context, scoped, query);
    },
    async listSubmissionsIncludingDeleted(context, query) {
      const access = ensureDeletedSubmissionAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalDocumentSubmissionRow>(
        transport,
        LEGAL_READ_RPC_NAMES.submissions,
      );
      if (!rows.ok) return rows;
      return listSubmissionRows(context, rows.value, query);
    },
  };

  const listAuditRows = async (
    context: LegalReadAccessContext,
    rows: readonly LegalAuditEventRow[],
    query?: LegalAuditEventListQuery,
  ) => {
    const access = ensureAuditReadAccess(context);
    if (!access.ok) return access;
    const sorted = sortAuditRowsBySequence(rows);
    const visible = Object.freeze(
      sorted.filter((row) => {
        const recipientId = resolveAuditRecipientIdFromRelatedEntityIds(row.related_entity_ids);
        return canReadAuditEventForContext(context, recipientId, row.actor_id, row.actor_portal);
      }),
    );
    const page = resolvePagination(visible, query);
    if (!page.ok) return page;
    const mapped = mapRowsToDomainList(page.value.items, mapLegalAuditEventRowToDomain);
    if (!mapped.ok) return mapped;
    return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
  };

  const audit: LegalAuditReadRepositoryPort = {
    async getAuditEventById(context, eventId) {
      const access = ensureAuditReadAccess(context);
      if (!access.ok) return access;
      const rows = await fetchTransportRows<LegalAuditEventRow>(
        transport,
        LEGAL_READ_RPC_NAMES.auditEvents,
      );
      if (!rows.ok) return rows;
      const row = rows.value.find((item) => item.business_id === eventId.trim());
      if (!row) return notFound('Audit event', eventId);
      const recipientId = resolveAuditRecipientIdFromRelatedEntityIds(row.related_entity_ids);
      if (!canReadAuditEventForContext(context, recipientId, row.actor_id, row.actor_portal)) {
        return notFound('Audit event', eventId);
      }
      return mapLegalAuditEventRowToDomain(row);
    },
    async listAuditEvents(context, query) {
      const rows = await fetchTransportRows<LegalAuditEventRow>(
        transport,
        LEGAL_READ_RPC_NAMES.auditEvents,
      );
      if (!rows.ok) return rows;
      return listAuditRows(context, rows.value, query);
    },
    async listAuditEventsByEntity(context, entityType, entityId, query) {
      const rows = await fetchTransportRows<LegalAuditEventRow>(
        transport,
        LEGAL_READ_RPC_NAMES.auditEvents,
      );
      if (!rows.ok) return rows;
      const scoped = rows.value.filter(
        (row) => row.entity_type === entityType && row.entity_id === entityId.trim(),
      );
      return listAuditRows(context, scoped, query);
    },
    async listAuditEventsByActor(context, actorId, query) {
      const rows = await fetchTransportRows<LegalAuditEventRow>(
        transport,
        LEGAL_READ_RPC_NAMES.auditEvents,
      );
      if (!rows.ok) return rows;
      const scoped = rows.value.filter((row) => row.actor_id === actorId.trim());
      return listAuditRows(context, scoped, query);
    },
    async listAuditEventsByAction(context, action, query) {
      const rows = await fetchTransportRows<LegalAuditEventRow>(
        transport,
        LEGAL_READ_RPC_NAMES.auditEvents,
      );
      if (!rows.ok) return rows;
      const scoped = rows.value.filter((row) => row.action === action);
      return listAuditRows(context, scoped, query);
    },
    async listAuditEventsByCorrelationId(context, correlationId, query) {
      const rows = await fetchTransportRows<LegalAuditEventRow>(
        transport,
        LEGAL_READ_RPC_NAMES.auditEvents,
      );
      if (!rows.ok) return rows;
      const scoped = rows.value.filter((row) => row.correlation_id === correlationId.trim());
      return listAuditRows(context, scoped, query);
    },
    async listAuditEventsByTimeRange(context, dateFrom, dateTo, query) {
      const rows = await fetchTransportRows<LegalAuditEventRow>(
        transport,
        LEGAL_READ_RPC_NAMES.auditEvents,
      );
      if (!rows.ok) return rows;
      const scoped = rows.value.filter(
        (row) => row.occurred_at >= dateFrom && row.occurred_at <= dateTo,
      );
      return listAuditRows(context, scoped, query);
    },
  };

  return Object.freeze({ templates, instances, w9Requests, submissions, audit });
}

export function createSupabaseSimulatedLegalReadRepositories(
  transport: LegalPersistenceReadTransport,
): LegalReadPersistenceRepositories {
  return createSupabaseLegalReadRepositories({ transport });
}
