/** MOD-003 Permissions — component capability map — TICKET-MOD-003-COMPONENT-MAP-001 */

import { ROUTE_CAPABILITY_MAP, type RouteId, type RoutePortalId } from './route-capability-map';
import type { CapabilityId } from './types';

export type ComponentPortalId = RoutePortalId;

export type ComponentId = string & { readonly __brand: 'ComponentId' };

export type ComponentKind = 'surface' | 'control' | 'action';

export type ComponentCapabilityMatch = 'all' | 'any';

export type ComponentStatePolicy = {
  readonly onDeniedRender: 'HIDDEN' | 'DISABLED';
  readonly onReadOnly: 'READ_ONLY';
  readonly onDeniedEnable: 'HIDDEN' | 'DISABLED';
  readonly onDeniedAction: 'forbidden';
};

export type ComponentDefinition = {
  readonly id: ComponentId;
  readonly portal: ComponentPortalId;
  readonly kind: ComponentKind;
  readonly requiredCapabilities: readonly CapabilityId[];
  readonly readCapabilities: readonly CapabilityId[];
  readonly match: ComponentCapabilityMatch;
  readonly statePolicy: ComponentStatePolicy;
  readonly relatedRouteId: RouteId;
  readonly redZone?: boolean;
};

type ComponentSeed = {
  readonly id: string;
  readonly portal: ComponentPortalId;
  readonly kind: ComponentKind;
  readonly requiredCapabilities?: readonly string[];
  readonly readCapabilities?: readonly string[];
  readonly match?: ComponentCapabilityMatch;
  readonly statePolicy?: Partial<ComponentStatePolicy>;
  readonly relatedRouteId: string;
  readonly redZone?: boolean;
};

const CLIENT_STATE_POLICY: ComponentStatePolicy = Object.freeze({
  onDeniedRender: 'HIDDEN',
  onReadOnly: 'READ_ONLY',
  onDeniedEnable: 'DISABLED',
  onDeniedAction: 'forbidden',
});

const ARTIST_STATE_POLICY: ComponentStatePolicy = Object.freeze({
  onDeniedRender: 'HIDDEN',
  onReadOnly: 'READ_ONLY',
  onDeniedEnable: 'HIDDEN',
  onDeniedAction: 'forbidden',
});

const STAFF_STATE_POLICY: ComponentStatePolicy = Object.freeze({
  onDeniedRender: 'HIDDEN',
  onReadOnly: 'READ_ONLY',
  onDeniedEnable: 'HIDDEN',
  onDeniedAction: 'forbidden',
});

const STAFF_DASHBOARD_ACCESS = 'staff.dashboard.access';

function staffComponent(
  id: string,
  options: {
    readonly kind: ComponentKind;
    readonly relatedRouteId: string;
    readonly requiredCapabilities?: readonly string[];
    readonly readCapabilities?: readonly string[];
    readonly match?: ComponentCapabilityMatch;
    readonly redZone?: boolean;
    readonly statePolicy?: Partial<ComponentStatePolicy>;
  },
): ComponentSeed {
  const required = options.requiredCapabilities ?? [];
  const withDashboard = required.includes(STAFF_DASHBOARD_ACCESS)
    ? required
    : [STAFF_DASHBOARD_ACCESS, ...required];

  return {
    id,
    portal: 'staff',
    kind: options.kind,
    requiredCapabilities: withDashboard,
    readCapabilities: options.readCapabilities,
    match: options.match,
    statePolicy: { ...STAFF_STATE_POLICY, ...options.statePolicy },
    relatedRouteId: options.relatedRouteId,
    redZone: options.redZone,
  };
}

