/** LC-11 — Legal read access context */

export type LegalReadAccessContext = {
  readonly actorType: 'staff' | 'artist' | 'client' | 'system';
  readonly actorId: string;
  readonly role: 'owner' | 'manager' | 'seller' | 'artist' | 'client' | 'system';
  readonly portal: 'staff' | 'artist' | 'client' | 'system';
  readonly recipientScope?: string;
};

export function canReadFiscalLegalData(context: LegalReadAccessContext): boolean {
  if (context.portal === 'client') {
    return false;
  }
  if (context.portal === 'staff' && context.role === 'seller') {
    return false;
  }
  return context.portal === 'staff' || context.portal === 'artist';
}

export function canReadFullAuditTrail(context: LegalReadAccessContext): boolean {
  return context.portal === 'staff' && (context.role === 'owner' || context.role === 'manager');
}

export function canReadDeletedSubmissions(context: LegalReadAccessContext): boolean {
  return context.portal === 'staff' && context.role === 'owner';
}

export function canReadW9TemplateCatalog(context: LegalReadAccessContext): boolean {
  if (context.portal === 'client') {
    return false;
  }
  if (context.portal === 'staff' && context.role === 'seller') {
    return false;
  }
  return true;
}

export function matchesRecipientScope(
  context: LegalReadAccessContext,
  recipientId: string,
): boolean {
  if (context.portal === 'staff') {
    return context.role === 'owner' || context.role === 'manager';
  }
  if (context.portal === 'artist') {
    return context.actorId === recipientId || context.recipientScope === recipientId;
  }
  return false;
}

export function createStaffOwnerReadContext(actorId = 'STAFF-OWNER-001'): LegalReadAccessContext {
  return Object.freeze({
    actorType: 'staff',
    actorId,
    role: 'owner',
    portal: 'staff',
  });
}

export function createStaffManagerReadContext(actorId = 'STAFF-MANAGER-001'): LegalReadAccessContext {
  return Object.freeze({
    actorType: 'staff',
    actorId,
    role: 'manager',
    portal: 'staff',
  });
}

export function createStaffSellerReadContext(actorId = 'STAFF-SELLER-001'): LegalReadAccessContext {
  return Object.freeze({
    actorType: 'staff',
    actorId,
    role: 'seller',
    portal: 'staff',
  });
}

export function createArtistReadContext(
  actorId: string,
  recipientScope?: string,
): LegalReadAccessContext {
  return Object.freeze({
    actorType: 'artist',
    actorId,
    role: 'artist',
    portal: 'artist',
    recipientScope: recipientScope ?? actorId,
  });
}

export function createClientReadContext(actorId = 'CLI-001'): LegalReadAccessContext {
  return Object.freeze({
    actorType: 'client',
    actorId,
    role: 'client',
    portal: 'client',
  });
}
