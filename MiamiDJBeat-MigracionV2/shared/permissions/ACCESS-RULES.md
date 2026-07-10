# ACCESS-RULES.md

**TICKET-V2-SHARED-CORE-004 — Permissions Specification**

**Módulo:** MOD-003 · Reglas de acceso  
**Versión:** 1.0

---

## 1. Deny-by-default

| Situación | Resultado |
|-----------|-----------|
| Capability no en snapshot | **DENY** |
| Capability no en catálogo | **DENY** |
| Snapshot no cargado | **DENY** acciones protegidas |
| Portal incorrecto para capability | **DENY** |
| Acción no mapeada a capability | **DENY** (fail closed) |

Guest: solo capabilities `guest.*` y `artist.profile.read.public` explícitas.

---

## 2. Least privilege

- Cada rol recibe el **mínimo** set en ROLE-MATRIX
- Seller: read CRM/leads/invoices; **sin** write management salvo ADR
- Artist Lite: sin SFT, sin analytics
- Elevación temporal requiere ticket + audit

Principio: preferir capability granular (`orders.read`) sobre bloques amplios (`staff.manage`) en checks de módulo — usar `staff.manage` solo en gates de sección, no en cada botón.

---

## 3. Inheritance

### Artist tiers

```
Artist Lite (base performer caps)
    └── + Artist Pro (+ sft, analytics)
            └── + Artist Elite (+ future elite-only caps)
```

Implementación conceptual: resolver capabilities = union(Lite, Pro extras, Elite extras) según `artistTier` en snapshot — **no** herencia OOP en código portal.

### Staff hierarchy

```
Seller (staff read subset)
    └── Manager (+ management writes)
            └── Admin (+ system.admin)
                    └── Owner (+ featureflags.override)
```

`is_staff_management()` en snapshot activa banda Manager+.

---

## 4. Override

Overrides modifican snapshot **después** de matriz rol:

| Override source | Ejemplo |
|-----------------|---------|
| Snapshot flag | `clientVip` → `client.vip.benefits` |
| Subscription | `sftOk` + Pro tier → `artist.sft.use` |
| PO grant | Temporary capability (future) |
| ADR | Nueva capability cross-role |

Orden resolución:

```
1. Deny-by-default
2. ROLE-MATRIX base
3. Tier inheritance merge
4. Snapshot flags
5. Temporary grants (expiry check)
6. Explicit deny override (rare, ADR)
```

---

## 5. Temporary permissions

**Estado:** Especificado · **Implementación:** post-MVP (ticket futuro)

| Campo | Descripción |
|-------|-------------|
| `capability` | ID catálogo |
| `grantedTo` | userId |
| `grantedBy` | staff userId management |
| `expiresAt` | ISO 8601 |
| `reason` | ticket ref |

Reglas:

- Expiradas → auto revoke; emit `PERMISSION_CHANGED`
- No temporary en red zone sin PO + audit
- Max TTL documentado por ADR (default 24h ops)

---

## 6. Future custom permissions

**Estado:** Reservado

- Custom roles **no** en V2 MVP — capabilities fijas en catálogo
- Custom = nueva capability + matriz + ADR
- Prohibido runtime string capabilities no catalogadas
- UI staff roles (MOD-315) administra asignación **dentro** de catálogo fijo

---

## 7. Portal enforcement

| Portal | Gate entrada |
|--------|--------------|
| client | `client.*` o guest browse |
| artist | `artist.*` performer snapshot |
| staff | `staff.dashboard.access` + staff snapshot; else logout |

Cross-portal link: destino revalida capabilities en portal target.

---

## 8. UI vs enforcement

| Capa | Comportamiento |
|------|----------------|
| UI | Ocultar/deshabilitar si !capability (portal decide UX) |
| Guard | **DENY** si !capability — fuente de verdad |
| RLS | Server-side — fu fuera de este módulo pero obligatorio red zone |

UI hide **no** sustituye guard.

---

## 9. Contradicciones JWT vs snapshot

- Snapshot DB **gana** sobre JWT claims
- Log `PERM_SNAPSHOT_CONTRADICTION`
- Emit `PERMISSION_CHANGED` tras refresh
- No elevar privilegios desde cliente

---

## 10. Regla capability-first (refuerzo)

```text
PROHIBIDO: if (role === 'Owner')
PROHIBIDO: if (isOwner)
REQUERIDO: if (hasCapability('staff.invoices.write'))
```

Roles solo en: badges, audit logs, support tools — **no** en module gates.

---

*ACCESS-RULES v1.0 — TICKET-V2-SHARED-CORE-004*