const COMPONENT_SEEDS: readonly ComponentSeed[] = [
  {
    id: 'client.checkout.button',
    portal: 'client',
    kind: 'control',
    requiredCapabilities: ['client.shop.checkout'],
    relatedRouteId: 'client.shop.checkout',
  },
  {
    id: 'client.vip.banner',
    portal: 'client',
    kind: 'surface',
    requiredCapabilities: ['client.vip.benefits'],
    relatedRouteId: 'client.vip',
  },
  {
    id: 'client.payments.panel',
    portal: 'client',
    kind: 'surface',
    readCapabilities: ['payments.read.own'],
    relatedRouteId: 'client.payments',
  },
  {
    id: 'client.documents.tab',
    portal: 'client',
    kind: 'surface',
    readCapabilities: ['client.documents.read.own'],
    relatedRouteId: 'client.documents',
  },
  {
    id: 'client.notifications.panel',
    portal: 'client',
    kind: 'surface',
    readCapabilities: ['client.notifications.read.own'],
    relatedRouteId: 'client.notifications',
  },
  {
    id: 'client.orders.panel',
    portal: 'client',
    kind: 'surface',
    readCapabilities: ['orders.read.own'],
    relatedRouteId: 'client.orders',
  },
  {
    id: 'client.account.form',
    portal: 'client',
    kind: 'surface',
    requiredCapabilities: ['client.profile.edit.own'],
    relatedRouteId: 'client.account',
    statePolicy: { onDeniedRender: 'DISABLED' },
  },
  {
    id: 'client.shop.browse.grid',
    portal: 'client',
    kind: 'surface',
    relatedRouteId: 'client.shop.browse',
  },
  {
    id: 'client.login.button',
    portal: 'client',
    kind: 'control',
    relatedRouteId: 'client.login',
  },
  {
    id: 'client.profile.save.button',
    portal: 'client',
    kind: 'action',
    requiredCapabilities: ['client.profile.edit.own'],
    relatedRouteId: 'client.account',
  },
  {
    id: 'client.checkout.summary',
    portal: 'client',
    kind: 'surface',
    requiredCapabilities: ['client.shop.checkout'],
    relatedRouteId: 'client.shop.checkout',
  },
  {
    id: 'client.vip.crown.badge',
    portal: 'client',
    kind: 'surface',
    requiredCapabilities: ['client.vip.benefits'],
    relatedRouteId: 'client.vip',
  },
  {
    id: 'artist.cashflow.card',
    portal: 'artist',
    kind: 'surface',
    readCapabilities: ['artist.cashflow.read.own'],
    relatedRouteId: 'artist.cashflow',
  },
  {
    id: 'artist.analytics.card',
    portal: 'artist',
    kind: 'surface',
    requiredCapabilities: ['artist.analytics.read.own'],
    relatedRouteId: 'artist.analytics',
  },
  {
    id: 'artist.song4tips.card',
    portal: 'artist',
    kind: 'surface',
    requiredCapabilities: ['artist.sft.use'],
    relatedRouteId: 'artist.sft',
  },
  {
    id: 'artist.academy.card',
    portal: 'artist',
    kind: 'surface',
    readCapabilities: ['artist.academy.access'],
    relatedRouteId: 'artist.academy',
  },
  {
    id: 'artist.media.upload.button',
    portal: 'artist',
    kind: 'control',
    requiredCapabilities: ['artist.media.upload.own'],
    relatedRouteId: 'artist.media',
  },
  {
    id: 'artist.jobs.button',
    portal: 'artist',
    kind: 'control',
    requiredCapabilities: ['jobs.apply'],
    readCapabilities: ['jobs.read'],
    relatedRouteId: 'artist.jobs',
    statePolicy: { onDeniedEnable: 'DISABLED' },
  },
  {
    id: 'artist.jobs.panel',
    portal: 'artist',
    kind: 'surface',
    readCapabilities: ['jobs.read'],
    relatedRouteId: 'artist.jobs',
  },
  {
    id: 'artist.calendar.editor',
    portal: 'artist',
    kind: 'control',
    requiredCapabilities: ['artist.calendar.edit.own'],
    readCapabilities: ['artist.calendar.read.own'],
    relatedRouteId: 'artist.calendar.edit',
  },
  {
    id: 'artist.calendar.view',
    portal: 'artist',
    kind: 'surface',
    readCapabilities: ['artist.calendar.read.own'],
    relatedRouteId: 'artist.calendar',
  },
  {
    id: 'artist.tools.link',
    portal: 'artist',
    kind: 'control',
    requiredCapabilities: ['artist.tools.use'],
    relatedRouteId: 'artist.tools',
  },
  {
    id: 'artist.profile.edit.form',
    portal: 'artist',
    kind: 'surface',
    requiredCapabilities: ['artist.profile.edit.own'],
    relatedRouteId: 'artist.profile',
    statePolicy: { onDeniedRender: 'DISABLED' },
  },
  {
    id: 'artist.notifications.panel',
    portal: 'artist',
    kind: 'surface',
    readCapabilities: ['notifications.read.own'],
    relatedRouteId: 'artist.notifications',
  },
  {
    id: 'artist.orders.panel',
    portal: 'artist',
    kind: 'surface',
    readCapabilities: ['orders.read.assigned'],
    relatedRouteId: 'artist.orders',
  },
  {
    id: 'artist.cashflow.export.button',
    portal: 'artist',
    kind: 'action',
    requiredCapabilities: ['artist.cashflow.read.own'],
    relatedRouteId: 'artist.cashflow',
  },
  staffComponent('staff.invoice.create.button', {
    kind: 'action',
    requiredCapabilities: ['staff.invoices.write'],
    relatedRouteId: 'staff.invoices.write',
    redZone: true,
  }),
  staffComponent('staff.invoice.edit.button', {
    kind: 'action',
    requiredCapabilities: ['staff.invoices.write'],
    relatedRouteId: 'staff.invoices.write',
    redZone: true,
  }),
  staffComponent('staff.invoice.panel', {
    kind: 'surface',
    readCapabilities: ['staff.invoices.read'],
    relatedRouteId: 'staff.invoices',
  }),
  staffComponent('staff.invoice.read.table', {
    kind: 'surface',
    readCapabilities: ['staff.invoices.read'],
    relatedRouteId: 'staff.invoices',
  }),
  staffComponent('staff.crm.panel', {
    kind: 'surface',
    readCapabilities: ['crm.read'],
    relatedRouteId: 'staff.crm',
    redZone: true,
  }),
  staffComponent('staff.crm.edit.button', {
    kind: 'action',
    requiredCapabilities: ['crm.write'],
    relatedRouteId: 'staff.crm.write',
    redZone: true,
  }),
  staffComponent('staff.crm.delete.button', {
    kind: 'action',
    requiredCapabilities: ['crm.delete'],
    relatedRouteId: 'staff.crm.write',
    redZone: true,
  }),
  staffComponent('staff.production.panel', {
    kind: 'surface',
    readCapabilities: ['staff.production.read'],
    relatedRouteId: 'staff.production',
  }),
  staffComponent('staff.production.edit.button', {
    kind: 'action',
    requiredCapabilities: ['staff.production.write'],
    relatedRouteId: 'staff.production.write',
    redZone: true,
  }),
  staffComponent('staff.matching.panel', {
    kind: 'surface',
    requiredCapabilities: ['staff.matching.run'],
    relatedRouteId: 'staff.matching',
    redZone: true,
  }),
  staffComponent('staff.matching.run.button', {
    kind: 'action',
    requiredCapabilities: ['staff.matching.run'],
    relatedRouteId: 'staff.matching',
    redZone: true,
  }),
  staffComponent('staff.users.panel', {
    kind: 'surface',
    readCapabilities: ['staff.users.read'],
    relatedRouteId: 'staff.users',
    redZone: true,
  }),
  staffComponent('staff.users.edit.button', {
    kind: 'action',
    requiredCapabilities: ['staff.users.write'],
    relatedRouteId: 'staff.users.write',
    redZone: true,
  }),
  staffComponent('staff.roles.panel', {
    kind: 'surface',
    requiredCapabilities: ['staff.roles.read'],
    relatedRouteId: 'staff.roles',
    redZone: true,
  }),
  staffComponent('staff.audit.panel', {
    kind: 'surface',
    requiredCapabilities: ['staff.audit.read'],
    relatedRouteId: 'staff.audit',
    redZone: true,
  }),
  staffComponent('staff.system.panel', {
    kind: 'surface',
    requiredCapabilities: ['system.admin'],
    relatedRouteId: 'staff.system',
    redZone: true,
  }),
  staffComponent('staff.featureflags.panel', {
    kind: 'surface',
    requiredCapabilities: ['system.featureflags.override'],
    relatedRouteId: 'staff.featureflags',
    redZone: true,
  }),
  staffComponent('staff.leads.panel', {
    kind: 'surface',
    readCapabilities: ['staff.leads.read'],
    relatedRouteId: 'staff.leads',
  }),
  staffComponent('staff.leads.edit.button', {
    kind: 'action',
    requiredCapabilities: ['staff.leads.write'],
    relatedRouteId: 'staff.leads.write',
    redZone: true,
  }),
  staffComponent('staff.leads.create.button', {
    kind: 'action',
    requiredCapabilities: ['staff.leads.write'],
    relatedRouteId: 'staff.leads.write',
    redZone: true,
  }),
  staffComponent('staff.orders.panel', {
    kind: 'surface',
    readCapabilities: ['orders.read'],
    relatedRouteId: 'staff.orders',
  }),
  staffComponent('staff.orders.write.button', {
    kind: 'action',
    requiredCapabilities: ['orders.write'],
    relatedRouteId: 'staff.orders.write',
    redZone: true,
  }),
  staffComponent('staff.payments.panel', {
    kind: 'surface',
    readCapabilities: ['payments.read'],
    relatedRouteId: 'staff.payments',
    redZone: true,
  }),
  staffComponent('staff.payments.write.button', {
    kind: 'action',
    requiredCapabilities: ['payments.write'],
    relatedRouteId: 'staff.payments.write',
    redZone: true,
  }),
  staffComponent('staff.reports.panel', {
    kind: 'surface',
    readCapabilities: ['staff.reports.read'],
    relatedRouteId: 'staff.reports',
  }),
  staffComponent('staff.dashboard.shell', {
    kind: 'surface',
    relatedRouteId: 'staff.dashboard',
  }),
];

