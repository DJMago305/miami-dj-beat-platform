# EVENT-BUS-SPEC.md

**TICKET-V2-SHARED-CORE-003 — Event Bus Specification**

**Módulo:** MOD-004 Event Bus  
**Ticket:** TICKET-V2-SHARED-CORE-003  
**Versión spec:** 1.1 · Reconciliado **PHASE-DOC-RECONCILIATION-001**  
**Estado:** Especificación oficial — **sin código ejecutable**

> Primer módulo funcional **especificado** de MiamiDJBeat-MigracionV2.  
> Implementación runtime → TICKET-V2-SHARED-CORE-005+ (pendiente PO).

---

## 1. Formato oficial de un evento

Todo evento V2 **debe** conformarse a este envelope:

| Campo | Tipo | Req | Descripción |
|-------|------|-----|-------------|
| `name` | string | ✅ | `UPPER_SNAKE`; ver EVENT-NAMING-STANDARD.md |
| `version` | integer | ✅ | Schema payload; inicia en `1` |
| `timestamp` | ISO 8601 UTC | ✅ | Momento de emisión |
| `emitter` | object | ✅ | `{ moduleId, subsystem? }` — MOD-xxx |
| `scope` | enum | ✅ | `internal` \| `public` |
| `payload` | object | ✅ | Datos del evento; schema por `name`+`version` |
| `correlationId` | string | ○ | Trazabilidad cross-module |
| `meta` | object | ○ | `{ portal?, userId?, env? }` — sin secrets |

**Ejemplo conceptual (no código):**

```
{
  "name": "ORDER_UPDATED",
  "version": 1,
  "timestamp": "2026-07-05T18:00:00.000Z",
  "emitter": { "moduleId": "MOD-409", "subsystem": "orders" },
  "scope": "public",
  "payload": { "orderId": "…", "status": "confirmed" },
  "correlationId": "corr-…",
  "meta": { "portal": "client" }
}
```

---

## 2. Estados (ciclo de vida del bus)

Estados del **subsistema Event Bus**, no del dominio de negocio:

| Estado | Descripción |
|--------|-------------|
| `BUS_UNINITIALIZED` | Bus no registrado; emits rechazados |
| `BUS_READY` | Catálogo cargado; acepta emit/subscribe |
| `BUS_SUSPENDED` | Solo emits críticos (`SYSTEM_ERROR`) |
| `BUS_SHUTDOWN` | Teardown; no nuevos subscribes |

Transición boot: `UNINITIALIZED → READY` emite `SYSTEM_READY`.

---

## 3. Payload

### Reglas globales

| Regla | Detalle |
|-------|---------|
| Serializable | JSON-safe únicamente |
| Sin referencias | No DOM, functions, class instances |
| Sin secrets | No tokens, passwords, service keys |
| Tamaño | Default máx 64 KB por evento |
| PII | Mínima necesaria; ids opacos preferidos |
| Vacío | `{}` permitido si el nombre implica señal pura |

### Payload por evento

Cada entrada del catálogo define campos requeridos/opcionales. Cambio breaking → increment `version` + ADR.

---

## 4. Versionado

| Regla | Acción |
|-------|--------|
| Compatible | Mismo `name`, mismos campos req → misma `version` |
| Additive | Nuevos campos opcionales → misma `version` |
| Breaking | Renombrar/eliminar/required new → `version++` |
| Deprecación | Evento marcado `deprecated` en catálogo; listeners migran antes de cutover |
| Registro | Cambios en este file + ADR si afecta portales |

Listeners declaran `{ name, version }` soportados.

---

## 5. Reglas de nombres

Ver **EVENT-NAMING-STANDARD.md**. Resumen:

- `UPPER_SNAKE`
- Verbo o sustantivo en pasado/participio para hechos (`CREATED`, `UPDATED`, `READY`)
- Prefijos de dominio implícitos en nombre (`ORDER_`, `PAYMENT_`, `SESSION_`)
- Prohibido prefijo `V1_`, nombres genéricos `UPDATE`, `CHANGE` sin dominio

---

## 6. Reglas de publicación (emit)

