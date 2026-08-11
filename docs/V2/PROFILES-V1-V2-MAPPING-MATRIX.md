# PROFILES V1 → V2 — Mapping Matrix (DTO Read Model)

| Campo | Valor |
|-------|--------|
| **Documento** | `docs/V2/PROFILES-V1-V2-MAPPING-MATRIX.md` |
| **Fase** | Plan §4 — **Paso 1** (matriz DTO) |
| **Fecha** | 2026-08-11 |
| **Repo oficial** | `/Users/djmago/Desktop/miami-dj-beat-platform` |
| **Lab runtime** | `MiamiDJBeat-MigracionV2` · consumo previsto `http://localhost:5173` |
| **Rama / HEAD (al redactar)** | `plan/v2-artist-agenda-matrix` · `90f5c89` |
| **Tipo** | Documentación discovery — **sin código runtime** · **sin SQL** · **sin commit** · **sin deploy** |
| **Estado ciclo** | Pasos 0–7 **cerrados en lab** — ver [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) (Paso 8) |
| **Jerarquía** | Bajo Constitución + Protocolo PO + `PROFILE-TAXONOMY.md` ([Master Index](../MASTER-DOCUMENTATION-INDEX.md) §2–§3.4) |

---

## 0. Lectura canónica aplicada

| Documento | Uso en esta matriz |
|-----------|-------------------|
| `docs/MASTER-DOCUMENTATION-INDEX.md` | Índice maestro; ubicación oficial de taxonomía y blueprints |
| `docs/V2/PROFILE-TAXONOMY.md` | IDs recuperables Client / Artist / Staff + tiers |
| `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` | V1 = producción · V2 = lab aislado · cero improvisación |
| `docs/V2/NOTA-DIARIA-LAB-001.md` / `docs/V2/README.md` | Lab `localhost:5173` · Shared Core parcial |
| `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` | MOD-103 (Client Profile) · MOD-204 (Artist Profile) = PLANIFICADO |
| Schema V1 | `supabase/migrations` + seed `supabase/client_profiles_schema.sql` |

**Root exclusivo de implementación futura:** `MiamiDJBeat-MigracionV2/` (no tocar `web/` V1).

---

## 1. Principios de mapeo

1. **Postgres manda.** No se inventan tablas de perfiles en V2 en este paso.
2. **Snapshot ≠ perfil de producto.** `mdj_access_snapshot()` es foto de acceso; bio/media/address son Read DTOs aparte.
3. **Taxonomía V2** (`client.*` / `artist.*` / `staff.*`) es la plantilla recuperable ([PROFILE-TAXONOMY.md](./PROFILE-TAXONOMY.md)).
4. **Legal ≠ stage:** `full_name` legal; `stage_name` / `dj_name` marca.
5. **Categoría artística ≠ tier comercial** (AR-01…AR-03).
6. **VIP buyer** = `buyer_billing_tier = 'vip'` en snapshot — no solo `loyalty_points`.
7. **Staff** = `dj_profiles.role` + `is_staff` / `is_staff_management` (ST-01).

### Capas DTO (contrato conceptual)

| DTO | Portal / uso | Estado lab (cierre Paso 8) |
|-----|--------------|----------------------------|
| **AccessSnapshotDTO** | Boot / MOD-003 / identity | ✅ `profiles` + access-snapshot |
| **ClientProfileReadDTO** | MOD-103 | ✅ types + service + UI Slice 1 (`client/`) |
| **ArtistProfileReadDTO** | MOD-204 owner | ✅ types + service + UI Slice 1 (`artist/`) |
| **PublicArtistCardDTO** | Roster / público | ✅ types + service (UI pública Slice 1 no en este ciclo) |
| **StaffIdentityDTO** | Staff shell MOD-301 | ✅ types + map + UI Slice 1 (`staff/`) |

Detalle de cierre: [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md).

---

## 2. Taxonomía V2 ↔ señales V1