function resolveStatePolicy(
  portal: ComponentPortalId,
  overrides?: Partial<ComponentStatePolicy>,
): ComponentStatePolicy {
  const base =
    portal === 'client'
      ? CLIENT_STATE_POLICY
      : portal === 'artist'
        ? ARTIST_STATE_POLICY
        : STAFF_STATE_POLICY;

  if (!overrides) {
    return base;
  }

  return Object.freeze({ ...base, ...overrides });
}

function toCapabilityIds(values: readonly string[] | undefined): readonly CapabilityId[] {
  return Object.freeze((values ?? []).map((capability) => capability as CapabilityId));
}

function toComponentDefinition(seed: ComponentSeed): ComponentDefinition {
  return Object.freeze({
    id: seed.id as ComponentId,
    portal: seed.portal,
    kind: seed.kind,
    requiredCapabilities: toCapabilityIds(seed.requiredCapabilities),
    readCapabilities: toCapabilityIds(seed.readCapabilities),
    match: seed.match ?? 'all',
    statePolicy: resolveStatePolicy(seed.portal, seed.statePolicy),
    relatedRouteId: seed.relatedRouteId as RouteId,
    redZone: seed.redZone,
  });
}

const COMPONENT_DEFINITIONS = Object.freeze(
  COMPONENT_SEEDS.map((seed) => toComponentDefinition(seed)),
);

