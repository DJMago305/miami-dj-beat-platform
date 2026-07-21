/** LC-7 — W-9 workflow actor context */

export type LegalWorkflowActor = {
  readonly portal: 'staff' | 'artist' | 'client';
  readonly role?: 'owner' | 'manager' | 'seller';
  readonly actorId: string;
};

export function canActorCreateW9Request(actor: LegalWorkflowActor): boolean {
  return actor.portal === 'staff' && (actor.role === 'owner' || actor.role === 'manager');
}

export function canActorListW9Requests(actor: LegalWorkflowActor): boolean {
  if (actor.portal === 'client') {
    return false;
  }
  if (actor.portal === 'staff' && actor.role === 'seller') {
    return false;
  }
  return true;
}

export function canActorAccessW9Request(
  actor: LegalWorkflowActor,
  recipientType: string,
  recipientId: string,
): boolean {
  if (!canActorListW9Requests(actor)) {
    return false;
  }
  if (actor.portal === 'staff') {
    return actor.role === 'owner' || actor.role === 'manager';
  }
  if (actor.portal === 'artist') {
    return recipientType === 'artist' && recipientId === actor.actorId;
  }
  return false;
}
