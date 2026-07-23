# TICKET-V2-LEGAL-CENTER-LC-13B-IDENTITY-INTEGRATION-DISCOVERY-001

## Estado

**LC-13B IDENTITY INTEGRATION DISCOVERY COMPLETADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

| Campo | Valor |
|-------|-------|
| Ticket | LC-13B — Identity Integration Discovery |
| Modo | Discovery + arquitectura — **sin implementación** |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `043f2cc5f86e1b9a2d8b7dfc735ea455a5727a09` |
| Fecha | 2026-07-22 |
| SQL / runtime / Supabase | ❌ NO |
| Commit | ❌ **NO autorizado en este ticket** |
| Producción / deploy | ❌ **NOT_AUTHORIZED** |

---

## 1. Contexto aprobado

| Estado | Valor |
|--------|-------|
| LC-12 DDL | **APPROVED_BY_PO_IN_ISOLATED_POSTGRES** |
| LC-13 discovery | **APPROVED** |
| LC-13A read security | **VALIDATED_IN_ISOLATED_POSTGRES** (commit local `043f2cc`) |
| LC-13B runtime bridge | ✅ Live en V2 lab (`resolveLegalReadAccessContextFromSession`) |
| LC-13B **SQL / producción identity** | ❌ **PENDIENTE** — objeto de este discovery |
| Bootstrap legacy | **BLOCKED_BY_LEGACY_BOOTSTRAP_DEBT** |
| Producción | **NOT_AUTHORIZED** |

**Principio:** la identidad legal productiva **no** es `legal_lc13_identity_profiles`. Ese artefacto es stub de validación aislada LC-13A.

---

## 2. Inventario de identidades (FASE 2)

### 2.1 Identidades técnicas

| Identidad | Origen | Persistencia | Propietario | Estabilidad | Ciclo de vida | Riesgo |
|-----------|--------|--------------|-------------|-------------|---------------|--------|
| **`auth.users.id`** | Supabase Auth signup/login | Postgres `auth.users` | Plataforma Auth | Alta (UUID inmutable) | Create on signup · delete account policy | Medio — no usar solo para autorización legal |
| **Session `userId`** | Session MOD-002 tras login | Memoria cliente + token binding | SessionService | Sesión | Login → refresh → expire | Medio — debe igualar `auth.uid()` en RPC |
| **Opaque bearer** | Session store / ApiClient | Client memory (no localStorage role) | Session transport | Por sesión | Rotación refresh | Bajo si no se parsea JWT en cliente para roles |
| **JWT claims (`app_metadata.role`)** | Supabase JWT | Token payload | Auth (legacy) | Puede desincronizar | Re-login refresh | **Alto** — Constitución: **no** fuente de verdad operativa |
| **`mdj_access_snapshot` RPC** | Postgres `dj_profiles` + `client_profiles` | Computed per call | Staff/management RLS | Alta en prod con DB | Login/refresh attach | Medio — requiere `dj_profiles` en stack |

### 2.2 Identidades de negocio (Legal Center)

| ID | Origen | Persistencia | Propietario | Estabilidad | Ciclo de vida | Riesgo |
|----|--------|--------------|-------------|-------------|---------------|--------|
| **`STAFF-*`** | Staff actor policy / fixtures | Audit + legal rows `requested_by_*` | Staff profile row | Alta convención | Staff hire/role change | Medio — mapeo auth→STAFF PO |
| **`ART-*`** | DJ roster / legal recipient | `legal_*` rows `recipient_id` | Artist profile | Alta dominio | Onboarding artista | **Alto** — cross-tenant si mal mapeado |
| **`CLI-*`** | Client profile | `legal_*` rows `recipient_id` | Client profile | Alta dominio | Client signup | **Alto** — fiscal isolation |
| **`MDJB-*-C\|A\|S\|M`** | `mdjb_account_ids` triggers | Postgres | CASM sync | Alta pública | Profile class change | Bajo legal read — correlación |
| **`SPC-*` / `LDI-*` / etc.** | Legal domain generators | LC-12 tables | SYSTEM/staff | Alta | Document lifecycle | Medio — no confundir con actor |

### 2.3 Identidades legales extendidas (futuro)

