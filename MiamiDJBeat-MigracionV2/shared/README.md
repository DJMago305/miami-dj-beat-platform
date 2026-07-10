# shared/

**Shared Core** — núcleo transversal de MiamiDJBeat-MigracionV2.

## Propósito

Capacidades comunes a los tres portales. Sin páginas ni navegación específica de un portal.

## Inventario oficial (MOD-001–016)

Fuente única de IDs: `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md`

| MOD | Carpeta | Estado documental |
|-----|---------|-------------------|
| MOD-001 | `auth/` | DOCUMENTACIÓN COMPLETA |
| MOD-002 | `session/` | DOCUMENTACIÓN COMPLETA |
| MOD-003 | `permissions/` | DOCUMENTACIÓN COMPLETA |
| MOD-004 | `events/` | DOCUMENTACIÓN COMPLETA |
| MOD-005 | `api/` | DOCUMENTACIÓN COMPLETA |
| MOD-006 | `config/` | DOCUMENTACIÓN COMPLETA |
| MOD-007 | `theme/` | DOCUMENTACIÓN COMPLETA |
| MOD-008 | `design-system/` | DOCUMENTACIÓN COMPLETA |
| MOD-009 | `components/` | DOCUMENTACIÓN COMPLETA |
| MOD-010 | `logging/` | DOCUMENTACIÓN COMPLETA |
| MOD-011 | `notifications/` | DOCUMENTACIÓN COMPLETA |
| MOD-012 | `storage/` | DOCUMENTACIÓN COMPLETA |
| MOD-013 | `feature-flags/` | DOCUMENTACIÓN COMPLETA |
| MOD-014 | `errors/` | DOCUMENTACIÓN COMPLETA |
| MOD-015 | `i18n/` | DOCUMENTACIÓN COMPLETA |
| MOD-016 | `responsive/` | DOCUMENTACIÓN COMPLETA |

**Progreso:** 16/16 documentados · **100%** · Nivel 0 ✅ · Nivel 1 ✅ · Nivel 2 ✅ · Implementación runtime: 0%

Artefacto transversal: `CONTRACTS.md` (ticket 002) — no cuenta como módulo.

## Restricciones

- **Nunca** importar desde `client/`, `artist/` o `staff/`
- **Nunca** copiar desde `web/` sin ADR aprobada

## Tablero

`docs/V2/SHARED-CORE-PROGRESS.md`
