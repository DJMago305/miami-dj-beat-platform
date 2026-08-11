/**
 * Staff Payment Review Form UI — Writers Phase · Slice 3 · Paso 3.
 * Lab adapter only — no fetch / no Supabase.
 */

import type { StaffMutationsAdapter } from '../../shared/services/staff-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import type {
  OfflinePaymentReviewDecision,
  StaffMutationResult,
} from '../../shared/types/staff.mutations.types';

export type StaffPaymentReviewFormOptions = {
  readonly adapter: StaffMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly staffUserId: string;
  readonly defaultPaymentId?: string;
  readonly onResult?: (result: StaffMutationResult) => void;
};

function createIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.slice(0, 64);
}

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
 * Renders StaffPaymentReviewFormUI into container.
 */
export function renderStaffPaymentReviewForm(
  container: HTMLElement,
  options: StaffPaymentReviewFormOptions,
): HTMLFormElement {
  const root = document.createElement('form');
  root.className = 'mdj-staff-mutations-form mdj-staff-mutations-form--payment';
  root.dataset.mdjComponent = 'StaffPaymentReviewFormUI';
  root.dataset.mdjMod = 'MOD-301-MUT';
  root.noValidate = true;

  const heading = document.createElement('h3');
  heading.className = 'mdj-staff-mutations-form__title';
  heading.textContent = 'Review Offline Payment';

  const note = document.createElement('p');
  note.className = 'mdj-staff-mutations-form__note';
  note.textContent =
    'Lab writer — Approve or Reject an offline proof. Reject requires a reason. No production persistence.';

  const paymentId = document.createElement('input');
  paymentId.className = 'mdj-staff-mutations-form__input';
  paymentId.name = 'paymentId';
  paymentId.type = 'text';
  paymentId.required = true;
  paymentId.placeholder = 'Payment / proof id';
  paymentId.value = options.defaultPaymentId ?? '';
  paymentId.autocomplete = 'off';

  const reviewNotes = document.createElement('textarea');
  reviewNotes.className = 'mdj-staff-mutations-form__textarea';
  reviewNotes.name = 'reviewNotes';
  reviewNotes.rows = 2;
  reviewNotes.placeholder = 'Optional review notes';

  const rejectionReason = document.createElement('textarea');
  rejectionReason.className = 'mdj-staff-mutations-form__textarea';
  rejectionReason.name = 'rejectionReason';
  rejectionReason.rows = 3;
  rejectionReason.placeholder = 'Required when Rejecting';
  rejectionReason.dataset.mdjRejectReason = '1';

  const actions = document.createElement('div');
  actions.className = 'mdj-staff-mutations-form__actions';

  const approveBtn = document.createElement('button');
  approveBtn.type = 'button';
  approveBtn.className =
    'mdj-staff-mutations-form__submit mdj-staff-mutations-form__submit--approve';
  approveBtn.dataset.mdjSubmit = 'approve';
  approveBtn.textContent = 'Approve payment';

  const rejectBtn = document.createElement('button');
  rejectBtn.type = 'button';
  rejectBtn.className =
    'mdj-staff-mutations-form__submit mdj-staff-mutations-form__submit--reject';
  rejectBtn.dataset.mdjSubmit = 'reject';
  rejectBtn.textContent = 'Reject payment';

  actions.append(approveBtn, rejectBtn);

  const feedback = document.createElement('p');
  feedback.className = 'mdj-staff-mutations-form__feedback';
  feedback.dataset.mdjFeedback = 'idle';
  feedback.setAttribute('aria-live', 'polite');

  root.append(
    heading,
    note,
    field('paymentId', 'Payment ID *', paymentId),
    field('reviewNotes', 'Review notes', reviewNotes),
    field('rejectionReason', 'Rejection reason *', rejectionReason),
    actions,
    feedback,
  );

  let submitting = false;
  const buttons = [approveBtn, rejectBtn];

  const submitDecision = (decision: OfflinePaymentReviewDecision): void => {
    if (submitting || approveBtn.disabled || rejectBtn.disabled) return;

    submitting = true;
    setButtonsDisabled(buttons, true);
    setFeedback(feedback, 'idle', 'Submitting…');

    const idempotencyKey = createIdempotencyKey(
      decision === 'APPROVE' ? 'idem_pay_approve' : 'idem_pay_reject',
    );
    const payload = {
      staffUserId: options.staffUserId,
      idempotencyKey,
      paymentId: paymentId.value,
      decision,
      rejectionReason: decision === 'REJECT' ? rejectionReason.value || null : null,
      reviewNotes: reviewNotes.value || null,
    };

    void (async () => {
      try {
        const result = await Promise.resolve(
          options.adapter.reviewOfflinePayment({
            payload,
            session: { context: options.sessionContext },
          }),
        );
        options.onResult?.(result);

        if (result.status === 'SUCCESS') {
          const lab = options.adapter.getLabRecord(result.labRecordId);
          const labStatus =
            lab?.kind === 'review_offline_payment'
              ? lab.status
              : decision === 'APPROVE'
                ? 'approved_lab'
                : 'rejected_lab';
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
        } else if (result.status === 'PAYMENT_NOT_FOUND') {
          setFeedback(feedback, 'error', `Payment not found: ${result.reason}`);
        } else if (result.status === 'BOOKING_NOT_FOUND') {
          setFeedback(feedback, 'error', `Booking not found: ${result.reason}`);
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

  approveBtn.addEventListener('click', () => {
    submitDecision('APPROVE');
  });
  rejectBtn.addEventListener('click', () => {
    submitDecision('REJECT');
  });
  root.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  container.replaceChildren(root);
  return root;
}

export { createIdempotencyKey };
