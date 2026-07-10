# config/

Módulo **MOD-006 Configuration** · Shared Core.

## Documentación — TICKET-V2-SHARED-CORE-006 — Configuration Specification

| Archivo | Contenido |
|---------|-----------|
| **CONFIG-SPEC.md** | Responsabilidad, variables, secretos, validación, relaciones |
| **ENVIRONMENT-RULES.md** | local · staging · production |
| **CONFIG-LIFECYCLE.md** | Load → Validate → Freeze → Expose |
| **../CONTRACTS.md** | Contrato Configuration (TICKET-V2-SHARED-CORE-002) |

## Entornos oficiales

**3:** `local` · `staging` · `production` (selector `MDJ_V2_ENV`)

## Reglas clave

- NO autentica · NO Supabase · NO UI · NO permisos
- NO secretos en texto plano en repo
- Solo configuración **validada** y read-only post-freeze
- Primer módulo en boot Core

## Secuencia tickets Shared Core

| Ticket | Entregable |
|--------|------------|
| 001–005 | Scaffold … Session |
| **006** | **Configuration specification** |
| 007 | Pendiente PO |

## Estado

**Especificación completada** — sin implementación · sin código

## Dependencias

Runtime futuro: `../utilities/` parse helpers only

## Prohibido

Portales, V1 paths, service role en client config, lógica negocio
