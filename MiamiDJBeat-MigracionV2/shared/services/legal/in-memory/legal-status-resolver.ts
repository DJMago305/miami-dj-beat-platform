/** Legal Status resolver — pure read-side — TICKET-V2-LEGAL-IN-MEMORY-SERVICE-001 */

import type {
  ComplianceProfile,
  LegalDocument,
  LegalProfile,
  TaxProfile,
} from '../contracts/legal-entities';
import type { LegalAggregateStatus, LegalRestriction } from '../contracts/legal-enums';

export const LEGAL_STATUS_REASON_CODES = [
  'W9_REQUIRED',
  'W9_PENDING',
  'ANTI_BYPASS_MISSING',
  'CONTRACT_EXPIRED',
  'CONTRACT_MISSING',
  'INSURANCE_EXPIRED',
  'INSURANCE_EXPIRING_SOON',
  'COMPLIANCE_BLOCKED',
  'COMPLIANCE_WARNING',
  'POLICIES_INCOMPLETE',
  'MATCHING_BLOCKED',
  'PAYOUT_BLOCKED',
] as const;

export type LegalStatusReasonCode = (typeof LEGAL_STATUS_REASON_CODES)[number];

export type LegalStatusReason = {
  readonly code: LegalStatusReasonCode;
  readonly blocking: boolean;
  readonly labelKey: string;
};

export type LegalStatusResolution = {
  readonly status: LegalAggregateStatus;
  readonly reasons: readonly LegalStatusReason[];
  readonly restrictions: readonly LegalRestriction[];
};

export type ResolveLegalStatusInput = {
  readonly profile: LegalProfile;
  readonly documents: readonly LegalDocument[];
  readonly taxProfile?: TaxProfile | null;
  readonly complianceProfile?: ComplianceProfile | null;
  readonly now?: Date;
};

const POLICY_TEMPLATE_CODES = ['LGL-001', 'LGL-002', 'LGL-003'] as const;
const INSURANCE_TEMPLATE_CODE = 'SPC-002';

function hasAcceptedPolicy(documents: readonly LegalDocument[], templateCode: string): boolean {
  return documents.some(
    (document) =>
      document.templateCode === templateCode &&
      (document.lifecycleStatus === 'COMPLETED' || document.lifecycleStatus === 'SIGNED_BY_RECIPIENT'),
  );
}

function findContract(documents: readonly LegalDocument[]): LegalDocument | undefined {
  return documents.find((document) => document.templateCode.startsWith('CTR-'));
}

function findInsurance(documents: readonly LegalDocument[]): LegalDocument | undefined {
  return documents.find((document) => document.templateCode === INSURANCE_TEMPLATE_CODE);
}

function isExpired(isoDate: string | undefined, now: Date): boolean {
  if (!isoDate) {
    return false;
  }
  const timestamp = Date.parse(isoDate);
  return !Number.isNaN(timestamp) && timestamp < now.getTime();
}

function isExpiringSoon(isoDate: string | undefined, now: Date, days: number): boolean {
  if (!isoDate) {
    return false;
  }
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) {
    return false;
  }
  const windowMs = days * 24 * 60 * 60 * 1000;
  return timestamp >= now.getTime() && timestamp <= now.getTime() + windowMs;
}

function requiresW9(profile: LegalProfile): boolean {
  return profile.subjectType === 'artist' || profile.subjectType === 'vendor';
}

function pushReason(
  reasons: LegalStatusReason[],
  code: LegalStatusReasonCode,
  blocking: boolean,
  labelKey: string,
): void {
  reasons.push(Object.freeze({ code, blocking, labelKey }));
}

export function resolveLegalStatus(input: ResolveLegalStatusInput): LegalStatusResolution {
  const now = input.now ?? new Date();
  const reasons: LegalStatusReason[] = [];
  const profileDocuments = input.documents.filter(
    (document) =>
      document.ownerProfileId === input.profile.legalProfileId ||
      document.signerProfileIds.includes(input.profile.legalProfileId),
  );

  for (const templateCode of POLICY_TEMPLATE_CODES) {
    if (!hasAcceptedPolicy(profileDocuments, templateCode)) {
      pushReason(
        reasons,
        templateCode === 'LGL-003' ? 'ANTI_BYPASS_MISSING' : 'POLICIES_INCOMPLETE',
        templateCode === 'LGL-003',
        `legal.status.reason.${templateCode.toLowerCase()}`,
      );
    }
  }

  const contract = findContract(profileDocuments);
  if (!contract) {
    pushReason(reasons, 'CONTRACT_MISSING', true, 'legal.status.reason.contract_missing');
  } else if (
    contract.lifecycleStatus === 'EXPIRED' ||
    isExpired(contract.expiresAt, now)
  ) {
    pushReason(reasons, 'CONTRACT_EXPIRED', true, 'legal.status.reason.contract_expired');
  }

  if (requiresW9(input.profile)) {
    const w9Status = input.taxProfile?.w9Status ?? 'missing';
    if (w9Status === 'missing' || w9Status === 'rejected' || w9Status === 'expired') {
      pushReason(reasons, 'W9_REQUIRED', true, 'legal.status.reason.w9_required');
    } else if (w9Status === 'pending_review') {
      pushReason(reasons, 'W9_PENDING', false, 'legal.status.reason.w9_pending');
    }
  }

  const insurance = findInsurance(profileDocuments);
  if (insurance) {
    if (insurance.lifecycleStatus === 'EXPIRED' || isExpired(insurance.expiresAt, now)) {
      pushReason(reasons, 'INSURANCE_EXPIRED', true, 'legal.status.reason.insurance_expired');
    } else if (isExpiringSoon(insurance.expiresAt, now, 30)) {
      pushReason(reasons, 'INSURANCE_EXPIRING_SOON', false, 'legal.status.reason.insurance_expiring_soon');
    }
  }

  if (input.complianceProfile?.aggregateCompliance === 'blocked') {
    pushReason(reasons, 'COMPLIANCE_BLOCKED', true, 'legal.status.reason.compliance_blocked');
  } else if (input.complianceProfile?.aggregateCompliance === 'warning') {
    pushReason(reasons, 'COMPLIANCE_WARNING', false, 'legal.status.reason.compliance_warning');
  }

  for (const restriction of input.profile.restrictions) {
    if (restriction === 'no_matching') {
      pushReason(reasons, 'MATCHING_BLOCKED', true, 'legal.status.reason.matching_blocked');
    }
    if (restriction === 'no_payout') {
      pushReason(reasons, 'PAYOUT_BLOCKED', true, 'legal.status.reason.payout_blocked');
    }
  }

  const blocking = reasons.some((reason) => reason.blocking);
  const status: LegalAggregateStatus = blocking ? 'RED' : reasons.length > 0 ? 'YELLOW' : 'GREEN';

  return Object.freeze({
    status,
    reasons: Object.freeze([...reasons]),
    restrictions: Object.freeze([...input.profile.restrictions]),
  });
}