| Identidad | Origen | Persistencia | Estado |
|-----------|--------|--------------|--------|
| **invited-recipient** | Public link token (futuro) | Token table + scope | DEFER |
| **anonymous** | Sin sesión | — | DENY direct read (LC-13A) |
| **signer** | E-sign provider / in-app | Envelope id → LDI | DEFER |
| **external recipient** | Email link / vendor | Token-scoped | DEFER |

---

## 3. Mapa de resolución (FASE 3)

```
auth.users.id (auth.uid() en Postgres)
        ↓
SessionSnapshot (MOD-002) — userId, portal shell, mdjbId
        ↓
AccessPermissionOrchestrator → mdj_access_snapshot RPC
        ↓
PermissionSnapshot — documentedRole, profile.kind, capabilities
        ↓
LegalProfileLookupPort — authUserId + profileKind → legalRecipientId (ART-* / CLI-* / STAFF-*)
        ↓
LegalReadAccessContext — actorType, role, portal, actorId, recipientScope
        ↓
[Producción futura] Postgres SET request.jwt.claim.sub + helpers OR RPC pre-check
        ↓
RLS policies (LC-13A) — row filters
        ↓
RPC read SECURITY INVOKER (LC-13A) — envelope + column sanitization
        ↓
Portal UI — Staff / Artist / Client shells
```

### 3.1 ¿Quién resuelve qué?

| Pregunta | Autoridad | Notas |
|----------|-----------|-------|
| **¿Roles?** | Postgres `dj_profiles.role` → `mdj_access_snapshot` → `documentedRole` → bridge `role` | V1 candado. V2 **no** lee JWT solo. |
| **¿Permisos read?** | `LegalReadAccessContext` guard fns + RLS + RPC gates | Triple capa; params RPC **no** autoritativos. |
| **¿Tenant?** | Single-brand MDJB; aislamiento por `recipient_id` + staff band | No multi-tenant SaaS externo hoy. |
| **¿Fiscal access?** | `canReadFiscalLegalData()` + RLS `legal_lc13_can_read_fiscal()` equivalent | Seller/client deny; artist own; staff owner/manager allow. |

**Runtime actual (lab):** pasos 1–8 completos en TypeScript (`legal-identity-bridge.ts`). Paso Postgres identity **stub** (`legal_lc13_identity_profiles`).

---

## 4. Contrato conceptual LC-13B — `LegalIdentityContext` (FASE 4)

Tipo **propuesto** (documentación only — **no** TypeScript en este ticket). Envuelve inputs del bridge + metadatos para auditoría y futura migración SQL.

| Campo | Obligatorio | Origen | Estabilidad | Uso esperado |
|-------|-------------|--------|-------------|--------------|
| `auth_user_id` | ✅ | `session.user.userId` / `auth.uid()` | Alta | Clave lookup DB |
| `session_id` | ○ | SessionSnapshot | Sesión | Correlación audit |
| `actor_type` | ✅ | Mapped from profile kind | Alta | RLS branch |
| `actor_role` | ✅ | `documentedRole` → short role | Alta | Fiscal/audit gates |
| `business_entity_id` | ✅ | `LegalProfileLookupPort.legalRecipientId` | Alta | `actorId` en LC-11 context |
| `legal_profile_id` | ○ | Lookup record | Media | Correlación fixtures/DB |
| `tenant_scope` | ○ | Constant MDJB single-tenant | Alta | Futuro multi-site |
| `fiscal_scope` | ✅ derivado | `canReadFiscalLegalData(context)` | Por request | Pre-gate RPC |
| `recipient_scope` | ○ artist | Same as `business_entity_id` | Alta | `matchesRecipientScope` |
| `permissions` | ○ | Capability snapshot | Sesión | Pre-gate UX only |
| `correlation_id` | ○ | Request/LAC-* | Por operación | Audit writes futuro |
| `source_portal` | ✅ | Effective portal (not URL alone) | Alta | Portal mismatch detection |
| `mdjb_id` | ○ | Session user | Alta | Support / display |
| `resolution_source` | ✅ | `snapshot` \| `memory_fixture` \| `sql_stub` | Debug | Clasificar lab vs prod |

**Relación con tipos existentes:**

