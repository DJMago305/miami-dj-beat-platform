/** LC-8 — Legal document submission permissions */

import type { LegalWorkflowActor } from '../workflows/legal-w9-workflow-actor';
import type { LegalDocumentSubmissionSubmittedBy } from './legal-document-submission-types';

export function canActorSubmitW9Document(actor: LegalWorkflowActor): boolean {
  return actor.portal === 'artist';
}

export function canActorReviewSubmissions(actor: LegalWorkflowActor): boolean {
  return actor.portal === 'staff' && (actor.role === 'owner' || actor.role === 'manager');
}

export function canActorDeleteSubmissions(actor: LegalWorkflowActor): boolean {
  return actor.portal === 'staff' && actor.role === 'owner';
}

export function canActorListSubmissions(actor: LegalWorkflowActor): boolean {
  if (actor.portal === 'client') {
    return false;
  }
  if (actor.portal === 'staff' && actor.role === 'seller') {
    return false;
  }
  if (actor.portal === 'staff') {
    return actor.role === 'owner' || actor.role === 'manager';
  }
  return actor.portal === 'artist';
}

export function canActorViewSubmission(
  actor: LegalWorkflowActor,
  submittedBy: LegalDocumentSubmissionSubmittedBy,
): boolean {
  if (actor.portal === 'client') {
    return false;
  }
  if (actor.portal === 'staff' && actor.role === 'seller') {
    return false;
  }
  if (actor.portal === 'staff') {
    return actor.role === 'owner' || actor.role === 'manager';
  }
  if (actor.portal === 'artist') {
    return submittedBy.actorId === actor.actorId && submittedBy.portal === 'artist';
  }
  return false;
}
