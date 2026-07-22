# LEGAL CENTER LC-13B — END OF SESSION HANDOFF

**Ticket:** TICKET-V2-LC-13B-DOCUMENTATION-CLOSEOUT-001
**Fecha:** 2026-07-22
**Modo:** Documentación post-aprobación PO — **sin commit en este ticket**

---

## 1. Baseline Git

| Campo | Valor |
|-------|-------|
| **Rama** | `plan/v2-phase-4-api-client` |
| **HEAD base** | `c66a839d773baf75e169e0568864e528fb0ce98c` |
| **Último commit** | `docs(v2-legal): approve identity bridge discovery` |
| **Working tree** | Cambios LC-13B runtime + tests **sin commit** · docs handoff 2026-07-21 + este cierre **sin commit** |

---

## 2. Estado Product Owner

| Ticket | Estado |
|--------|--------|
| **LC-13B — Identity Bridge & Legal Profile Lookup Implementation** | ✅ **APROBADO TÉCNICAMENTE POR PRODUCT OWNER** |

Incluye hardening fail-closed (`TICKET-V2-LC-13B-FAIL-CLOSED-INTEGRATION-HARDENING-001`).

---

## 3. Resumen de implementación

LC-13B implementa la capa local descubierta en LC-13B-0:

- **`resolveLegalReadAccessContextFromSession()`** — bridge Session + PermissionSnapshot + lookup → `LegalReadAccessContext`
- **`LegalProfileLookupPort`** — contrato de lookup desacoplado (futuro adapter Supabase)
- **`createMemoryLegalProfileLookup()`** — adapter in-memory con bindings lab
- **`staff-legal-provider-wire.ts`** — rol staff desde bridge de sesión; **`previewRole` sin autoridad**; fail-closed → `staff_seller`

**Sin:** Supabase remoto · SQL · RLS · RPC SQL · migration apply · deploy.

---

## 4. Arquitectura

```
SessionSnapshot
      +
PermissionSnapshot
      +
LegalProfileLookupPort  ← MemoryLegalProfileLookup (lab)
      ↓
resolveLegalReadAccessContextFromSession()
      ↓
LegalReadAccessContext
```

| Componente | Ruta |
|------------|------|
| Bridge | `MiamiDJBeat-MigracionV2/shared/services/legal/persistence/identity/legal-identity-bridge.ts` |
| Tipos / errores | `…/identity/legal-identity-bridge-types.ts` |
| Puerto lookup | `…/identity/legal-profile-lookup-port.ts` |
| Adapter in-memory | `…/identity/memory-legal-profile-lookup.ts` |
| Role mapper | `…/identity/legal-read-role-mapper.ts` |
| Staff wire | `MiamiDJBeat-MigracionV2/staff/legal/staff-legal-provider-wire.ts` |

---

## 5. Flujo de resolución (9 pasos LC-13B-0)

1. Validar sesión (`user`, `SESSION_EXPIRED` → error estructurado)
2. Resolver rol documentado desde `PermissionSnapshot` (guest → `role_unresolved`)
3. Mapear `DocumentedRoleId` → `actorType` / `role` / portal efectivo
4. Comparar portal shell (`session.portal`) vs identidad efectiva → `portal_mismatch` si difieren
5. Buscar perfil legal vía `LegalProfileLookupPort` (`authUserId` + `profileKind`)
6. Aplicar invariantes (`validateLegalReadAccessContextInvariants`)
7. Construir `LegalReadAccessContext` con `actorId` business ID
8. Retornar contexto congelado o error (`identity_unavailable`, `profile_missing`, etc.)
9. Consumidor (wire / repos) usa guards LC-11 existentes

---

## 6. IDs empresariales (actorId)

| actorType | actorId MUST be | MUST NOT be |
|-----------|-----------------|-------------|
| staff | `STAFF-OWNER-001` · `STAFF-MANAGER-001` · `STAFF-SELLER-001` | UUID auth crudo |
| artist | `ART-*` (lab: `ART-DEMO-001`) | UUID auth crudo |
| client | `CLI-*` (lab: `CLI-001`) | UUID auth crudo |

**Regla PO:** raw `auth.uid()` / `session.user.userId` **nunca** es `actorId` legal.

---

## 7. Seguridad confirmada

| Control | Comportamiento |
|---------|----------------|
| `previewRole` URL | **Sin autoridad** — wire ignora query param |
| `portal_mismatch` | Fail-closed — bridge deniega contexto |
| Guest / anónimo | Wire → `staff_seller` |
| `clearSession()` post-owner | No conserva owner — wire → `staff_seller` |
| Owner/Manager vía URL | **Imposible** sin snapshot staff autorizado |
| Supabase / SQL | **No conectado** |

