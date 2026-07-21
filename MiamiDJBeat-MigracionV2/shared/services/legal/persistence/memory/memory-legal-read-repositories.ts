/** LC-11 — Memory legal read repositories */

import type { LegalReadFixtureStore } from '../fixtures/legal-read-fixture-store';
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
import { legalPersistenceSuccess } from '../legal-persistence-errors';
import type { LegalAuditEventListQuery } from '../legal-persistence-query-types';

function filterByRecipient<
  T extends { readonly recipient_type: string; readonly recipient_id: string },
>(rows: readonly T[], context: LegalReadAccessContext): readonly T[] {
  if (context.portal === 'staff' && (context.role === 'owner' || context.role === 'manager')) {
    return rows;
  }
  if (context.portal === 'artist') {
    return Object.freeze(
      rows.filter((row) => matchesRecipientScope(context, row.recipient_id)),
    );
  }
  return Object.freeze([]);
}

export function createMemoryLegalReadRepositories(
  store: LegalReadFixtureStore,
): LegalReadPersistenceRepositories {
  const templates: LegalTemplateReadRepositoryPort = {
    async getTemplateById(context, templateId) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const row = store.templates.find((item) => item.business_id === templateId.trim());
      if (!row) return notFound('Template', templateId);
      return mapLegalTemplateRowToDomain(row);
    },
    async getTemplateVersionById(context, templateVersionId) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const row = store.templateVersions.find((item) => item.business_id === templateVersionId.trim());
      if (!row) return notFound('Template version', templateVersionId);
      return mapLegalTemplateVersionRowToDomain(row);
    },
    async listTemplates(context, query) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const filtered = store.templates.filter((row) =>
        query?.category ? row.category === query.category : true,
      );
      const page = resolvePagination(filtered, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalTemplateRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(
        Object.freeze({ ...page.value, items: mapped.value }),
      );
    },
    async listTemplateVersions(context, templateId, query) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const filtered = store.templateVersions.filter((row) => row.template_business_id === templateId.trim());
      const page = resolvePagination(filtered, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalTemplateVersionRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async listTemplateAssets(context, templateId, query) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const filtered = store.templateAssets.filter((row) => row.template_business_id === templateId.trim());
      const page = resolvePagination(filtered, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalTemplateAssetRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async getTemplateAssetMetadata(context, assetKey) {
      const access = ensureTemplateCatalogAccess(context);
      if (!access.ok) return access;
      const row = store.templateAssets.find((item) => item.asset_key === assetKey.trim());
      if (!row) return notFound('Template asset', assetKey);
      return mapLegalTemplateAssetRowToDomain(row);
    },
  };

  const instances: LegalDocumentInstanceReadRepositoryPort = {
    async getInstanceById(context, instanceId) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const row = store.instances.find((item) => item.business_id === instanceId.trim());
      if (!row) return notFound('Document instance', instanceId);
      if (!matchesRecipientScope(context, row.recipient_id) && context.portal !== 'staff') {
        return notFound('Document instance', instanceId);
      }
      return mapLegalDocumentInstanceRowToDomain(row);
    },
    async listInstances(context, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      let rows = filterByRecipient(store.instances, context);
      if (query?.recipientType) {
        rows = Object.freeze(rows.filter((row) => row.recipient_type === query.recipientType));
      }
      if (query?.recipientId) {
        rows = Object.freeze(rows.filter((row) => row.recipient_id === query.recipientId));
      }
      if (query?.status) rows = Object.freeze(rows.filter((row) => row.status === query.status));
      if (query?.templateId) rows = Object.freeze(rows.filter((row) => row.template_id === query.templateId));
      const page = resolvePagination(rows, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalDocumentInstanceRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async listInstancesByRecipient(context, recipientType, recipientId, query) {
      return instances.listInstances(context, {
        ...query,
        recipientType,
        recipientId,
      });
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
      const row = store.w9Requests.find((item) => item.business_id === requestId.trim());
      if (!row || !matchesRecipientScope(context, row.recipient_id)) {
        return notFound('W-9 request', requestId);
      }
      return mapLegalW9RequestRowToDomain(row);
    },
    async listW9Requests(context, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      let rows = filterByRecipient(store.w9Requests, context);
      if (query?.status) rows = Object.freeze(rows.filter((row) => row.status === query.status));
      const page = resolvePagination(rows, query);
      if (!page.ok) return page;
      const mapped = mapRowsToDomainList(page.value.items, mapLegalW9RequestRowToDomain);
      if (!mapped.ok) return mapped;
      return legalPersistenceSuccess(Object.freeze({ ...page.value, items: mapped.value }));
    },
    async listW9RequestsByRecipient(context, recipientType, recipientId, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = Object.freeze(
        store.w9Requests.filter(
          (row) => row.recipient_type === recipientType && row.recipient_id === recipientId,
        ),
      );
      const visible = filterByRecipient(rows, context);
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
      const row = findActiveW9Row(store.w9Requests, recipientType, recipientId, templateId);
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
    rows: readonly (typeof store.submissions)[number][],
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
      const row = store.submissions.find((item) => item.business_id === submissionId.trim());
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
      return listSubmissionRows(context, filterActiveSubmissions(store.submissions), query);
    },
    async listSubmissionsByInstance(context, instanceId, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = filterActiveSubmissions(
        store.submissions.filter((row) => row.document_instance_business_id === instanceId.trim()),
      );
      return listSubmissionRows(context, rows, query);
    },
    async listSubmissionsByWorkflow(context, workflowId, query) {
      const access = ensureFiscalReadAccess(context);
      if (!access.ok) return access;
      const rows = filterActiveSubmissions(
        store.submissions.filter((row) => row.workflow_business_id === workflowId.trim()),
      );
      return listSubmissionRows(context, rows, query);
    },
    async listSubmissionsIncludingDeleted(context, query) {
      const access = ensureDeletedSubmissionAccess(context);
      if (!access.ok) return access;
      return listSubmissionRows(context, store.submissions, query);
    },
  };

  const listAuditRows = async (
    context: LegalReadAccessContext,
    rows: readonly (typeof store.auditEvents)[number][],
    query?: LegalAuditEventListQuery,
  ) => {
    const access = ensureAuditReadAccess(context);
    if (!access.ok) return access;
    const sorted = sortAuditRowsBySequence(rows);
    const visible = Object.freeze(
      sorted.filter((row) => {
        const recipientId =
          typeof row.related_entity_ids.recipientId === 'string'
            ? row.related_entity_ids.recipientId
            : null;
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
      const row = store.auditEvents.find((item) => item.business_id === eventId.trim());
      if (!row) return notFound('Audit event', eventId);
      const recipientId =
        typeof row.related_entity_ids.recipientId === 'string'
          ? row.related_entity_ids.recipientId
          : null;
      if (
        !canReadAuditEventForContext(context, recipientId, row.actor_id, row.actor_portal)
      ) {
        return notFound('Audit event', eventId);
      }
      return mapLegalAuditEventRowToDomain(row);
    },
    async listAuditEvents(context, query) {
      return listAuditRows(context, store.auditEvents, query);
    },
    async listAuditEventsByEntity(context, entityType, entityId, query) {
      const rows = store.auditEvents.filter(
        (row) => row.entity_type === entityType && row.entity_id === entityId.trim(),
      );
      return listAuditRows(context, rows, query);
    },
    async listAuditEventsByActor(context, actorId, query) {
      const rows = store.auditEvents.filter((row) => row.actor_id === actorId.trim());
      return listAuditRows(context, rows, query);
    },
    async listAuditEventsByAction(context, action, query) {
      const rows = store.auditEvents.filter((row) => row.action === action);
      return listAuditRows(context, rows, query);
    },
    async listAuditEventsByCorrelationId(context, correlationId, query) {
      const rows = store.auditEvents.filter((row) => row.correlation_id === correlationId.trim());
      return listAuditRows(context, rows, query);
    },
    async listAuditEventsByTimeRange(context, dateFrom, dateTo, query) {
      const rows = store.auditEvents.filter(
        (row) => row.occurred_at >= dateFrom && row.occurred_at <= dateTo,
      );
      return listAuditRows(context, rows, query);
    },
  };

  return Object.freeze({ templates, instances, w9Requests, submissions, audit });
}
