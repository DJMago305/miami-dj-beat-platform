# TICKET-V2-PHASE-7-DOMAIN-SERVICE-WIRING-001

## Estado

**CORRECCIÓN COMPLETADA — PENDIENTE VALIDACIÓN DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Fase | V2 — Phase 7 |
| Modo | Documentación formal + corrección técnica controlada |
| Fecha | 2026-07-12 |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `af0703a23aaa52927679aecaf96d79daafd617a5` — `feat(v2-api): add supabase adapter` |
| Suite baseline pre-corrección | **597/597 PASS** · **50/50 files** |
| Autorización PO | Q-02 cerrada — primer consumidor de dominio autorizado |
| Push / PR / merge / deploy | ❌ No autorizado en este ticket |

---

## 1. Baseline

| Verificación | Resultado |
|--------------|-----------|
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `af0703a23aaa52927679aecaf96d79daafd617a5` |
| Archivos nuevos (pre-commit) | `shared/services/access-snapshot/*`, `tests/unit/access-snapshot-service.test.ts` |
| Staging | Vacío — sin `git add` |
| Egress real | ❌ Prohibido — solo `MemoryTransport` |

---

## 2. Decisión PO — Q-02 (cerrada)

**Pregunta:** ¿Cuál es el primer RPC de dominio autorizado para wiring V2?

**Respuesta PO (vinculante):**

| Decisión | Valor |
|----------|-------|
| Primer consumidor de dominio | RPC `mdj_access_snapshot` |
| Payload de entrada | `{}` (sin parámetros) |
| `authMode` | `'session'` — obligatorio, sellado |
| `requireSession` | `true` — obligatorio, sellado |
| Anon | ❌ Prohibido |
| Fallback a anon | ❌ Prohibido |
| REST tabular | ❌ Prohibido |
| Otros RPC / Edge | ❌ No autorizados en este ticket |
| Boot wiring | ❌ Diferido |
| SessionProvider directo | ❌ Diferido |
| MOD-003 core | ❌ Sin cambios |

---

## 3. RPC autorizado

| Campo | Valor |
|-------|-------|
| Nombre | `mdj_access_snapshot` |
| Método HTTP | `POST /rest/v1/rpc/mdj_access_snapshot` |
| Params | `{}` |
| Grant SQL | `authenticated`, `service_role` |
| Migración fuente | `supabase/migrations/20260430330000_access_tiers_snapshot_seller_vs_management_rls.sql` |

---

## 4. Contrato SQL real

### Sin sesión (`auth.uid()` nulo)

```json
{ "ok": false, "reason": "no_session" }
```

### Éxito — campos devueltos

```json
{
  "ok": true,
  "profile_kind": "buyer | artist | staff_seller | staff_full | unknown",
  "artist_tier": 0 | 1 | 2 | null,
  "buyer_vip": true | false,
  "role": "admin" | "owner" | "manager" | "seller" | "client" | null
}
```

### Perfil autenticado no clasificado

```json
{ "ok": true, "profile_kind": "unknown", "auth_uid": "<uuid>" }
```

### Semántica de negocio (SQL)

| `profile_kind` | Origen |
|----------------|--------|
| `staff_seller` | `dj_profiles.role = seller` |
| `staff_full` | `dj_profiles.role IN (admin, owner, manager)` |
| `buyer` | `client_profiles` sin staff, o DJ con role client/cliente |
| `artist` | `dj_profiles` sin rol staff |
| `unknown` | Sesión válida sin fila clasificable |

| `artist_tier` | Significado |
|---------------|-------------|
| `0` | Lite |
| `1` | Pro |
| `2` | Elite |

| `buyer_vip` | Significado |
|-------------|-------------|
| `true` | `client_profiles.buyer_billing_tier = vip` |
| `false` | Cliente no VIP |

---

## 5. Seguridad de sesión (sellado)

`fetchSnapshot()` **no** expone `authMode` ni `requireSession` al caller.

Opciones permitidas al caller (`AccessSnapshotFetchOptions`):

- `timeoutMs`
- `context`
- `headers` (no protegidos)
- `signal`
- `retrySafe`

Valores sellados internamente (no sobrescribibles):

```typescript
{ authMode: 'session', requireSession: true }
```

