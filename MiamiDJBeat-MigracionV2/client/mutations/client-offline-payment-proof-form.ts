/**
 * Client Offline Payment Proof Form UI — Writers Phase · Slice 1 · Paso 3.
 * Lab adapter only — file input keeps local filename only (no upload).
 */

import type { ClientMutationsAdapter } from '../../shared/services/client-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type { ClientMutationResult } from '../../shared/types/client.mutations.types';
import { createIdempotencyKey } from './client-booking-request-form';

export type ClientOfflinePaymentProofFormOptions = {
  readonly adapter: ClientMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly clientUserId: string;
  readonly defaultBookingId?: string;
  readonly onResult?: (result: ClientMutationResult) => void;
};

const OFFLINE_METHODS = Object.freeze([
  'Zelle',
  'Cash',
  'BankTransfer',
  'Check',
  'Other',
] as const);

function field(name: string, label: string, input: HTMLElement): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'mdj-client-mutations-form__field';
  wrap.dataset.mdjField = name;
  const title = document.createElement('span');
  title.className = 'mdj-client-mutations-form__label';
  title.textContent = label;
  wrap.append(title, input);
  return wrap;
}

function setFeedback(el: HTMLElement, kind: 'success' | 'error' | 'idle', message: string): void {
  el.dataset.mdjFeedback = kind;
  el.textContent = message;
}

/**
 * Renders ClientOfflinePaymentProofFormUI into container.
 */
export function renderClientOfflinePaymentProofForm(
  container: HTMLElement,
  options: ClientOfflinePaymentProofFormOptions,
): HTMLFormElement {
  const root = document.createElement('form');
  root.className = 'mdj-client-mutations-form mdj-client-mutations-form--payment';
  root.dataset.mdjComponent = 'ClientOfflinePaymentProofFormUI';
  root.dataset.mdjMod = 'MOD-103-MUT';
  root.noValidate = true;

  const heading = document.createElement('h3');
  heading.className = 'mdj-client-mutations-form__title';
  heading.textContent = 'Register Offline Payment Proof';

  const note = document.createElement('p');
  note.className = 'mdj-client-mutations-form__note';
  note.textContent =
    'Lab writer — Zelle / Cash / Bank Transfer only. Attachment stays local (filename only).';

  const bookingId = document.createElement('input');
  bookingId.className = 'mdj-client-mutations-form__input';
  bookingId.name = 'bookingId';
  bookingId.type = 'text';
  bookingId.required = true;
  bookingId.placeholder = 'Booking / lead id';
  bookingId.value = options.defaultBookingId ?? '';
  bookingId.autocomplete = 'off';

  const amount = document.createElement('input');
  amount.className = 'mdj-client-mutations-form__input';
  amount.name = 'amountUsd';
  amount.type = 'number';
  amount.min = '0.01';
  amount.step = '0.01';
  amount.required = true;
  amount.placeholder = 'Amount (USD)';

  const method = document.createElement('select');
  method.className = 'mdj-client-mutations-form__select';
  method.name = 'paymentMethod';
  method.required = true;
  for (const value of OFFLINE_METHODS) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value === 'BankTransfer' ? 'Bank Transfer' : value;
    method.append(opt);
  }

  const proofReference = document.createElement('input');
  proofReference.className = 'mdj-client-mutations-form__input';
  proofReference.name = 'proofReference';
  proofReference.type = 'text';
  proofReference.placeholder = 'Reference / confirmation code';
  proofReference.autocomplete = 'off';

  const paidAt = document.createElement('input');
  paidAt.className = 'mdj-client-mutations-form__input';
  paidAt.name = 'paidAt';
  paidAt.type = 'date';

  const proofNotes = document.createElement('textarea');
  proofNotes.className = 'mdj-client-mutations-form__textarea';
  proofNotes.name = 'proofNotes';
  proofNotes.rows = 2;
  proofNotes.placeholder = 'Notes (optional)';

  const attachment = document.createElement('input');
  attachment.className = 'mdj-client-mutations-form__input';
  attachment.name = 'proofAttachment';
  attachment.type = 'file';
  attachment.accept = 'image/*,.pdf';
  attachment.dataset.mdjProofAttachment = '1';

  const attachmentHint = document.createElement('p');
  attachmentHint.className = 'mdj-client-mutations-form__hint';
  attachmentHint.textContent = 'Optional proof file — filename recorded locally; never uploaded.';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'mdj-client-mutations-form__submit';
  submit.dataset.mdjSubmit = 'payment';
  submit.textContent = 'Submit payment proof';

  const feedback = document.createElement('p');
  feedback.className = 'mdj-client-mutations-form__feedback';
  feedback.dataset.mdjFeedback = 'idle';
  feedback.setAttribute('aria-live', 'polite');

  root.append(
    heading,
    note,
    field('bookingId', 'Booking ID *', bookingId),
    field('amountUsd', 'Amount (USD) *', amount),
    field('paymentMethod', 'Payment method *', method),
    field('proofReference', 'Proof reference', proofReference),
    field('paidAt', 'Paid at', paidAt),
    field('proofNotes', 'Notes', proofNotes),
    field('proofAttachment', 'Proof attachment', attachment),
    attachmentHint,
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

    const usd = Number(amount.value);
    const amountMinorUnits = Number.isFinite(usd) ? Math.round(usd * 100) : NaN;
    const fileName = attachment.files?.[0]?.name ?? null;
    const notesParts = [proofNotes.value.trim(), fileName ? `attachment:${fileName}` : '']
      .filter(Boolean)
      .join(' · ');

    const idempotencyKey = createIdempotencyKey('idem_pay');
    const payload = {
      clientUserId: options.clientUserId,
      idempotencyKey,
      bookingId: bookingId.value,
      amountMinorUnits,
      currencyCode: 'USD',
      paymentMethod: method.value,
      proofReference: proofReference.value || null,
      proofNotes: notesParts || null,
      paidAt: paidAt.value || null,
    };

    void (async () => {
      try {
        const result = await Promise.resolve(
          options.adapter.submitOfflinePaymentProof({
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
