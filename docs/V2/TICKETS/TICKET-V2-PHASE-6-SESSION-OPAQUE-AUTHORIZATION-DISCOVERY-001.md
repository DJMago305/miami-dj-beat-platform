# TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-DISCOVERY-001

## Estado

DISCOVERY COMPLETADO — CORRECCIONES DOCUMENTALES APLICADAS — IMPLEMENTACIÓN NO AUTORIZADA

**Modo:** solo lectura de código + documentación en `docs/V2/**`
**Fecha discovery:** 2026-07-11
**Fecha correcciones:** 2026-07-11 — `TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-DISCOVERY-CORRECTIONS-001`
**Decisión técnica:** APROBABLE CON CORRECCIONES DOCUMENTALES
**Rama analizada:** `plan/v2-phase-4-api-client`
**HEAD analizado:** `ffc363636abfd18e61987d94f18bcc482cb42471`
**Autorización PO:** discovery + correcciones documentales únicamente — sin runtime, tests, commit, push, PR, merge, preview ni deploy

---

## Problema

MOD-005 API Client necesita un header `Authorization` opaco en cada request HTTP. El contrato público de Session (`SessionSnapshot` / `UserRef`) **no incluye** `accessTokenRef`. Durante el wiring de bootstrap (Fase 6), `initialize-api.ts` resolvió la brecha consultando el **historial del Event Bus** (`getEventBus().getHistory()`), haciendo un reverse-scan de eventos `USER_LOGIN` hasta encontrar un `accessTokenRef` cuyo `userId` coincida con `snapshot.user.userId`.

Esto convierte al Event Bus en un **almacén indirecto de credenciales**, viola el principio de que Session es la fuente canónica de autorización activa, y crea riesgos de token obsoleto, historial ausente o contaminado, y acoplamiento entre MOD-004 y MOD-005 que no está documentado como contrato de credenciales.

---

## Evidencia actual

| Archivo | Símbolo / función | Evidencia |
|---------|-------------------|-----------|
| `MiamiDJBeat-MigracionV2/bootstrap/initialize-api.ts` | `resolveAuthorizationHeader()` | Llama `getEventBus().getHistory()`, itera en reversa buscando `USER_LOGIN`, extrae `accessTokenRef` vía `parseUserLoginPayload()`, devuelve `` `Bearer ${accessTokenRef}` `` |
| `MiamiDJBeat-MigracionV2/bootstrap/initialize-api.ts` | `createLiveSessionReader()` | Pasa `resolveAuthorizationHeader` como callback a `createSessionReaderFromSnapshot()` |
| `MiamiDJBeat-MigracionV2/shared/api/runtime/session-reader-port.ts` | `SessionReaderPort.getAuthorizationHeader()` | Pull síncrono por request; delega a `resolveAuthorization(snapshot)` si hay usuario |
| `MiamiDJBeat-MigracionV2/shared/api/runtime/api-client.ts` | `buildRequestHeaders()` | Invoca `this.sessionReader?.getAuthorizationHeader()` en cada request |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/types.ts` | `UserRef`, `SessionSnapshot` | `UserRef` solo expone `userId`, `email`, `mdjbId` — **sin** `accessTokenRef` |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/types.ts` | `AuthHandle` | Define `accessTokenRef: string` como campo obligatorio del handoff Auth → Session |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-store.ts` | `SessionStore` | Campos mutables: `currentUser`, `expiresAt` — **no** slot de credencial opaca |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-store.ts` | `clearIdentity()` | Pone `currentUser = null`, `expiresAt = null` — no limpia token (porque no lo guarda) |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-provider.ts` | `ingestAuthHandle()` | Valida `AuthHandle` (incluye `accessTokenRef`), persiste solo `userRef` + `expiresAt` en store |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-provider.ts` | `finalizeRefreshSuccess()` | Actualiza `expiresAt` y `isRefreshing`; **no** actualiza credencial opaca |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-provider.ts` | `executeRefreshSession()` | Pasa `accessTokenRef: options?.accessTokenRef ?? 'mock-access-ref'` al refresh port — lee mock, no store |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-provider.ts` | `clearSession()` | `clearIdentity()` + rebootstrap anónimo — snapshot sin usuario |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/persistence-port.ts` | `PersistedSessionRecord.authRef` | Campo opcional en tipo — **no** poblado por `persistSessionRecord()` |
| `MiamiDJBeat-MigracionV2/shared/auth/runtime/auth-service.ts` | `emitUserLogin()` | Publica `USER_LOGIN` con `accessTokenRef`, `refreshTokenRef`, `expiresAt`, etc. |
| `MiamiDJBeat-MigracionV2/shared/auth/runtime/auth-service.ts` | `refresh()` | Tras refresh exitoso: `emitUserLogin(handoff)` + `deliverHandoff()` — nuevo token en bus, re-handoff a Session |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-listeners.ts` | `parseUserLoginPayload()` | Extrae `accessTokenRef` del payload del envelope — usado por bootstrap y listeners |
| `MiamiDJBeat-MigracionV2/shared/events/runtime/event-bus-service.ts` | `getHistory()`, `recordHistory()` | Array in-memory `eventHistory`, cap `MAX_HISTORY = 100`, FIFO eviction con `shift()` |
| `MiamiDJBeat-MigracionV2/shared/events/EVENT-BUS-SPEC.md` | `USER_LOGIN` payload público | Documenta payload mínimo `{ userId }` — credenciales en runtime son más amplias |
| `MiamiDJBeat-MigracionV2/tests/unit/boot-api-wiring.test.ts` | signed-in boot test | Espera `Authorization: Bearer mock-mock-user-client-1-access` — valida workaround, no API Session |
| `MiamiDJBeat-MigracionV2/shared/auth/AUTH-SESSION-BOUNDARY.md` | §1, §3 | Auth entrega `accessTokenRef` opaco en `AuthHandle`; Session no parsea JWT para roles |
| `MiamiDJBeat-MigracionV2/shared/session/SESSION-SPEC.md` | §10 handoff | `ingestAuthHandle` recibe `accessTokenRef`; no define API pública de lectura para MOD-005 |

