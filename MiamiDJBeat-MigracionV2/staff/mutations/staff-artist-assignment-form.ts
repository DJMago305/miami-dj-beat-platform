/**
 * Staff Artist Assignment Form UI — Writers Phase · Slice 3 · Paso 3.
 * Lab adapter only — no fetch / no Supabase.
 */

import type { StaffMutationsAdapter } from '../../shared/services/staff-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type { StaffMutationResult } from '../../shared/types/staff.mutations.types';
import { createIdempotencyKey } from './staff-payment-review-form';

export type StaffArtistAssignmentFormOptions = {
  readonly adapter: StaffMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly staffUserId: string;
  readonly defaultBookingId?: string;
  readonly defaultArtistUserId?: string;
  readonly onResult?: (result: StaffMutationResult) => void;
};

function field(name: string, label: string, input: HTMLElement): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'mdj-staff-mutations-form__field';
  wrap.dataset.mdjField = name;
  const title = document.createElement('span');
  title.className = 'mdj-staff-mutations-form__label';
  title.textContent = label;
  wrap.append(title, input);
  return wrap;
}

function setFeedback(el: HTMLElement, kind: 'success' | 'error' | 'idle', message: string): void {
  el.dataset.mdjFeedback = kind;
  el.textContent = message;
}

/**
 * Renders StaffArtistAssignmentFormUI into container.
 */
export function renderStaffArtistAssignmentForm(
  container: HTMLElement,
  options: StaffArtistAssignmentFormOptions,
): HTMLFormElement {
  const root = document.createElement('form');
  root.className = 'mdj-staff-mutations-form mdj-staff-mutations-form--assign';
  root.dataset.mdjComponent = 'StaffArtistAssignmentFormUI';
  root.dataset.mdjMod = 'MOD-301-MUT';
  root.noValidate = true;

  const heading = document.createElement('h3');
  heading.className = 'mdj-staff-mutations-form__title';
  heading.textContent = 'Assign Artist to Booking';

  const note = document.createElement('p');
  note.className = 'mdj-staff-mutations-form__note';
  note.textContent =
    'Lab writer — assign / reassign a DJ to a booking. Optional notes. No production persistence.';

  const bookingId = document.createElement('input');
  bookingId.className = 'mdj-staff-mutations-form__input';
  bookingId.name = 'bookingId';
  bookingId.type = 'text';
  bookingId.required = true;
  bookingId.placeholder = 'Booking / event id';
  bookingId.value = options.defaultBookingId ?? '';
  bookingId.autocomplete = 'off';

  const artistUserId = document.createElement('input');
  artistUserId.className = 'mdj-staff-mutations-form__input';
  artistUserId.name = 'artistUserId';
  artistUserId.type = 'text';
  artistUserId.required = true;
  artistUserId.placeholder = 'Artist user id';
  artistUserId.value = options.defaultArtistUserId ?? '';
  artistUserId.autocomplete = 'off';

  const notes = document.createElement('textarea');
  notes.className = 'mdj-staff-mutations-form__textarea';
  notes.name = 'notes';
  notes.rows = 3;
  notes.placeholder = 'Optional assignment notes';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'mdj-staff-mutations-form__submit mdj-staff-mutations-form__submit--assign';
  submit.dataset.mdjSubmit = 'assign';
  submit.textContent = 'Assign DJ';

  const feedback = document.createElement('p');
  feedback.className = 'mdj-staff-mutations-form__feedback';
  feedback.dataset.mdjFeedback = 'idle';
  feedback.setAttribute('aria-live', 'polite');

  root.append(
    heading,
    note,
    field('bookingId', 'Booking ID *', bookingId),
    field('artistUserId', 'Artist user ID *', artistUserId),
    field('notes', 'Notes', notes),
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

    const idempotencyKey = createIdempotencyKey('idem_assign');
    const payload = {
      staffUserId: options.staffUserId,
      idempotencyKey,
      bookingId: bookingId.value,
      artistUserId: artistUserId.value,
      notes: notes.value || null,
      replaceExisting: true,
    };

    void (async () => {
      try {
        const result = await Promise.resolve(
          options.adapter.assignArtistToBooking({
            payload,
            session: { context: options.sessionContext },
          }),
        );
        options.onResult?.(result);

        if (result.status === 'SUCCESS') {
          const lab = options.adapter.getLabRecord(result.labRecordId);
          const labStatus =
            lab?.kind === 'assign_artist_to_booking' ? lab.status : 'assigned_lab';
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
        } else if (result.status === 'BOOKING_NOT_FOUND') {
          setFeedback(feedback, 'error', `Booking not found: ${result.reason}`);
        } else if (result.status === 'PAYMENT_NOT_FOUND') {
          setFeedback(feedback, 'error', `Payment not found: ${result.reason}`);
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
