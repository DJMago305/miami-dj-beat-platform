/**
 * MOD-103 Slice 1 — Client Profile Read ViewModel (pure).
 * READ-ONLY display projection from ClientProfileReadDTO. No writers.
 */

import type { ClientProfileReadDTO } from '../../shared/services/profiles/index';

export type ClientVipBadgeStatus = 'vip' | 'regular' | 'unknown';
export type ClientCommercialBadgeStatus = 'commercial' | 'individual' | 'unknown';

export type ClientProfileReadViewModel = {
  readonly displayName: string;
  readonly companyOrBrand: string | null;
  readonly usernameHandle: string | null;
  readonly mdjbId: string | null;
  readonly clientProfileTypeLabel: string;
  readonly clientProfileId: string;
  readonly vipStatus: ClientVipBadgeStatus;
  readonly vipLabel: string;
  readonly commercialStatus: ClientCommercialBadgeStatus;
  readonly commercialLabel: string;
  readonly venueTypeLabel: string | null;
  /** Contact — owner read; treat carefully in public surfaces. */
  readonly email: string | null;
  readonly phone: string | null;
  readonly city: string | null;
  readonly languagePreference: string | null;
  /** Booking history / loyalty preferences (display only). */
  readonly loyaltyPointsLabel: string;
  readonly totalEventsBookedLabel: string;
  readonly discountEligibleLabel: string;
  readonly sourceRef: string | null;
  readonly notifyBookingsLabel: string;
  readonly notifyMarketingLabel: string;
  readonly notifySmsLabel: string;
  /** Billing PII — owner private block. */
  readonly billingNameOnCard: string | null;
  readonly billingAddressSummary: string | null;
  readonly homeAddressSummary: string | null;
  readonly billingSameAsHomeLabel: string | null;
  readonly buyerBillingTierLabel: string;
  /** Masked — never show full Stripe id in Slice 1 UI. */
  readonly stripeCustomerMasked: string | null;
  readonly avatarUrl: string | null;
  readonly photoUrl: string | null;
};

function displayOrNull(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

function boolLabel(value: boolean | null, yes: string, no: string): string {
  if (value === true) return yes;
  if (value === false) return no;
  return 'Unknown';
}

function joinAddress(parts: readonly (string | null)[]): string | null {
  const cleaned = parts.map((p) => displayOrNull(p)).filter((p): p is string => Boolean(p));
  return cleaned.length > 0 ? cleaned.join(', ') : null;
}

function maskStripeId(id: string | null): string | null {
  const raw = displayOrNull(id);
  if (!raw) return null;
  if (raw.length <= 8) return '••••';
  return `${raw.slice(0, 4)}…${raw.slice(-4)}`;
}

function resolveVip(profile: ClientProfileReadDTO): {
  readonly status: ClientVipBadgeStatus;
  readonly label: string;
} {
  if (
    profile.clientProfileType === 'vip' ||
    profile.clientProfileId === 'client.vip' ||
    profile.buyerBillingTier === 'vip'
  ) {
    return { status: 'vip', label: 'Cliente VIP' };
  }
  if (profile.buyerBillingTier === 'none' || profile.clientProfileType === 'regular') {
    return { status: 'regular', label: 'Cliente regular' };
  }
  return { status: 'unknown', label: 'VIP status unknown' };
}

function resolveCommercial(profile: ClientProfileReadDTO): {
  readonly status: ClientCommercialBadgeStatus;
  readonly label: string;
} {
  if (
    profile.isCommercial === true ||
    profile.clientProfileType === 'commercial' ||
    profile.clientProfileId === 'client.commercial'
  ) {
    return { status: 'commercial', label: 'Commercial account' };
  }
  if (profile.isCommercial === false) {
    return { status: 'individual', label: 'Individual account' };
  }
  return { status: 'unknown', label: 'Commercial status unknown' };
}

/**
 * Pure mapper — ClientProfileReadDTO → display strings for MOD-103 Slice 1.
 */
export function toClientProfileReadViewModel(
  profile: ClientProfileReadDTO,
): ClientProfileReadViewModel {
  const vip = resolveVip(profile);
  const commercial = resolveCommercial(profile);
  const username = displayOrNull(profile.username);

  return Object.freeze({
    displayName: displayOrNull(profile.fullName) ?? displayOrNull(profile.companyName) ?? 'Client',
    companyOrBrand: displayOrNull(profile.companyName),
    usernameHandle: username ? `@${username.replace(/^@/, '')}` : null,
    mdjbId: displayOrNull(profile.mdjbId),
    clientProfileTypeLabel: profile.clientProfileType,
    clientProfileId: profile.clientProfileId,
    vipStatus: vip.status,
    vipLabel: vip.label,
    commercialStatus: commercial.status,
    commercialLabel: commercial.label,
    venueTypeLabel: displayOrNull(profile.venueType),
    email: displayOrNull(profile.email),
    phone: displayOrNull(profile.phone),
    city: displayOrNull(profile.city),
    languagePreference: displayOrNull(profile.languagePreference),
    loyaltyPointsLabel:
      profile.loyaltyPoints != null ? String(profile.loyaltyPoints) : '—',
    totalEventsBookedLabel:
      profile.totalEventsBooked != null ? String(profile.totalEventsBooked) : '—',
    discountEligibleLabel: boolLabel(
      profile.discountEligible,
      'Discount eligible',
      'Not discount eligible',
    ),
    sourceRef: displayOrNull(profile.sourceRef),
    notifyBookingsLabel: boolLabel(profile.notifyEmailBookings, 'On', 'Off'),
    notifyMarketingLabel: boolLabel(profile.notifyEmailMarketing, 'On', 'Off'),
    notifySmsLabel: boolLabel(profile.notifySms, 'On', 'Off'),
    billingNameOnCard: displayOrNull(profile.billingNameOnCard),
    billingAddressSummary: joinAddress([
      profile.billingStreet,
      profile.billingApt,
      profile.billingCity,
      profile.billingState,
      profile.billingZip,
      profile.billingCountry,
    ]),
    homeAddressSummary: joinAddress([
      profile.addressStreet,
      profile.addressApt,
      profile.city,
      profile.addressState,
      profile.addressZip,
      profile.addressCountry,
    ]),
    billingSameAsHomeLabel:
      profile.billingSameAsHome == null
        ? null
        : boolLabel(profile.billingSameAsHome, 'Same as home', 'Different billing address'),
    buyerBillingTierLabel: displayOrNull(profile.buyerBillingTier) ?? 'none',
    stripeCustomerMasked: maskStripeId(profile.buyerStripeCustomerId),
    avatarUrl: displayOrNull(profile.avatarUrl),
    photoUrl: displayOrNull(profile.photoUrl),
  });
}