| ID V2 (`PROFILE-TAXONOMY`) | Señal V1 | En `mdj_access_snapshot` | Gap |
|----------------------------|----------|--------------------------|-----|
| `client.regular` | Fila `client_profiles`, no VIP, no commercial | `profile_kind=buyer` + `buyer_vip=false` | Inferir commercial aparte |
| `client.vip` | `buyer_billing_tier='vip'` | `buyer_vip=true` | OK |
| `client.commercial` | `is_commercial=true` (+ `company_name` / `venue_type`) | **No** | Ampliar snapshot o leer fila |
| `staff.owner` | `dj_profiles.role='owner'` | `staff_full` + `role` | Distinguir owner vs manager vs admin en cliente |
| `staff.manager` | `role='manager'` (admin → management en ROLE-MATRIX) | `staff_full` + `role` | Idem |
| `staff.seller` | `role='seller'` | `staff_seller` | OK |
| `artist.dj` … `artist.custom` | Sin enum canónico; `artist_specialty` texto libre | Solo `profile_kind=artist` | **Falta fuente enum** |
| Lite / Pro / Elite | `mdj_artist_commercial_tier` → 0 / 1 / 2 | `artist_tier` | OK |

**MDJB suffix (taxonomía):** Client **C** · Artist **A** · Staff seller **S** · Staff management **M** — vía `mdjb_account_ids` / `mdjb_id` en snapshot.

---

## 3. AccessSnapshotDTO ← `public.mdj_access_snapshot()`

**SQL canónico:** `20260430340000_mdjb_account_public_id_casm.sql`  
**Modelo:** `20260430330000_access_tiers_snapshot_seller_vs_management_rls.sql`  
**TS lab:** `MiamiDJBeat-MigracionV2/shared/services/access-snapshot/access-snapshot-types.ts`

| Campo JSON | Origen V1 | Campo / tipo V2 lab | Notas |
|------------|-----------|---------------------|-------|
| `ok` | sesión | `MdjAccessSnapshotPayload.ok` | |
| `reason` | rechazo | failure `reason` | ej. `no_session` |
| `profile_kind` | reglas §3.1 | `MdjAccessSnapshotProfileKind` | `buyer` \| `artist` \| `staff_seller` \| `staff_full` \| `unknown` |
| `artist_tier` | `mdj_artist_commercial_tier(uid)` | → `ArtistTier` Lite/Pro/Elite | NULL si staff/client-role |
| `buyer_vip` | `lower(trim(buyer_billing_tier))='vip'` | `SnapshotFlags.clientVip` | |
| `role` | `dj_profiles.role` | string en mapping | owner/manager/admin/seller/… |
| `mdjb_id` | `mdjb_ensure_code_core` | **consumo TS a completar** | Formato `MDJB-…-C\|A\|S\|M` |
| `auth_uid` | rama `unknown` | opcional | |

### 3.1 Derivación `profile_kind`

| Condición | `profile_kind` |
|-----------|----------------|
| `role` ∈ admin \| owner \| manager | `staff_full` |
| `role` = seller | `staff_seller` |
| sin `dj_profiles` + sí `client_profiles` | `buyer` |
| `role` ∈ client \| cliente | `buyer` |
| resto con `dj_profiles` | `artist` |
| sin filas de perfil | `unknown` |

### 3.2 RPCs / funciones relacionadas (solo lectura)

| Función | Rol |
|---------|-----|
| `is_staff(uuid)` | Staff operativo |
| `is_staff_management(uuid)` | Escritura producción |
| `mdj_artist_commercial_tier(uuid)` | 0 LITE · 1 PRO · 2 ELITE |
| `dj_soundfortips_plan_ok(uuid)` | Gate SFT (PRO) |
| `compute_mdjb_letter` / `mdjb_ensure_*` | Letras C\|A\|S\|M |

**Gap flags:** `SnapshotFlags.sftOk` existe en TS; **no** viaja en el JSON snapshot actual.

---

## 4. ClientProfileReadDTO ← `public.client_profiles`

**CREATE + RLS own SELECT/UPDATE:** seed `supabase/client_profiles_schema.sql` (fuera de `migrations/`).  
**Portal:** Client · taxonomía `client.*` · MOD-103.