| # | Regla |
|---|-------|
| P-01 | Solo módulos catalogados como **emisor autorizado** |
| P-02 | Evento debe existir en catálogo antes del primer emit en runtime |
| P-03 | `timestamp` generado en emit |
| P-04 | `scope: internal` no expone payload a portales directamente |
| P-05 | Surface-ready (`PORTAL_READY`, `DASHBOARD_READY`): emit solo cuando gates cumplidos |
| P-06 | **Prohibido** emit sintético para simular poll/nav reorder |
| P-07 | Emit fallido → log `EVENT_EMIT_REJECTED`; no throw silencioso en prod |
| P-08 | Un emit `once`-eligible no re-emit same correlationId duplicate |

---

## 7. Reglas de suscripción (listen)

| # | Regla |
|---|-------|
| S-01 | Handler registrado con `{ name, version? }` |
| S-02 | Opción `once: true` para acciones únicas (nav reorder, init) |
| S-03 | Catch-up: si flag `__mdjV2Emitted[name]` antes de subscribe → ejecutar handler una vez |
| S-04 | Handler idempotente cuando `once` no aplica |
| S-05 | Handler no muta otro portal; consume payload y actúa en módulo propio |
| S-06 | Unsubscribe explícito en teardown portal |
| S-07 | Handler throw → log `EVENT_HANDLER_THROW`; no crashear bus |

---

## 8. Eventos internos

**Scope:** `internal` · Consumidores: Shared Core subsystems only.

| Evento | Emisor | Propósito |
|--------|--------|-----------|
| `SYSTEM_READY` | Event Bus / boot | Bus operativo |
| `SYSTEM_ERROR` | errors/, api/ | Fallo crítico Core |
| `SESSION_CREATED` | Session (MOD-002) | Sesión estable post-validate |
| `SESSION_REFRESH` | Session (MOD-002) | Refresh token cycle |
| `SESSION_ERROR` | Session (MOD-002) | Estado ERROR session |
| `SESSION_DESTROYED` | Session | Post logout |
| `ROLE_CHANGED` | Permissions | Cambio rol efectivo |
| `PERMISSION_CHANGED` | Permissions | Snapshot invalidado |
| `FLAGS_LOADING` | Feature Flags (MOD-013) | Boot flags |
| `FLAGS_INVALIDATED` | Feature Flags | Cache/registry invalid |
| `FLAGS_REFRESH` | Feature Flags | Reload cycle |
| `FLAGS_FALLBACK` | Feature Flags | Defaults applied |
| `FLAGS_ERROR` | Feature Flags | Unrecoverable flag error |
| `FLAGS_RELOADED` | Feature Flags | Post CONFIG_UPDATED |
| `THEME_LOAD_*`, `THEME_SWITCH_*` | Theme (MOD-007) | Lifecycle interno theme |
| `COMPONENT_REGISTRY_*` | Components (MOD-009) | Registry lifecycle |
| `RESPONSIVE_INIT_STARTED` | Responsive (MOD-016) | Init cycle |
| `VIEWPORT_RESIZED` | Responsive | Debounced resize log |
| `RESPONSIVE_ERROR` | Responsive | ERR-RESP-* surface |

No los consumen portales directamente salvo ADR; portales escuchan eventos `public` derivados si aplica.

---

## 9. Eventos públicos

**Scope:** `public` · Consumidores: portales + Shared Core.

| Evento | Emisor típico | Propósito |
|--------|---------------|-----------|
| `USER_LOGIN` | Auth | Identidad confirmada |
| `USER_LOGOUT` | Auth / Session | Sesión terminada |
| `SESSION_READY` | Session (MOD-002) | Snapshot listo — gate portal |
| `SESSION_EXPIRED` | Session (MOD-002) | Expiración confirmada |
| `ORDER_*` | Orders service | Operations Core |
| `PAYMENT_*` | Payments service | Estado pago |
| `PROFILE_UPDATED` | Profile service | Invalidar UI perfil |
| `NOTIFICATION_CREATED` | Notifications | Nueva alerta |
| `THEME_CHANGED` | Theme | Aplicar tokens |
| `LANGUAGE_CHANGED` | i18n | Re-render copy |
| `FLAGS_READY` | Feature Flags (MOD-013) | Registry estable — gate portal |
| `FLAGS_UPDATED` | Feature Flags | Flag key changed |
| `RESPONSIVE_READY` | Responsive (MOD-016) | Breakpoint authority ready |
| `BREAKPOINT_CHANGED` | Responsive | Active bp token changed |
| `ORIENTATION_CHANGED` | Responsive | portrait \| landscape |
| `PORTAL_READY` | Portal shell | Surface listo (nav/layout gates) |
| `DASHBOARD_READY` | Portal feature | Dashboard hidratado |

