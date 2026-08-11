/**
 * Artist Gig Decision Form UI — Writers Phase · Slice 2 · Paso 3.
 * Lab adapter only — no fetch / no Supabase.
 */

import type { ArtistMutationsAdapter } from '../../shared/services/artist-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type { ArtistMutationResult } from '../../shared/types/artist.mutations.types';
import type { GigAssignmentDecision } from '../../shared/types/artist.mutations.types';

export type ArtistGigDecisionFormOptions = {
  readonly adapter: ArtistMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly artistUserId: string;
  readonly defaultBookingId?: string;
  readonly gigAssignedDjId?: string | null;
  readonly onResult?: (result: ArtistMutationResult) => void;
};

function createIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.slice(0, 64);
}

function field(name: string, label: string, input: HTMLElement): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'mdj-artist-mutations-form__field';
  wrap.dataset.mdjField = name;
  const title = document.createElement('span');
  title.className = 'mdj-artist-mutations-form__label';
  title.textContent = label;
  wrap.append(title, input);
  return wrap;
}

function setFeedback(el: HTMLElement, kind: 'success' | 'error' | 'idle', message: string): void {
  el.dataset.mdjFeedback = kind;
  el.textContent = message;
}

function setButtonsDisabled(buttons: HTMLButtonElement[], disabled: boolean): void {
  for (const btn of buttons) {
    btn.disabled = disabled;
    if (disabled) {
      btn.dataset.mdjSubmitting = '1';
    } else {
      delete btn.dataset.mdjSubmitting;
    }
  }
}

/**
 * Renders ArtistGigDecisionFormUI into container.
 */
export function renderArtistGigDecisionForm(
  container: HTMLElement,
  options: ArtistGigDecisionFormOptions,
): HTMLFormElement {
  const root = document.createElement('form');
  root.className = 'mdj-artist-mutations-form mdj-artist-mutations-form--gig';
  root.dataset.mdjComponent = 'ArtistGigDecisionFormUI';
  root.dataset.mdjMod = 'MOD-204-MUT';
  root.noValidate = true;

  const heading = document.createElement('h3');
  heading.className = 'mdj-artist-mutations-form__title';
  heading.textContent = 'Gig Assignment Decision';

  const note = document.createElement('p');
  note.className = 'mdj-artist-mutations-form__note';
  note.textContent =
    'Lab writer — Accept or Decline an assigned gig. Decline requires notes. No production persistence.';

  const bookingId = document.createElement('input');
  bookingId.className = 'mdj-artist-mutations-form__input';
  bookingId.name = 'bookingId';
  bookingId.type = 'text';
  bookingId.required = true;
  bookingId.placeholder = 'Booking / gig id';
  bookingId.value = options.defaultBookingId ?? '';
  bookingId.autocomplete = 'off';

  const responseNotes = document.createElement('textarea');
  responseNotes.className = 'mdj-artist-mutations-form__textarea';
  responseNotes.name = 'responseNotes';
  responseNotes.rows = 2;
  responseNotes.placeholder = 'Optional notes on Accept';

  const rejectionNotes = document.createElement('textarea');
  rejectionNotes.className = 'mdj-artist-mutations-form__textarea';
  rejectionNotes.name = 'rejectionNotes';
  rejectionNotes.rows = 3;
  rejectionNotes.placeholder = 'Required when Declining';
  rejectionNotes.dataset.mdjDeclineNotes = '1';

  const actions = document.createElement('div');
  actions.className = 'mdj-artist-mutations-form__actions';

  const acceptBtn = document.createElement('button');
  acceptBtn.type = 'button';
  acceptBtn.className =
    'mdj-artist-mutations-form__submit mdj-artist-mutations-form__submit--accept';
  acceptBtn.dataset.mdjSubmit = 'accept';
  acceptBtn.textContent = 'Accept gig';

  const declineBtn = document.createElement('button');
  declineBtn.type = 'button';
  declineBtn.className =
    'mdj-artist-mutations-form__submit mdj-artist-mutations-form__submit--decline';
  declineBtn.dataset.mdjSubmit = 'decline';
  declineBtn.textContent = 'Decline gig';

  actions.append(acceptBtn, declineBtn);

  const feedback = document.createElement('p');
  feedback.className = 'mdj-artist-mutations-form__feedback';
  feedback.dataset.mdjFeedback = 'idle';
  feedback.setAttribute('aria-live', 'polite');

  root.append(
    heading,
    note,
    field('bookingId', 'Booking ID *', bookingId),
    field('responseNotes', 'Accept notes', responseNotes),
    field('rejectionNotes', 'Decline notes *', rejectionNotes),
    actions,
    feedback,
  );

  let submitting = false;
  const buttons = [acceptBtn, declineBtn];

  const submitDecision = (decision: GigAssignmentDecision): void => {
    if (submitting || acceptBtn.disabled || declineBtn.disabled) return;

    submitting = true;
    setButtonsDisabled(buttons, true);
    setFeedback(feedback, 'idle', 'Submitting…');

    const idempotencyKey = createIdempotencyKey(
      decision === 'ACCEPT' ? 'idem_gig_accept' : 'idem_gig_decline',
    );
    const payload = {
      artistUserId: options.artistUserId,
      assignedDjId: options.artistUserId,
      idempotencyKey,
      bookingId: bookingId.value,
      decision,
      rejectionNotes: decision === 'DECLINE' ? rejectionNotes.value || null : null,
      responseNotes: responseNotes.value || null,
    };

    void (async () => {
      try {
        const result = await Promise.resolve(
          options.adapter.respondGigAssignment({
            payload,
            session: { context: options.sessionContext },
            gigAssignedDjId: options.gigAssignedDjId ?? options.artistUserId,
          }),
        );
        options.onResult?.(result);

        if (result.status === 'SUCCESS') {
          const lab = options.adapter.getLabRecord(result.labRecordId);
          const labStatus =
            lab?.kind === 'respond_gig_assignment' ? lab.status : decision === 'ACCEPT'
              ? 'accepted_lab'
              : 'declined_lab';
          setFeedback(
            feedback,
            'success',
            result.replayed
              ? `Replayed · ${labStatus} · ${result.labRecordId}`
              : `${labStatus} · ${result.labRecordId}`,
          );
          root.dataset.mdjLastLabRecordId = result.labRecordId;
          root.dataset.mdjLabStatus = labStatus;
        } else if (result.status === 'VALIDATION_ERROR') {
          const msg = result.issues.map((i) => `${i.field}: ${i.message}`).join('; ');
          setFeedback(feedback, 'error', msg || 'Validation error');
        } else if (result.status === 'UNAUTHORIZED_ROLE') {
          setFeedback(feedback, 'error', `Unauthorized: ${result.reason}`);
        } else if (result.status === 'GIG_NOT_ASSIGNED') {
          setFeedback(feedback, 'error', `Gig not assigned: ${result.reason}`);
        } else if (result.status === 'IDEMPOTENCY_CONFLICT') {
          setFeedback(feedback, 'error', result.message);
        } else {
          setFeedback(feedback, 'error', 'Unknown result');
        }
      } catch (error) {
        setFeedback(
          feedback,
          'error',
          error instanceof Error ? error.message : 'Submit failed',
        );
      } finally {
        submitting = false;
        setButtonsDisabled(buttons, false);
      }
    })();
  };

  acceptBtn.addEventListener('click', () => {
    submitDecision('ACCEPT');
  });
  declineBtn.addEventListener('click', () => {
    submitDecision('DECLINE');
  });
  root.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  container.replaceChildren(root);
  return root;
}

export { createIdempotencyKey };