| Campo DTO (propuesto) | Columna V1 | Provenance | Visibilidad | Mapa taxonomía / snapshot |
|-----------------------|------------|------------|-------------|---------------------------|
| `userId` | `user_id` | seed | private/session | Access |
| `profileId` | `id` | seed | private | |
| `fullName` | `full_name` | seed | private / display | Legal |
| `email` | `email` | seed | private | |
| `phone` | `phone` | seed + ensure | private | |
| `username` | `username` | `20260429120000` | display | @handle |
| `languagePreference` | `language_preference` | `20260415120000` | settings | en\|es |
| `avatarUrl` / `photoUrl` | `avatar_url` / `photo_url` | `20260428140000` | display | |
| `city` + `address*` | `city`, `address_*` | seed / `20260428120000` | private | |
| `billing*` / `billingNameOnCard` / `billingSameAsHome` | billing cols | `20260514124500` / `130000` | private | |
| `notifyEmailBookings` / `notifyEmailMarketing` / `notifySms` | notify_* | seed + ensure | settings | |
| `buyerBillingTier` | `buyer_billing_tier` | `20260430320000` | access | → `client.vip` si `vip` |
| `buyerStripeCustomerId` | `buyer_stripe_customer_id` | `20260430320000` | private | ≠ artist Stripe |
| `loyaltyPoints` / `totalEventsBooked` / `discountEligible` / `sourceRef` | loyalty cluster | seed + `20260513910000` | VIP **UI** | **No** sustituyen `buyer_vip` |
| `isCommercial` / `companyName` / `venueType` | commercial | `20260527190000` | B2B | → `client.commercial` |
| `createdAt` / `updatedAt` | timestamps | seed | meta | |
| `mdjbId` | vía RPC / `mdjb_account_ids` | `20260430340000` | display | suffix **C** |

### 4.1 RLS `client_profiles` (referencia)

| Policy | Op | Archivo |
|--------|----|---------|
| Users view/update own | SELECT/UPDATE | seed |
| Users insert own | INSERT | `20260428140000` |
| `client_profiles_staff_select_all` / `_update_all` | SELECT/UPDATE | `20260430230000` |

---

## 5. ArtistProfileReadDTO ← `public.dj_profiles`

**Sin `CREATE TABLE` en migrations** (tabla legacy).  
**Portal:** Artist · taxonomía `artist.*` + tier · MOD-204.

### 5.1 Identidad y acceso

| Campo DTO | Columna V1 | Provenance | Capa |
|-----------|------------|------------|------|
| `userId` | `user_id` | LEGACY | Access + Artist |
| `rowId` | `id` | LEGACY | ops / leads FK |
| `role` | `role` | LEGACY | Access / Staff vs Artist |
| `fullName` | `full_name` | LEGACY | **Legal** (owner-only en UI pública) |
| `stageName` / `djName` | `stage_name` / `dj_name` | LEGACY | Public + owner |
| `username` / `djSlug` | `username` / `dj_slug?` | ADD `20260429120000` / LEGACY | Public |
| `email` | `email` | LEGACY | private |
| `commercialTier` | vía `mdj_artist_commercial_tier` (+ `plan*` / `is_premium`) | LEGACY + fn | Access |
| `mdjbId` | RPC / table | `20260430340000` | display · **A** |

### 5.2 Perfil público / media

| Campo DTO | Columna V1 | Provenance |
|-----------|------------|------------|
| `bio` / `bioEn` / `bioShort` / `bioLong` | bio* | `20260412140000` |
| `photoUrl` / `backgroundUrl` / focal / `heroBgZoom` | media + hero | LEGACY + `20260414210000` |
| `hourlyRateUsd` / `artistSpecialty` | rate / specialty | `20260418140000` |
| `city` / `available` / `verified` / `rating` / `reviewCount` | roster | LEGACY + `20260513400000` |
| Residency fields | `weekly_schedule`, `current_venue`, … | LEGACY (vista `20260513600000`) |
| Social URLs | instagram_url … | LEGACY (vista) |

### 5.3 Billing artista / SFT (nunca en PublicArtistCardDTO)

| Campo DTO | Columnas V1 | Provenance |
|-----------|-------------|------------|
| Stripe / sub / card refs / founder / referral | stripe_*, subscription_*, card_*, is_founder, member_number, referral_* | `20260303000003` |
| SFT active / pay instructions / fee block | soundfortips_*, sft_* | `20260411200000` … `20260420120000` |
| Flow extras | `address`, `birth_date` | `20260302_flow_tab_implementation.sql` |

### 5.4 RLS `dj_profiles` (referencia — zona roja)

| Policy | Archivo |
|--------|---------|
| Insert/update/select own | `20260415190000`, `20260412140000`, `20260430170000`, reassert `20260430350000` |
| Staff select/update others | `20260430310000` (containment wall + role guard trigger) |