---

## 10. Eventos prohibidos

| Prohibición | Razón |
|-------------|-------|
| Poll timers como pseudo-eventos | C6 drift V1 |
| `DOM_MUTATED`, `NAV_POLL_TICK` | Inferencia implícita |
| Eventos con credenciales en payload | Seguridad |
| Emit cross-portal que muta DOM ajeno | Acoplamiento |
| Duplicar orden: `OWNER_STRIP_READY` + `PORTAL_READY` mismo tick sin ADR | Usar catálogo unificado |
| Eventos no registrados en catálogo | Trazabilidad |
| `V1_*` bridge events | Mezcla V1/V2 |

**Nav primario:** usar `PORTAL_READY` (payload incluye `surface: nav | shell | dashboard`).

---

## Catálogo inicial de eventos

| # | Evento | Scope | Emisor autorizado | Payload v1 (requerido) | Estado spec |
|---|--------|-------|-------------------|------------------------|-------------|
| 1 | `SYSTEM_READY` | internal | MOD-004 | `{ busVersion }` | ✅ |
| 2 | `SYSTEM_ERROR` | internal | MOD-014, MOD-005 | `{ code, message?, correlationId? }` | ✅ |
| 3 | `USER_LOGIN` | public | MOD-001 | `{ userId }` | ✅ |
| 4 | `USER_LOGOUT` | public | MOD-001, MOD-002 | `{ reason }` | ✅ |
| 5 | `SESSION_CREATED` | internal | MOD-002 | `{ userId, hydrationPhase }` | ✅ |
| 6 | `SESSION_DESTROYED` | internal | MOD-002 | `{ reason }` | ✅ |
| 7 | `ROLE_CHANGED` | internal | MOD-003 | `{ userId, role, principal }` | ✅ |
| 8 | `PERMISSION_CHANGED` | internal | MOD-003 | `{ userId, snapshotVersion }` | ✅ |
| 9 | `ORDER_CREATED` | public | MOD-409 | `{ orderId, status }` | ✅ |
| 10 | `ORDER_UPDATED` | public | MOD-409 | `{ orderId, status, changedFields? }` | ✅ |
| 11 | `ORDER_CLOSED` | public | MOD-409 | `{ orderId, closedReason? }` | ✅ |
| 12 | `PAYMENT_CREATED` | public | MOD-409 | `{ paymentId, orderId?, amount? }` | ✅ |
| 13 | `PAYMENT_COMPLETED` | public | MOD-409 | `{ paymentId, orderId?, status }` | ✅ |
| 14 | `PROFILE_UPDATED` | public | MOD-409 / services | `{ profileType, userId }` | ✅ |
| 15 | `NOTIFICATION_CREATED` | public | MOD-011 | `{ notificationId, channel?, userId? }` | ✅ |
| 16 | `THEME_CHANGED` | public | MOD-007 | `{ mode }` | ✅ |
| 17 | `LANGUAGE_CHANGED` | public | MOD-015 | `{ locale }` | ✅ |
| 18 | `PORTAL_READY` | public | Portal shells | `{ portal, surface }` | ✅ |
| 19 | `DASHBOARD_READY` | public | Portal features | `{ portal, dashboardId? }` | ✅ |

**Total catálogo base (§9 + operaciones):** 19

### Payload notes (v1)

- `USER_LOGOUT.reason`: `user` | `forced` | `staff_gate` | `expired`
- `PORTAL_READY.surface`: `shell` | `nav` | `feature`
- `PORTAL_READY.portal`: `client` | `artist` | `staff`
- `PROFILE_UPDATED.profileType`: `client` | `artist` | `staff`

---

## 11. Catálogo extendido Shared Core (tickets 014–018)

Eventos adicionales documentados en specs de módulo — **payloads autoritativos en origen** (este file no duplica campos).

