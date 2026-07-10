# AUTH-SPEC.md

**TICKET-V2-SHARED-CORE-012 — Authentication Specification**

**Módulo:** MOD-001 Authentication  
**Ticket:** TICKET-V2-SHARED-CORE-012  
**Versión:** 1.0  
**Estado:** Especificación oficial — **sin implementación**

> Auth **identifica** al usuario. Session **administra** estado. Permissions **decide** capacidades.

---

## 1. Propósito

Proveer la capa de **identidad** del Shared Core V2: sign-in, sign-out, restore y refresh ante un proveedor futuro — **sin** UI de portal, **sin** permisos de negocio, **sin** Supabase en este ticket.

---

## 2. Scope

| Incluye | Descripción |
|---------|-------------|
| Identidad usuario | Validar credenciales / provider |
| AuthHandle | Entrega opaca a Session |
| IdentitySnapshot | Metadatos identidad permitidos |
| Lifecycle | 12 estados — ver AUTH-LIFECYCLE.md |
| Provider contract | Conceptual — AUTH-PROVIDER-CONTRACT.md |
| Eventos | `USER_LOGIN`, `USER_LOGOUT` vía Event Bus |
| Errores | ERR-AUTH-xxx → Error Handling |

---

## 3. Non-scope

| Excluye | Responsable |
|---------|-------------|
| Permisos / roles / capabilities | Permissions MOD-003 |
| Estado sesión runtime | Session MOD-002 |
| HTTP/RPC egress | API Client MOD-005 |
| UI login / redirect portal | Portales |
| RLS / profiles SQL | Backend tickets |
| Notificaciones toast | Notifications vía Error Handling |
| Persistencia refresh plain | Storage ADR + Auth rules |

---

## 4. Responsabilidades

| Hace | No hace |
|------|---------|
| signIn / signOut / restore / refresh (conceptual) | `hasCapability()` |
| Normaliza identidad → AuthHandle | Lee role matrix |
| Emite USER_LOGIN / USER_LOGOUT | Persiste `capabilities[]` |
| Delega handoff a Session | Usa `app_metadata.role` como autoridad |
| Mapea fallos → ERR-AUTH-* | Renderiza HTML |
| Lee config (URLs, provider ref) | Elige dashboard destino |

---

## 5. Límites del módulo

```
Portal UI → Auth facade (signIn request)
Auth → Provider (futuro) → AuthHandle
Auth → Session.ingestAuthHandle(handle)
Session → Permissions (capabilities fetch)
Permissions → Session snapshot merge
```

Auth **termina** en identidad confirmada + handoff. No participa en gates staff ni nav.

---

## 6. Dependencias permitidas

| Módulo | Uso |
|--------|-----|
| Configuration MOD-006 | provider URL, redirect refs |
| Logging MOD-010 | eventos redactados |
| Error Handling MOD-014 | normalize ERR-AUTH-* |
| Event Bus MOD-004 | emit USER_LOGIN / USER_LOGOUT |
| Storage MOD-012 | **no** write directo — Session owns Session ns |

---

## 7. Dependencias prohibidas

| Prohibido | Motivo |
|-----------|--------|
| Permissions import | Auth no decide acceso |
| Portales | UI fuera de Core |
| `web/` V1 | Lab aislado |
| API Client directo en sign-in | Provider adapter futuro encapsula |
| Components | No UI |
| Notifications direct | vía Errors |
| Supabase SDK (este ticket) | Spec only |

---

## 8. Relación con Session Manager

Auth entrega **AuthHandle** + **IdentitySnapshot**; Session acepta o rechaza handoff.

Ver **AUTH-SESSION-BOUNDARY.md**. Session expone `ingestAuthHandle`, `requestLogout`. Auth **no** importa Session implementation circularmente — contrato + Event Bus.

---

## 9. Relación con Permissions

**Ninguna directa.** Auth no conoce capabilities. Tras handoff exitoso, Session solicita snapshot Permissions por contrato existente (SESSION-SPEC §10).

---

## 10. Relación con API Client

Futuro: provider adapter **puede** usar API Client para Edge/OAuth — Auth module no expone HTTP. Sign-in **no** bypass API Client para egress Core.