---

## Flujo actual

### Cadena canónica de boot

```
Config → Bus → Logging → Error → registerAuthForBoot → Session → activateAuthForBoot
→ initializeApiForBoot → Runtime → SYSTEM_READY → Theme
```

(`bootstrap/boot.ts` — API Client después de Auth activate, antes de Runtime.)

### Auth → Session → Event Bus → API Client

```
┌─────────┐    AuthHandle + IdentitySnapshot     ┌──────────────┐
│ MOD-001 │ ───────────────────────────────────► │   MOD-002    │
│  Auth   │    deliverHandoff / ingestAuthHandle │   Session    │
└────┬────┘                                      └──────┬───────┘
     │ emitUserLogin({ userId, accessTokenRef, ... })   │ store: userRef + expiresAt only
     ▼                                                  │ (accessTokenRef discarded)
┌─────────┐                                             │
│ MOD-004 │ ◄── USER_LOGIN envelope en eventHistory     │
│Event Bus│                                             │
└────┬────┘                                             │
     │ getHistory() reverse scan                         │ getSessionSnapshot()
     ▼                                                  ▼
┌─────────┐    SessionReaderPort.getAuthorizationHeader()
│ MOD-005 │ ◄── resolveAuthorizationHeader() en initialize-api.ts
│API Client│    (solo si snapshot.user != null)
└─────────┘
```

### Login (sign-in / restore con sesión válida)

1. Auth: `restore()` o `signIn()` → `buildHandoff()` con `accessTokenRef`.
2. Auth: `emitUserLogin()` → Event Bus registra envelope con credencial.
3. Auth: `deliverHandoff()` → Session `ingestAuthHandle()` — guarda identidad, **descarta** token del store.
4. Session: `SESSION_READY` con `user` poblado.
5. Bootstrap: `initializeApiForBoot()` crea `SessionReaderPort` que, en cada request, busca `USER_LOGIN` en historial.

### Refresh

**Vía Auth (`auth-service.refresh()`):**

1. Auth obtiene nuevo `accessTokenRef` del provider.
2. Auth emite **otro** `USER_LOGIN` (AUTH-LIFECYCLE L-08 documenta update de handle; en runtime Auth sí re-emite).
3. Auth re-entrega handoff → Session `ingestAuthHandle()` — actualiza `expiresAt`, **no** almacena nuevo token internamente.
4. API Client: si usa historial, el reverse-scan encuentra el `USER_LOGIN` más reciente para el `userId` → token actualizado **indirectamente**.

**Vía Session (`session-provider.refreshSession()`):**

