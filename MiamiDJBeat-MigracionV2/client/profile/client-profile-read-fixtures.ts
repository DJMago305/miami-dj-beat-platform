/**
 * MOD-103 Slice 1 — lab fixtures (portal-local).
 * Does not mutate sealed shared profiles.mocks — extends for VIP/commercial demo.
 */

import {
  MOCK_CLIENT_PROFILE_REGULAR,
  type ClientProfileReadDTO,
} from '../../shared/services/profiles/index';

/** Lab demo: VIP client with booking history signals. */
export const LAB_CLIENT_PROFILE_VIP: ClientProfileReadDTO = Object.freeze({
  ...MOCK_CLIENT_PROFILE_REGULAR,
  fullName: 'Maria VIP Client',
  email: 'maria.vip@example.com',
  phone: '+1-305-555-0142',
  username: 'mariavip',
  companyName: null,
  buyerBillingTier: 'vip',
  clientProfileId: 'client.vip',
  clientProfileType: 'vip',
  isCommercial: false,
  loyaltyPoints: 420,
  totalEventsBooked: 7,
  discountEligible: true,
  mdjbId: 'MDJB-TEST-0002-C',
  billingNameOnCard: 'Maria VIP Client',
  billingSameAsHome: true,
  addressStreet: '100 Ocean Drive',
  addressState: 'FL',
  addressZip: '33139',
  addressCountry: 'United States',
  city: 'Miami Beach',
  buyerStripeCustomerId: 'cus_lab_mock_vip_123456',
});

/** Lab demo: commercial buyer (company / brand). */
export const LAB_CLIENT_PROFILE_COMMERCIAL: ClientProfileReadDTO = Object.freeze({
  ...MOCK_CLIENT_PROFILE_REGULAR,
  fullName: 'Ops Contact',
  companyName: 'Brickell Events Co',
  email: 'ops@brickellevents.example',
  phone: '+1-305-555-0199',
  username: 'brickellevents',
  buyerBillingTier: 'none',
  clientProfileId: 'client.commercial',
  clientProfileType: 'commercial',
  isCommercial: true,
  venueType: 'other',
  loyaltyPoints: 50,
  totalEventsBooked: 3,
  discountEligible: false,
  mdjbId: 'MDJB-TEST-0005-C',
});

/** Default lab fallback for client portal Slice 1. */
export const LAB_CLIENT_PROFILE_DEFAULT: ClientProfileReadDTO = LAB_CLIENT_PROFILE_VIP;