const COMPONENT_MAP_ENTRIES = COMPONENT_DEFINITIONS.map(
  (definition) => [definition.id, definition] as const,
);

export const COMPONENT_CAPABILITY_MAP: Readonly<Record<ComponentId, ComponentDefinition>> =
  Object.freeze(Object.fromEntries(COMPONENT_MAP_ENTRIES)) as Readonly<
    Record<ComponentId, ComponentDefinition>
  >;

export const COMPONENT_COUNT = COMPONENT_DEFINITIONS.length;

export function getComponentDefinition(componentId: string): ComponentDefinition | null {
  return COMPONENT_CAPABILITY_MAP[componentId as ComponentId] ?? null;
}

export function isRegisteredComponent(componentId: string): boolean {
  return getComponentDefinition(componentId) !== null;
}

export function listComponentsForPortal(
  portal: ComponentPortalId,
): readonly ComponentDefinition[] {
  return Object.freeze(
    COMPONENT_DEFINITIONS.filter((definition) => definition.portal === portal),
  );
}

export function listComponentsForRoute(routeId: string): readonly ComponentDefinition[] {
  if (!(routeId in ROUTE_CAPABILITY_MAP)) {
    return Object.freeze([]);
  }

  const typedRouteId = routeId as RouteId;
  return Object.freeze(
    COMPONENT_DEFINITIONS.filter((definition) => definition.relatedRouteId === typedRouteId),
  );
}
