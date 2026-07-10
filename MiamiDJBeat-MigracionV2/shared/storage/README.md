# storage/

Módulo **MOD-012 Storage** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-011 — Storage Specification

| Archivo | Contenido |
|---------|-----------|
| **STORAGE-SPEC.md** | Responsabilidad, reglas, runtime prep, visión futura |
| **STORAGE-LIFECYCLE.md** | Create → Read → Update → Invalidate → Delete |
| **STORAGE-NAMESPACE-RULES.md** | 7 namespaces · keys · prohibidos |
| **CACHE-POLICY.md** | TTL · invalidación · hit/miss · eviction |
| **../session/SESSION-STORAGE.md** | Session keys contract (consumer) |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-011 |

## Reglas clave

- Autoridad almacenamiento **local** client V2
- No auth · no Supabase · no business logic · no secretos · no permisos
- Remote file/blob upload → **fuera de alcance** (ticket futuro)

## Dependencias (runtime futuro)

Configuration · Logging · Error Handling · Session (consumer) · API Client (cache writer)

## Prohibido

Secrets, service_role, refresh token plain, Supabase direct, portal direct imports, business rules
