/** LC-8 — In-memory legal document storage */

import type { LegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import { createSystemLegalDocumentInstanceClock } from '../domain/legal-document-instance-clock';
import {
  createLegalDocumentSubmission,
  type CreateLegalDocumentSubmissionDependencies,
} from '../submissions/legal-document-submission-factory';
import {
  legalDocumentSubmissionError,
  legalDocumentSubmissionSuccess,
  type LegalDocumentSubmissionResult,
} from '../submissions/legal-document-submission-errors';
import {
  bumpSubmissionSequenceFloor,
  cloneLegalDocumentSubmission,
  freezeLegalDocumentSubmission,
} from '../submissions/legal-document-submission-immutability';
import { transitionSubmissionStatus } from '../submissions/legal-document-submission-transition';
import {
  isActiveLegalDocumentSubmissionStatus,
  isTerminalLegalDocumentSubmissionStatus,
  type LegalDocumentSubmissionStatus,
} from '../submissions/legal-document-submission-status';
import type {
  LegalDocumentSubmission,
  LegalDocumentSubmissionId,
  ReplaceLegalDocumentSubmissionInput,
  StoreLegalDocumentSubmissionInput,
} from '../submissions/legal-document-submission-types';
import type { LegalDocumentStoragePort } from '../submissions/legal-document-storage-port';

export type InMemoryLegalDocumentStorageOptions = {
  readonly clock?: LegalDocumentInstanceClock;
};

export class InMemoryLegalDocumentStorage implements LegalDocumentStoragePort {
  private readonly clock: LegalDocumentInstanceClock;
  private readonly submissions = new Map<LegalDocumentSubmissionId, LegalDocumentSubmission>();
  private sequence = 0;

  constructor(options: InMemoryLegalDocumentStorageOptions = {}) {
    this.clock = options.clock ?? createSystemLegalDocumentInstanceClock();
  }

  private nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  private factoryDependencies(): CreateLegalDocumentSubmissionDependencies {
    return Object.freeze({
      clock: this.clock,
      nextSequence: () => this.nextSequence(),
    });
  }

  private persist(submission: LegalDocumentSubmission): LegalDocumentSubmission {
    this.submissions.set(submission.id, submission);
    this.sequence = bumpSubmissionSequenceFloor(this.sequence, submission.id);
    return cloneLegalDocumentSubmission(submission);
  }

  storeSubmission(
    input: StoreLegalDocumentSubmissionInput,
  ): LegalDocumentSubmissionResult<LegalDocumentSubmission> {
    const created = createLegalDocumentSubmission(input, this.factoryDependencies());
    if (!created.ok) {
      return created;
    }
    if (this.submissions.has(created.value.id)) {
      return legalDocumentSubmissionError(
        'duplicate_submission_id',
        `Duplicate submission id: ${created.value.id}`,
        Object.freeze({ id: created.value.id }),
      );
    }
    const persisted = this.persist(created.value);
    return legalDocumentSubmissionSuccess(persisted);
  }

  getSubmission(id: LegalDocumentSubmissionId): LegalDocumentSubmissionResult<LegalDocumentSubmission> {
    const submission = this.submissions.get(id);
    if (!submission) {
      return legalDocumentSubmissionError('submission_not_found', `Submission not found: ${id}`, {
        id,
      });
    }
    return legalDocumentSubmissionSuccess(cloneLegalDocumentSubmission(submission));
  }

  listSubmissions(): readonly LegalDocumentSubmission[] {
    return Object.freeze(
      [...this.submissions.values()]
        .filter((row) => isActiveLegalDocumentSubmissionStatus(row.status))
        .map((row) => cloneLegalDocumentSubmission(row)),
    );
  }

  listSubmissionsIncludingDeleted(): readonly LegalDocumentSubmission[] {
    return Object.freeze([...this.submissions.values()].map((row) => cloneLegalDocumentSubmission(row)));
  }

  listSubmissionsByInstance(documentInstanceId: string): readonly LegalDocumentSubmission[] {
    const normalized = documentInstanceId.trim();
    return Object.freeze(
      [...this.submissions.values()]
        .filter(
          (row) =>
            row.documentInstanceId === normalized && isActiveLegalDocumentSubmissionStatus(row.status),
        )
        .map((row) => cloneLegalDocumentSubmission(row)),
    );
  }

  listSubmissionsByWorkflow(workflowId: string): readonly LegalDocumentSubmission[] {
    const normalized = workflowId.trim();
    return Object.freeze(
      [...this.submissions.values()]
        .filter(
          (row) => row.workflowId === normalized && isActiveLegalDocumentSubmissionStatus(row.status),
        )
        .map((row) => cloneLegalDocumentSubmission(row)),
    );
  }

  purgeUnlinkedSubmission(id: LegalDocumentSubmissionId): LegalDocumentSubmissionResult<true> {
    const current = this.submissions.get(id);
    if (!current) {
      return legalDocumentSubmissionError('submission_not_found', `Submission not found: ${id}`, { id });
    }
    if (current.status !== 'uploaded') {
      return legalDocumentSubmissionError(
        'submission_coordination_failed',
        `Cannot purge submission ${id} unless it remains uploaded and unlinked.`,
        Object.freeze({ status: current.status }),
      );
    }
    this.submissions.delete(id);
    return legalDocumentSubmissionSuccess(true);
  }

  deleteSubmission(id: LegalDocumentSubmissionId): LegalDocumentSubmissionResult<LegalDocumentSubmission> {
    const current = this.submissions.get(id);
    if (!current) {
      return legalDocumentSubmissionError('submission_not_found', `Submission not found: ${id}`, { id });
    }
    const deleted = transitionSubmissionStatus(current, 'deleted', this.clock.now());
    if (!deleted.ok) {
      return deleted;
    }
    return legalDocumentSubmissionSuccess(this.persist(deleted.value));
  }

  transitionSubmission(
    id: LegalDocumentSubmissionId,
    nextStatus: LegalDocumentSubmissionStatus,
  ): LegalDocumentSubmissionResult<LegalDocumentSubmission> {
    const current = this.submissions.get(id);
    if (!current) {
      return legalDocumentSubmissionError('submission_not_found', `Submission not found: ${id}`, { id });
    }
    const transitioned = transitionSubmissionStatus(current, nextStatus, this.clock.now());
    if (!transitioned.ok) {
      return transitioned;
    }
    return legalDocumentSubmissionSuccess(this.persist(transitioned.value));
  }

  replaceSubmission(
    id: LegalDocumentSubmissionId,
    input: ReplaceLegalDocumentSubmissionInput,
  ): LegalDocumentSubmissionResult<LegalDocumentSubmission> {
    const current = this.submissions.get(id);
    if (!current) {
      return legalDocumentSubmissionError('submission_not_found', `Submission not found: ${id}`, { id });
    }

    if (isTerminalLegalDocumentSubmissionStatus(current.status)) {
      return legalDocumentSubmissionError(
        'submission_replace_not_allowed',
        `Submission ${id} is terminal (${current.status}) and cannot be replaced.`,
        Object.freeze({ status: current.status }),
      );
    }

    if (
      input.workflowId !== undefined &&
      input.workflowId.trim() !== (current.workflowId ?? '').trim()
    ) {
      return legalDocumentSubmissionError(
        'submission_replace_not_allowed',
        'replaceSubmission cannot change workflowId.',
        Object.freeze({ workflowId: input.workflowId }),
      );
    }

    const replacement = this.storeSubmission({
      ...input,
      documentInstanceId: current.documentInstanceId,
      workflowId: current.workflowId,
      templateId: input.templateId ?? current.templateId,
      templateVersionId: input.templateVersionId ?? current.templateVersionId,
      metadata: Object.freeze({
        ...(input.metadata ?? {}),
        replacesSubmissionId: id,
      }),
      initialStatus: 'uploaded',
    });
    if (!replacement.ok) {
      return replacement;
    }

    const superseded = freezeLegalDocumentSubmission({
      ...current,
      metadata: Object.freeze({
        ...current.metadata,
        replacedBySubmissionId: replacement.value.id,
      }),
    });
    this.submissions.set(id, superseded);

    const deleted = transitionSubmissionStatus(superseded, 'deleted', this.clock.now());
    if (!deleted.ok) {
      return deleted;
    }
    this.persist(deleted.value);

    return legalDocumentSubmissionSuccess(replacement.value);
  }

  exists(id: LegalDocumentSubmissionId): boolean {
    return this.submissions.has(id);
  }
}

export function createInMemoryLegalDocumentStorage(
  options: InMemoryLegalDocumentStorageOptions = {},
): InMemoryLegalDocumentStorage {
  return new InMemoryLegalDocumentStorage(options);
}

export function createIsolatedInMemoryLegalDocumentStorage(
  options: InMemoryLegalDocumentStorageOptions = {},
): InMemoryLegalDocumentStorage {
  return new InMemoryLegalDocumentStorage(options);
}
