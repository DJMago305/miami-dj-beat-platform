# PERMISSIONS-SPEC.md

**TICKET-V2-SHARED-CORE-004 — Permissions Specification**

**Módulo:** MOD-003 Permissions  
**Ticket:** TICKET-V2-SHARED-CORE-004  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Fuente de verdad operativa: snapshot DB (equivalente `mdj_access_snapshot`) + matriz capability.  
> **Nunca** JWT `app_metadata.role` solo.

---

## 1. Objetivo

Definir el **Sistema de Permisos V2** del Shared Core: roles, capabilities, matriz, reglas de acceso y flujo hasta módulos de portal.

Implementación runtime → ticket posterior (005+). Este ticket es **solo arquitectura y contratos**.

---

## 2. Modelo oficial de Roles

Roles son **etiquetas de snapshot** derivadas de perfiles DB. Un usuario puede tener contextos distintos por portal, pero **capabilities** resuelven acceso — no preguntas directas al rol en módulos.

| ID | Rol | Principal | MDJB | Portal home | Notas |
|----|-----|-----------|------|-------------|-------|
| R-00 | **Guest** | — | — | client (browse) | Sin sesión |
| R-01 | **Buyer** | buyer | C | client | `client_profiles` |
| R-02 | **Artist Lite** | performer | A | artist | tier 0 |
| R-03 | **Artist Pro** | performer | A | artist | tier 1 · SFT eligible |
| R-04 | **Artist Elite** | performer | A | artist | tier 2 |
| R-05 | **Seller** | staff | S | staff | `is_staff()` · limited write |
| R-06 | **Manager** | staff | M | staff | `is_staff_management()` |
| R-07 | **Admin** | staff | M | staff | management pleno |
| R-08 | **Owner** | staff | M | staff | management pleno + owner flags |

**Total roles documentados:** 9 (+ Guest = **10** roles en matriz)

### Reglas de rol

- Rol **no** autoriza directamente en UI/modules — solo vía **capabilities** asignadas al rol en `ROLE-MATRIX.md`
- Artist tier se compone: Lite ⊂ Pro ⊂ Elite (inheritance)
- Staff Seller ⊄ management writes; Manager/Admin/Owner comparten management capabilities salvo ADR owner-only

---

## 3. Modelo de Capabilities

Capabilities son **strings namespaced** `domain.resource.action[.scope]`.

### Principios

| Principio | Regla |
|-----------|-------|
| Independencia parcial del rol | Misma capability puede otorgarse por rol + override + subscription flag |
| Composición | Artist Pro = Lite capabilities + `artist.sft.use` + extras |
| Portal binding | Capability válida solo en portal(s) declarados en catálogo |
| Deny default | Capability ausente → deny |

### Formato

```
{domain}.{resource}.{action}[.{scope}]
```

Ejemplos: `orders.read`, `artist.profile.edit.own`, `staff.invoices.write`

Ver catálogo completo: **CAPABILITY-CATALOG.md** (**51 capabilities** documentadas).

---

## 4. ROLE MATRIX

Matriz completa rol → capabilities: **ROLE-MATRIX.md**

Resumen por banda:

| Rol | Capabilities (count) |
|-----|----------------------|
| Guest | 3 |
| Buyer | 12 |
| Artist Lite | 14 |
| Artist Pro | 22 |
| Artist Elite | 24 |
| Seller | 18 |
| Manager | 35 |
| Admin | 38 |
| Owner | 40 |

---

## 5. ACCESS RULES

Detalle: **ACCESS-RULES.md**

| Regla | Resumen |
|-------|---------|
| Deny-by-default | Sin capability → deny |
| Least privilege | Mínimo set por rol |
| Inheritance | Lite → Pro → Elite; staff base → management |
| Override | Snapshot flags / PO ADR |
| Temporary | Time-boxed grants (future) |
| Custom | Post-MVP; ADR required |

---

## 6. PERMISSION FLOW