### 5.5 Vista pública → PublicArtistCardDTO

| Objeto | Archivo | Notas |
|--------|---------|-------|
| `public.public_dj_profiles` | `20260513340000` + `20260513600000` | GRANT anon+authenticated; sin PII de billing |

---

## 6. StaffIdentityDTO ← `dj_profiles` (rol staff)

| Campo DTO | Señal V1 | Taxonomía V2 |
|-----------|----------|--------------|
| `userId` / `mdjbId` | user_id / MDJB **S\|M** | Staff portal |
| `staffProfileId` | map `role` → `staff.owner` \| `staff.manager` \| `staff.seller` | PROFILE-TAXONOMY §2 |
| `isStaff` / `isStaffManagement` | funciones SQL | seller limited vs management |
| `documentedRole` | ROLE-MATRIX / `DocumentedRoleId` | `staff_seller` \| `staff_manager` \| `staff_admin` \| `staff_owner` |

**Regla ST-03:** Owner STAFF → Staff Portal — no mezclar con buyer profile.

---

## 7. Gaps bloqueantes para reconstrucción de perfiles

| # | Gap | Impacto | Resolución futura (ticket aparte) |
|---|-----|---------|-----------------------------------|
| G1 | `client.commercial` no está en snapshot | Taxonomía incompleta en hydrate | Extender RPC **o** fetch `client_profiles` post-snapshot |
| G2 | `staff_full` no separa owner/manager/admin | Capabilities management finas | Usar campo `role` ya devuelto |
| G3 | Sin enum `artist.*` en V1 | MOD-204 / talent hub | Columna controlada **o** mapa desde `artist_specialty` (producto) |
| G4 | `sftOk` / `mdjb_id` tipado incompleto en lab | Flags MOD-003 | Completar validation/mapping en access-snapshot service |
| G5 | MOD-103 / MOD-204 / MOD-301 UI | **Cerrado en lab** Slice 1 (Pasos 5–7) | Writers / edit UI = ticket futuro |
| G6 | Seed `client_profiles` fuera de migrations | Drift documental | Tratar seed como parte del inventario oficial |

---

## 8. Fuera de alcance de este documento

- Mutaciones SQL / RLS / triggers  
- Código TS/HTML en lab o V1  
- Writers de perfil  
- Commit / push / PR / deploy  
- Cambios a producción V1  

**Consumo previsto:** documentación para ingeniería en lab `http://localhost:5173` únicamente.

---

## 9. Estado del plan (actualizado Paso 8)

| Paso | Entregable | Estado |
|------|------------|--------|
| 1 | Esta matriz | ✅ |
| 2–4 | Types · service · identity map | ✅ lab |
| 5–7 | UI Slice 1 artist / client / staff | ✅ lab |
| 8 | [PROFILES-CYCLE-CLOSURE.md](./PROFILES-CYCLE-CLOSURE.md) | ✅ |

**Siguiente (requiere OK PO):** writers, wiring session productivo, o extensión SQL — **no** implícito.

---

## 10. Referencias cruzadas

| Recurso | Ruta |
|---------|------|
| **Cierre ciclo** | `docs/V2/PROFILES-CYCLE-CLOSURE.md` |
| Taxonomía | `docs/V2/PROFILE-TAXONOMY.md` |
| Catálogo módulos | `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` (MOD-103, MOD-204, MOD-301) |
| Permissions spec | `MiamiDJBeat-MigracionV2/shared/permissions/PERMISSIONS-SPEC.md` |
| Profile matrix runtime | `MiamiDJBeat-MigracionV2/shared/permissions/runtime/profile-matrix.ts` |
| Profiles domain | `MiamiDJBeat-MigracionV2/shared/services/profiles/` |
| Access snapshot | `MiamiDJBeat-MigracionV2/shared/services/access-snapshot/` |
| Master index | `docs/MASTER-DOCUMENTATION-INDEX.md` |
| Borrador lab previo (no canónico) | `MiamiDJBeat-MigracionV2/docs/PROFILE-V1-TO-V2-READ-MODEL-MATRIX-001.md` |

---

*Paso 1 — matriz DTO — docs/V2 — 2026-08-11 — documentation only*  
*Actualización estado lab — Paso 8 — 2026-08-11*