1. Session entra en máquina `REFRESHING`, `isRefreshing: true`.
2. Refresh port recibe `accessTokenRef` desde `options` o default `'mock-access-ref'` — **no** desde store.
3. `finalizeRefreshSuccess()` solo actualiza `expiresAt` — **no** emite `USER_LOGIN`, **no** actualiza credencial en ningún store Session.
4. API Client sigue leyendo historial → **token previo** (riesgo stale si solo refresh Session sin nuevo `USER_LOGIN`).

### Logout

1. Auth: `emitUserLogout()` → Event Bus.
2. Session listener: `handleUserLogoutEvent()` → `clearSession()` → `user = null`.
3. API Client: `getAuthorizationHeader()` — guard `!snapshot.user` → `null` inmediato.
4. Event Bus: historial **conserva** `USER_LOGIN` antiguos (no se purgan credenciales del historial).

### Relogin (mismo usuario)

1. Nuevo `USER_LOGIN` append al historial.
2. Reverse-scan encuentra el más reciente con `userId` coincidente.
3. Funciona **si** Auth emitió nuevo evento con token actualizado.

### Relogin (usuario diferente)

1. Session `ingestAuthHandle()` reemplaza `userRef`.
2. Reverse-scan salta `USER_LOGIN` de `userId` distinto hasta match.
3. Funciona **si** existe `USER_LOGIN` del nuevo usuario en historial accesible.

### Expiry / destroy

- **Expiry:** `handleSessionExpiry()` / `expireSession()` — máquina `EXPIRED`, lifecycle `SESSION_EXPIRED`; usuario puede quedar hasta clear explícito según transición; API sin guard de lifecycle (solo `user`).
- **Destroy:** `destroySession()` invalida snapshot y API pública; historial del bus no se limpia automáticamente.

---

## Riesgos confirmados

| Riesgo | Clasificación | Evidencia |
|--------|---------------|-----------|
| **Stale token** — API usa credencial vieja tras refresh solo-Session | **CONFIRMADO** | `finalizeRefreshSuccess()` no actualiza token; refresh Session no emite `USER_LOGIN`; bootstrap lee historial estático hasta nuevo evento Auth |
| **Stale token** — tras refresh Auth | **POSIBLE** | Auth re-emite `USER_LOGIN`; workaround funciona si evento está en historial; no hay test dedicado |
| **Wrong-user token** — snapshot user A, historial sin match | **CONFIRMADO** | `resolveAuthorizationHeader()` retorna `null` si no hay `USER_LOGIN` con `userId` coincidente — sesión “signed-in” sin Authorization |
| **Wrong-user token** — match por userId sin validar handoffId/portal | **CONFIRMADO** | Lookup solo compara `payload.userId === snapshot.user.userId` — ignora `handoffId`, `expiresAt`, `provider` |
| **Historial ausente** — signed-in sin `USER_LOGIN` en bus | **CONFIRMADO** | Boot no falla; API opera sin header (`boot-api-wiring` guest path; signed-in depende de restore emitiendo evento) |
| **Historial contaminado** — múltiples `USER_LOGIN` mismo userId | **POSIBLE** | Reverse-scan toma el más reciente por userId — correcto si el más reciente es válido; incorrecto si evento nuevo tiene `accessTokenRef` vacío |
| **Historial eviction** — `USER_LOGIN` expulsado (cap 100) | **POSIBLE** | `recordHistory()` hace `shift()` al superar `MAX_HISTORY`; sesión activa podría perder credencial en historial |
| **Logout tardío** — request tras logout | **NO OBSERVADO** en tests | Guard `!snapshot.user` invalida header síncronamente en `SessionReaderPort`; no hay test post-logout request |
| **Logout tardío** — historial retiene token | **CONFIRMADO** | `USER_LOGIN` permanece en `eventHistory`; mitigado por guard de snapshot, no por purga |
| **Acoplamiento MOD-005 → MOD-004** | **CONFIRMADO** | `initialize-api.ts` importa `getEventBus` y `parseUserLoginPayload` |
| **Acoplamiento MOD-005 → payload Auth** | **CONFIRMADO** | Depende de forma del payload `USER_LOGIN` definida por Auth, no por contrato Session |
| **Pruebas insuficientes** — stale / relogin / wrong-user / post-logout | **CONFIRMADO** | `boot-api-wiring.test.ts` no cubre esos escenarios (catálogo §4H y nota diaria 2026-07-10) |
| **Credencial en bus no es contrato público** | **CONFIRMADO** | `EVENT-BUS-SPEC.md` lista `{ userId }`; runtime incluye `accessTokenRef` |