```
Login (Auth MOD-001)
        ↓
Session (MOD-002) — userId, portal context
        ↓
Access Snapshot fetch (Permissions MOD-003)
        ↓
Role resolution → capability set (ROLE-MATRIX + overrides)
        ↓
Portal shell — filter nav by capabilities
        ↓
Navigation — surface-ready; hide deny routes
        ↓
Modules — guard each action: hasCapability('orders.write')?
```

### Eventos relacionados (Event Bus 003)

- `SESSION_CREATED` → trigger snapshot load
- `ROLE_CHANGED` / `PERMISSION_CHANGED` → invalidate capability cache
- `PORTAL_READY` → nav filtered post-capabilities

### Guard API (conceptual, sin código)

```
can(user, capability, context?) → allow | deny + reasonCode
```

**Prohibido en módulos:**

```text
if (role === 'Owner')  // ❌
if (can('staff.manage'))  // ✅
```

---

## 7. PORTAL RESTRICTIONS

### Cliente (Buyer / Guest)

| Puede ver | No puede ver |
|-----------|--------------|
| Shop browse (guest limited) | Owner strip, STAFF |
| Own orders, profile, VIP | Artist dashboard, CRM |
| Checkout (buyer session) | Staff invoices, leads |
| Notifications own | `staff.*`, `artist.*` write others |

### Artista (Lite / Pro / Elite)

| Puede ver | No puede ver |
|-----------|--------------|
| Profile, agenda, jobs (caps) | Staff admin home |
| Cash Flow (own), DJ Tools | Client checkout as home |
| SFT (Pro+ + capability) | `staff.invoices.*`, CRM write |
| Academia artist | Seller limited staff views |

### Staff (Seller / Manager / Admin / Owner)

| Puede ver | No puede ver |
|-----------|--------------|
| Staff shell post gate | Artist profile editor as default |
| CRM/Leads (per cap) | Client shop checkout home |
| Production, matching (management) | SoundForTips artist console |
| Invoices/payments (management) | Seller: management writes hidden |

**Owner** vs **Admin**: mismas capabilities base management; owner-only caps flagged in catalog (`system.admin`, future owner flags) — ver ROLE-MATRIX.

### Non-staff en Staff portal

→ **deny all** + `PERM_STAFF_GATE_FAILED` + forced logout (Constitución V1 parity).

---

## 8. REGLAS (capability-first)

| # | Regla |
|---|-------|
| P-01 | Módulos **nunca** preguntan «¿Es Owner?» — preguntan `hasCapability(...)` |
| P-02 | Eliminar dependencia directa de roles en lógica de módulo |
| P-03 | UI puede mostrar badge rol; **gates** usan capabilities |
| P-04 | Red zone (`payments.write`, `crm.delete`, `staff.invoices.write`) — capability + RLS |
| P-05 | SFT: `artist.sft.use` + subscription flag en snapshot — no rol genérico |
| P-06 | VIP buyer: `client.vip.benefits` — no confundir con artist PRO |
| P-07 | Snapshot stale → deny protected; refresh on PERMISSION_CHANGED |
| P-08 | Nuevas capabilities → CAPABILITY-CATALOG + ROLE-MATRIX + ADR si cross-portal |

---

## Snapshot (conceptual)

| Campo | Uso |
|-------|-----|
| `userId` | Identidad |
| `mdjbId` | MDJB-XXXX-XXXX-C\|A\|S\|M |
| `roles[]` | Roles resueltos |
| `capabilities[]` | Set efectivo post-matriz + overrides |
| `snapshotVersion` | Invalidación |
| `flags` | `isStaff`, `isStaffManagement`, `artistTier`, `clientVip`, `sftOk` |

---

## Dependencias

| Permitido | Prohibido |
|-----------|-----------|
| `../config/`, `../logging/`, `../errors/` | Portales |
| Event Bus (listen PERMISSION_CHANGED) | Supabase en este ticket |
| Contrato §3 CONTRACTS.md | V1 `web/` |

---

## Referencias

- `ROLE-MATRIX.md`
- `CAPABILITY-CATALOG.md`
- `ACCESS-RULES.md`
- `../CONTRACTS.md` §3
- `../events/EVENT-BUS-SPEC.md`

---

*Permissions Spec v1.0 — TICKET-V2-SHARED-CORE-004 — Sin implementación.*
