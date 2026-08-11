/**
 * client-mutations-ui.spec.ts — Writers Phase · Slice 1 · Paso 3.
 * DOM forms · lab adapter only · no fetch / no Supabase.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOCK_SW_CLIENT_USER_ID,
  MOCK_SW_CONTEXT_CLIENT,
} from '../../shared/services/session-wiring/index';
import {
  createClientMutationsAdapter,
  resetLabRecordIdSequence,
  type ClientMutationsAdapter,
} from '../../shared/services/client-mutations/index';
import type { ClientMutationResult } from '../../shared/types/client.mutations.types';
import { renderClientBookingRequestForm } from '../../client/mutations/client-booking-request-form';
import { renderClientOfflinePaymentProofForm } from '../../client/mutations/client-offline-payment-proof-form';
import { renderClientMutationsSlice } from '../../client/mutations/render-client-mutations-slice';
import { mountClientMutationsSlice } from '../../client/mutations/mount-client-mutations-slice';
import { resolveClientSessionWiringPilot } from '../../client/session/client-session-wiring-pilot';

function waitMicrotasks(n = 2): Promise<void> {
  let chain = Promise.resolve();
  for (let i = 0; i < n; i += 1) {
    chain = chain.then(() => Promise.resolve());
  }
  return chain;
}

describe('client mutations UI — booking form', () => {
  beforeEach(() => {
    resetLabRecordIdSequence();
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders ClientBookingRequestFormUI fields', () => {
    const host = document.getElementById('host')!;
    const adapter = createClientMutationsAdapter();
    renderClientBookingRequestForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_CLIENT,
      clientUserId: MOCK_SW_CLIENT_USER_ID,
    });

    const form = host.querySelector('[data-mdj-component="ClientBookingRequestFormUI"]');
    expect(form).not.toBeNull();
    expect(form?.querySelector('[name="title"]')).not.toBeNull();
    expect(form?.querySelector('[name="eventDate"]')).not.toBeNull();
    expect(form?.querySelector('[name="locationLabel"]')).not.toBeNull();
    expect(form?.querySelector('[name="contactEmail"]')).not.toBeNull();
    expect(form?.querySelector('[data-mdj-submit="booking"]')).not.toBeNull();
  });

  it('submits booking request and shows labRecordId on success', async () => {
    const host = document.getElementById('host')!;
    const adapter = createClientMutationsAdapter({
      nowIso: () => '2026-08-11T12:00:00.000Z',
    });
    const onResult = vi.fn();
    const form = renderClientBookingRequestForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_CLIENT,
      clientUserId: MOCK_SW_CLIENT_USER_ID,
      onResult,
    });

    (form.querySelector('[name="title"]') as HTMLInputElement).value = 'Garden party';
    (form.querySelector('[name="eventDate"]') as HTMLInputElement).value = '2026-10-01';
    (form.querySelector('[name="startTime"]') as HTMLInputElement).value = '19:00';
    (form.querySelector('[name="locationLabel"]') as HTMLInputElement).value = 'Coral Gables';
    (form.querySelector('[name="contactName"]') as HTMLInputElement).value = 'Ada';
    (form.querySelector('[name="contactEmail"]') as HTMLInputElement).value = 'ada@example.com';

    form.requestSubmit();
    await waitMicrotasks(4);

    expect(onResult).toHaveBeenCalledTimes(1);
    const result = onResult.mock.calls[0][0] as ClientMutationResult;
    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;

    const feedback = form.querySelector('[data-mdj-feedback]');
    expect(feedback?.getAttribute('data-mdj-feedback')).toBe('success');
    expect(feedback?.textContent).toContain(result.labRecordId);
    expect(form.dataset.mdjLastLabRecordId).toBe(result.labRecordId);
  });

  it('disables submit during in-flight request and blocks duplicate submit', async () => {
    const host = document.getElementById('host')!;
    let release!: (value: ClientMutationResult) => void;
    const pending = new Promise<ClientMutationResult>((resolve) => {
      release = resolve;
    });

    const real = createClientMutationsAdapter();
    const adapter = {
      ...real,
      submitBookingRequest: vi.fn(() => pending),
    } as unknown as ClientMutationsAdapter;

    const form = renderClientBookingRequestForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_CLIENT,
      clientUserId: MOCK_SW_CLIENT_USER_ID,
    });

    (form.querySelector('[name="title"]') as HTMLInputElement).value = 'Dup guard';
    (form.querySelector('[name="eventDate"]') as HTMLInputElement).value = '2026-11-02';

    const submitBtn = form.querySelector<HTMLButtonElement>('[data-mdj-submit="booking"]')!;
    form.requestSubmit();
    await waitMicrotasks(1);

    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.dataset.mdjSubmitting).toBe('1');

    form.requestSubmit();
    await waitMicrotasks(1);
    expect(adapter.submitBookingRequest).toHaveBeenCalledTimes(1);

    release({
      status: 'SUCCESS',
      mutationKind: 'create_booking_request',
      labRecordId: 'lab_booking_ui_1',
      acceptedAt: '2026-08-11T12:00:00.000Z',
      replayed: false,
      idempotencyKey: 'idem_booking_x',
    });
    await waitMicrotasks(4);

    expect(submitBtn.disabled).toBe(false);
    expect(submitBtn.dataset.mdjSubmitting).toBeUndefined();
  });

  it('shows validation error feedback for empty title', async () => {
    const host = document.getElementById('host')!;
    const adapter = createClientMutationsAdapter();
    const form = renderClientBookingRequestForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_CLIENT,
      clientUserId: MOCK_SW_CLIENT_USER_ID,
    });

    (form.querySelector('[name="eventDate"]') as HTMLInputElement).value = '2026-10-01';
    form.requestSubmit();
    await waitMicrotasks(4);

    const feedback = form.querySelector('[data-mdj-feedback]');
    expect(feedback?.getAttribute('data-mdj-feedback')).toBe('error');
    expect(feedback?.textContent).toMatch(/title/i);
  });
});

describe('client mutations UI — offline payment form', () => {
  beforeEach(() => {
    resetLabRecordIdSequence();
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders payment method options including Zelle, Cash, Bank Transfer', () => {
    const host = document.getElementById('host')!;
    const adapter = createClientMutationsAdapter();
    const form = renderClientOfflinePaymentProofForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_CLIENT,
      clientUserId: MOCK_SW_CLIENT_USER_ID,
    });

    expect(form.dataset.mdjComponent).toBe('ClientOfflinePaymentProofFormUI');
    const select = form.querySelector<HTMLSelectElement>('[name="paymentMethod"]')!;
    const values = [...select.options].map((o) => o.value);
    expect(values).toEqual(expect.arrayContaining(['Zelle', 'Cash', 'BankTransfer']));
    expect(form.querySelector('[name="amountUsd"]')).not.toBeNull();
    expect(form.querySelector('[name="proofReference"]')).not.toBeNull();
    expect(form.querySelector('[data-mdj-proof-attachment="1"]')).not.toBeNull();
  });

  it('submits offline payment proof and shows success feedback', async () => {
    const host = document.getElementById('host')!;
    const adapter = createClientMutationsAdapter();
    const onResult = vi.fn();
    const form = renderClientOfflinePaymentProofForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_CLIENT,
      clientUserId: MOCK_SW_CLIENT_USER_ID,
      onResult,
    });

    (form.querySelector('[name="bookingId"]') as HTMLInputElement).value = 'bk_lab_ui_1';
    (form.querySelector('[name="amountUsd"]') as HTMLInputElement).value = '250.00';
    (form.querySelector('[name="paymentMethod"]') as HTMLSelectElement).value = 'Zelle';
    (form.querySelector('[name="proofReference"]') as HTMLInputElement).value = 'ZELLE-99';

    form.requestSubmit();
    await waitMicrotasks(4);

    expect(onResult).toHaveBeenCalledTimes(1);
    const result = onResult.mock.calls[0][0] as ClientMutationResult;
    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    expect(form.querySelector('[data-mdj-feedback]')?.textContent).toContain(result.labRecordId);
  });
});

describe('client mutations UI — slice mount', () => {
  beforeEach(() => {
    resetLabRecordIdSequence();
    document.body.innerHTML = `
      <main data-mdj-shell-region="main">
        <div class="mdj-client-dashboard__grid">
          <section data-mdj-client-section="client-mutations"></section>
        </div>
      </main>
    `;
  });

  it('renderClientMutationsSlice mounts both forms', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const adapter = createClientMutationsAdapter();
    renderClientMutationsSlice(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_CLIENT,
      clientUserId: MOCK_SW_CLIENT_USER_ID,
    });

    expect(host.querySelector('[data-mdj-component="ClientMutationsSlice"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-component="ClientBookingRequestFormUI"]')).not.toBeNull();
    expect(
      host.querySelector('[data-mdj-component="ClientOfflinePaymentProofFormUI"]'),
    ).not.toBeNull();
  });

  it('mountClientMutationsSlice fills dashboard slot for client session', () => {
    const mainRegion = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]')!;
    const sessionWiring = resolveClientSessionWiringPilot('client');
    const adapter = createClientMutationsAdapter();

    mountClientMutationsSlice({
      mainRegion,
      adapter,
      sessionContext: sessionWiring.context,
      clientUserId: sessionWiring.clientUserId!,
      sessionWiring,
    });

    const slot = mainRegion.querySelector('[data-mdj-client-section="client-mutations"]');
    expect(slot?.querySelector('[data-mdj-component="ClientMutationsSlice"]')).not.toBeNull();
  });

  it('mountClientMutationsSlice gates anonymous session', () => {
    const mainRegion = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]')!;
    const sessionWiring = resolveClientSessionWiringPilot('anonymous');
    const adapter = createClientMutationsAdapter();

    mountClientMutationsSlice({
      mainRegion,
      adapter,
      sessionContext: sessionWiring.context,
      clientUserId: sessionWiring.clientUserId ?? '',
      sessionWiring,
    });

    const gated = mainRegion.querySelector('.mdj-client-mutations-slice--gated');
    expect(gated).not.toBeNull();
    expect(gated?.getAttribute('data-mdj-session-ready')).toBe('0');
  });
});