---

## Alternativas evaluadas

| Criterio | A. Getter síncrono `getAuthorizationSnapshot()` | B. Puerto opaco `SessionAuthorizationReaderPort` | C. Resolver/callback `resolveAuthorization()` | D. Suscripción reactiva | E. Pull + invalidation event | F. Capability sellada en bootstrap |
|----------|---------------------------------------------------|--------------------------------------------------|-----------------------------------------------|-------------------------|-------------------------------|-----------------------------------|
| **Encapsulación** | Media — función pública en Session | **Alta** — puerto dedicado, consumidor acotado | Media — callback puede filtrar leaks | Media — listeners pueden copiar estado | **Alta** — pull + señales sin historial | Alta al inicio, baja después |
| **Exposición del token** | Baja si devuelve solo header | **Baja** — header preformado, sin ref cruda en snapshot | Depende implementación | Riesgo de persistir en closures | **Baja** | Riesgo si capability guarda string |
| **Acoplamiento** | Bajo MOD-002↔MOD-005 | **Bajo** — contrato explícito | Bajo | Medio (MOD-004 o Session emitter) | Bajo-Medio | Medio bootstrap |
| **Testabilidad** | Alta | **Alta** — mock de puerto | Alta | Media — async timing | Alta | Media — refresh difícil |
| **Boot síncrono** | **Compatible** | **Compatible** | Compatible | Compatible (init subscribe) | Compatible | **Compatible** |
| **Refresh** | OK si store interno actualizado | **OK** — mismo mecanismo | OK | OK con evento | **OK** | **Stale** sin re-bootstrap |
| **Logout** | **Inmediato** si store se limpia | **Inmediato** | Inmediato | Inmediato con evento | **Inmediato** | Stale hasta invalidar capability |
| **Stale token** | Elimina si Session es SoT | **Elimina** | Elimina | Elimina con versión | **Elimina** | **Riesgo alto** |
| **Wrong-user token** | Elimina con bind userId+token | **Elimina** | Elimina | Elimina | Elimina | Riesgo si no rebind |
| **Costo implementación** | Bajo | **Bajo-Medio** | Bajo | Medio | Medio | Medio-Alto |
| **Riesgo regresión** | Bajo | **Bajo** — cambio acotado store + export | Bajo | Medio | Bajo-Medio | Alto en refresh/relogin |
| **Alineación arquitectura** | Buena | **Óptima** — Session SoT, bus no almacén | Buena | Buena para UI, exceso para API | **Óptima** para MOD-005 | Desalineada con refresh |

**Conclusión comparativa:** La opción **B** (puerto opaco de lectura en Session) con modelo **pull síncrono** (ya usado por `api-client.ts`) es la mejor alineación. La opción **E** aporta valor como complemento documental (invalidación en logout/destroy vía limpieza del slot interno), no como suscripción obligatoria para MOD-005. **Descartar F** para credenciales que rotan. **Descartar D** como requisito mínimo de MOD-005 (pull por request es suficiente). **A** es subconjunto de B sin contrato nominal.

---

## Diseño recomendado

### Nombre del puerto / API

**`SessionAuthorizationReaderPort`** (contrato nominal de tests/diagnóstico) con facade pública mínima de producción.

Export desde `@mdj/shared/session` — **no** incluir en `SessionSnapshot`.

#### Superficie pública mínima (producción obligatoria)

```typescript
getSessionAuthorizationHeader(): string | null
```

Única API requerida para el composition root de MOD-005 (`bootstrap/initialize-api.ts`). Devuelve header preformado `Bearer <opaque>` o `null`. No expone `accessTokenRef` crudo.

#### Superficie opcional (tests / diagnóstico — no obligatoria en producción)

```typescript
getSessionAuthorizationState(): SessionAuthorizationState
createSessionAuthorizationReader(): SessionAuthorizationReaderPort
```

Tipos asociados: `SessionAuthorizationState`, `SessionAuthorizationReaderPort`, `SessionAuthorizationNoneReason`. Orientados a unit tests MOD-002/MOD-005 y diagnóstico de laboratorio. No son requisito del wiring bootstrap mínimo.

### Responsabilidad

