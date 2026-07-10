# SESSION-STATE-MACHINE.md

**TICKET-V2-SHARED-CORE-005 — Session Manager Specification**

**Módulo:** MOD-002 · Máquina de estados  
**Versión:** 1.0

---

## Regla global

> **Ningún estado puede cambiar arbitrariamente.**  
> Solo transiciones listadas en esta tabla son válidas.  
> Transición ilegal → permanecer en estado + log + opcional `SESSION_ERROR`.

---

## Diagrama

```
                    ┌──────────┐
                    │ INITIAL  │
                    └────┬─────┘
                         │ boot
                         ▼
                    ┌──────────┐
              ┌────│ LOADING  │────┐
              │    └────┬─────┘    │
              │         │          │
         validate fail  │          │ validate ok + no user
              │         │          ▼
              │    ┌────▼─────┐  ┌───────────┐
              │    │AUTHENTICATED│ │ ANONYMOUS │
              │    └────┬─────┘  └─────┬─────┘
              │         │              │
              │    refresh fail        │
              │         │              │
              ▼         ▼              │
         ┌────────┐ ┌─────────┐       │
         │ ERROR  │ │ EXPIRED │       │
         └────────┘ └────┬────┘       │
                           │          │
              logout ◄─────┴──────────┘
                  │
                  ▼
            ┌────────────┐
            │ LOGGING_OUT │
            └──────┬─────┘
                   │
                   ▼
            ┌────────────┐
            │ DESTROYED  │ (terminal)
            └────────────┘

AUTHENTICATED ◄──► REFRESHING (sub-loop)
```

---

## Tabla de transiciones

| Desde | Evento / condición | Hacia | Notas |
|-------|-------------------|-------|-------|
| — | module load | **INITIAL** | Entry |
| INITIAL | SYSTEM_READY | **LOADING** | Begin restore |
| LOADING | validate OK + user | **AUTHENTICATED** | emit SESSION_CREATED |
| LOADING | validate OK + no user | **ANONYMOUS** | guest |
| LOADING | validate fail recoverable | **ANONYMOUS** | clear bad storage |
| LOADING | validate fail fatal | **ERROR** | SESSION_ERROR |
| AUTHENTICATED | USER_LOGIN (re-auth) | **LOADING** | rare; re-ingest |
| AUTHENTICATED | PERMISSION_CHANGED | **AUTHENTICATED** | snapshot update only |
| AUTHENTICATED | refresh start | **REFRESHING** | |
| REFRESHING | refresh OK | **AUTHENTICATED** | SESSION_REFRESH done |
| REFRESHING | refresh fail | **EXPIRED** | SESSION_EXPIRED |
| AUTHENTICATED | expiry detected | **EXPIRED** | |
| EXPIRED | USER_LOGIN | **LOADING** | re-auth path |
| EXPIRED | USER_LOGOUT | **LOGGING_OUT** | |
| ANONYMOUS | USER_LOGIN | **LOADING** | |
| ANONYMOUS | USER_LOGOUT | **LOGGING_OUT** | noop cleanup |
| AUTHENTICATED | USER_LOGOUT | **LOGGING_OUT** | |
| ANONYMOUS | PERMISSION_CHANGED | **ANONYMOUS** | update guest caps if any |
| LOGGING_OUT | teardown complete | **DESTROYED** | SESSION_DESTROYED |
| ERROR | manual recovery / boot | **INITIAL** | full reset only |
| DESTROYED | new boot cycle | **INITIAL** | app remount |
| * | illegal transition | * (hold) | log violation |

---

## Estados terminales y estables

| Estado | Tipo |
|--------|------|
| **DESTROYED** | Terminal |
| **ERROR** | Sticky hasta reset |
| **AUTHENTICATED** | Stable operativo |
| **ANONYMOUS** | Stable operativo |
| **EXPIRED** | Stable pre re-auth |

---

## REFRESHING (sub-estado)

| Regla | Detalle |
|-------|---------|
| Entrada solo desde | AUTHENTICATED |
| Salida | AUTHENTICATED o EXPIRED |
| Concurrencia | Segundo refresh → await first |
| UI | Session expone `isRefreshing: true` en snapshot |

---

## LOGGING_OUT

| Regla | Detalle |
|-------|---------|
| Duración | Corta; síncrono donde posible |
| Reentrancy | Ignorar duplicate USER_LOGOUT |
| Fail Auth signOut | Proceder destroy local anyway + log |

---

## Validación de transiciones (runtime futuro)

Implementación 006+ debe incluir:

```
assertTransition(from, to, event) → ok | SESSION_ERROR
```

Tests: tabla completa; cero transiciones no listadas.

---

*SESSION-STATE-MACHINE v1.0 — 9 estados — TICKET-V2-SHARED-CORE-005*
