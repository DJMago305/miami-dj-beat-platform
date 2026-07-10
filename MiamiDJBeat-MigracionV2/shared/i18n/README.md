# i18n/

Módulo **MOD-015 Internationalization** · Shared Core · **Nivel 1 (Infraestructura)**

## Documentación — TICKET-V2-SHARED-CORE-013 — Internationalization Specification

| Archivo | Contenido |
|---------|-----------|
| **I18N-SPEC.md** | Propósito, scope, reglas, relaciones, formatos |
| **LANGUAGE-LIFECYCLE.md** | Estados locale · boot · switch |
| **TRANSLATION-CONTRACT.md** | Keys · bundles · portal slices |
| **LOCALE-RULES.md** | Resolución locale (i18n no decide) |
| **I18N-EVENTS.md** | LANGUAGE_CHANGED |
| **I18N-ERRORS.md** | ERR-I18N-001–010 |
| **FALLBACK-STRATEGY.md** | EN canónico · missing keys |
| **../CONTRACTS.md** | §10 Contrato i18n |

## Estado

| Campo | Valor |
|-------|-------|
| **Documentación** | **DOCUMENTACIÓN COMPLETA** |
| **Implementación** | **PENDIENTE** |
| **Ticket** | TICKET-V2-SHARED-CORE-013 |

## Idiomas MVP

| Rol | Código |
|-----|--------|
| Canonical + Fallback | `en` |
| Primer soportado | `es` |

## Reglas clave

- Solo Translation Keys · nunca hardcoded UI copy Core
- i18n **no decide** idioma · Session/Preferences/Config resuelven
- **No** mezclar con Theme · Permissions · Auth
- EN first en todo catálogo nuevo

## Dependencias (runtime futuro)

Configuration · Session · Storage · Event Bus · Error Handling

## Prohibido

V1 `translations.js` · Supabase · portal direct imports · legal copy sin PO · implementación en este ticket

## Próximo paso

Aprobación PO → **TICKET-V2-SHARED-CORE-014** (candidato Nivel 1: **MOD-007 Theme** o **MOD-013 Feature Flags**)
