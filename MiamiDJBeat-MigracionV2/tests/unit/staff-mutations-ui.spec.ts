/**
 * staff-mutations-ui.spec.ts — Writers Phase · Slice 3 · Paso 3.
 * DOM forms · lab adapter only · no fetch / no Supabase.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOCK_SW_ARTIST_USER_ID,
  MOCK_SW_CONTEXT_STAFF,
  MOCK_SW_STAFF_USER_ID,
} from '../../shared/services/session-wiring/index';
import {
  createStaffMutationsAdapter,
  resetStaffLabRecordIdSequence,
  type StaffMutationsAdapter,
} from '../../shared/services/staff-mutations/index';
import type { StaffMutationResult } from '../../shared/types/staff.mutations.types';
import { renderStaffPaymentReviewForm } from '../../staff/mutations/staff-payment-review-form';
import { renderStaffArtistAssignmentForm } from '../../staff/mutations/staff-artist-assignment-form';
import { renderStaffMutationsSlice } from '../../staff/mutations/render-staff-mutations-slice';
import { mountStaffMutationsSlice } from '../../staff/mutations/mount-staff-mutations-slice';
import { resolveStaffSessionWiringPilot } from '../../staff/session/staff-session-wiring-pilot';

function waitMicrotasks(n = 2): Promise<void> {
  let chain = Promise.resolve();
  for (let i = 0; i < n; i += 1) {
    chain = chain.then(() => Promise.resolve());
  }
  return chain;
}

describe('staff mutations UI — payment review form', () => {
  beforeEach(() => {
    resetStaffLabRecordIdSequence();
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders StaffPaymentReviewFormUI with Approve / Reject controls', () => {
    const host = document.getElementById('host')!;
    const adapter = createStaffMutationsAdapter();
    renderStaffPaymentReviewForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_STAFF,
      staffUserId: MOCK_SW_STAFF_USER_ID,
    });

    const form = host.querySelector('[data-mdj-component="StaffPaymentReviewFormUI"]');
    expect(form).not.toBeNull();
    expect(form?.querySelector('[name="paymentId"]')).not.toBeNull();
    expect(form?.querySelector('[data-mdj-reject-reason="1"]')).not.toBeNull();
    expect(form?.querySelector('[data-mdj-submit="approve"]')).not.toBeNull();
    expect(form?.querySelector('[data-mdj-submit="reject"]')).not.toBeNull();
  });

  it('APPROVE shows approved_lab feedback with labRecordId', async () => {
    const host = document.getElementById('host')!;
    const adapter = createStaffMutationsAdapter();
    const onResult = vi.fn();
    const form = renderStaffPaymentReviewForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_STAFF,
      staffUserId: MOCK_SW_STAFF_USER_ID,
      onResult,
    });

    (form.querySelector('[name="paymentId"]') as HTMLInputElement).value = 'pay_ui_1';
    (form.querySelector('[data-mdj-submit="approve"]') as HTMLButtonElement).click();
    await waitMicrotasks(4);

    expect(onResult).toHaveBeenCalledTimes(1);
    const result = onResult.mock.calls[0][0] as StaffMutationResult;
    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;

    const feedback = form.querySelector('[data-mdj-feedback]');
    expect(feedback?.getAttribute('data-mdj-feedback')).toBe('success');
    expect(feedback?.textContent).toContain('approved_lab');
    expect(feedback?.textContent).toContain(result.labRecordId);
    expect(form.dataset.mdjLabStatus).toBe('approved_lab');
  });

  it('REJECT without reason shows validation error', async () => {
    const host = document.getElementById('host')!;
    const adapter = createStaffMutationsAdapter();
    const form = renderStaffPaymentReviewForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_STAFF,
      staffUserId: MOCK_SW_STAFF_USER_ID,
    });

    (form.querySelector('[name="paymentId"]') as HTMLInputElement).value = 'pay_ui_reject_bad';
    (form.querySelector('[data-mdj-submit="reject"]') as HTMLButtonElement).click();
    await waitMicrotasks(4);

    const feedback = form.querySelector('[data-mdj-feedback]');
    expect(feedback?.getAttribute('data-mdj-feedback')).toBe('error');
    expect(feedback?.textContent).toMatch(/rejectionReason|reject/i);
  });

  it('REJECT with reason shows rejected_lab feedback', async () => {
    const host = document.getElementById('host')!;
    const adapter = createStaffMutationsAdapter();
    const form = renderStaffPaymentReviewForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_STAFF,
      staffUserId: MOCK_SW_STAFF_USER_ID,
    });

    (form.querySelector('[name="paymentId"]') as HTMLInputElement).value = 'pay_ui_reject_ok';
    (form.querySelector('[name="rejectionReason"]') as HTMLTextAreaElement).value =
      'Invalid transfer memo';
    (form.querySelector('[data-mdj-submit="reject"]') as HTMLButtonElement).click();
    await waitMicrotasks(4);

    const feedback = form.querySelector('[data-mdj-feedback]');
    expect(feedback?.getAttribute('data-mdj-feedback')).toBe('success');
    expect(feedback?.textContent).toContain('rejected_lab');
    expect(form.dataset.mdjLabStatus).toBe('rejected_lab');
  });

  it('disables both buttons during in-flight request and blocks duplicate submit', async () => {
    const host = document.getElementById('host')!;
    let release!: (value: StaffMutationResult) => void;
    const pending = new Promise<StaffMutationResult>((resolve) => {
      release = resolve;
    });

    const real = createStaffMutationsAdapter();
    const adapter = {
      ...real,
      reviewOfflinePayment: vi.fn(() => pending),
      getLabRecord: real.getLabRecord.bind(real),
    } as unknown as StaffMutationsAdapter;

    const form = renderStaffPaymentReviewForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_STAFF,
      staffUserId: MOCK_SW_STAFF_USER_ID,
    });

    (form.querySelector('[name="paymentId"]') as HTMLInputElement).value = 'pay_ui_dup';
    const approveBtn = form.querySelector<HTMLButtonElement>('[data-mdj-submit="approve"]')!;
    const rejectBtn = form.querySelector<HTMLButtonElement>('[data-mdj-submit="reject"]')!;

    approveBtn.click();
    await waitMicrotasks(1);

    expect(approveBtn.disabled).toBe(true);
    expect(rejectBtn.disabled).toBe(true);
    expect(approveBtn.dataset.mdjSubmitting).toBe('1');

    approveBtn.click();
    rejectBtn.click();
    await waitMicrotasks(1);
    expect(adapter.reviewOfflinePayment).toHaveBeenCalledTimes(1);

    release({
      status: 'SUCCESS',
      mutationKind: 'review_offline_payment',
      labRecordId: 'lab_payment_review_ui_1',
      acceptedAt: '2026-08-11T17:40:00.000Z',
      replayed: false,
      idempotencyKey: 'idem_pay_x',
    });
    await waitMicrotasks(4);

    expect(approveBtn.disabled).toBe(false);
    expect(rejectBtn.disabled).toBe(false);
  });
});

describe('staff mutations UI — artist assignment form', () => {
  beforeEach(() => {
    resetStaffLabRecordIdSequence();
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('assigns artist and shows assigned_lab', async () => {
    const host = document.getElementById('host')!;
    const adapter = createStaffMutationsAdapter();
    const onResult = vi.fn();
    const form = renderStaffArtistAssignmentForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_STAFF,
      staffUserId: MOCK_SW_STAFF_USER_ID,
      onResult,
    });

    (form.querySelector('[name="bookingId"]') as HTMLInputElement).value = 'bk_ui_1';
    (form.querySelector('[name="artistUserId"]') as HTMLInputElement).value =
      MOCK_SW_ARTIST_USER_ID;
    (form.querySelector('[name="notes"]') as HTMLTextAreaElement).value = 'Primary';
    form.requestSubmit();
    await waitMicrotasks(4);

    expect(onResult).toHaveBeenCalledTimes(1);
    const result = onResult.mock.calls[0][0] as StaffMutationResult;
    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    expect(form.querySelector('[data-mdj-feedback]')?.textContent).toContain('assigned_lab');
    expect(form.dataset.mdjLabStatus).toBe('assigned_lab');
  });
});

describe('staff mutations UI — slice mount', () => {
  beforeEach(() => {
    resetStaffLabRecordIdSequence();
    document.body.innerHTML = `
      <main data-mdj-shell-region="main">
        <div class="mdj-client-dashboard__grid">
          <section data-mdj-staff-section="staff-mutations"></section>
        </div>
      </main>
    `;
  });

  it('renderStaffMutationsSlice mounts both forms', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const adapter = createStaffMutationsAdapter();
    renderStaffMutationsSlice(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_STAFF,
      staffUserId: MOCK_SW_STAFF_USER_ID,
    });

    expect(host.querySelector('[data-mdj-component="StaffMutationsSlice"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-component="StaffPaymentReviewFormUI"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-component="StaffArtistAssignmentFormUI"]')).not.toBeNull();
  });

  it('mountStaffMutationsSlice fills dashboard slot for staff session', () => {
    const mainRegion = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]')!;
    const sessionWiring = resolveStaffSessionWiringPilot('staff');
    const adapter = createStaffMutationsAdapter();

    mountStaffMutationsSlice({
      mainRegion,
      adapter,
      sessionContext: sessionWiring.context,
      staffUserId: sessionWiring.context.userId!,
      sessionWiring,
    });

    const slot = mainRegion.querySelector('[data-mdj-staff-section="staff-mutations"]');
    expect(slot?.querySelector('[data-mdj-component="StaffMutationsSlice"]')).not.toBeNull();
  });

  it('mountStaffMutationsSlice gates anonymous session', () => {
    const mainRegion = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]')!;
    const sessionWiring = resolveStaffSessionWiringPilot('anonymous');
    const adapter = createStaffMutationsAdapter();

    mountStaffMutationsSlice({
      mainRegion,
      adapter,
      sessionContext: sessionWiring.context,
      staffUserId: sessionWiring.context.userId ?? '',
      sessionWiring,
    });

    const gated = mainRegion.querySelector('.mdj-staff-mutations-slice--gated');
    expect(gated).not.toBeNull();
    expect(gated?.getAttribute('data-mdj-session-ready')).toBe('0');
  });
});
