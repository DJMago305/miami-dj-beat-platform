/** LC-7 — W-9 workflow transitions */

import {
  legalW9WorkflowError,
  legalW9WorkflowSuccess,
  w9TransitionContext,
  type LegalW9WorkflowResult,
} from './legal-w9-request-errors';
import { freezeLegalW9Request } from './legal-w9-request-immutability';
import type { LegalW9Request } from './legal-w9-request-types';
import {
  isTerminalLegalW9RequestStatus,
  type LegalW9RequestStatus,
} from './legal-w9-request-status';

const ALLOWED_TRANSITIONS = {
  requested: ['available', 'cancelled', 'expired'],
  available: ['viewed', 'cancelled', 'expired'],
  viewed: ['awaiting_upload', 'cancelled', 'expired'],
  awaiting_upload: ['submitted', 'cancelled', 'expired'],
  expired: [],
  cancelled: [],
  submitted: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
} as const satisfies Record<LegalW9RequestStatus, readonly LegalW9RequestStatus[]>;

export function canTransitionLegalW9RequestStatus(
  currentStatus: LegalW9RequestStatus,
  nextStatus: LegalW9RequestStatus,
): boolean {
  if (currentStatus === nextStatus) {
    return false;
  }
  if (isTerminalLegalW9RequestStatus(currentStatus)) {
    return false;
  }
  return (ALLOWED_TRANSITIONS[currentStatus] as readonly LegalW9RequestStatus[]).includes(nextStatus);
}

export function applyLegalW9RequestStatusTransition(
  request: LegalW9Request,
  nextStatus: LegalW9RequestStatus,
  updatedAt: string,
): LegalW9WorkflowResult<LegalW9Request> {
  if (isTerminalLegalW9RequestStatus(request.status)) {
    return legalW9WorkflowError(
      'w9_request_already_terminal',
      `W-9 request ${request.id} is terminal (${request.status}).`,
      Object.freeze({ status: request.status }),
    );
  }

  if (request.status === nextStatus) {
    return legalW9WorkflowSuccess(freezeLegalW9Request({ ...request, updatedAt }));
  }

  if (!canTransitionLegalW9RequestStatus(request.status, nextStatus)) {
    return legalW9WorkflowError(
      'w9_invalid_status_transition',
      `Cannot transition W-9 request ${request.id} from ${request.status} to ${nextStatus}.`,
      w9TransitionContext(request.status, nextStatus),
    );
  }

  return legalW9WorkflowSuccess(
    freezeLegalW9Request({
      ...request,
      status: nextStatus,
      updatedAt,
      ...(nextStatus === 'viewed' || nextStatus === 'awaiting_upload'
        ? { viewedAt: request.viewedAt ?? updatedAt }
        : {}),
      ...(nextStatus === 'submitted'
        ? { reviewStatus: 'pending_review' as const }
        : {}),
      ...(nextStatus === 'accepted' || nextStatus === 'rejected'
        ? { reviewStatus: 'complete' as const, completedAt: updatedAt }
        : {}),
    }),
  );
}

export function applyLegalW9ViewedTransition(
  request: LegalW9Request,
  updatedAt: string,
): LegalW9WorkflowResult<LegalW9Request> {
  if (request.status === 'viewed' || request.status === 'awaiting_upload') {
    return legalW9WorkflowSuccess(
      freezeLegalW9Request({
        ...request,
        viewedAt: request.viewedAt ?? updatedAt,
        updatedAt,
      }),
    );
  }
  return applyLegalW9RequestStatusTransition(request, 'viewed', updatedAt);
}
