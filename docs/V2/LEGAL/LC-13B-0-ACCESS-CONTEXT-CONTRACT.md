# LC-13B-0 — Access Context Contract

**Ticket:** TICKET-V2-LEGAL-CENTER-LC-13B-0-IDENTITY-BRIDGE-DISCOVERY-AND-CONTRACT-001
**Status:** Discovery contract only — no TypeScript interfaces implemented

---

## Target type (existing — LC-11)

Source: `MiamiDJBeat-MigracionV2/shared/services/legal/persistence/legal-read-access-context.ts`

```typescript
LegalReadAccessContext = {
  actorType: 'staff' | 'artist' | 'client' | 'system';
  actorId: string;
  role: 'owner' | 'manager' | 'seller' | 'artist' | 'client' | 'system';
  portal: 'staff' | 'artist' | 'client' | 'system';
  recipientScope?: string;
}
```

**LC-13B-0 does not extend this type.** Bridge must populate it from server-side sources.

---

## Bridge input bundle (conceptual — not implemented)

| Field | Source | Classification |
|-------|--------|----------------|
| `auth_user_id` | `session.user.userId` (= `auth.uid()`) | **Obligatorio** |
| `session_id` | `session.sessionId` | Opcional (audit correlation) |
| `portal_shell` | `session.portal` | **Derivado UX** — not authority alone |
| `documented_role` | `PermissionSnapshot.documentedRole` | **Obligatorio** when authenticated |
| `profile_kind` | `PermissionSnapshot.profile.kind` | **Obligatorio** |
| `profile_id` | `PermissionSnapshot.profile.profileId` | Opcional (permissions layer) |
| `mdjb_id` | `session.user.mdjbId` | Opcional (correlation) |
| `legal_profile_id` | **Future lookup** RPC/DB | **Obligatorio** for artist/client reads |
| `recipient_ids[]` | Derived from legal profile + ownership | **Derivado** |
| `capabilities[]` | `PermissionSnapshot.capabilities` | Opcional (pre-gate) |
| `snapshot_flags` | `MdjAccessSnapshotPayload.flags` | Opcional |

---

## Field evaluation (requested LC-13B-0 analysis)

| Evaluated field | Maps to LegalReadAccessContext? | Classification |
|-----------------|--------------------------------|----------------|
| `user_id` | Indirect → `actorId` (staff uses auth uid or staff actor id policy) | Derivado — **decisión PO LC-13B** |
| `auth_user_id` | Input only | Obligatorio input |
| `portal` | `portal` | Obligatorio — from **effective** portal, not URL alone |
| `role` | `role` (short form) | Obligatorio — mapped from `documented_role` |
| `staff_role` | Maps to `role` when `actorType=staff` | Derivado |
| `artist_profile_id` | `actorId` + `recipientScope` for artist | Obligatorio lookup — **ausente hoy** |
| `client_profile_id` | `actorId` for client | Obligatorio lookup — **ausente hoy** |
| `ownership_ids` | `recipientScope` / internal | Derivado |
| `permissions` | Pre-check only; legal uses guard fns | Opcional |
| `is_staff` | Derive `actorType=staff` | Derivado from snapshot |
| `is_owner` | `role=owner` | Derivado |
| `is_manager` | `role=manager` | Derivado |
| `is_seller` | `role=seller` | Derivado |
| `is_artist` | `actorType=artist` | Derivado |
| `is_client` | `actorType=client` | Derivado |

**Rule:** Do not add boolean flags to `LegalReadAccessContext`. Derive from `role` + `actorType` + existing guard functions.

---

## Role namespace mapping (canonical)

| DocumentedRoleId (Session) | LegalReadAccessContext.role | LegalReadAccessContext.actorType | LegalReadAccessContext.portal |
|----------------------------|----------------------------|----------------------------------|-------------------------------|
| `staff_owner` | `owner` | `staff` | `staff` |
| `staff_manager` | `manager` | `staff` | `staff` |
| `staff_seller` | `seller` | `staff` | `staff` |
| `artist_lite` / `artist_pro` / `artist_elite` | `artist` | `artist` | `artist` |
| `client_regular` / `client_vip` | `client` | `client` | `client` |
| `guest` | — | — | Bridge fails `identity_unavailable` |

**V1 Postgres `dj_profiles.role`:** `owner|admin|manager|seller` — resolved via `mdj_access_snapshot`, not read directly in V2 bridge.

---

## actorId semantics (critical contract)

| actorType | `actorId` MUST be | MUST NOT be |
|-----------|-------------------|-------------|
| `staff` | Stable staff actor ID for audit (policy: auth uid OR staff business ID — **PO decision LC-13B**) | Client-supplied string |
| `artist` | **Legal recipient business ID** (`ART-*` domain) matching DB row | Raw `auth.uid()` alone |
| `client` | **Legal recipient business ID** (`CLI-*`) | Raw `auth.uid()` alone |
| `system` | Service identifier | Browser session |

**`recipientScope`:** For artist, set to own legal profile/recipient ID. Used by `matchesRecipientScope()`.

---

## Bridge output invariants

1. `actorType` and `portal` are consistent (staff→staff, artist→artist, client→client).
2. `role` matches mapped `documented_role` — never from URL preview.
3. For artist/client self-read: `actorId === recipientScope` (unless explicit staff cross-read).
4. Staff seller: fiscal guards return false — bridge still produces valid context.
5. Missing legal profile for authenticated artist/client → `profile_missing` error, not guest fallback.
6. Ambiguous multi-profile → `identity_ambiguous` — no silent pick-first.
7. Portal shell mismatch (e.g. seller session on artist portal) → `portal_mismatch` or reduced capability — **PO decision**.

---

## Related types (bridge must also feed — future unified module)

| Type | Path | Mapping note |
|------|------|--------------|
| `LegalWorkflowActor` | `workflows/legal-w9-workflow-actor.ts` | Subset: staff short roles + `actorId` |
| `LegalViewerContext` | `in-memory/legal-access-policy.ts` | `LegalViewerRole` uses `staff_*` prefix; needs `subjectProfileId` param |
| `LegalAuditActor` | `audit/legal-audit-permissions.ts` | Via `mapWorkflowActorToAuditActor()` today |

**LC-13B-0 recommendation:** Single resolver produces all three from one snapshot + lookup bundle.

---

## Error → HTTP/RPC mapping (conceptual)

| Bridge error | Legal persistence analog | User-visible class |
|--------------|-------------------------|-------------------|
| `identity_unavailable` | `persistence_identity_unavailable` | Unauthorized |
| `identity_ambiguous` | `persistence_identity_unavailable` | Forbidden |
| `role_unresolved` | `persistence_role_unresolved` | Forbidden |
| `profile_missing` | `persistence_identity_unavailable` | Unauthorized |
| `ownership_missing` | `persistence_access_forbidden` | Not found |
| `portal_mismatch` | `persistence_access_forbidden` | Forbidden |
| `session_expired` | `persistence_identity_unavailable` | Unauthorized |
| `contract_violation` | `persistence_contract_violation` | Forbidden |

---

## What bridge does NOT do

- Parse JWT claims for roles
- Read `previewRole` query param
- Trust `recipient_id` from RPC params
- Cache role in localStorage
- Bypass `mdj_access_snapshot` for staff band
- Create second identity system parallel to Session MOD-002