- **`LegalReadAccessContext`** — subset autoritativo para read repos (mantener; no duplicar flags boolean).
- **`LegalIdentityContext`** — superset transporte + trazabilidad para integración Edge/RPC/SQL.

---

## 5. Compatibilidad LC-13A (FASE 5)

| Pieza LC-13A | Clasificación | Acción futura |
|--------------|---------------|---------------|
| RLS SELECT policies (7 tablas) | **KEEP** | Mantener lógica; rewire helpers a identidad productiva |
| DELETE deny policies | **KEEP** | Sin cambio |
| Audit append-only trigger (LC-12) | **KEEP** | Sin cambio |
| 7 RPC read `SECURITY INVOKER` | **KEEP** | Contratos LC-13A-RPC-CONTRACT-MATRIX |
| Helpers `legal_lc13_can_read_fiscal()` etc. | **REPLACE** | Implementación lee identidad real (`dj_profiles` / lookup) no stub table |
| `legal_lc13_read_access_context()` | **REPLACE** | Sustituir lectura de stub por función SECURITY DEFINER acotada o JWT + profile join |
| `legal_lc13_identity_profiles` | **REMOVE** (prod) | Solo validación aislada |
| `legal_lc13_test_set_session()` | **REMOVE** (prod) | Test-only |
| `auth.uid()` stub schema | **REPLACE** | Supabase native `auth.uid()` |
| `LegalReadAccessContext` (TS) | **KEEP** | Bridge ya lo produce |
| `resolveLegalReadAccessContextFromSession` | **KEEP** | Caller RPC client-side pre-check |
| `MemoryLegalProfileLookup` | **KEEP** (lab) | Reemplazar adapter prod: Supabase lookup RPC |
| Public link token identity | **DEFER** | Ticket LC-13+ |

---

## 6. Impacto por portal (FASE 6)

| Capacidad | Staff Owner | Staff Manager | Staff Seller | Artist | Client |
|-----------|-------------|---------------|--------------|--------|--------|
| Ver W-9 workflow | ✅ | ✅ | ❌ | ✅ own | ❌ |
| Ver templates W-9 (`SPC-001`) | ✅ | ✅ | ❌ | ✅ flow | ❌ |
| Ver public library templates | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver instancias fiscales ajenas | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver propias instancias | ✅ all | ✅ all | ❌ ops TBD | ✅ own | ✅ own |
| Auditoría raw | ✅ | ✅ | ❌ | 📋 projection | ❌ |
| Submissions deleted | ✅ | ❌ | ❌ | ❌ | ❌ |
| Descargar PDF (signed URL) | ✅ future | ✅ future | ❌ | ✅ own future | ✅ own future |

**Información que nunca debe cruzarse:**

- `storage_key` / `object_key` en listados browser
- Fiscal rows entre `ART-*` / `CLI-*` distintos
- Audit raw seller/client
- JWT role sin snapshot validation
- `previewRole` / query `recipient_id` como autoridad

**Portal shell rule (bridge live):** `session.portal` debe coincidir con `profile.kind` → else `portal_mismatch`.

---

## 7. Deuda legacy (FASE 7)

| Componente | Relación LC-13B | Clasificación |
|------------|-----------------|---------------|
| **`dj_profiles`** | Fuente staff role para `mdj_access_snapshot` | **BLOCKED_BY_BOOTSTRAP** en cadena vacía · **SAFE** en prod remota existente |
| **`is_staff()` / `is_staff_management()`** | RLS V1 global; LC-13A usa helpers paralelos | **BLOCKED_BY_BOOTSTRAP** apply local · diseño referencia **SAFE_TO_CONTINUE** |
| **`auth.users`** | `auth.uid()` en RPC/RLS productivo | **SAFE_TO_CONTINUE** (Supabase) · no integrado en stub LC-13A |
| **110 migraciones** | LC-12+#111 LC-13A no alcanzables desde vacío | **BLOCKED_BY_BOOTSTRAP** |
| **V2 bridge TypeScript** | Independiente de cadena | **SAFE_TO_CONTINUE** |
| **LC-13A aislado** | Validó SQL sin `dj_profiles` | **SAFE_TO_CONTINUE** |
| **Integración bridge→RLS prod** | Requiere lookup SQL + stack completo o pipeline V2 | **BLOCKED_BY_BOOTSTRAP** hasta baseline o PG aislado extendido |