---

## 11. Relación con Storage

Auth **no** escribe Storage directamente. Session persiste `auth_ref` opaco vía Storage facade (SESSION-STORAGE.md). Auth no guarda refresh token plain en localStorage.

---

## 12. Relación con Event Bus

| Evento | Emisor | Cuándo |
|--------|--------|--------|
| `USER_LOGIN` | Auth | Identidad confirmada pre-handoff |
| `USER_LOGOUT` | Auth / Session coord | signOut complete |

Payload mínimo `{ userId }` — sin tokens.

---

## 13. Relación con Error Handling

Todo fallo Auth → `ErrorHandling.normalizeAuthError()` → ERR-0100 band o ERR-AUTH catalog local → `userMessageKey` i18n.

Ver **AUTH-ERRORS.md**. Auth no muestra UI de error.

---

## 14. Datos permitidos

| Dato | Uso |
|------|-----|
| userId (UUID) | IdentitySnapshot |
| email | IdentitySnapshot (redact log) |
| display_name | IdentitySnapshot |
| avatar_url | IdentitySnapshot |
| auth_provider | enum conceptual |
| email_verified | boolean |
| created_at / last_sign_in_at | ISO |
| auth_status | enum lifecycle |
| accessTokenRef / refreshTokenRef | **opaque refs only** |

---

## 15. Datos prohibidos

Password · refresh_token plain · service_role · provider secrets · payment data · capabilities[] · role matrix · portal destination · JWT raw in logs · SQL · stack traces · app_metadata.role as authority

---

## 16. Reglas obligatorias

| # | Regla |
|---|-------|
| A-01 | Auth **no decide permisos** |
| A-02 | Auth **no ejecuta** `hasCapability()` |
| A-03 | Auth **no lee** role matrix |
| A-04 | Auth **no persiste** `capabilities[]` |
| A-05 | Auth **no usa** `app_metadata.role` como autoridad final |
| A-06 | Auth **no guarda** refresh token plain |
| A-07 | Auth **no loguea** tokens |
| A-08 | Auth **no renderiza** portal |
| A-09 | Auth **no selecciona** dashboard |
| A-10 | Auth entrega handle/snapshot identidad a Session |
| A-11 | Permissions hace **propio** fetch/snapshot |
| A-12 | Todo error Auth → Error Handling |
| A-13 | INITIAL_SESSION vs SIGNED_IN — Auth coordina con Session (no redirect prematuro) |
| A-14 | Staff gate failure → forced signOut — Permissions emite, Auth ejecuta signOut |

---

## 17. Anti-patterns prohibidos

| Anti-pattern | Por qué |
|--------------|---------|
| Auth checks `isOwner()` | → Permissions |
| Auth redirects to admin-dashboard | → Portal shell post SESSION_READY |
| Auth reads JWT claims for role | → Permissions snapshot |
| Auth calls Supabase from portal | → API Client + Auth adapter |
| Auth + Session circular import | → Event Bus + facade |
| Copy `web/auth.js` without ADR | V1 isolation |
| Log Authorization header | Security |

---

## 18. Criterios de aceptación documental

| # | Criterio |
|---|----------|
| D-01 | AUTH-SPEC, LIFECYCLE, PROVIDER-CONTRACT, SESSION-BOUNDARY, ERRORS exist |
| D-02 | 12 lifecycle states documented with transition table |
| D-03 | IdentitySnapshot allow/deny lists complete |
| D-04 | 10 ERR-AUTH codes cataloged |
| D-05 | Zero code / zero V1 / zero Supabase implementation |
| D-06 | README + progress + nota diaria + catalog updated |
| D-07 | Aligns CONTRACTS.md §1 without modifying CONTRACTS in this ticket |

---

## Referencias

- `AUTH-LIFECYCLE.md`
- `AUTH-PROVIDER-CONTRACT.md`
- `AUTH-SESSION-BOUNDARY.md`
- `AUTH-ERRORS.md`
- `../session/SESSION-SPEC.md` §10
- `../CONTRACTS.md` §1

---

*AUTH-SPEC v1.0 — TICKET-V2-SHARED-CORE-012*