- Session es la **única fuente de verdad** de la credencial activa opaca.
- Auth sigue entregando `accessTokenRef` solo vía `AuthHandle` / `USER_LOGIN` listener — Session **captura** en slot interno al aceptar handoff.
- MOD-005 consume únicamente header preformado `Bearer <opaque>` o `null`.
- Event Bus deja de ser consultado para credenciales.

### Propiedad de los datos

| Dato | Propietario | Visibilidad |
|------|-------------|-------------|
| `accessTokenRef` (opaco) | MOD-002 SessionStore (slot privado) | **No** exportar en snapshot/registry |
| `Authorization` header | MOD-002 formatea; MOD-005 consume | Público vía puerto de lectura |
| `userId` bind | MOD-002 — credencial válida solo si `currentUser` coincide | Validación interna en getter |
| Event `USER_LOGIN` | MOD-001 emite; MOD-002 ingiere | Bus **no** es store de lectura para API |

### Entrada

- `ingestAuthHandle(handle)` → captura `handle.accessTokenRef` en slot interno si handoff válido.
- `refreshSession` / Auth re-handoff → actualiza slot si nuevo `accessTokenRef` disponible en resultado.
- `clearSession` / `destroySession` / expiry con clear → slot = `null`.

### Salida

```typescript
// Conceptual — NO implementar en este ticket
type SessionAuthorizationState =
  | { readonly kind: 'none'; readonly reason: 'anonymous' | 'cleared' | 'expired' | 'destroyed' | 'error' }
  | {
      readonly kind: 'ready';
      readonly authorizationHeader: string; // "Bearer <opaque>"
      readonly credentialVersion: number;  // bump en ingest/refresh/clear
      readonly userId: string;              // bind check — no exponer token ref
    };

type SessionAuthorizationReaderPort = {
  getAuthorizationHeader(): string | null;
  getAuthorizationState(): SessionAuthorizationState;
};
```

### Estados posibles — máquina oficial (9 estados)

Comportamiento de `getSessionAuthorizationHeader()` por estado de máquina (`SessionStateMachineState`):

| Estado | Resultado |
|--------|-----------|
| `INITIAL` | `null` |
| `LOADING` | `null` |
| `AUTHENTICATED` | header solo si slot válido, usuario enlazado (`boundUserId`), `expiresAt` no vencido y sin bloqueo por `EXPIRED` |
| `ANONYMOUS` | `null` |
| `EXPIRED` | `null` **aunque `snapshot.user` siga presente** |
| `REFRESHING` | conservar temporalmente la última credencial válida (si no vencida) |
| `LOGGING_OUT` | `null` |
| `DESTROYED` | `null` |
| `ERROR` | `null` |

**Regla crítica:** el reader **no** puede basarse únicamente en `snapshot.user !== null`. Debe evaluar estado de máquina, bind slot/usuario y `expiresAt` (ver §Validación de `expiresAt`).

#### EXPIRED con `user` presente

En runtime actual, `handleSessionExpiry()` transiciona a máquina `EXPIRED` y lifecycle `SESSION_EXPIRED` **sin** llamar `clearIdentity()` — `snapshot.user` puede permanecer poblado.

Por tanto:

- El reader debe negar autorización cuando `getMachineState() === 'EXPIRED'`.
- Debe devolver `null` aunque exista slot poblado y usuario en snapshot.
- El guard actual de MOD-005 (`!snapshot.user` en `SessionReaderPort`) es **insuficiente** para expiry; la implementación futura debe delegar en Session, no replicar esa lógica en bootstrap.

### Errores

- Sin throw en lectura — `null` header equivale a guest para MOD-005.
- Inconsistencia slot/userId (defensa): tratar como `none`, log interno MOD-002, opcional `SESSION_ERROR` — no filtrar token.

### Invalidación

- `clearSession()` → `clearCredential()` + slot `null`, `credentialVersion++`.
- `destroySession()` → `clearCredential()` explícito antes/durante invalidación — reader `destroyed`, ninguna credencial residual.
- `ingestAuthHandle()` nuevo usuario → reemplazo atómico slot (no reutilizar credencial anterior).
- Logout Auth → Session clear → invalidación inmediata para API pull.

### Refresh

Session refresh path debe dejar de depender de `'mock-access-ref'` hardcoded — leer slot interno al invocar refresh port.

#### Política cuando `SessionRefreshPortSuccess.accessTokenRef` **no** está presente

