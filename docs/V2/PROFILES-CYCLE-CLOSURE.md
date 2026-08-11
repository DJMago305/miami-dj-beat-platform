# PROFILES V2 — Cycle Closure (Pasos 0–7)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/PROFILES-CYCLE-CLOSURE.md` |
| **Fase** | Plan §4 — **Paso 8** (documentación + cierre de ciclo) |
| **Fecha** | 2026-08-11 |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · `http://localhost:5173` |
| **Tipo** | Auditoría documental — **sin SQL** · **sin commit** · **sin deploy** · **sin writers** |
| **Jerarquía** | Bajo Constitución + Protocolo PO + [PROFILE-TAXONOMY.md](./PROFILE-TAXONOMY.md) · matriz [PROFILES-V1-V2-MAPPING-MATRIX.md](./PROFILES-V1-V2-MAPPING-MATRIX.md) |
| **Suite perfiles (Vitest)** | **55/55 PASS** (archivos de contrato + UI Slice 1) |
| **Typecheck** | `tsc --noEmit` exit 0 (lab) |
| **Portales** | `/client/` · `/artist/` · `/staff/` → HTTP **200** |

---

## 1. Veredicto

El ciclo de **Read Model de Perfiles V2** (discovery → contratos → servicio → identidad → UI Slice 1 en tres portales) queda **cerrado en laboratorio** bajo gobernanza read-only.

| Criterio | Estado |
|----------|--------|
| Matriz DTO canónica | ✅ Paso 1 |
| Types + mocks + taxonomy resolve | ✅ Paso 2 |
| ProfilesService fetch read-only | ✅ Paso 3 |
| Identity map → profile-matrix + flags | ✅ Paso 4 |
| MOD-204 Artist Profile Read UI | ✅ Paso 5 |
| MOD-103 Client Profile Read UI | ✅ Paso 6 |
| MOD-301 Staff Identity Read UI | ✅ Paso 7 |
| Documentación + índices | ✅ Paso 8 (este documento) |
| Writers / SQL / RLS / commit / deploy | ❌ Fuera de alcance (prohibido) |

---

## 2. Arquitectura Read Model (resumen)

```text
mdj_access_snapshot() ──► AccessSnapshotDTO
        │
        ├─(+ enrichment)──► classifyPlatformIdentity() ──► profile-matrix + flags
        │
        ├─ GET client_profiles ──► ClientProfileReadDTO ──► MOD-103 UI (client/)
        ├─ GET dj_profiles      ──► ArtistProfileReadDTO ──► MOD-204 UI (artist/)
        └─ role + profile_kind  ──► StaffIdentityDTO      ──► MOD-301 UI (staff/)
                                      │
                                      └─ PublicArtistCardDTO (roster; sin PII billing)
```

### 2.1 DTOs canónicos

| DTO | Origen V1 | Consumo lab | Notas |
|-----|-----------|-------------|-------|
| **AccessSnapshotDTO** | RPC `mdj_access_snapshot` | Boot, identity map, staff UI | Foto de acceso ≠ perfil de producto |
| **ClientProfileReadDTO** | `client_profiles` | MOD-103 Slice 1 | VIP / commercial / billing PII aislado+masked |
| **ArtistProfileReadDTO** | `dj_profiles` (owner) | MOD-204 Slice 1 | Legal name ≠ stage; Lite/Pro/Elite; SFT gate |
| **PublicArtistCardDTO** | `public_dj_profiles` | Servicio read (sin UI Slice 1 en este ciclo) | Sin email / fullName / Stripe |
| **StaffIdentityDTO** | `dj_profiles.role` + taxonomy | MOD-301 Slice 1 | Seller limited vs full management |

**Barrel / spec lab:** `MiamiDJBeat-MigracionV2/shared/services/profiles/` · `PROFILES-SPEC.md`

### 2.2 Servicio (Paso 3) — solo lectura

| Método | Sesión |
|--------|--------|
| `fetchOwnAccessSnapshot()` | Requerida |
| `fetchOwnArtistProfile()` | Requerida |
| `fetchOwnClientProfile()` | Requerida |
| `fetchPublicArtistCard(handle)` | No |
| `fetchOwnIdentityClassification()` | Requerida (enrichment) |

**Prohibido:** `insert` · `update` · `upsert` · `delete` · mutación de roles.

### 2.3 Identidad (Paso 4) — gaps cerrados en capa lab

| Gap | Resolución lab (sin SQL) |
|-----|--------------------------|
| VIP | `buyer_vip` / enrichment → `client.vip` |
| Commercial | `client_profiles.is_commercial` enrichment |
| Artist tier | `artist_tier` → Lite/Pro/Elite + `sftOk` |
| Staff seller vs full | `staff_seller` / `staff_full` + `role` |
| Principal | `buyer` \| `performer` \| `staff` |

Gaps **heredados** que siguen documentados en la matriz §7 (G3 specialty enum, G6 seed drift, social URLs no mapeadas en DTO) — **no** “resueltos” por magia; UI muestra empty state donde aplica.

