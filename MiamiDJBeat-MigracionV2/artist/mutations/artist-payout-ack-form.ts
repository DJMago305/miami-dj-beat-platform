/**
 * Artist Payout Acknowledgement Form UI — Writers Phase · Slice 2 · Paso 3.
 * Lab adapter only — no fetch / no Supabase.
 */

import type { ArtistMutationsAdapter } from '../../shared/services/artist-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type { ArtistMutationResult } from '../../shared/types/artist.mutations.types';
import { createIdempotencyKey } from './artist-gig-decision-form';

export type ArtistPayoutAckFormOptions = {
  readonly adapter: ArtistMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly artistUserId: string;
  readonly defaultPayoutId?: string;
  readonly onResult?: (result: ArtistMutationResult) => void;
};

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

/**
 * Renders ArtistPayoutAckFormUI into container.
 */
export function renderArtistPayoutAckForm(
  container: HTMLElement,
  options: ArtistPayoutAckFormOptions,
): HTMLFormElement {
  const root = document.createElement('form');
  root.className = 'mdj-artist-mutations-form mdj-artist-mutations-form--payout';
  root.dataset.mdjComponent = 'ArtistPayoutAckFormUI';
  root.dataset.mdjMod = 'MOD-204-MUT';
  root.noValidate = true;

  const heading = document.createElement('h3');
  heading.className = 'mdj-artist-mutations-form__title';
  heading.textContent = 'Acknowledge Payout';

  const note = document.createElement('p');
  note.className = 'mdj-artist-mutations-form__note';
  note.textContent =
    'Lab writer — confirm receipt of honorarios. Optional feedback. No production persistence.';

  const payoutId = document.createElement('input');
  payoutId.className = 'mdj-artist-mutations-form__input';
  payoutId.name = 'payoutId';
  payoutId.type = 'text';
  payoutId.required = true;
  payoutId.placeholder = 'Payout / receipt id';
  payoutId.value = options.defaultPayoutId ?? '';
  payoutId.autocomplete = 'off';

  const feedbackField = document.createElement('textarea');
  feedbackField.className = 'mdj-artist-mutations-form__textarea';
  feedbackField.name = 'feedback';
  feedbackField.rows = 3;
  feedbackField.placeholder = 'Optional feedback';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'mdj-artist-mutations-form__submit mdj-artist-mutations-form__submit--ack';
  submit.dataset.mdjSubmit = 'payout';
  submit.textContent = 'Confirm payout received';

  const feedback = document.createElement('p');
  feedback.className = 'mdj-artist-mutations-form__feedback';
  feedback.dataset.mdjFeedback = 'idle';
  feedback.setAttribute('aria-live', 'polite');

  root.append(
    heading,
    note,
    field('payoutId', 'Payout ID *', payoutId),
    field('feedback', 'Feedback', feedbackField),
    submit,
    feedback,
  );

  let submitting = false;

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    if (submitting || submit.disabled) return;

    submitting = true;
    submit.disabled = true;
    submit.dataset.mdjSubmitting = '1';
    setFeedback(feedback, 'idle', 'Submitting…');

    const idempotencyKey = createIdempotencyKey('idem_payout_ack');
    const payload = {
      artistUserId: options.artistUserId,
      assignedDjId: options.artistUserId,
      idempotencyKey,
      payoutId: payoutId.value,
      acknowledged: true,
      feedback: feedbackField.value || null,
    };

    void (async () => {
      try {
        const result = await Promise.resolve(
          options.adapter.acknowledgePayout({
            payload,
            session: { context: options.sessionContext },
          }),
        );
        options.onResult?.(result);

        if (result.status === 'SUCCESS') {
          const lab = options.adapter.getLabRecord(result.labRecordId);
          const labStatus =
            lab?.kind === 'acknowledge_payout' ? lab.status : 'acknowledged_lab';
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
        submit.disabled = false;
        delete submit.dataset.mdjSubmitting;
      }
    })();
  });

  container.replaceChildren(root);
  return root;
}
