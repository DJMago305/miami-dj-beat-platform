/**
 * Client Booking Request Form UI — Writers Phase · Slice 1 · Paso 3.
 * Lab adapter only — no fetch / no Supabase.
 */

import type { ClientMutationsAdapter } from '../../shared/services/client-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type { ClientMutationResult } from '../../shared/types/client.mutations.types';

export type ClientBookingRequestFormOptions = {
  readonly adapter: ClientMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly clientUserId: string;
  readonly onResult?: (result: ClientMutationResult) => void;
};

function createIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.slice(0, 64);
}

function field(
  name: string,
  label: string,
  input: HTMLElement,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'mdj-client-mutations-form__field';
  wrap.dataset.mdjField = name;
  const title = document.createElement('span');
  title.className = 'mdj-client-mutations-form__label';
  title.textContent = label;
  wrap.append(title, input);
  return wrap;
}

function textInput(
  name: string,
  opts?: { readonly type?: string; readonly required?: boolean; readonly placeholder?: string },
): HTMLInputElement {
  const input = document.createElement('input');
  input.className = 'mdj-client-mutations-form__input';
  input.name = name;
  input.type = opts?.type ?? 'text';
  input.required = opts?.required ?? false;
  if (opts?.placeholder) input.placeholder = opts.placeholder;
  input.autocomplete = 'off';
  return input;
}

function setFeedback(el: HTMLElement, kind: 'success' | 'error' | 'idle', message: string): void {
  el.dataset.mdjFeedback = kind;
  el.textContent = message;
}

/**
 * Renders ClientBookingRequestFormUI into container.
 */
export function renderClientBookingRequestForm(
  container: HTMLElement,
  options: ClientBookingRequestFormOptions,
): HTMLFormElement {
  const root = document.createElement('form');
  root.className = 'mdj-client-mutations-form mdj-client-mutations-form--booking';
  root.dataset.mdjComponent = 'ClientBookingRequestFormUI';
  root.dataset.mdjMod = 'MOD-103-MUT';
  root.noValidate = true;

  const heading = document.createElement('h3');
  heading.className = 'mdj-client-mutations-form__title';
  heading.textContent = 'Request a Booking';

  const note = document.createElement('p');
  note.className = 'mdj-client-mutations-form__note';
  note.textContent = 'Lab writer — submits to in-memory adapter only (no production persistence).';

  const title = textInput('title', { required: true, placeholder: 'Event title' });
  const eventDate = textInput('eventDate', { type: 'date', required: true });
  const startTime = textInput('startTime', { type: 'time' });
  const endTime = textInput('endTime', { type: 'time' });
  const locationLabel = textInput('locationLabel', { placeholder: 'Venue / location' });
  const contactName = textInput('contactName', { placeholder: 'Contact name' });
  const contactEmail = textInput('contactEmail', { type: 'email', placeholder: 'email@example.com' });
  const contactPhone = textInput('contactPhone', { type: 'tel', placeholder: '+1…' });

  const notes = document.createElement('textarea');
  notes.className = 'mdj-client-mutations-form__textarea';
  notes.name = 'notes';
  notes.rows = 3;
  notes.placeholder = 'Notes (optional)';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'mdj-client-mutations-form__submit';
  submit.dataset.mdjSubmit = 'booking';
  submit.textContent = 'Submit booking request';

  const feedback = document.createElement('p');
  feedback.className = 'mdj-client-mutations-form__feedback';
  feedback.dataset.mdjFeedback = 'idle';
  feedback.setAttribute('aria-live', 'polite');

  root.append(
    heading,
    note,
    field('title', 'Title *', title),
    field('eventDate', 'Event date *', eventDate),
    field('startTime', 'Start time', startTime),
    field('endTime', 'End time', endTime),
    field('locationLabel', 'Location', locationLabel),
    field('contactName', 'Contact name', contactName),
    field('contactEmail', 'Contact email', contactEmail),
    field('contactPhone', 'Contact phone', contactPhone),
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

    const normalizeTime = (value: string): string | null => {
      const trimmed = value.trim();
      if (!trimmed) return null;
      // HTML time may be HH:MM:SS — validators expect HH:MM.
      const match = /^(\d{2}:\d{2})(?::\d{2})?$/.exec(trimmed);
      return match?.[1] ?? trimmed;
    };

    const idempotencyKey = createIdempotencyKey('idem_booking');
    const payload = {
      clientUserId: options.clientUserId,
      idempotencyKey,
      title: title.value,
      eventDate: eventDate.value,
      startTime: normalizeTime(startTime.value),
      endTime: normalizeTime(endTime.value),
      locationLabel: locationLabel.value || null,
      notes: notes.value || null,
      preferredArtistProfileId: null,
      contactName: contactName.value || null,
      contactEmail: contactEmail.value || null,
      contactPhone: contactPhone.value || null,
    };

    void (async () => {
      try {
        const result = await Promise.resolve(
          options.adapter.submitBookingRequest({
            payload,
            session: { context: options.sessionContext },
          }),
        );
        options.onResult?.(result);

        if (result.status === 'SUCCESS') {
          setFeedback(
            feedback,
            'success',
            result.replayed
              ? `Replayed · labRecordId ${result.labRecordId}`
              : `Accepted · labRecordId ${result.labRecordId}`,
          );
          root.dataset.mdjLastLabRecordId = result.labRecordId;
        } else if (result.status === 'VALIDATION_ERROR') {
          const msg = result.issues.map((i) => `${i.field}: ${i.message}`).join('; ');
          setFeedback(feedback, 'error', msg || 'Validation error');
        } else if (result.status === 'UNAUTHORIZED_ROLE') {
          setFeedback(feedback, 'error', `Unauthorized: ${result.reason}`);
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

export { createIdempotencyKey };