**No decidir solución bootstrap en este ticket.**

---

## 8. Dependencias futuras (FASE 8)

| Capacidad | Depende de LC-13B identity? | Notas |
|-----------|----------------------------|-------|
| **Write workflows** | ✅ Sí | `LegalWorkflowActor` + system actor; staff band from snapshot |
| **Public links** | ✅ Parcial | Token identity **adicional** a session; invited-recipient scope |
| **Firmas (e-sign)** | ✅ Parcial | Signer may be anonymous/token; audit actor mapping |
| **Storage signed URLs** | ✅ Sí | Fiscal gate before URL mint |
| **Email delivery** | ○ Indirecto | Edge uses service role; not browser identity |
| **Webhooks** | ○ System | `actorType=system`; no LC-13B browser bridge |

Orden documentado:

1. LC-13B production lookup adapter (Supabase RPC)
2. LC-13A helper rewire (REPLACE stub)
3. ApiClient `rpc()` legal read with session
4. Writes / public links / storage (tickets separados)

---

## 9. Wiring existente (referencia — no modificado)

| Componente | Ubicación | Rol |
|------------|-----------|-----|
| Bridge | `…/identity/legal-identity-bridge.ts` | Session → LegalReadAccessContext |
| Lookup port | `…/identity/legal-profile-lookup-port.ts` | Boundary adapter |
| Memory lookup | `…/identity/memory-legal-profile-lookup.ts` | Lab fixtures |
| Role mapper | `…/identity/legal-read-role-mapper.ts` | documentedRole → context |
| Access context | `…/legal-read-access-context.ts` | Guards + type |
| Session | `shared/session/runtime/` | MOD-002 foundation |
| Snapshot | `shared/services/access-snapshot/` | `mdj_access_snapshot` |
| Orchestrator | `shared/services/access-permissions/` | Permission attach |
| Staff legal wire | `staff/legal/staff-legal-provider-wire.ts` | Bridge + provider factory |
| LC-13B-0 docs | `docs/V2/LEGAL/LC-13B-0-*` | Contrato previo |

---

## 10. Gap analysis — bridge live vs SQL LC-13A

| Capacidad | V2 TS bridge | LC-13A SQL stub | Producción target |
|-----------|--------------|-----------------|-------------------|
| Resolve role | ✅ snapshot | ✅ stub table | `mdj_access_snapshot` + SQL helper |
| Map ART-/CLI- | ✅ memory bindings | ✅ stub rows | RPC lookup `auth.uid()` → business ID |
| Portal mismatch | ✅ enforced | N/A | Mantener en bridge antes RPC |
| RLS enforcement | Memory repos only | ✅ Postgres | Postgres con identidad real |
| Fail-closed seller | ✅ | ✅ validated 22 tests | Unchanged policy |

---

## 11. Restricciones respetadas

| Prohibido | Cumplido |
|-----------|----------|
| SQL / migraciones | ✅ |
| Runtime TypeScript changes | ✅ |
| Supabase / Docker | ✅ |
| Commit / push / deploy | ✅ |

---

## 12. Estado final

> **LC-13B IDENTITY INTEGRATION DISCOVERY COMPLETADO — PENDIENTE DE REVISIÓN Y APROBACIÓN PO**

**Recomendación provisional:**

1. Mantener `LegalReadAccessContext` como contrato read canónico.
2. Introducir `LegalIdentityContext` solo si PO aprueba capa de transporte unificada (writes + audit).
3. Reemplazar stub LC-13A en ticket SQL futuro con lookup productivo — **no** mezclar con bootstrap repair.
4. Implementar `LegalProfileLookupPort` Supabase antes de conectar ApiClient a RPC read prod.
5. No sustituir LC-13B bridge runtime — **extender** adapter lookup.

Handoff: [`SESSION-SUMMARIES/2026-07-22-LC13B-IDENTITY-DISCOVERY.md`](../SESSION-SUMMARIES/2026-07-22-LC13B-IDENTITY-DISCOVERY.md)
