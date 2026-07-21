/** LC-11 — Shared legal read repository helpers */

import { isActiveLegalW9RequestStatus } from '../../workflows/legal-w9-request-status';
import { isActiveLegalDocumentSubmissionStatus } from '../../submissions/legal-document-submission-status';
import {
  canReadDeletedSubmissions,
  canReadFiscalLegalData,
  canReadFullAuditTrail,
  canReadW9TemplateCatalog,
  matchesRecipientScope,
  type LegalReadAccessContext,
} from '../legal-read-access-context';
import {
  decodeReadCursor,
  normalizeReadLimit,
  paginateRows,
  type LegalReadPage,
} from '../legal-persistence-page';
import {
  legalPersistenceError,
  legalPersistenceSuccess,
  type LegalPersistenceResult,
} from '../legal-persistence-errors';
import type { LegalReadQueryBase } from '../legal-persistence-query-types';

export function ensureFiscalReadAccess(context: LegalReadAccessContext): LegalPersistenceResult<true> {
  if (!canReadFiscalLegalData(context)) {
    return legalPersistenceError('persistence_access_forbidden', 'Actor cannot read fiscal legal data.');
  }
  return legalPersistenceSuccess(true);
}

export function ensureTemplateCatalogAccess(context: LegalReadAccessContext): LegalPersistenceResult<true> {
  if (!canReadW9TemplateCatalog(context)) {
    return legalPersistenceError('persistence_access_forbidden', 'Actor cannot read fiscal template catalog.');
  }
  return legalPersistenceSuccess(true);
}

export function ensureDeletedSubmissionAccess(context: LegalReadAccessContext): LegalPersistenceResult<true> {
  if (!canReadDeletedSubmissions(context)) {
    return legalPersistenceError('persistence_access_forbidden', 'Actor cannot read deleted submissions.');
  }
  return legalPersistenceSuccess(true);
}

export function ensureAuditReadAccess(context: LegalReadAccessContext): LegalPersistenceResult<true> {
  if (context.portal === 'client' || (context.portal === 'staff' && context.role === 'seller')) {
    return legalPersistenceError('persistence_access_forbidden', 'Actor cannot read fiscal audit trail.');
  }
  return legalPersistenceSuccess(true);
}

export function canReadAuditEventForContext(
  context: LegalReadAccessContext,
  recipientId: string | null,
  actorId: string,
  actorPortal: string,
): boolean {
  if (canReadFullAuditTrail(context)) {
    return true;
  }
  if (context.portal === 'artist') {
    if (actorPortal === 'artist' && actorId === context.actorId) {
      return true;
    }
    if (recipientId && matchesRecipientScope(context, recipientId)) {
      return true;
    }
    return false;
  }
  return false;
}

export function resolvePagination<T>(
  rows: readonly T[],
  query: LegalReadQueryBase = {},
): LegalPersistenceResult<LegalReadPage<T>> {
  const limitResult = normalizeReadLimit(query.limit);
  if (!limitResult.ok) {
    return limitResult;
  }
  const cursorResult = decodeReadCursor(query.cursor);
  if (!cursorResult.ok) {
    return cursorResult;
  }
  return legalPersistenceSuccess(paginateRows(rows, limitResult.value, cursorResult.value));
}

export function findActiveW9Row<
  T extends { readonly recipient_type: string; readonly recipient_id: string; readonly template_id: string; readonly status: string },
>(rows: readonly T[], recipientType: string, recipientId: string, templateId: string): T | null {
  return (
    rows.find(
      (row) =>
        row.recipient_type === recipientType &&
        row.recipient_id === recipientId &&
        row.template_id === templateId &&
        isActiveLegalW9RequestStatus(row.status as never),
    ) ?? null
  );
}

export function filterActiveSubmissions<
  T extends { readonly status: string; readonly deleted_at?: string | null },
>(rows: readonly T[]): readonly T[] {
  return Object.freeze(rows.filter((row) => isActiveLegalDocumentSubmissionStatus(row.status as never)));
}

export function sortAuditRowsBySequence<
  T extends { readonly sequence: number; readonly business_id: string },
>(rows: readonly T[]): readonly T[] {
  return Object.freeze(
    [...rows].sort((left, right) =>
      left.sequence === right.sequence
        ? left.business_id.localeCompare(right.business_id)
        : left.sequence - right.sequence,
    ),
  );
}

export function notFound<T>(entity: string, id: string): LegalPersistenceResult<T> {
  return legalPersistenceError('persistence_entity_not_found', `${entity} not found.`, Object.freeze({ id }));
}
