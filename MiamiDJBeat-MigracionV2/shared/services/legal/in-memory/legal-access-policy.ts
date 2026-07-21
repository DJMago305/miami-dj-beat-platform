/** Legal access policy — read-side portal projections — TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001 */

import type { LegalProfileId, SignaturePackageId } from '../contracts/legal-ids';
import type {
  AuditTimelineView,
  ComplianceCenterView,
  DocumentsLibraryView,
  LegalExpedienteSnapshot,
  SignatureHistoryEntry,
  SignatureHistoryView,
  TaxCenterView,
} from '../contracts/legal-projections';

export const LEGAL_VIEWER_ROLES = [
  'staff_owner',
  'staff_manager',
  'staff_seller',
  'artist',
  'client',
  'external_signer',
] as const;

export type LegalViewerRole = (typeof LEGAL_VIEWER_ROLES)[number];

export type LegalViewerContext = {
  readonly role: LegalViewerRole;
  readonly viewerProfileId?: LegalProfileId;
  readonly subjectProfileId: LegalProfileId;
  readonly assignedPackageId?: SignaturePackageId;
};

export type SafeExpedienteView = {
  readonly version: 1;
  readonly profile: LegalExpedienteSnapshot['profile'];
  readonly status: LegalExpedienteSnapshot['status'];
  readonly documentsLibrary: DocumentsLibraryView;
  readonly taxCenter?: TaxCenterView;
  readonly complianceCenter?: ComplianceCenterView;
  readonly pendingPackages: LegalExpedienteSnapshot['pendingPackages'];
  readonly notifications: LegalExpedienteSnapshot['notifications'];
  readonly signatureHistory?: SignatureHistoryView;
  readonly auditTimeline?: AuditTimelineView;
};

export type ExternalSignerPackageView = {
  readonly packageId: SignaturePackageId;
  readonly packageCode: string;
  readonly signingStatus: LegalExpedienteSnapshot['pendingPackages'][number]['signingStatus'];
  readonly progressRatio: string;
  readonly expiresAt: string;
  readonly documentCount: number;
  readonly completedCount: number;
};

function stripSignatureHistoryForSeller(entries: readonly SignatureHistoryEntry[]): SignatureHistoryEntry[] {
  return entries.map((entry) =>
    Object.freeze({
      ...entry,
      ipHashPartial: undefined,
      deviceClass: undefined,
      browserFamily: undefined,
    }),
  );
}

export function canViewSubjectExpediente(context: LegalViewerContext): boolean {
  if (context.role === 'staff_owner' || context.role === 'staff_manager' || context.role === 'staff_seller') {
    return true;
  }
  if (context.role === 'artist' || context.role === 'client') {
    return context.viewerProfileId === context.subjectProfileId;
  }
  return false;
}

export function canExternalSignerAccessPackage(
  viewerProfileId: LegalProfileId | undefined,
  assignedPackageId: SignaturePackageId | undefined,
  requestedPackageId: SignaturePackageId,
): boolean {
  if (!viewerProfileId || !assignedPackageId) {
    return false;
  }
  return assignedPackageId === requestedPackageId;
}

export function projectTaxCenterForViewer(
  taxCenter: TaxCenterView | undefined,
  role: LegalViewerRole,
): TaxCenterView | undefined {
  if (!taxCenter) {
    return undefined;
  }
  if (role === 'staff_seller' || role === 'client' || role === 'external_signer') {
    return undefined;
  }
  return Object.freeze({
    ...taxCenter,
    tinLast4: taxCenter.tinLast4 ? `***-${taxCenter.tinLast4}` : undefined,
  });
}

export function projectComplianceForViewer(
  complianceCenter: ComplianceCenterView | undefined,
  role: LegalViewerRole,
): ComplianceCenterView | undefined {
  if (!complianceCenter) {
    return undefined;
  }
  if (role === 'client' || role === 'external_signer') {
    return undefined;
  }
  if (role === 'staff_seller') {
    return Object.freeze({
      ...complianceCenter,
      matrices: Object.freeze(
        complianceCenter.matrices.map((matrix) =>
          Object.freeze({
            eventType: matrix.eventType,
            aggregateState: matrix.aggregateState,
            cells: Object.freeze(
              (matrix.cells ?? []).map((cell) =>
                Object.freeze({
                  requirementCode: cell.requirementCode,
                  state: cell.state,
                }),
              ),
            ),
          }),
        ),
      ),
    });
  }
  return complianceCenter;
}

export function projectSignatureHistoryForViewer(
  history: SignatureHistoryView | null,
  role: LegalViewerRole,
): SignatureHistoryView | undefined {
  if (!history) {
    return undefined;
  }
  if (role === 'staff_seller') {
    return Object.freeze({
      ...history,
      entries: Object.freeze(stripSignatureHistoryForSeller(history.entries)),
    });
  }
  if (role === 'external_signer') {
    return undefined;
  }
  return history;
}

export function projectAuditTimelineForViewer(
  auditTimeline: AuditTimelineView | null,
  role: LegalViewerRole,
): AuditTimelineView | undefined {
  if (!auditTimeline) {
    return undefined;
  }
  if (role === 'staff_seller' || role === 'client' || role === 'external_signer') {
    return undefined;
  }
  return auditTimeline;
}

export function projectExpedienteForViewer(
  snapshot: LegalExpedienteSnapshot,
  context: LegalViewerContext,
  extras?: {
    readonly signatureHistory?: SignatureHistoryView | null;
    readonly auditTimeline?: AuditTimelineView | null;
  },
): SafeExpedienteView | null {
  if (!canViewSubjectExpediente(context)) {
    return null;
  }

  const taxCenter = projectTaxCenterForViewer(snapshot.taxCenter, context.role);
  const complianceCenter = projectComplianceForViewer(snapshot.complianceCenter, context.role);
  const signatureHistory = projectSignatureHistoryForViewer(extras?.signatureHistory ?? null, context.role);
  const auditTimeline = projectAuditTimelineForViewer(extras?.auditTimeline ?? null, context.role);

  let status = snapshot.status;
  if (context.role === 'staff_seller') {
    status = Object.freeze({
      ...status,
      statusItems: Object.freeze([]),
    });
  }

  return Object.freeze({
    version: 1,
    profile: snapshot.profile,
    status,
    documentsLibrary: snapshot.documentsLibrary,
    taxCenter,
    complianceCenter,
    pendingPackages:
      context.role === 'staff_seller'
        ? Object.freeze(
            snapshot.pendingPackages.map((pkg) =>
              Object.freeze({
                packageId: pkg.packageId,
                packageCode: pkg.packageCode,
                signingStatus: pkg.signingStatus,
                documentCount: pkg.documentCount,
                completedCount: pkg.completedCount,
                progressRatio: pkg.progressRatio,
                expiresAt: pkg.expiresAt,
                items: Object.freeze([]),
              }),
            ),
          )
        : snapshot.pendingPackages,
    notifications: snapshot.notifications,
    signatureHistory,
    auditTimeline,
  });
}
