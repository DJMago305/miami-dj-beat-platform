# Profiles Domain Service — SPEC

| Campo | Valor |
|-------|--------|
| **Módulo** | `shared/services/profiles` |
| **Fase** | Plan §4 — **Paso 2** |
| **Fecha** | 2026-08-11 |
| **Matriz canónica** | `docs/V2/PROFILES-V1-V2-MAPPING-MATRIX.md` |
| **Taxonomía** | `docs/V2/PROFILE-TAXONOMY.md` |
| **Runtime** | Lab `http://localhost:5173` only |
| **Estado** | Contrato TypeScript + mappers **read-only** — **sin writers** · **sin SQL** · **sin commit** |

---

## 1. Objetivo

Definir el **read model de dominio** para perfiles V1 consumible por Shared Core y portales V2:

- `ClientProfileReadDTO` (MOD-103)
- `ArtistProfileReadDTO` (MOD-204 owner)
- `PublicArtistCardDTO` (roster / vista pública)
- `StaffIdentityDTO` (staff shell)
- Helpers de resolución de taxonomía a partir de señales V1 / snapshot

**No** implementa fetch HTTP, Supabase queries, ni mutaciones.

---

## 2. Dependencias permitidas

- `../../permissions/runtime/types` (reutilizar `ClientProfileId`, `ArtistTier`, `ArtistCategory`, `StaffProfileId`, …)
- Ninguna dependencia de `client/` · `artist/` · `staff/` · V1 `web/`

---

## 3. Prohibiciones (Paso 2)

| Prohibido | Motivo |
|-----------|--------|
| Writers / `update*` / `insert*` | Ticket futuro + zona roja RLS |
| SQL / migraciones | Cero mutación schema |
| Llamadas RPC reales | Paso 3+ (wiring API) |
| Cambiar `mdj_access_snapshot` SQL | Zona roja |
| Commit / push / deploy | Gobernanza PO |

---

## 4. Archivos

| Archivo | Rol |
|---------|-----|
| `PROFILES-SPEC.md` | Este contrato |
| `profiles.types.ts` | **Canónico** — AccessSnapshotDTO + Client/Artist/Public/Staff DTOs |
| `profiles.mocks.ts` | Fixtures frozen para Vitest |
| `profiles.map-snapshot.ts` | Mapper RPC→DTO (read-only, sin I/O) |
| `profile-taxonomy-resolve.ts` | Resolvers de taxonomía (read-only) |
| `profile-read-types.ts` | Shim re-export → `profiles.types.ts` |
| `index.ts` | Barrel público |
| `README.md` | Orientación lab |
| `tests/unit/profiles.spec.ts` | Contrato Vitest Paso 2 |
| `profiles.service.ts` | **Paso 3** — fetch read-only (RPC + PostgREST SELECT) |
| `profiles.map-rows.ts` | Row → DTO mappers |
| `profiles.identity-map.ts` | **Paso 4** — snapshot → profile-matrix + flags |
| `tests/unit/profiles.identity-map.spec.ts` | Contrato Vitest Paso 4 |
| `fetchOwnIdentityClassification()` | Enrichment read-only (client commercial / artist specialty) |

### Paso 5 — MOD-204 Slice 1 (Artist portal read view)

| Archivo | Rol |
|---------|-----|
| `artist/profile/render-artist-profile-read-view.ts` | DOM read-only (stage, PII aislado, tier, SFT, bio, residency, media) |
| `artist/profile/mount-artist-profile-read-slice.ts` | Hydrate slot dashboard (`mock` \| `fetchOwnArtistProfile`) |
| `tests/unit/artist-profile-read-view.spec.ts` | Contrato UI Slice 1 |

**Prohibido en Slice 1:** formularios · save · writers · SQL.

### Paso 6 — MOD-103 Slice 1 (Client portal read view)

| Archivo | Rol |
|---------|-----|
| `client/profile/render-client-profile-read-view.ts` | DOM read-only (name, VIP/commercial, contact, booking prefs, billing PII masked) |
| `client/profile/mount-client-profile-read-slice.ts` | Hydrate slot dashboard (`mock` \| `fetchOwnClientProfile`) |
| `tests/unit/client-profile-read-view.spec.ts` | Contrato UI Slice 1 |

**Prohibido en Slice 1:** formularios · save · writers · SQL · tocar `artist/`.

### Paso 7 — MOD-301 Slice 1 (Staff identity read view)

| Archivo | Rol |
|---------|-----|
| `staff/identity/render-staff-identity-read-view.ts` | DOM read-only (role, seller vs full, flags, AccessSnapshot) |
| `staff/identity/mount-staff-identity-read-slice.ts` | Hydrate slot (`mock` \| `fetchOwnAccessSnapshot`) |
| `tests/unit/staff-identity-read-view.spec.ts` | Contrato UI Slice 1 |

**Prohibido en Slice 1:** assign role · edit permissions · writers · SQL · tocar `artist/` / `client/`.

### Paso 8 — Documentación y cierre de ciclo

| Archivo | Rol |
|---------|-----|
| `docs/V2/PROFILES-CYCLE-CLOSURE.md` | Auditoría final Pasos 0–7 + veredicto lab |
| `docs/V2/PROFILES-V1-V2-MAPPING-MATRIX.md` | Estado DTO actualizado |
| `docs/V2/README.md` · `docs/MASTER-DOCUMENTATION-INDEX.md` | Índices |

### Flags cerrados (Paso 4)

| Flag | Fuente |
|------|--------|
| `clientVip` | snapshot `buyer_vip` / enrichment |
| `clientCommercial` | `client_profiles.is_commercial` (enrichment; gap G1) |
| `artistTier` | snapshot `artist_tier` |
| `staffSeller` / `staffManagement` | `staff_seller` vs `staff_full`+role |
| `sftOk` | Pro/Elite o señales artist profile |
| `principal` | buyer \| performer \| staff |
| `permissionFlags` | subset `{ clientVip, sftOk }` → MOD-003 |

---

## 4b. ProfilesService (Paso 3) — métodos permitidos

| Método | Fuente | Sesión |
|--------|--------|--------|
| `fetchOwnAccessSnapshot()` | RPC `mdj_access_snapshot` | Requerida |
| `fetchOwnArtistProfile()` | GET `/rest/v1/dj_profiles` + snapshot | Requerida |
| `fetchOwnClientProfile()` | GET `/rest/v1/client_profiles` + snapshot | Requerida |
| `fetchPublicArtistCard(handle)` | GET `/rest/v1/public_dj_profiles` | No |

**Prohibido en el servicio:** `update` · `insert` · `upsert` · `delete` · mutación de roles.

---

## 5. Gaps heredados (no “resueltos” en código)

Documentados en la matriz §7 — este paso **solo tipa** la resolución posible:

- G1 commercial no en snapshot → `resolveClientProfileId` exige `isCommercial` explícito
- G2 staff_full → `resolveStaffProfileId(role)`
- G3 artist category → `resolveArtistCategoryFromSpecialty` es **best-effort** (default `DJ`)
- G4 `sftOk` / `mdjbId` → campos opcionales en DTOs

---

## 6. Criterio de cierre Paso 2

- [x] Types exportados desde barrel
- [x] Spec en carpeta servicio
- [x] Unit tests PASS
- [x] `typecheck` limpio sobre archivos nuevos
- [x] Localhost portales HTTP 200
- [ ] Writers — **fuera de alcance**
- [ ] Commit — **no**
