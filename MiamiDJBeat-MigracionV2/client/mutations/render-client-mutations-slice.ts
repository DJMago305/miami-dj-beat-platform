/**
 * Render Client Mutations slice — both writer forms (Paso 3).
 */

import type { ClientMutationsAdapter } from '../../shared/services/client-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import { renderClientBookingRequestForm } from './client-booking-request-form';
import { renderClientOfflinePaymentProofForm } from './client-offline-payment-proof-form';

export type RenderClientMutationsSliceOptions = {
  readonly adapter: ClientMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly clientUserId: string;
};

/**
 * Renders booking + offline payment forms into host.
 */
export function renderClientMutationsSlice(
  container: HTMLElement,
  options: RenderClientMutationsSliceOptions,
): void {
  const root = document.createElement('section');
  root.className = 'mdj-client-mutations-slice';
  root.dataset.mdjComponent = 'ClientMutationsSlice';
  root.dataset.mdjMod = 'MOD-103-MUT';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-client-mutations-slice__eyebrow';
  eyebrow.textContent = 'MOD-103 Writers · Lab only';

  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Client Mutations';

  const intro = document.createElement('p');
  intro.className = 'mdj-client-mutations-slice__intro';
  intro.textContent =
    'Submit a booking request or register an offline payment proof. Results stay in the lab adapter store.';

  const grid = document.createElement('div');
  grid.className = 'mdj-client-mutations-slice__grid';

  const bookingHost = document.createElement('div');
  bookingHost.className = 'mdj-client-mutations-slice__card';
  bookingHost.dataset.mdjMutationsHost = 'booking';

  const paymentHost = document.createElement('div');
  paymentHost.className = 'mdj-client-mutations-slice__card';
  paymentHost.dataset.mdjMutationsHost = 'payment';

  renderClientBookingRequestForm(bookingHost, {
    adapter: options.adapter,
    sessionContext: options.sessionContext,
    clientUserId: options.clientUserId,
  });
  renderClientOfflinePaymentProofForm(paymentHost, {
    adapter: options.adapter,
    sessionContext: options.sessionContext,
    clientUserId: options.clientUserId,
  });

  grid.append(bookingHost, paymentHost);
  root.append(eyebrow, title, intro, grid);
  container.replaceChildren(root);
}
