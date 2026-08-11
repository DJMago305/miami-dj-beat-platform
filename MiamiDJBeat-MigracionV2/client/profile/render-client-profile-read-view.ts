/**
 * MOD-103 Slice 1 — Client Profile Read View (DOM).
 * Strictly READ-ONLY visualization — no forms, no save buttons, no mutators.
 */

import type { ClientProfileReadDTO } from '../../shared/services/profiles/index';
import {
  toClientProfileReadViewModel,
  type ClientProfileReadViewModel,
} from './client-profile-read-view-model';

export type RenderClientProfileReadViewOptions = {
  readonly sourceLabel?: string;
};

function createSummaryRow(label: string, value: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'mdj-client-profile-read__row';

  const dt = document.createElement('dt');
  dt.className = 'mdj-client-profile-read__label';
  dt.textContent = label;

  const dd = document.createElement('dd');
  dd.className = 'mdj-client-profile-read__value';
  dd.textContent = value;

  row.append(dt, dd);
  return row;
}

function createSection(title: string, sectionId: string): HTMLElement {
  const section = document.createElement('section');
  section.className = 'mdj-client-profile-read__section';
  section.dataset.mdjClientProfileSection = sectionId;

  const heading = document.createElement('h3');
  heading.className = 'mdj-client-profile-read__section-title';
  heading.textContent = title;
  section.append(heading);
  return section;
}

function appendEmptyHint(section: HTMLElement, message: string): void {
  const hint = document.createElement('p');
  hint.className = 'mdj-client-profile-read__empty';
  hint.textContent = message;
  section.append(hint);
}

function renderHeader(vm: ClientProfileReadViewModel, sourceLabel: string): HTMLElement {
  const header = document.createElement('header');
  header.className = 'mdj-client-profile-read__header';
  header.dataset.mdjClientProfileSection = 'header';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'mdj-client-profile-read__eyebrow';
  eyebrow.textContent = `MOD-103 · Read view · ${sourceLabel}`;

  const name = document.createElement('h2');
  name.className = 'mdj-client-profile-read__name';
  name.textContent = vm.displayName;

  const badges = document.createElement('div');
  badges.className = 'mdj-client-profile-read__badges';
  badges.setAttribute('aria-label', 'Client classification badges');

  const vip = document.createElement('span');
  vip.className = `mdj-client-profile-read__badge mdj-client-profile-read__badge--vip mdj-client-profile-read__badge--vip-${vm.vipStatus}`;
  vip.dataset.mdjClientVip = vm.vipStatus;
  vip.textContent = vm.vipLabel;

  const commercial = document.createElement('span');
  commercial.className = `mdj-client-profile-read__badge mdj-client-profile-read__badge--commercial mdj-client-profile-read__badge--commercial-${vm.commercialStatus}`;
  commercial.dataset.mdjClientCommercial = vm.commercialStatus;
  commercial.textContent = vm.commercialLabel;

  const typeBadge = document.createElement('span');
  typeBadge.className = 'mdj-client-profile-read__badge';
  typeBadge.dataset.mdjClientProfileType = vm.clientProfileTypeLabel;
  typeBadge.textContent = vm.clientProfileTypeLabel;

  badges.append(vip, commercial, typeBadge);

  const meta = document.createElement('dl');
  meta.className = 'mdj-client-profile-read__meta';
  if (vm.companyOrBrand) meta.append(createSummaryRow('Company / brand', vm.companyOrBrand));
  if (vm.usernameHandle) meta.append(createSummaryRow('Handle', vm.usernameHandle));
  if (vm.mdjbId) meta.append(createSummaryRow('MDJB ID', vm.mdjbId));
  if (vm.venueTypeLabel) meta.append(createSummaryRow('Venue type', vm.venueTypeLabel));

  header.append(eyebrow, name, badges, meta);
  return header;
}

function renderContact(vm: ClientProfileReadViewModel): HTMLElement {
  const section = createSection('Contact', 'contact');
  const list = document.createElement('dl');
  list.className = 'mdj-client-profile-read__list';
  list.append(
    createSummaryRow('Email', vm.email ?? '—'),
    createSummaryRow('Phone', vm.phone ?? '—'),
    createSummaryRow('City', vm.city ?? '—'),
    createSummaryRow('Language', vm.languagePreference ?? '—'),
  );
  section.append(list);
  return section;
}

function renderBookingPrefs(vm: ClientProfileReadViewModel): HTMLElement {
  const section = createSection('Booking history & preferences', 'booking-prefs');
  const list = document.createElement('dl');
  list.className = 'mdj-client-profile-read__list';
  list.append(
    createSummaryRow('Events booked', vm.totalEventsBookedLabel),
    createSummaryRow('Loyalty points', vm.loyaltyPointsLabel),
    createSummaryRow('Discount', vm.discountEligibleLabel),
    createSummaryRow('Notify bookings', vm.notifyBookingsLabel),
    createSummaryRow('Notify marketing', vm.notifyMarketingLabel),
    createSummaryRow('Notify SMS', vm.notifySmsLabel),
  );
  if (vm.sourceRef) list.append(createSummaryRow('Source', vm.sourceRef));
  section.append(list);
  return section;
}

function renderBillingPrivate(vm: ClientProfileReadViewModel): HTMLElement {
  const section = createSection('Billing (owner private)', 'billing-private');
  const note = document.createElement('p');
  note.className = 'mdj-client-profile-read__pii-note';
  note.textContent =
    'Billing address, card name, and Stripe customer id are owner-private. Stripe id is masked.';
  section.append(note);

  const list = document.createElement('dl');
  list.className = 'mdj-client-profile-read__list';
  list.append(
    createSummaryRow('Buyer billing tier', vm.buyerBillingTierLabel),
    createSummaryRow('Name on card', vm.billingNameOnCard ?? '—'),
    createSummaryRow('Home address', vm.homeAddressSummary ?? '—'),
    createSummaryRow('Billing address', vm.billingAddressSummary ?? '—'),
    createSummaryRow(
      'Billing vs home',
      vm.billingSameAsHomeLabel ?? '—',
    ),
    createSummaryRow('Stripe customer', vm.stripeCustomerMasked ?? '—'),
  );
  section.append(list);

  if (!vm.billingAddressSummary && !vm.billingNameOnCard && !vm.stripeCustomerMasked) {
    appendEmptyHint(section, 'No billing details on file for this lab profile.');
  }
  return section;
}

/**
 * Renders a read-only client profile panel into `container` (replaces children).
 * Guarantees zero interactive writers (no form / submit / save controls).
 */
export function renderClientProfileReadView(
  container: HTMLElement,
  profile: ClientProfileReadDTO,
  options?: RenderClientProfileReadViewOptions,
): ClientProfileReadViewModel {
  const sourceLabel = options?.sourceLabel ?? 'ClientProfileReadDTO';
  const vm = toClientProfileReadViewModel(profile);

  const root = document.createElement('article');
  root.className = 'mdj-client-profile-read';
  root.dataset.mdjComponent = 'ClientProfileReadView';
  root.dataset.mdjMod = 'MOD-103';
  root.setAttribute('aria-label', 'Client profile read view');

  root.append(
    renderHeader(vm, sourceLabel),
    renderContact(vm),
    renderBookingPrefs(vm),
    renderBillingPrivate(vm),
  );

  for (const el of root.querySelectorAll('form, button[type="submit"], input, textarea, select')) {
    el.remove();
  }

  container.replaceChildren(root);
  return vm;
}