- Conservar temporalmente el slot anterior.
- Actualizar `expiresAt` si viene disponible en el resultado.
- **No** reemplazar la credencial por `null`.
- **No** incrementar `credentialVersion` si la credencial no cambió.
- Seguir negando autorización si el estado resultante es `EXPIRED` o inválido (máquina, bind o `expiresAt` vencido).

#### Política cuando llega un nuevo `accessTokenRef`

- Reemplazar atómicamente el slot.
- Incrementar `credentialVersion`.
- Preservar el enlace con el usuario actual (`boundUserId`).

Auth re-handoff post-refresh sigue el path de `ingestAuthHandle()` — misma política de reemplazo atómico.

### Validación de `expiresAt` (defensa interna obligatoria)

`getSessionAuthorizationHeader()` debe devolver `null` cuando:

- `expiresAt` exista en el store/snapshot activo;
- y sea menor o igual al tiempo actual;
- aunque el slot siga poblado;
- aunque el estado de máquina todavía no haya propagado formalmente `EXPIRED`.

Esta validación es **interna** a Session. **No** es obligatorio exponer `expiresAt` en el contrato público mínimo de producción.

### Logout

- Slot limpiado en `clearSession` **antes** de publicar snapshot `SIGNED_OUT`.
- MOD-005 siguiente request: `null` — sin depender de purga de historial.

### Destrucción

- `destroySession()` debe invocar `clearCredential()` **explícitamente** dentro de su flujo — antes o durante la invalidación final (`invalidateSnapshot()`, `frozenApi = null`).
- Ninguna credencial debe sobrevivir al estado `DESTROYED`.
- Reader siempre `null` tras destrucción.

### Visibilidad pública

- **Producción mínima:** export de `getSessionAuthorizationHeader()` únicamente.
- **Opcional (tests):** `getSessionAuthorizationState()`, `createSessionAuthorizationReader()`, tipos asociados.
- **No** añadir `accessTokenRef` a `SessionSnapshot`, `UserRef`, ni Session Registry público.

### Módulos consumidores autorizados

| Módulo | Uso permitido |
|--------|---------------|
| MOD-005 composition root (`bootstrap/initialize-api.ts`) | `getSessionAuthorizationHeader()` vía `SessionReaderPort` |
| Tests unitarios MOD-002 / MOD-005 | Lectura para aserciones de header / state |
| **Desaconsejado sin ticket** | UI, Storage, Registry, Theme, Permissions, otros módulos |
| **Prohibido** | MOD-004 Event Bus history, persist plain token sin ADR |

#### Gobernanza de consumidores (sin enforcement runtime)

- La restricción de consumidores es **gobernanza arquitectónica**, no seguridad sellada en runtime.
- Un export público desde `@mdj/shared/session` **no** constituye una capability con enforcement de acceso.
- El consumidor autorizado **inicial** es el composition root de MOD-005.
- **No existe** enforcement runtime que impida imports desde otros módulos TypeScript.
- Cualquier consumidor adicional requerirá ticket explícito del Product Owner.
- **No afirmar** en documentación ni código que el export impida lectura arbitraria — solo que el diseño y la gobernanza limitan el uso previsto.

---

## Contrato conceptual

```typescript
// ─── MOD-002 Session — authorization read surface (conceptual) ───

// === Producción mínima obligatoria ===

/** Preformatted "Bearer <opaque>" or null — única API requerida en wiring MOD-005 */
export function getSessionAuthorizationHeader(): string | null;

// === Opcional — tests / diagnóstico (no obligatoria en producción) ===

export type SessionAuthorizationNoneReason =
  | 'anonymous'
  | 'cleared'
  | 'expired'
  | 'destroyed'
  | 'error'
  | 'unbound'; // slot/user mismatch — defensive

export type SessionAuthorizationState =
  | { readonly kind: 'none'; readonly reason: SessionAuthorizationNoneReason }
  | {
      readonly kind: 'ready';
      readonly authorizationHeader: string;
      readonly credentialVersion: number;
      readonly userId: string;
      readonly isRefreshing: boolean;
    };

export type SessionAuthorizationReaderPort = {
  getAuthorizationHeader(): string | null;
  getAuthorizationState(): SessionAuthorizationState;
};

export function getSessionAuthorizationState(): SessionAuthorizationState;
export function createSessionAuthorizationReader(): SessionAuthorizationReaderPort;

// ─── MOD-002 SessionStore (internal — not exported) ───

interface SessionStoreCredentialSlot {
  accessTokenRef: string | null;
  boundUserId: string | null;
  credentialVersion: number;
}

// set on ingestAuthHandle, clear on clearIdentity/destroySession, update on refresh success

// ─── Lectura interna — reglas obligatorias (no en contrato público mínimo) ───
// - Negar si machineState === 'EXPIRED' aunque snapshot.user exista
// - Negar si expiresAt <= now aunque slot exista
// - Negar si boundUserId !== currentUser.userId

// ─── MOD-005 Bootstrap wiring (conceptual replacement) ───

function createLiveSessionReader(): SessionReaderPort {
  return createSessionReaderFromSnapshot(
    () => getSessionSnapshot(),
    () => getSessionAuthorizationHeader(), // NO Event Bus; NO lógica expiry en bootstrap
  );
}
```