| # | Evento | Scope | Emisor | Documento origen |
|---|--------|-------|--------|------------------|
| 20 | `SESSION_READY` | public | MOD-002 | `session/SESSION-SPEC.md` §6 |
| 21 | `SESSION_EXPIRED` | public | MOD-002 | `session/SESSION-SPEC.md` §6 |
| 22 | `SESSION_REFRESH` | internal | MOD-002 | `session/SESSION-SPEC.md` §6 |
| 23 | `SESSION_ERROR` | internal | MOD-002 | `session/SESSION-SPEC.md` §6 |
| 24 | `FLAGS_READY` | public | MOD-013 | `feature-flags/FLAG-EVENTS.md` |
| 25 | `FLAGS_UPDATED` | public | MOD-013 | `feature-flags/FLAG-EVENTS.md` |
| 26 | `FLAGS_LOADING` | internal | MOD-013 | `feature-flags/FLAG-EVENTS.md` |
| 27 | `FLAGS_INVALIDATED` | internal | MOD-013 | `feature-flags/FLAG-EVENTS.md` |
| 28 | `FLAGS_REFRESH` | internal | MOD-013 | `feature-flags/FLAG-EVENTS.md` |
| 29 | `FLAGS_FALLBACK` | internal | MOD-013 | `feature-flags/FLAG-EVENTS.md` |
| 30 | `FLAGS_ERROR` | internal | MOD-013 | `feature-flags/FLAG-EVENTS.md` |
| 31 | `FLAGS_RELOADED` | public | MOD-013 | `feature-flags/FLAG-EVENTS.md` |
| 32 | `THEME_LOAD_STARTED` | internal | MOD-007 | `theme/THEME-EVENTS.md` |
| 33 | `THEME_DEFAULT_RESOLVED` | internal | MOD-007 | `theme/THEME-EVENTS.md` |
| 34 | `THEME_SWITCH_REQUESTED` | internal | MOD-007 | `theme/THEME-EVENTS.md` |
| 35 | `THEME_SWITCH_COMPLETED` | internal | MOD-007 | `theme/THEME-EVENTS.md` |
| 36 | `THEME_FALLBACK_ACTIVATED` | internal | MOD-007 | `theme/THEME-EVENTS.md` |
| 37 | `COMPONENT_REGISTRY_READY` | internal | MOD-009 | `components/COMPONENT-EVENTS.md` |
| 38 | `COMPONENT_REGISTRY_LOADING` | internal | MOD-009 | `components/COMPONENT-EVENTS.md` |
| 39 | `COMPONENT_ADDED` | internal | MOD-009 | `components/COMPONENT-EVENTS.md` |
| 40 | `RESPONSIVE_READY` | public | MOD-016 | `responsive/RESPONSIVE-EVENTS.md` |
| 41 | `BREAKPOINT_CHANGED` | public | MOD-016 | `responsive/RESPONSIVE-EVENTS.md` |
| 42 | `ORIENTATION_CHANGED` | public | MOD-016 | `responsive/RESPONSIVE-EVENTS.md` |
| 43 | `RESPONSIVE_INIT_STARTED` | internal | MOD-016 | `responsive/RESPONSIVE-EVENTS.md` |
| 44 | `VIEWPORT_RESIZED` | internal | MOD-016 | `responsive/RESPONSIVE-EVENTS.md` |
| 45 | `RESPONSIVE_ERROR` | internal | MOD-016 | `responsive/RESPONSIVE-EVENTS.md` |

**Total eventos registrados (base + extendido):** 45 · Índice navegación: `docs/V2/ARCHITECTURE/EVENT-MAP.md`

> **Regla:** No crear eventos nuevos fuera de catálogo módulo + este registro. Boot order: `docs/V2/ARCHITECTURE/BOOT-SEQUENCE.md`.

---

## Dependencias

| Permitido | Prohibido |
|-----------|-----------|
| `../config/` | client, artist, staff |
| `../logging/` | Supabase, API runtime |
| `../utilities/` | UI, DOM |

---

## Referencias

- `CONTRACTS.md` §4 Event Bus
- `EVENT-NAMING-STANDARD.md`
- `EVENT-LIFECYCLE.md`
- `docs/V2/MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md`

---

*Event Bus Spec v1.1 — PHASE-DOC-RECONCILIATION-001 — Sin implementación runtime.*
