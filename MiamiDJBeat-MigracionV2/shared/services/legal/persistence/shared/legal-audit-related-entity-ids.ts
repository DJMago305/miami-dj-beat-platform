/** LC-11/LC-12 — Audit related entity IDs persistence helpers */

import type { LegalAuditEvent } from '../../audit/legal-audit-event-types';

export function mapRelatedEntityIdsArrayToDomain(
  ids: readonly string[],
): LegalAuditEvent['relatedEntityIds'] {
  const related: Record<string, string> = {};
  for (const value of ids) {
    const id = value.trim();
    if (!id) {
      continue;
    }
    if (/^W9R-/.test(id)) {
      related.workflowId = id;
    } else if (/^LDS-/.test(id)) {
      related.submissionId = id;
    } else if (/^LDI-/.test(id)) {
      related.documentInstanceId = id;
    } else if (/^ART-/.test(id) || /^CLI-/.test(id)) {
      related.recipientId = id;
    } else {
      related[`related_${Object.keys(related).length + 1}`] = id;
    }
  }
  return Object.freeze(related);
}

export function resolveAuditRecipientIdFromRelatedEntityIds(
  ids: readonly string[],
): string | null {
  for (const value of ids) {
    if (typeof value === 'string' && /^ART-/.test(value.trim())) {
      return value.trim();
    }
  }
  const mapped = mapRelatedEntityIdsArrayToDomain(ids);
  return typeof mapped.recipientId === 'string' ? mapped.recipientId : null;
}