---

## Archivos potenciales de una implementación futuro

### Archivos permitidos (mínimo)

| Archivo | Cambio |
|---------|--------|
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-store.ts` | Slot privado credencial + getters internos |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-provider.ts` | Set/clear/update slot en ingest, refresh, clear, destroy |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/session-service.ts` | Facade `getSessionAuthorizationHeader()` / state |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/types.ts` | Tipos `SessionAuthorizationState`, puerto (si no archivo dedicado) |
| `MiamiDJBeat-MigracionV2/shared/session/runtime/index.ts` | Re-exports públicos |
| `MiamiDJBeat-MigracionV2/bootstrap/initialize-api.ts` | Eliminar `getEventBus().getHistory()` workaround |
| `MiamiDJBeat-MigracionV2/tests/unit/session-authorization.test.ts` | **Nuevo** — matriz discovery |
| `MiamiDJBeat-MigracionV2/tests/unit/boot-api-wiring.test.ts` | Extender escenarios logout/relogin/stale |
| `MiamiDJBeat-MigracionV2/tests/unit/session-provider.test.ts` | ingest/refresh/clear slot behavior |

### Archivos que deben permanecer congelados (salvo ticket explícito)

| Archivo | Razón |
|---------|-------|
| `MiamiDJBeat-MigracionV2/shared/auth/runtime/**` | Zona roja — no necesario para lectura opaca Session-first |
| `MiamiDJBeat-MigracionV2/shared/events/runtime/catalog.ts` | Contrato eventos estable |
| `MiamiDJBeat-MigracionV2/shared/api/runtime/api-client.ts` | Ya usa pull — wiring cambia solo en bootstrap |
| `MiamiDJBeat-MigracionV2/bootstrap/boot.ts` | Orden boot aprobado — sin cambio de fase |
| `MiamiDJBeat-MigracionV2/shared/runtime/**` | Registry fuera de alcance |

### Documentos (post-implementación, ticket separado)

- Actualizar `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` §4H deuda resuelta
- Session summary de cierre
- `SESSION-SPEC.md` — § API lectura opaca (solo si PO autoriza doc MOD-002)

---

## Plan de implementación futuro

1. **Slot interno** en `SessionStore`: `accessTokenRef` + `boundUserId` + `credentialVersion`; nunca en `publishSnapshot()`.
2. **`ingestAuthHandle`**: tras validación, `setCredential(acceptedHandle.accessTokenRef, userRef.userId)`.
3. **`clearSession` / `clearIdentity`**: `clearCredential()` + `credentialVersion++` cuando corresponda.
4. **`destroySession`**: `clearCredential()` **explícito** antes o durante invalidación final — ninguna credencial sobrevive a `DESTROYED`.
5. **`finalizeRefreshSuccess`**: aplicar política §Refresh — conservar slot si no hay nuevo `accessTokenRef`; reemplazo atómico + bump versión si llega nuevo ref; leer slot interno en `executeRefreshSession` para refresh port.
6. **Facade pública** `getSessionAuthorizationHeader()` con: bind check `boundUserId === currentUser?.userId`; negación si máquina `EXPIRED`; negación si `expiresAt <= now` (defensa interna).
7. **Bootstrap** `initialize-api.ts`: reemplazar `resolveAuthorizationHeader` por `getSessionAuthorizationHeader()`; remover imports `getEventBus`, `parseUserLoginPayload`.
8. **Tests** según matriz § siguiente — obligatorio antes de cerrar ticket implementación.
9. **Documentación** de cierre — sin marcar merge/prod autorizado.

**Orden:** store → provider → facade → bootstrap → tests → docs. Sin cambiar orden de boot.

