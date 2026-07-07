/** MOD-003 Permissions — route capability map — TICKET-MOD-003-ROUTE-GUARDS-001 */

import type { CapabilityId } from './types';

export type RoutePortalId = 'client' | 'artist' | 'staff';

export type RouteId = string & { readonly __brand: 'RouteId' };

export type RouteAccessMode = 'public' | 'protected';

export type RouteCapabilityMatch = 'all' | 'any';

export type RouteDefinition = {
  readonly id: RouteId;
  readonly portal: RoutePortalId;
  readonly access: RouteAccessMode;
  readonly requiredCapabilities: readonly CapabilityId[];
  readonly match: RouteCapabilityMatch;
  readonly redZone?: boolean;
};

type RouteSeed = {
  readonly id: string;
  readonly portal: RoutePortalId;
  readonly access: RouteAccessMode;
  readonly requiredCapabilities?: readonly string[];
  readonly match?: RouteCapabilityMatch;
  readonly redZone?: boolean;
};

function staffRoute(
  id: string,
  requiredCapabilities: readonly string[],
  options?: { readonly redZone?: boolean },
): RouteSeed {
  return {
    id,
    portal: 'staff',
    access: 'protected',
    requiredCapabilities: ['staff.dashboard.access', ...requiredCapabilities],
    match: 'all',
    redZone: options?.redZone,
  };
}

const ROUTE_SEEDS: readonly RouteSeed[] = [
  { id: 'client.home', portal: 'client', access: 'public' },
  { id: 'client.shop.browse', portal: 'client', access: 'public' },
  { id: 'client.artist-profile.public', portal: 'client', access: 'public' },
  { id: 'client.login', portal: 'client', access: 'public' },
  {
    id: 'client.account',
    portal: 'client',
    access: 'protected',
    requiredCapabilities: ['client.profile.edit.own'],
  },
  {
    id: 'client.shop.checkout',
    portal: 'client',
    access: 'protected',
    requiredCapabilities: ['client.shop.checkout'],
  },
  {
    id: 'client.orders',
    portal: 'client',
    access: 'protected',
    requiredCapabilities: ['orders.read.own'],
  },
  {
    id: 'client.payments',
    portal: 'client',
    access: 'protected',
    requiredCapabilities: ['payments.read.own'],
  },
  {
    id: 'client.documents',
    portal: 'client',
    access: 'protected',
    requiredCapabilities: ['client.documents.read.own'],
  },
  {
    id: 'client.notifications',
    portal: 'client',
    access: 'protected',
    requiredCapabilities: ['client.notifications.read.own'],
  },
  {
    id: 'client.vip',
    portal: 'client',
    access: 'protected',
    requiredCapabilities: ['client.vip.benefits'],
  },
  {
    id: 'artist.home',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.profile.edit.own'],
  },
  {
    id: 'artist.profile',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.profile.edit.own'],
  },
  {
    id: 'artist.profile.public',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.profile.read.public'],
  },
  {
    id: 'artist.calendar',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.calendar.read.own'],
  },
  {
    id: 'artist.calendar.edit',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.calendar.edit.own'],
  },
  {
    id: 'artist.cashflow',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.cashflow.read.own'],
  },
  {
    id: 'artist.tools',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.tools.use'],
  },
  {
    id: 'artist.academy',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.academy.access'],
  },
  {
    id: 'artist.sft',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.sft.use'],
  },
  {
    id: 'artist.analytics',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.analytics.read.own'],
  },
  {
    id: 'artist.media',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['artist.media.upload.own'],
  },
  {
    id: 'artist.jobs',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['jobs.read', 'jobs.apply'],
    match: 'all',
  },
  {
    id: 'artist.orders',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['orders.read.assigned'],
  },
  {
    id: 'artist.notifications',
    portal: 'artist',
    access: 'protected',
    requiredCapabilities: ['notifications.read.own'],
  },
  staffRoute('staff.gate', []),
  staffRoute('staff.dashboard', []),
  staffRoute('staff.leads', ['staff.leads.read']),
  staffRoute('staff.leads.write', ['staff.leads.write'], { redZone: true }),
  staffRoute('staff.invoices', ['staff.invoices.read']),
  staffRoute('staff.invoices.write', ['staff.invoices.write'], { redZone: true }),
  staffRoute('staff.production', ['staff.production.read']),
  staffRoute('staff.production.write', ['staff.production.write'], { redZone: true }),
  staffRoute('staff.matching', ['staff.matching.run'], { redZone: true }),
  staffRoute('staff.orders', ['orders.read']),
  staffRoute('staff.orders.write', ['orders.write'], { redZone: true }),
  staffRoute('staff.payments', ['payments.read'], { redZone: true }),
  staffRoute('staff.payments.write', ['payments.write'], { redZone: true }),
  staffRoute('staff.crm', ['crm.read'], { redZone: true }),
  staffRoute('staff.crm.write', ['crm.write'], { redZone: true }),
  staffRoute('staff.reports', ['staff.reports.read']),
  staffRoute('staff.users', ['staff.users.read'], { redZone: true }),
  staffRoute('staff.users.write', ['staff.users.write'], { redZone: true }),
  staffRoute('staff.roles', ['staff.roles.read'], { redZone: true }),
  staffRoute('staff.audit', ['staff.audit.read'], { redZone: true }),
  staffRoute('staff.system', ['system.admin'], { redZone: true }),
  staffRoute('staff.featureflags', ['system.featureflags.override'], { redZone: true }),
];

function toRouteDefinition(seed: RouteSeed): RouteDefinition {
  return Object.freeze({
    id: seed.id as RouteId,
    portal: seed.portal,
    access: seed.access,
    requiredCapabilities: Object.freeze(
      (seed.requiredCapabilities ?? []).map((capability) => capability as CapabilityId),
    ),
    match: seed.match ?? 'all',
    redZone: seed.redZone,
  });
}

const ROUTE_DEFINITIONS = Object.freeze(
  ROUTE_SEEDS.map((seed) => toRouteDefinition(seed)),
);

const ROUTE_MAP_ENTRIES = ROUTE_DEFINITIONS.map(
  (definition) => [definition.id, definition] as const,
);

export const ROUTE_CAPABILITY_MAP: Readonly<Record<RouteId, RouteDefinition>> = Object.freeze(
  Object.fromEntries(ROUTE_MAP_ENTRIES),
) as Readonly<Record<RouteId, RouteDefinition>>;

export const ROUTE_COUNT = ROUTE_DEFINITIONS.length;