---

## 3. Integración portales (`localhost:5173`)

| Portal | Módulo | Slot dashboard | Artefactos UI |
|--------|--------|----------------|---------------|
| **Artist** `/artist/` | MOD-204 Slice 1 | `data-mdj-artist-section="artist-profile"` | `artist/profile/*` |
| **Client** `/client/` | MOD-103 Slice 1 | `data-mdj-client-section="client-profile"` | `client/profile/*` |
| **Staff** `/staff/` | MOD-301 Slice 1 | `data-mdj-staff-section="staff-profile"` | `staff/identity/*` |

Patrón común:

1. ViewModel puro (DTO → display)
2. Renderer DOM read-only (cero forms / save / assign role)
3. Mount sync (lab mock) + async opcional (`ProfilesService`)
4. Spec Vitest dedicado

---

## 4. Cobertura de pruebas (ciclo perfiles)

| Bloque | Archivo(s) | Tests |
|--------|------------|------:|
| Paso 2 contracts | `tests/unit/profiles.spec.ts` | 8 |
| Paso 3 service | `tests/unit/profiles.service.spec.ts` | 8 |
| Paso 4 identity | `tests/unit/profiles.identity-map.spec.ts` | 9 |
| Paso 5 artist UI + dashboard | `artist-profile-read-view.spec.ts` · `artist-dashboard-mvp.test.ts` | 9 |
| Paso 6 client UI + dashboard | `client-profile-read-view.spec.ts` · `client-dashboard-mvp.test.ts` | 11 |
| Paso 7 staff UI + dashboard | `staff-identity-read-view.spec.ts` · `staff-dashboard-mvp.test.ts` | 10 |
| **Total ciclo** | | **55** |

Comando de verificación (lab):

```bash
cd MiamiDJBeat-MigracionV2
npx vitest run \
  tests/unit/profiles.spec.ts \
  tests/unit/profiles.service.spec.ts \
  tests/unit/profiles.identity-map.spec.ts \
  tests/unit/artist-profile-read-view.spec.ts \
  tests/unit/artist-dashboard-mvp.test.ts \
  tests/unit/client-profile-read-view.spec.ts \
  tests/unit/client-dashboard-mvp.test.ts \
  tests/unit/staff-identity-read-view.spec.ts \
  tests/unit/staff-dashboard-mvp.test.ts
npx tsc --noEmit
```

---

## 5. Gobernanza respetada

| Barrera | Cumplimiento |
|---------|--------------|
| Read-only UI + service | ✅ |
| Cero DDL/DML / RLS | ✅ |
| Cero commit / push / deploy | ✅ (artefactos `M` / `??` locales) |
| V1 `web/` · Weather · Finanzas · Agenda | ✅ Intactos |
| Portales cruzados no regresivos | ✅ `/client/` `/artist/` `/staff/` 200 |

---

## 6. Inventario de rutas clave

| Área | Ruta |
|------|------|
| Matriz discovery | `docs/V2/PROFILES-V1-V2-MAPPING-MATRIX.md` |
| Este cierre | `docs/V2/PROFILES-CYCLE-CLOSURE.md` |
| Taxonomía | `docs/V2/PROFILE-TAXONOMY.md` |
| Spec servicio | `MiamiDJBeat-MigracionV2/shared/services/profiles/PROFILES-SPEC.md` |
| Types / service / identity | `…/profiles.types.ts` · `profiles.service.ts` · `profiles.identity-map.ts` |
| Pointer arquitectura | `docs/V2/ARCHITECTURE/PROFILE-V1-TO-V2-READ-MODEL-MATRIX-001.md` |

---

## 7. Fuera de alcance (post-ciclo)

Requieren **ticket + OK PO** explícito:

- Writers de perfil (MOD-103 / MOD-204 edit)
- Extensión SQL de `mdj_access_snapshot` (commercial / sft_ok en RPC)
- Social URLs / residency schedule en DTO
- Wiring productivo de `ProfilesService` a auth session real en boot
- Commit / push / merge / deploy
- Cambios catálogo MODULE status PLANIFICADO → PRODUCCIÓN (producto)

---

## 8. Hoja de ruta Pasos 0–8

| Paso | Entregable | Estado |
|------|------------|--------|
| 0 | Workspace lab aislado | ✅ |
| 1 | Discovery matrix docs | ✅ |
| 2 | Contratos read-only | ✅ 8 tests |
| 3 | Servicio fetch | ✅ 16 acum. |
| 4 | Identity map | ✅ 25 acum. |
| 5 | MOD-204 UI artist | ✅ 34 acum. |
| 6 | MOD-103 UI client | ✅ 45 acum. |
| 7 | MOD-301 UI staff | ✅ 55 acum. |
| 8 | Documentación cierre | ✅ |

---

*Paso 8 — cierre documental ciclo perfiles V2 — 2026-08-11 — documentation only — no commit*
