/** MOD-003 Permissions — capability registry — TICKET-MOD-003-CAPABILITY-REGISTRY-001 */

import { PermissionError } from './errors';
import type {
  CapabilityDefinition,
  CapabilityDomain,
  CapabilityId,
  PermissionPortalId,
} from './types';
import { CAPABILITY_ID_FORMAT } from './types';

type CapabilitySeed = {
  readonly id: string;
  readonly description: string;
  readonly portals: readonly PermissionPortalId[];
  readonly redZone?: boolean;
};

/** Official catalog — CAPABILITY-CATALOG.md v1.0 (51 capabilities). */
const CAPABILITY_SEEDS: readonly CapabilitySeed[] = [
  { id: 'orders.read.own', description: 'Leer órdenes propias (buyer)', portals: ['client'] },
  { id: 'orders.read.assigned', description: 'Leer órdenes asignadas (artist)', portals: ['artist'] },
  { id: 'orders.read', description: 'Leer órdenes operativas', portals: ['staff'] },
  { id: 'orders.write', description: 'Crear/editar órdenes', portals: ['staff'], redZone: true },
  { id: 'orders.assign', description: 'Asignar talento / artista', portals: ['staff'], redZone: true },
  { id: 'orders.cancel', description: 'Cancelar orden', portals: ['staff'], redZone: true },
  { id: 'payments.read.own', description: 'Estado pagos buyer', portals: ['client'] },
  { id: 'payments.read', description: 'Ver pagos operativos', portals: ['staff'], redZone: true },
  { id: 'payments.write', description: 'Registrar/cobrar', portals: ['staff'], redZone: true },
  { id: 'payments.refund', description: 'Reembolsos', portals: ['staff'], redZone: true },
  { id: 'crm.read', description: 'Leer CRM', portals: ['staff'], redZone: true },
  { id: 'crm.write', description: 'Editar CRM', portals: ['staff'], redZone: true },
  { id: 'crm.delete', description: 'Eliminar registros CRM', portals: ['staff'], redZone: true },
  { id: 'jobs.read', description: 'Ver oportunidades', portals: ['artist', 'staff'] },
  { id: 'jobs.apply', description: 'Aplicar a job (artist)', portals: ['artist'] },
  { id: 'jobs.publish', description: 'Publicar oportunidad', portals: ['staff'], redZone: true },
  { id: 'jobs.assign', description: 'Asignar job', portals: ['staff'], redZone: true },
  { id: 'artist.profile.read.public', description: 'Ver perfil público', portals: ['client', 'artist'] },
  { id: 'artist.profile.edit.own', description: 'Editar perfil propio', portals: ['artist'] },
  { id: 'artist.calendar.read.own', description: 'Ver agenda propia', portals: ['artist'] },
  { id: 'artist.calendar.edit.own', description: 'Editar agenda propia', portals: ['artist'] },
  { id: 'artist.cashflow.read.own', description: 'Cash Flow propio', portals: ['artist'] },
  { id: 'artist.tools.use', description: 'DJ Tools', portals: ['artist'] },
  { id: 'artist.academy.access', description: 'Academia artista', portals: ['artist'] },
  { id: 'artist.sft.use', description: 'SoundForTips™ (PRO+ flag)', portals: ['artist'] },
  { id: 'artist.media.upload.own', description: 'Subir media perfil', portals: ['artist'] },
  { id: 'artist.analytics.read.own', description: 'Analytics propio', portals: ['artist'] },
  { id: 'client.profile.edit.own', description: 'Editar perfil cliente', portals: ['client'] },
  { id: 'client.shop.browse', description: 'Ver catálogo', portals: ['client', 'guest'] },
  { id: 'client.shop.checkout', description: 'Checkout', portals: ['client'] },
  { id: 'client.vip.benefits', description: 'Beneficios VIP', portals: ['client'] },
  { id: 'client.documents.read.own', description: 'Documentos propios', portals: ['client'] },
  { id: 'client.notifications.read.own', description: 'Notificaciones', portals: ['client'] },
  { id: 'staff.dashboard.access', description: 'Acceso shell staff', portals: ['staff'] },
  { id: 'staff.leads.read', description: 'Leer leads', portals: ['staff'], redZone: true },
  { id: 'staff.leads.write', description: 'Editar leads', portals: ['staff'], redZone: true },
  { id: 'staff.invoices.read', description: 'Leer facturas', portals: ['staff'], redZone: true },
  { id: 'staff.invoices.write', description: 'Escribir facturas', portals: ['staff'], redZone: true },
  { id: 'staff.production.read', description: 'Producción read', portals: ['staff'], redZone: true },
  { id: 'staff.production.write', description: 'Producción write', portals: ['staff'], redZone: true },
  { id: 'staff.matching.run', description: 'Matching talento', portals: ['staff'], redZone: true },
  { id: 'staff.reports.read', description: 'Reportes', portals: ['staff'] },
  { id: 'staff.users.read', description: 'Ver usuarios staff', portals: ['staff'], redZone: true },
  { id: 'staff.users.write', description: 'Gestionar usuarios', portals: ['staff'], redZone: true },
  { id: 'staff.roles.read', description: 'Ver roles', portals: ['staff'], redZone: true },
  { id: 'staff.audit.read', description: 'Audit log', portals: ['staff'], redZone: true },
  { id: 'staff.manage', description: 'Gestión operativa plena', portals: ['staff'], redZone: true },
  { id: 'system.admin', description: 'Admin sistema (owner-weighted)', portals: ['staff'], redZone: true },
  {
    id: 'system.featureflags.override',
    description: 'Override flags (future)',
    portals: ['staff'],
    redZone: true,
  },
  { id: 'guest.browse.public', description: 'Browse público', portals: ['client'] },
  {
    id: 'notifications.read.own',
    description: 'Alias agregado cross-portal',
    portals: ['client', 'artist', 'staff'],
  },
];

