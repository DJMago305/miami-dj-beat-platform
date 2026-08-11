/**
 * artist-mutations-ui.spec.ts — Writers Phase · Slice 2 · Paso 3.
 * DOM forms · lab adapter only · no fetch / no Supabase.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOCK_SW_ARTIST_USER_ID,
  MOCK_SW_CONTEXT_ARTIST,
} from '../../shared/services/session-wiring/index';
import {
  createArtistMutationsAdapter,
  resetArtistLabRecordIdSequence,
  type ArtistMutationsAdapter,
} from '../../shared/services/artist-mutations/index';
import type { ArtistMutationResult } from '../../shared/types/artist.mutations.types';
import { renderArtistGigDecisionForm } from '../../artist/mutations/artist-gig-decision-form';
import { renderArtistPayoutAckForm } from '../../artist/mutations/artist-payout-ack-form';
import { renderArtistMutationsSlice } from '../../artist/mutations/render-artist-mutations-slice';
import { mountArtistMutationsSlice } from '../../artist/mutations/mount-artist-mutations-slice';
import { resolveArtistSessionWiringPilot } from '../../artist/session/artist-session-wiring-pilot';

function waitMicrotasks(n = 2): Promise<void> {
  let chain = Promise.resolve();
  for (let i = 0; i < n; i += 1) {
    chain = chain.then(() => Promise.resolve());
  }
  return chain;
}

describe('artist mutations UI — gig decision form', () => {
  beforeEach(() => {
    resetArtistLabRecordIdSequence();
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('renders ArtistGigDecisionFormUI with Accept / Decline controls', () => {
    const host = document.getElementById('host')!;
    const adapter = createArtistMutationsAdapter();
    renderArtistGigDecisionForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_ARTIST,
      artistUserId: MOCK_SW_ARTIST_USER_ID,
    });

    const form = host.querySelector('[data-mdj-component="ArtistGigDecisionFormUI"]');
    expect(form).not.toBeNull();
    expect(form?.querySelector('[name="bookingId"]')).not.toBeNull();
    expect(form?.querySelector('[data-mdj-decline-notes="1"]')).not.toBeNull();
    expect(form?.querySelector('[data-mdj-submit="accept"]')).not.toBeNull();
    expect(form?.querySelector('[data-mdj-submit="decline"]')).not.toBeNull();
  });

  it('ACCEPT shows accepted_lab feedback with labRecordId', async () => {
    const host = document.getElementById('host')!;
    const adapter = createArtistMutationsAdapter();
    const onResult = vi.fn();
    const form = renderArtistGigDecisionForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_ARTIST,
      artistUserId: MOCK_SW_ARTIST_USER_ID,
      onResult,
    });

    (form.querySelector('[name="bookingId"]') as HTMLInputElement).value = 'bk_ui_accept_1';
    (form.querySelector('[data-mdj-submit="accept"]') as HTMLButtonElement).click();
    await waitMicrotasks(4);

    expect(onResult).toHaveBeenCalledTimes(1);
    const result = onResult.mock.calls[0][0] as ArtistMutationResult;
    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;

    const feedback = form.querySelector('[data-mdj-feedback]');
    expect(feedback?.getAttribute('data-mdj-feedback')).toBe('success');
    expect(feedback?.textContent).toContain('accepted_lab');
    expect(feedback?.textContent).toContain(result.labRecordId);
    expect(form.dataset.mdjLabStatus).toBe('accepted_lab');
  });

  it('DECLINE without notes shows validation error', async () => {
    const host = document.getElementById('host')!;
    const adapter = createArtistMutationsAdapter();
    const form = renderArtistGigDecisionForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_ARTIST,
      artistUserId: MOCK_SW_ARTIST_USER_ID,
    });

    (form.querySelector('[name="bookingId"]') as HTMLInputElement).value = 'bk_ui_decline_bad';
    (form.querySelector('[data-mdj-submit="decline"]') as HTMLButtonElement).click();
    await waitMicrotasks(4);

    const feedback = form.querySelector('[data-mdj-feedback]');
    expect(feedback?.getAttribute('data-mdj-feedback')).toBe('error');
    expect(feedback?.textContent).toMatch(/rejectionNotes|decline/i);
  });

  it('DECLINE with notes shows declined_lab feedback', async () => {
    const host = document.getElementById('host')!;
    const adapter = createArtistMutationsAdapter();
    const form = renderArtistGigDecisionForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_ARTIST,
      artistUserId: MOCK_SW_ARTIST_USER_ID,
    });

    (form.querySelector('[name="bookingId"]') as HTMLInputElement).value = 'bk_ui_decline_ok';
    (form.querySelector('[name="rejectionNotes"]') as HTMLTextAreaElement).value =
      'Schedule conflict';
    (form.querySelector('[data-mdj-submit="decline"]') as HTMLButtonElement).click();
    await waitMicrotasks(4);

    const feedback = form.querySelector('[data-mdj-feedback]');
    expect(feedback?.getAttribute('data-mdj-feedback')).toBe('success');
    expect(feedback?.textContent).toContain('declined_lab');
    expect(form.dataset.mdjLabStatus).toBe('declined_lab');
  });

  it('disables both buttons during in-flight request and blocks duplicate submit', async () => {
    const host = document.getElementById('host')!;
    let release!: (value: ArtistMutationResult) => void;
    const pending = new Promise<ArtistMutationResult>((resolve) => {
      release = resolve;
    });

    const real = createArtistMutationsAdapter();
    const adapter = {
      ...real,
      respondGigAssignment: vi.fn(() => pending),
      getLabRecord: real.getLabRecord.bind(real),
    } as unknown as ArtistMutationsAdapter;

    const form = renderArtistGigDecisionForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_ARTIST,
      artistUserId: MOCK_SW_ARTIST_USER_ID,
    });

    (form.querySelector('[name="bookingId"]') as HTMLInputElement).value = 'bk_ui_dup';
    const acceptBtn = form.querySelector<HTMLButtonElement>('[data-mdj-submit="accept"]')!;
    const declineBtn = form.querySelector<HTMLButtonElement>('[data-mdj-submit="decline"]')!;

    acceptBtn.click();
    await waitMicrotasks(1);

    expect(acceptBtn.disabled).toBe(true);
    expect(declineBtn.disabled).toBe(true);
    expect(acceptBtn.dataset.mdjSubmitting).toBe('1');

    acceptBtn.click();
    declineBtn.click();
    await waitMicrotasks(1);
    expect(adapter.respondGigAssignment).toHaveBeenCalledTimes(1);

    release({
      status: 'SUCCESS',
      mutationKind: 'respond_gig_assignment',
      labRecordId: 'lab_gig_ui_1',
      acceptedAt: '2026-08-11T17:00:00.000Z',
      replayed: false,
      idempotencyKey: 'idem_gig_x',
    });
    await waitMicrotasks(4);

    expect(acceptBtn.disabled).toBe(false);
    expect(declineBtn.disabled).toBe(false);
  });
});

describe('artist mutations UI — payout ack form', () => {
  beforeEach(() => {
    resetArtistLabRecordIdSequence();
    document.body.innerHTML = '<div id="host"></div>';
  });

  it('submits payout ack and shows acknowledged_lab', async () => {
    const host = document.getElementById('host')!;
    const adapter = createArtistMutationsAdapter();
    const onResult = vi.fn();
    const form = renderArtistPayoutAckForm(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_ARTIST,
      artistUserId: MOCK_SW_ARTIST_USER_ID,
      onResult,
    });

    (form.querySelector('[name="payoutId"]') as HTMLInputElement).value = 'po_ui_1';
    (form.querySelector('[name="feedback"]') as HTMLTextAreaElement).value = 'Thanks';
    form.requestSubmit();
    await waitMicrotasks(4);

    expect(onResult).toHaveBeenCalledTimes(1);
    const result = onResult.mock.calls[0][0] as ArtistMutationResult;
    expect(result.status).toBe('SUCCESS');
    if (result.status !== 'SUCCESS') return;
    expect(form.querySelector('[data-mdj-feedback]')?.textContent).toContain('acknowledged_lab');
    expect(form.dataset.mdjLabStatus).toBe('acknowledged_lab');
  });
});

describe('artist mutations UI — slice mount', () => {
  beforeEach(() => {
    resetArtistLabRecordIdSequence();
    document.body.innerHTML = `
      <main data-mdj-shell-region="main">
        <div class="mdj-client-dashboard__grid">
          <section data-mdj-artist-section="artist-mutations"></section>
        </div>
      </main>
    `;
  });

  it('renderArtistMutationsSlice mounts both forms', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const adapter = createArtistMutationsAdapter();
    renderArtistMutationsSlice(host, {
      adapter,
      sessionContext: MOCK_SW_CONTEXT_ARTIST,
      artistUserId: MOCK_SW_ARTIST_USER_ID,
    });

    expect(host.querySelector('[data-mdj-component="ArtistMutationsSlice"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-component="ArtistGigDecisionFormUI"]')).not.toBeNull();
    expect(host.querySelector('[data-mdj-component="ArtistPayoutAckFormUI"]')).not.toBeNull();
  });

  it('mountArtistMutationsSlice fills dashboard slot for artist session', () => {
    const mainRegion = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]')!;
    const sessionWiring = resolveArtistSessionWiringPilot('artist');
    const adapter = createArtistMutationsAdapter();

    mountArtistMutationsSlice({
      mainRegion,
      adapter,
      sessionContext: sessionWiring.context,
      artistUserId: sessionWiring.assignedDjUserId!,
      sessionWiring,
    });

    const slot = mainRegion.querySelector('[data-mdj-artist-section="artist-mutations"]');
    expect(slot?.querySelector('[data-mdj-component="ArtistMutationsSlice"]')).not.toBeNull();
  });

  it('mountArtistMutationsSlice gates anonymous session', () => {
    const mainRegion = document.querySelector<HTMLElement>('[data-mdj-shell-region="main"]')!;
    const sessionWiring = resolveArtistSessionWiringPilot('anonymous');
    const adapter = createArtistMutationsAdapter();

    mountArtistMutationsSlice({
      mainRegion,
      adapter,
      sessionContext: sessionWiring.context,
      artistUserId: sessionWiring.assignedDjUserId ?? '',
      sessionWiring,
    });

    const gated = mainRegion.querySelector('.mdj-artist-mutations-slice--gated');
    expect(gated).not.toBeNull();
    expect(gated?.getAttribute('data-mdj-session-ready')).toBe('0');
  });
});
