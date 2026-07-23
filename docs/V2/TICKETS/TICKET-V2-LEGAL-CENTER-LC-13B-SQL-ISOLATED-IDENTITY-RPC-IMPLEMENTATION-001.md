# TICKET-V2-LEGAL-CENTER-LC-13B-SQL-ISOLATED-IDENTITY-RPC-IMPLEMENTATION-001

## Estado

**LC-13B SQL IDENTITY RPC IMPLEMENTED IN ISOLATED POSTGRES — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

| Campo | Valor |
|-------|-------|
| Ticket | LC-13B-SQL — `legal_resolve_profile_access` |
| Modo | SQL aislado + validación PostgreSQL 16 |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `467b6d2ebccaa7753f1265dee968e10e5df223f4` |
| Fecha | 2026-07-22 |
| TypeScript | ❌ congelado — sin cambios |
| Commit | ❌ **NO autorizado en este ticket** |
| Push / merge / PR / deploy | ❌ **PROHIBIDOS** |
| Producción / Supabase remoto | ❌ **NOT_AUTHORIZED** |

---

## 1. Objetivo cumplido

Implementar y validar en PostgreSQL 16 aislado la RPC:

`public.legal_resolve_profile_access(p_source_portal text, p_correlation_id text DEFAULT NULL)`

Contrato alineado con `legal-resolve-profile-access-types.ts` (LC-13B-TS committed).

**Fuera de alcance (no implementado):**

- Integración productiva · Supabase remoto · wiring TypeScript adicional
- Reescritura de `legal_lc13_read_access_context()` contra `dj_profiles`
- Bootstrap repair · cadena 110 migraciones legacy
- Commit · push · deploy

---

## 2. Inventario SQL existente (LC-13A — reutilizado)

| Objeto | Ubicación | Rol | Clasificación |
|--------|-----------|-----|---------------|
| `auth.uid()` stub | LC-13A migration | Sesión vía GUC `request.jwt.claim.sub` | LAB_ONLY → DROP_AFTER_REPLACEMENT |
| `legal_lc13_identity_profiles` | LC-13A migration | Bridge identidad aislado | LAB_ONLY → extendido LC-13B |
| `legal_lc13_read_access_context()` | LC-13A migration | Contexto read RLS | KEEP (sin cambio en este ticket) |
| `legal_lc13_test_set_session(uuid)` | LC-13A migration | Setter sesión validación | LAB_ONLY |
| `legal_lc13_can_read_fiscal()` | LC-13A migration | Gate fiscal seller/client | KEEP — reutilizado en tests |
| `legal_lc13_matches_recipient_scope()` | LC-13A migration | Aislamiento artist | KEEP — reutilizado en tests |
| `legal_lc13_*` helpers + 7 read RPCs | LC-13A migration | RLS + read envelope | KEEP — sin modificación |

**Limitación stub:** identidad resuelve desde `legal_lc13_identity_profiles`, no desde `dj_profiles` / `client_profiles` productivos.

---

## 3. Artefactos LC-13B-SQL creados

| Archivo | Acción |
|---------|--------|
| `supabase/migrations/20260722220000_legal_center_identity_rpc_lc13b.sql` | creado |
| `supabase/scripts/lc13b_isolated_identity_rpc_validation.sql` | creado |

### Migración LC-13B

| Objeto | Propósito |
|--------|-----------|
| `ALTER legal_lc13_identity_profiles` | `profile_status`, `revision`, `mdjb_id`, `brand_scope` |
| `legal_lc13b_secondary_identity_claims` | LAB_ONLY fixture `identity_ambiguous` |
| `legal_resolve_profile_access(text, text)` | RPC SECURITY DEFINER · `auth.uid()` authority |

### Contrato RPC

**Request (autoridad servidor):**

- `p_source_portal` — `staff` \| `artist` \| `client`
- `p_correlation_id` — audit-only; no autoriza

**Prohibido en request:** `actor_id`, `recipient_id`, permisos cliente.

**Success response:**

```json
{
  "ok": true,
  "actor_type": "staff|artist|client",
  "actor_role": "owner|manager|seller|artist|client",
  "business_entity_id": "STAFF-*|ART-*|CLI-*",
  "recipient_scope": "ART-*|null",
  "profile_status": "active|inactive",
  "revision": "ISO8601Z",
  "mdjb_id": "optional",
  "brand_scope": "MDJB",
  "source_version": "lc13b-isolated-v1"
}
```