---

## 8. Tests añadidos

| Capa | Archivo | Cantidad |
|------|---------|----------|
| Unit bridge | `tests/unit/legal-identity-bridge.test.ts` | **14** tests |
| Integración wire | `tests/integration/legal-portal-injection.test.ts` | +3 hardening + wire session |

**Casos hardening (integración):**

- `CASO A — guest session resolves staff_seller and denies owner/manager privileges`
- `CASO B — previewRole=owner with guest session cannot elevate to owner or manager`
- `CASO C — cleared session without valid identity resolves fail-closed to staff_seller`

---

## 9. Validaciones finales

| Gate | Resultado |
|------|-----------|
| `npm test -- --run` | ✅ **1046/1046 PASS** · **80/80 files** |
| `npm run typecheck` | ✅ exit 0 |
| HTTP localhost | ✅ **5/5** (matriz §10) |
| `git diff --check` | ✅ PASS |
| Migration LC-12 aplicada | ❌ NO |
| Supabase remoto | ❌ NO |

---

## 10. Matriz HTTP

| URL | HTTP | Notas |
|-----|------|-------|
| `http://localhost:5173/staff/` | 200 | Portal staff |
| `http://localhost:5173/staff/?previewRole=seller` | 200 | Shell OK; rol desde sesión, no URL |
| `http://localhost:5173/artist/` | 200 | Portal artist |
| `http://localhost:5173/client/` | 200 | Portal client |
| `http://localhost:5173/shared/services/legal/assets/templates/tax/SPC-001/TV-SPC-001-1/fw9-corporate.pdf` | 200 | `Content-Type: application/pdf` · body `%PDF-1.7` |

---

## 11. Nota forense (tsx / Node bare)

Durante diagnóstico HTTP se ejecutó ad-hoc:

```bash
npx tsx -e "import ... legal-template-asset-urls.ts ..."
```

**Error reproducible:**

```
SyntaxError: Unexpected token '%'
at legal-template-asset-urls.ts:3:32
```

**Causa:** línea 3 importa `.pdf?url` — contrato **Vite-only** (LC-5). Node/tsx bare intenta parsear `%PDF-1.7` como JavaScript.

**Clasificación:** diagnóstico ad-hoc · **no** fallo de pipeline · **no** regresión LC-13B (`legal-template-asset-urls.ts` sin diff desde LC-5).

**Gates oficiales:** typecheck + vitest PASS.

---

## 12. Restricciones respetadas

| Prohibido | Estado |
|-----------|--------|
| commit (este ticket doc) | ❌ NO |
| push / merge / PR / deploy | ❌ NO |
| SQL / migrations apply | ❌ NO |
| Supabase remoto | ❌ NO |
| Producción V2 | ❌ NO |

**Regla global PO:** V2 no a producción hasta aprobación explícita del Product Owner de toda la plataforma.

---

## 13. Handoff anterior (contexto)

`docs/V2/SESSION-SUMMARIES/2026-07-21-LEGAL-CENTER-END-OF-SESSION.md` describe estado **PRE-LC-13B** (1029 PASS · LC-13B no iniciado). **No modificar** — histórico.

---

## 14. Próximo paso recomendado

Según `TICKET-V2-LEGAL-CENTER-LC-13B-0-IDENTITY-BRIDGE-DISCOVERY-AND-CONTRACT-001` §19 y LC-13A:

**LC-13B RLS/RPC** — SQL policies + 7 read RPCs de lectura Legal Center.

**Gate PO:** bridge LC-13B live (✅ local) + LC-12 migration apply local autorizada por ticket separado.

**LC-13B RLS/RPC no debe iniciarse** sin ticket PO explícito (RLS · RPC SQL · migration apply · Supabase remoto requieren ampliación).

---

## 15. Archivos runtime LC-13B (pendientes de commit selectivo PO)

| Path | Rol |
|------|-----|
| `shared/services/legal/persistence/identity/**` | Bridge + lookup |
| `shared/services/legal/persistence/index.ts` | Export identity |
| `staff/legal/staff-legal-provider-wire.ts` | Wire sesión |
| `tests/unit/legal-identity-bridge.test.ts` | Unit 14 |
| `tests/integration/legal-portal-injection.test.ts` | Integración + hardening |

---

*Documentación únicamente — TICKET-V2-LC-13B-DOCUMENTATION-CLOSEOUT-001 — sin commit*

**SESIÓN DOCUMENTADA — LC-13B CERRADO — LISTA PARA COMMIT SELECTIVO PO**
