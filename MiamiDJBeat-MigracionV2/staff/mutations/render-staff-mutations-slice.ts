/**
 * Render Staff Mutations slice — payment review + artist assignment (Paso 3).
 */

import type { StaffMutationsAdapter } from '../../shared/services/staff-mutations/index';
import type { SessionContextDTO } from '../../shared/types/session.types';
import { renderStaffPaymentReviewForm } from './staff-payment-review-form';
import { renderStaffArtistAssignmentForm } from './staff-artist-assignment-form';

export type RenderStaffMutationsSliceOptions = {
  readonly adapter: StaffMutationsAdapter;
  readonly sessionContext: SessionContextDTO;
  readonly staffUserId: string;
};

/**
 * Renders payment review + artist assignment forms into host.
 */
export function renderStaffMutationsSlice(
  container: HTMLElement,
  options: RenderStaffMutationsSliceOptions,
): void {
  const root = document.createElement('section');
  root.className = 'mdj-staff-mutations-slice';
  root.dataset.mdjComponent = 'StaffMutationsSlice';
  root.dataset.mdjMod = 'MOD-301-MUT';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-staff-mutations-slice__eyebrow';
  eyebrow.textContent = 'MOD-301 Writers · Lab only';

  const title = document.createElement('h2');
  title.className = 'mdj-shell-section-header';
  title.setAttribute('data-mdj-component', 'SectionHeader');
  title.textContent = 'Staff Mutations';

  const intro = document.createElement('p');
  intro.className = 'mdj-staff-mutations-slice__intro';
  intro.textContent =
    'Review offline payments and assign DJs to bookings. Results stay in the lab adapter store.';

  const grid = document.createElement('div');
  grid.className = 'mdj-staff-mutations-slice__grid';

  const paymentHost = document.createElement('div');
  paymentHost.className = 'mdj-staff-mutations-slice__card';
  paymentHost.dataset.mdjMutationsHost = 'payment';

  const assignHost = document.createElement('div');
  assignHost.className = 'mdj-staff-mutations-slice__card';
  assignHost.dataset.mdjMutationsHost = 'assign';

  renderStaffPaymentReviewForm(paymentHost, {
    adapter: options.adapter,
    sessionContext: options.sessionContext,
    staffUserId: options.staffUserId,
  });
  renderStaffArtistAssignmentForm(assignHost, {
    adapter: options.adapter,
    sessionContext: options.sessionContext,
    staffUserId: options.staffUserId,
  });

  grid.append(paymentHost, assignHost);
  root.append(eyebrow, title, intro, grid);
  container.replaceChildren(root);
}