function parseDomain(id: string): CapabilityDomain {
  const domain = id.split('.')[0];
  return domain as CapabilityDomain;
}

function toCapabilityId(id: string): CapabilityId {
  return id as CapabilityId;
}

function buildDefinition(seed: CapabilitySeed): CapabilityDefinition {
  assertCapabilityIdFormat(seed.id);

  const definition: CapabilityDefinition = Object.freeze({
    id: toCapabilityId(seed.id),
    domain: parseDomain(seed.id),
    description: seed.description,
    portals: Object.freeze([...seed.portals]),
    redZone: seed.redZone ?? false,
  });

  return definition;
}

function buildRegistry(): ReadonlyMap<string, CapabilityDefinition> {
  const entries = CAPABILITY_SEEDS.map((seed) => {
    const definition = buildDefinition(seed);
    return [definition.id, definition] as const;
  });

  const map = new Map<string, CapabilityDefinition>(entries);
  return Object.freeze(map);
}

export const CAPABILITY_REGISTRY: ReadonlyMap<string, CapabilityDefinition> = buildRegistry();

export const CAPABILITY_COUNT = CAPABILITY_REGISTRY.size;

export function isValidCapabilityIdFormat(id: string): boolean {
  return CAPABILITY_ID_FORMAT.test(id);
}

export function assertCapabilityIdFormat(id: string): asserts id is CapabilityId {
  if (!isValidCapabilityIdFormat(id)) {
    throw new PermissionError(
      'PERM_INVALID_CAPABILITY_ID',
      `Invalid capability id format: "${id}"`,
    );
  }
}

export function isRegisteredCapability(id: string): id is CapabilityId {
  if (!isValidCapabilityIdFormat(id)) {
    return false;
  }
  return CAPABILITY_REGISTRY.has(id);
}

export function getCapabilityDefinition(id: string): CapabilityDefinition | undefined {
  if (!isRegisteredCapability(id)) {
    return undefined;
  }
  return CAPABILITY_REGISTRY.get(id);
}

export function assertCapabilityRegistered(id: string): CapabilityDefinition {
  assertCapabilityIdFormat(id);

  const definition = CAPABILITY_REGISTRY.get(id);
  if (!definition) {
    throw new PermissionError(
      'PERM_CAPABILITY_NOT_REGISTERED',
      `Capability not registered: "${id}"`,
    );
  }

  return definition;
}

/** Deny-default: unregistered capability → false. */
export function capabilityAllowedOnPortal(
  id: string,
  portal: PermissionPortalId,
): boolean {
  const definition = getCapabilityDefinition(id);
  if (!definition) {
    return false;
  }
  return definition.portals.includes(portal);
}

export function assertCapabilityAllowedOnPortal(
  id: string,
  portal: PermissionPortalId,
): CapabilityDefinition {
  const definition = assertCapabilityRegistered(id);
  if (!definition.portals.includes(portal)) {
    throw new PermissionError(
      'PERM_PORTAL_NOT_ALLOWED',
      `Capability "${id}" is not allowed on portal "${portal}"`,
    );
  }
  return definition;
}

export function listCapabilitiesByDomain(
  domain: CapabilityDomain,
): readonly CapabilityDefinition[] {
  const matches = [...CAPABILITY_REGISTRY.values()].filter(
    (definition) => definition.domain === domain,
  );
  return Object.freeze(matches);
}

export function listAllCapabilities(): readonly CapabilityDefinition[] {
  return Object.freeze([...CAPABILITY_REGISTRY.values()]);
}

export function listCapabilityDomains(): readonly CapabilityDomain[] {
  const domains = new Set<CapabilityDomain>();
  for (const definition of CAPABILITY_REGISTRY.values()) {
    domains.add(definition.domain);
  }
  return Object.freeze([...domains].sort());
}