### SessionReader

Ruta única autorizada: **Opción A** — `createAccessSnapshotServiceFromApiClient` exige `sessionReader: SessionReaderPort` explícito.

El adapter recibe la misma instancia para precheck de sesión antes de egress.

---

## 6. Mapper autorizado

Función: `mapAccessSnapshotToProfileResolveInput(value: unknown): AccessSnapshotMappingResult`

### Resultado explícito (sin fallback a guest)

```typescript
type AccessSnapshotMappingResult =
  | { ok: true; profile: ProfileResolveInput; flags: SnapshotFlags }
  | {
      ok: false;
      code:
        | 'ACCESS_SNAPSHOT_REJECTED'
        | 'ACCESS_SNAPSHOT_UNKNOWN_PROFILE'
        | 'ACCESS_SNAPSHOT_UNRESOLVED_STAFF'
        | 'ACCESS_SNAPSHOT_INVALID_PAYLOAD';
      reason?: string;
    };
```

### Reglas de mapping

| RPC `profile_kind` | `ProfileResolveInput` | Notas |
|--------------------|----------------------|-------|
| `buyer` + `buyer_vip: true` | `{ kind: 'client', profileId: 'client.vip' }` | `flags.clientVip: true` |
| `buyer` + `buyer_vip: false` | `{ kind: 'client', profileId: 'client.regular' }` | `flags.clientVip: false` |
| `artist` | `{ kind: 'artist', profileId: 'artist.dj', tier }` | tier desde `artist_tier` |
| `staff_seller` | `{ kind: 'staff', profileId: 'staff.seller' }` | |
| `staff_full` + `owner` | `{ kind: 'staff', profileId: 'staff.owner' }` | |
| `staff_full` + `admin`/`manager` | `{ kind: 'staff', profileId: 'staff.manager' }` | |
| `staff_full` + role ausente/desconocido | **error** `ACCESS_SNAPSHOT_UNRESOLVED_STAFF` | sin elevación |
| `unknown` | **error** `ACCESS_SNAPSHOT_UNKNOWN_PROFILE` | sin guest |
| `ok: false` | **error** `ACCESS_SNAPSHOT_REJECTED` | sin guest |

**Prohibido:** convertir `{ ok: false }` o `profile_kind: 'unknown'` en `{ kind: 'guest' }`.

---

## 7. Flags `clientVip`

Integración MOD-003: la capability `client.vip.benefits` requiere **ambos**:

- `profileId === 'client.vip'`
- `flags.clientVip === true`

El mapper devuelve `flags.clientVip` explícitamente para compradores. No se inventan otras capabilities (`sftOk` permanece fuera de alcance).

---

## 8. Validación runtime

Función: `validateMdjAccessSnapshotPayload(value: unknown)`

Guard functions locales (sin Zod). Valida:

- payload es objeto;
- `ok` es boolean;
- `profile_kind` en conjunto permitido (éxito);
- `artist_tier` number o null;
- `buyer_vip` boolean o null/undefined;
- `role` string o null;
- `reason` string no vacío (rechazo).

Payload malformado en el mapper → `ACCESS_SNAPSHOT_INVALID_PAYLOAD` — no se mapea a perfil.

### Validación en `fetchSnapshot()` (H-01 cerrado)

`fetchSnapshot()` ejecuta `validateMdjAccessSnapshotPayload()` sobre `result.data` **antes** de devolver `ApiSuccess`.

| Flujo | Resultado |
|-------|-----------|
| Adapter `ApiFailure` | Se devuelve sin modificar (401, 403, 500, timeout, cancelación, etc.) |
| Adapter `ApiSuccess` + payload válido | `ApiSuccess` con payload validado |
| Adapter `ApiSuccess` + payload inválido | `ApiFailure` con `API_PARSE_ERROR` — mensaje: `Invalid mdj_access_snapshot response payload` |

La validación del mapper permanece como **defensa adicional** cuando se invoca `mapAccessSnapshotToProfileResolveInput()` de forma independiente.

---

## 9. Superficie pública permitida

### Exportado