**Failure codes:** `unauthenticated`, `profile_missing`, `identity_ambiguous`, `portal_mismatch`, `role_unsupported`

**No devuelve:** tokens, storage_key, object_key, fiscal data, PII.

---

## 4. Infraestructura de validación

| Campo | Valor |
|-------|-------|
| Imagen | `postgres:16` |
| Contenedor | `mdjb-lc13b-identity-rpc` (efímero) |
| Container ID | `1947a3f03c2701decf19abd0da5e9f438dd335929337c211513f5eb62ba3033e` |
| Volumen | `mdjb-lc13b-identity-rpc-data` (eliminado) |
| Base | `mdjb_lc13b_identity_validation` |
| Migraciones aplicadas | LC-12 → LC-13A → LC-13B (3 únicamente) |

**Limpieza:** contenedor y volumen eliminados al cierre.

---

## 5. Matriz de seguridad — resultados

| Test | Actor / caso | Resultado |
|------|--------------|-----------|
| `owner_resolve_staff` | owner | PASS |
| `manager_resolve_staff` | manager | PASS |
| `seller_resolve_staff` | seller | PASS |
| `artist_resolve_artist` | artist | PASS |
| `artist_recipient_scope` | artist scope = actor | PASS |
| `client_resolve_client` | client | PASS |
| `client_null_recipient_scope` | client | PASS |
| `anonymous_unauthenticated` | anonymous | PASS |
| `inactive_profile_status` | inactive (success payload) | PASS |
| `inactive_profile_status_value` | profile_status=inactive | PASS |
| `portal_mismatch_owner_artist_shell` | portal mismatch | PASS |
| `profile_missing_unknown_user` | missing profile | PASS |
| `identity_ambiguous_secondary_claim` | ambiguous | PASS |
| `malformed_invalid_portal` | invalid portal | PASS |
| `seller_fiscal_gate_fail_closed` | seller fiscal=false | PASS |
| `artist_cross_tenant_scope` | cross-tenant deny | PASS |
| `timeout_sql_layer` | N/A ApiClient layer | PASS |

**Total:** 17 PASS · 0 FAIL

---

## 6. Compatibilidad LC-13B-TS

| Campo TS | SQL RPC | Estado |
|----------|---------|--------|
| `source_portal` | `p_source_portal` | ✅ |
| `correlation_id` | `p_correlation_id` (ignored auth) | ✅ |
| `ok`, `actor_type`, `actor_role` | presentes | ✅ |
| `business_entity_id` | `actor_id` from stub | ✅ |
| `recipient_scope` | artist=self; client/staff=null | ✅ |
| `profile_status`, `revision` | columnas stub | ✅ |
| `mdjb_id` | opcional | ✅ |
| Failure codes TS | subset implementado | ✅ |

TypeScript **no modificado** — validación por inspección de contrato + respuestas JSON.

---

## 7. Restricciones respetadas

| Prohibido | Cumplido |
|-----------|----------|
| Modificar TypeScript / bridge | ✅ |
| supabase link/start/push | ✅ |
| Producción / remoto | ✅ |
| Cadena 110 migraciones | ✅ |
| Commit / push / deploy | ✅ (sin commit) |

---

## 8. Riesgos y limitaciones

1. RPC lee stub `legal_lc13_identity_profiles` — producción requiere reemplazo por identidad real.
2. `legal_lc13b_secondary_identity_claims` es LAB_ONLY — eliminar tras lookup productivo.
3. Timeout/cancelación no aplican a capa SQL — ApiClient TS.
4. Integración runtime TS↔SQL remota **no autorizada** en este ticket.

---

## 9. Estado final

> **LC-13B SQL IDENTITY RPC IMPLEMENTED IN ISOLATED POSTGRES — LC-13B TYPESCRIPT CONTRACT SATISFIED — SELLER FAIL-CLOSED PRESERVED — PRODUCTION INTEGRATION BLOCKED — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

Handoff: [`SESSION-SUMMARIES/2026-07-22-LC13B-SQL-IDENTITY-RPC-IMPLEMENTATION.md`](../SESSION-SUMMARIES/2026-07-22-LC13B-SQL-IDENTITY-RPC-IMPLEMENTATION.md)