---

## Matriz de pruebas requerida

| Escenario | Expectativa |
|-----------|-------------|
| anonymous | `getAuthorizationHeader()` → `null`; API sin `Authorization` |
| login | Tras `ingestAuthHandle`, header `Bearer <ref>` coherente con handle |
| token actual | Header refleja último ingest, no evento bus antiguo |
| refresh con nuevo `accessTokenRef` | Header actualizado; `credentialVersion` incrementa |
| refresh sin nuevo `accessTokenRef` | Slot conservado; `credentialVersion` sin cambio; `expiresAt` actualizado si aplica |
| stale token | Tras refresh Session-only con nuevo ref en result, **no** sirve token pre-refresh |
| logout | Post `clearSession`, header `null`; request API sin `Authorization` |
| relogin mismo usuario | Nuevo handle reemplaza slot; header nuevo |
| relogin usuario diferente | Slot del usuario anterior no reutilizado |
| expired (clear) | Post expiry+clear, `null` |
| **EXPIRED con `user !== null` y slot poblado** | **`getAuthorizationHeader()` → `null`** — obligatorio |
| `expiresAt` vencido antes de transición formal `EXPIRED` | `null` aunque slot poblado y máquina aún `AUTHENTICATED` |
| destroyed | Post `destroySession`, `null`; slot limpiado explícitamente |
| Event Bus history vacío | Signed-in con slot Session — header **presente** (sin bus) |
| Event Bus history contaminado | Múltiples `USER_LOGIN` viejos — header sigue slot Session, no bus |
| API request posterior a logout | `transport.calls[n].headers.Authorization` undefined |
| request concurrente durante refresh | Retener última credencial válida (política `REFRESHING`) |

---

## Criterios de aceptación futuros

1. `initialize-api.ts` **no** importa ni llama `getEventBus().getHistory()` para Authorization.
2. Session almacena credencial opaca en slot privado actualizado en ingest/refresh/clear/destroy.
3. `SessionSnapshot` y `UserRef` permanecen sin `accessTokenRef`.
4. `getSessionAuthorizationHeader()` niega header en máquina `EXPIRED` aunque `snapshot.user` exista.
5. `getSessionAuthorizationHeader()` niega header cuando `expiresAt <= now` aunque slot exista.
6. `destroySession()` invoca `clearCredential()` explícito — ninguna credencial sobrevive a `DESTROYED`.
7. Refresh sin nuevo `accessTokenRef` conserva slot y no incrementa `credentialVersion`.
8. `boot-api-wiring.test.ts` pasa incluyendo escenarios logout y relogin.
9. Nuevos tests `session-authorization.test.ts` cubren matriz mínima (incl. EXPIRED con user presente).
10. Suite global sin regresiones (baseline 448+ tests).
11. `bootScaffold()` permanece síncrono; orden de fases sin cambio.
12. Superficie pública mínima de producción: solo `getSessionAuthorizationHeader()` obligatoria en wiring.
13. Sin Supabase, sin fetch, sin UI en Session.
14. Documentación de cierre en `docs/V2/**` — implementación **lab only** hasta PO autorice merge.

---

## Fuera de alcance

- Runtime Registry MOD-005
- `FetchTransport`
- Supabase adapter
- UI / portales
- Storage / persistencia `authRef` en prod (ADR separado)
- Producción, merge, preview, deploy
- Modificar payload público de `USER_LOGIN` en Event Bus
- Purga retroactiva de credenciales en historial del bus (opcional hardening futuro MOD-004)
- Permissions, Theme, Registry salvo dependencia estricta (ninguna identificada)

---

## Recomendación final

La arquitectura V2 **permite** abrir un ticket de implementación acotado (`TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-IMPLEMENTATION-001` o equivalente PO) que:

1. Añada slot interno y API de lectura opaca en MOD-002.
2. Elimine el workaround Event Bus en `initialize-api.ts`.
3. Extienda tests sin tocar Auth ni orden de boot.

**No autorizar merge, preview ni producción** del wiring MOD-005 actual hasta cerrar esa implementación o aceptar explícitamente la deuda solo-lab.

---

*Discovery · TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-DISCOVERY-001 · 2026-07-11*
*Correcciones · TICKET-V2-PHASE-6-SESSION-OPAQUE-AUTHORIZATION-DISCOVERY-CORRECTIONS-001 · 2026-07-11*