| Símbolo | Tipo |
|---------|------|
| `createAccessSnapshotService` | factory |
| `createAccessSnapshotServiceFromApiClient` | factory (sessionReader requerido) |
| `mapAccessSnapshotToProfileResolveInput` | mapper |
| `validateMdjAccessSnapshotPayload` | validación |
| `MDJ_ACCESS_SNAPSHOT_RPC` | constante |
| Tipos en `access-snapshot-types.ts` | types |

### Eliminado de la superficie pública

- `getSupabaseAdapter()` — **prohibido**; el servicio no expone el gateway completo.

---

## 10. Tests exigidos

Archivo: `tests/unit/access-snapshot-service.test.ts`

| # | Caso |
|---|------|
| 1 | RPC exacto `mdj_access_snapshot` |
| 2 | Body `{}` |
| 3 | `authMode: 'session'` sellado |
| 4 | `requireSession: true` sellado |
| 5 | Caller no puede forzar anon (tipo + sellado) |
| 6 | Caller no puede desactivar `requireSession` |
| 7 | Sin sesión → `API_INVALID_PAYLOAD` |
| 8 | HTTP 401 |
| 9 | HTTP 403 |
| 10 | HTTP 500 |
| 11 | Timeout |
| 12 | Cancelación |
| 13 | Payload malformado |
| 14 | `ok: false` no devuelve guest |
| 15 | `profile_kind: unknown` no devuelve guest |
| 16 | Buyer VIP incluye `flags.clientVip` |
| 17 | Staff role desconocido no eleva privilegios |
| 18 | `getSupabaseAdapter` no existe |
| 19 | Sin red real (`MemoryTransport`) |
| 20 | Suite completa verde |

---

## 11. Alcance prohibido

| Área | Estado |
|------|--------|
| `bootstrap/` | ❌ |
| `client/`, `artist/`, `staff/` portales | ❌ |
| `shared/session/` | ❌ |
| `shared/permissions/` (core MOD-003) | ❌ |
| `shared/api/runtime/` | ❌ |
| `shared/api/supabase/` | ❌ |
| `package.json`, lockfile, `tsconfig*` | ❌ |
| `.env`, `.env.example` | ❌ |
| Boot wiring | ❌ |
| Fetch egress real | ❌ |
| Instalar paquetes | ❌ |

---

## 12. Criterios de aceptación

- [x] Ticket formal creado
- [x] Q-02 documentada y cerrada
- [x] `fetchSnapshot()` sellado (`authMode` + `requireSession`)
- [x] `sessionReader` requerido en factory from ApiClient
- [x] Sin fallback silencioso a guest
- [x] `flags.clientVip` para buyer VIP
- [x] `fetchSnapshot()` valida payload RPC antes de `ApiSuccess` (`API_PARSE_ERROR` si inválido)
- [x] `getSupabaseAdapter()` eliminado
- [x] Staff mapping conservador
- [x] Tests ampliados (20 casos)
- [ ] PO valida suite + diff
- [ ] Commit autorizado por PO (futuro)
- [ ] Push con `APROBADO PUSH` (futuro)

---

## 13. Próximo ticket futuro

| Ticket propuesto | Alcance |
|------------------|---------|
| `TICKET-V2-PHASE-7-DOMAIN-SERVICE-BOOT-WIRING-001` | Integrar `createAccessSnapshotServiceFromApiClient` en composition root post-auth |
| `TICKET-V2-PHASE-7-MOD-014-PERMISSION-BRIDGE-001` | Conectar `AccessSnapshotMappingResult` → `PermissionResolver` |
| `TICKET-V2-PHASE-7-FETCH-EGRESS-QA-001` | QA egress real con `FetchTransport` + sesión real (preview only) |

---

## Archivos autorizados (este ticket)

| Acción | Ruta |
|--------|------|
| Crear | `docs/V2/TICKETS/TICKET-V2-PHASE-7-DOMAIN-SERVICE-WIRING-001.md` |
| Modificar | `MiamiDJBeat-MigracionV2/shared/services/access-snapshot/access-snapshot-types.ts` |
| Modificar | `MiamiDJBeat-MigracionV2/shared/services/access-snapshot/access-snapshot-service.ts` |
| Modificar | `MiamiDJBeat-MigracionV2/shared/services/access-snapshot/index.ts` |
| Modificar | `MiamiDJBeat-MigracionV2/tests/unit/access-snapshot-service.test.ts` |
