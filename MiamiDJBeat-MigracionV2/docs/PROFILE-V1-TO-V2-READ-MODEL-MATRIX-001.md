# PROFILE V1→V2 READ MODEL MATRIX — Discovery 001

| Campo | Valor |
|-------|--------|
| **Ticket / fase** | Arquitectura V2 — Plan §4 **Paso 0 + Paso 1** |
| **Fecha** | 2026-08-11 |
| **Root exclusivo** | `/Users/djmago/Desktop/miami-dj-beat-platform/MiamiDJBeat-MigracionV2` |
| **Tipo** | Discovery / inventario — **cero mutación schema** · **cero commits** · **cero deploys** |
| **Fuente schema** | `miami-dj-beat-platform/supabase/migrations` (+ seed `supabase/client_profiles_schema.sql`) |
| **Consumidor V2** | Shared Core: `shared/services/access-snapshot`, `shared/permissions/runtime` |

---

## 0. Paso 0 — Entorno (evidencia)

| Ítem | Valor |
|------|--------|
| Lab path | `…/MiamiDJBeat-MigracionV2` (**confirmado**) |
| Git del lab | **No es repo git independiente** — anidado en `miami-dj-beat-platform` |
| Rama activa (parent) | `plan/v2-artist-agenda-matrix` |
| HEAD (parent) | `90f5c89c2e82695b47f04c81aa9637a313568682` |
| `move_agent_to_root` Cursor | Rechazado por el usuario (fallaba fetch de rama V1); trabajo por **ruta absoluta** al lab |
| Schema dentro del lab | **Sin** `supabase/` propio — perfiles viven en Postgres V1 compartido |
| Mutaciones DB / push / commit | **Ninguna** en este documento |

---

## 1. Principios del Read Model (DTO)

1. **Postgres manda.** V2 no inventa tablas paralelas de perfiles en este paso.
2. **Snapshot ≠ perfil completo.** `mdj_access_snapshot()` es foto de acceso; el perfil de producto (bio, media, address) es read model aparte.
3. **Legal name ≠ stage name.** `full_name` legal; `stage_name` / `dj_name` marca artística.
4. **Categoría artística ≠ tier comercial.** Taxonomía V2 (`artist.*`) ortogonal a `mdj_artist_commercial_tier` (0/1/2).
5. **VIP buyer** = `client_profiles.buyer_billing_tier = 'vip'` en snapshot — **no** `loyalty_points` solos.
6. **Staff** = fila `dj_profiles` con `role ∈ {admin,owner,manager,seller}` + `is_staff` / `is_staff_management`.

### Capas V2 propuestas (futuro — no implementadas aquí)

| Capa | Propósito | Estado hoy |
|------|-----------|------------|
| **AccessSnapshotDTO** | Gate sesión / portal / capabilities | Parcial (`access-snapshot-types.ts`) |
| **ArtistProfileReadDTO** | MOD-204 read | **Falta** |
| **ClientProfileReadDTO** | MOD-103 read | **Falta** |
| **PublicArtistCardDTO** | Roster / `public_dj_profiles` | **Falta** (vista SQL existe en V1) |
| **StaffIdentityDTO** | Subconjunto role + MDJB | Cubierto vía snapshot + profile-matrix |

---

## 2. RPC / funciones de identidad (contrato canónico)

### 2.1 `public.mdj_access_snapshot()` → JSON

**Definición canónica:** `20260430340000_mdjb_account_public_id_casm.sql`  
**Origen modelo:** `20260430330000_access_tiers_snapshot_seller_vs_management_rls.sql`

| Campo JSON | Tipo | Origen V1 | Mapeo V2 actual |
|------------|------|-----------|-----------------|
| `ok` | boolean | sesión | `MdjAccessSnapshotPayload.ok` |
| `reason` | string | `no_session` etc. | failure payload |
| `profile_kind` | text | reglas abajo | `MdjAccessSnapshotProfileKind` |
| `artist_tier` | smallint \| null | `mdj_artist_commercial_tier(uid)` | → `ArtistTier` Lite/Pro/Elite |
| `buyer_vip` | boolean | `lower(trim(buyer_billing_tier)) = 'vip'` | `SnapshotFlags.clientVip` |
| `role` | text \| null | `dj_profiles.role` | staff resolve / flags |
| `mdjb_id` | text | `mdjb_ensure_code_core` | **tipado V2 incompleto** (validar en service) |
| `auth_uid` | text | solo rama `unknown` | — |

**Derivación `profile_kind`:**

| Condición | `profile_kind` |
|-----------|----------------|
| `dj_profiles.role` ∈ admin\|owner\|manager | `staff_full` |
| `dj_profiles.role` = seller | `staff_seller` |
| sin `dj_profiles` + sí `client_profiles` | `buyer` |
| `dj_profiles.role` ∈ client\|cliente | `buyer` |
| resto con `dj_profiles` (performer) | `artist` |
| sin filas | `unknown` (+ `mdjb_id`) |

**V2 mapping gaps (documentados, no fijados aquí):**

| Gap | Detalle |
|-----|---------|
| `staff_full` → `staff.owner` vs `staff.manager` vs admin | Snapshot no distingue owner/manager/admin — solo `role` string |
| `artist` → `ArtistProfileId` (`artist.dj`…) | Snapshot **no** envía categoría artística; falta columna/fuente V1 canónica para taxonomía |
| `buyer` → `client.commercial` | Snapshot no expone `is_commercial`; solo VIP boolean |
| `mdjb_id` en types TS | Presente en RPC; asegurar validación/consumo en access-snapshot service |
| `sftOk` flag | `SnapshotFlags.sftOk` existe en TS; **no** viene del JSON snapshot actual |

### 2.2 Otras funciones (solo lectura / candado)

| Función | Migración clave | Rol |
|---------|-----------------|-----|
| `is_staff(uuid)` | `20260430300000_is_staff_include_owner_role.sql` | Staff operativo |
| `is_staff_management(uuid)` | idem / `20260430210000_…` | Escritura producción |
| `mdj_artist_commercial_tier(uuid)` | `20260430330000_…` | 0 LITE · 1 PRO · 2 ELITE · NULL staff/client |
| `dj_soundfortips_plan_ok(uuid)` | `20260525120000_…` | Gate SFT (PRO signals) |
| `compute_mdjb_letter(uuid)` / `mdjb_ensure_*` | `20260430340000_…` | Sufijo C\|A\|S\|M |
| `mdj_resolve_email_for_login` / username RPCs | `20260429120000_…` | Login alias |

---

## 3. Matriz `public.dj_profiles` → V2 Read DTO

### 3.1 Nota de provenance

- **No hay `CREATE TABLE dj_profiles` en** `supabase/migrations` (tabla legacy pre-repo).
- Columnas listadas como **LEGACY** = referenciadas por vistas/funciones sin `ADD COLUMN` en migraciones.
- Columnas **ADD** = introducidas por migración citada.

### 3.2 Identidad y roles

| Columna V1 | Tipo (evidencia) | Provenance | Capas DTO | Notas V2 |
|------------|------------------|------------|-----------|----------|
| `user_id` | uuid (FK auth) | LEGACY | Access + Artist + Public | Clave de join |
| `id` | uuid | LEGACY | Artist / Staff ops | FK leads `assigned_dj_id` |
| `role` | text | LEGACY (+ COMMENT `20260430180000`) | Access | Fuente `is_staff*`; trigger lowercase+guard |
| `email` | text | LEGACY | Artist private | Login resolve |
| `full_name` | text | LEGACY | Artist private / Legal | **Legal** — no UI stage |
| `stage_name` | text | LEGACY | Artist + Public | Marca escénica |
| `dj_name` | text | LEGACY | Artist + Public | Alias stage |
| `username` | text | ADD `20260429120000` | Artist + Public | @handle; unique cross profiles |
| `dj_slug` | text? | LEGACY opcional | Public | Vista puede computarlo |

### 3.3 Tier / billing artista (≠ buyer)

| Columna V1 | Provenance | Capas DTO | Notas V2 |
|------------|------------|-----------|----------|
| `plan` | LEGACY | Access (vía tier fn) | ELITE explícito en tier fn |
| `plan_type` / `plan_status` / `plan_expires_at` / `is_premium` | LEGACY | Artist private | Señales PRO; MDJB trigger |
| `stripe_customer_id` / `subscription_*` / `next_renewal` / `billing_period` | ADD `20260303000003` | Artist private | Solo artista MDJ Pro |
| `card_*` / `is_founder` / `member_number` / `referral_*` | ADD `20260303000003` | Artist private | No exponer en Public DTO |

### 3.4 Perfil público / media / bio

| Columna V1 | Provenance | Capas DTO | Notas V2 |
|------------|------------|-----------|----------|
| `bio` / `bio_en` / `bio_short` / `bio_long` | ADD `20260412140000` | Artist + Public (subset) | i18n EN canónico |
| `photo_url` / `background_url` | LEGACY | Artist + Public | |
| `photo_focal_x` / `photo_focal_y` / `hero_bg_zoom` | ADD `20260414210000` (+ y legacy) | Artist + Public | Hero |
| `hourly_rate_usd` / `artist_specialty` | ADD `20260418140000` | Artist + Public (policy) | Specialty **≠** taxonomía `artist.*` aún |
| `city` / `roles` / `available` / `verified` / `rating` / `review_count` | LEGACY + rating ADD `20260513400000` | Public | |
| Residency: `weekly_schedule`, `availability_schedule`, `current_venue`, `venue_schedule`, `is_resident` | LEGACY (vista `20260513600000`) | Public / Agenda | |
| Social URLs (`instagram_url` …) | LEGACY (vista) | Public | |
| `address` / `birth_date` | ADD `20260302_flow_tab…` | Artist private | |

### 3.5 SoundForTips

| Columna V1 | Provenance | Capas DTO | Notas V2 |
|------------|------------|-----------|----------|
| `soundfortips_active` | ADD `20260411200000` | Artist private + flags | UI booth |
| `sft_pay_*_instructions` | ADD `20260419120000` | Artist private | |
| `sft_manual_fee_pending_cents` / `soundfortips_platform_fee_blocked` / `sft_platform_fee_last_error` | ADD `20260420120000` | Artist private / staff | |

### 3.6 Triggers / índices (referencia)

| Objeto | Archivo | Efecto |
|--------|---------|--------|
| `trg_dj_profiles_role_lowercase_and_guard` | `20260430310000` | Contención role |
| `trg_dj_profiles_username_cross` | `20260429120000` | Username único vs client |
| `trg_mdjb_after_dj` | `20260430340000` | Sync MDJB |
| Indexes stripe/referral/username | varias | — |

---

## 4. Matriz `public.client_profiles` → V2 Read DTO

### 4.1 Provenance

- **CREATE + RLS own SELECT/UPDATE + `updated_at`:** `supabase/client_profiles_schema.sql` (**fuera** de `migrations/`).
- Resto: ALTER en migraciones.

### 4.2 Columnas

| Columna V1 | Tipo | Provenance | Capas DTO | Notas V2 |
|------------|------|------------|-----------|----------|
| `id` | uuid | seed | Client | PK |
| `user_id` | uuid unique | seed | Access + Client | |
| `full_name` | text | seed | Client | Legal / display rules VIP |
| `email` / `phone` | text | seed (+ phone ensure) | Client private | |
| `notify_email_*` / `notify_sms` | boolean | seed + ensure | Client settings | |
| `city` | text | seed + address ensure | Client | |
| `source_ref` / `loyalty_points` / `discount_eligible` / `total_events_booked` | seed + loyalty ensure | Client / VIP UI | **No** alimentan `buyer_vip` del snapshot |
| `language_preference` | text | `20260415120000` | Client | en\|es |
| `address_*` | text | `20260428120000` | Client private | |
| `photo_url` / `avatar_url` | text | `20260428140000` | Client | |
| `username` | text | `20260429120000` | Client | @handle VIP header |
| `buyer_stripe_customer_id` | text | `20260430320000` | Client private | ≠ artist Stripe |
| `buyer_billing_tier` | text not null default `none` | `20260430320000` | Access (`buyer_vip`) | `none` \| `vip` |
| `billing_*` / `billing_name_on_card` / `billing_same_as_home` | `20260514124500` / `130000` | Client private | Facturación |
| `is_commercial` / `company_name` / `venue_type` | `20260527190000` | Client → `client.commercial` | **Ausente del snapshot** |
| `created_at` / `updated_at` | timestamptz | seed | Client meta | |

### 4.3 Triggers MDJB (client)

| Trigger | Evento | Archivo |
|---------|--------|---------|
| `trg_mdjb_after_client` | AFTER INSERT | `20260430340000` |
| `trg_mdjb_after_client_upd` | AFTER UPDATE OF `buyer_billing_tier` | idem |
| `trg_client_profiles_username_cross` | username | `20260429120000` |

---

## 5. RLS — inventario (perfiles)

### 5.1 `dj_profiles`

| Policy | Op | Archivo |
|--------|----|---------|
| `"DJs can insert their own profile"` | INSERT | `20260415190000` |
| `"DJs update own dj_profiles"` | UPDATE | `20260412140000` / reassert `20260430350000` |
| `"DJs select own dj_profiles"` | SELECT | `20260430170000` / reassert `20260430350000` |
| `dj_profiles_staff_select_all` | SELECT | `20260430310000` |
| `dj_profiles_staff_update_others` | UPDATE | `20260430310000` |

**Zona roja:** cualquier cambio a estas policies / trigger de `role` requiere ticket + PO.

### 5.2 `client_profiles`

| Policy | Op | Archivo |
|--------|----|---------|
| `"Users can view their own client profile"` | SELECT | **seed only** |
| `"Users can update their own client profile"` | UPDATE | **seed only** |
| `"Users can insert their own client profile"` | INSERT | `20260428140000` |
| `client_profiles_staff_select_all` | SELECT | `20260430230000` |
| `client_profiles_staff_update_all` | UPDATE | `20260430230000` |

### 5.3 Vista pública

| Objeto | Archivo | Notas |
|--------|---------|-------|
| `public.public_dj_profiles` | `20260513340000` + residency `20260513600000` | `security_invoker=false`; GRANT anon+authenticated; columnas dinámicas según existan |

---

## 6. Taxonomía V2 ↔ señales V1 (gap explícito)

| ID V2 (`PROFILE-TAXONOMY.md`) | Señal V1 disponible hoy | Gap |
|-------------------------------|-------------------------|-----|
| `client.regular` | `client_profiles` + no VIP + not commercial | Inferencia V2 |
| `client.vip` | `buyer_billing_tier='vip'` | OK vía snapshot |
| `client.commercial` | `is_commercial` | **No en snapshot** |
| `staff.owner` / `staff.manager` / `staff.seller` | `dj_profiles.role` | Snapshot colapsa owner/manager/admin → `staff_full` |
| `artist.dj` … `artist.custom` | `artist_specialty` (texto libre) / sin enum | **Sin columna enum V1** alineada a taxonomía |
| Lite / Pro / Elite | `mdj_artist_commercial_tier` | OK vía snapshot `artist_tier` |

---

## 7. Propuesta DTO Read Model (contrato futuro — tipos conceptuales)

> No es código runtime. Sirve de contrato para Paso 2+.

### 7.1 `AccessSnapshotDTO` (ya parcial en lab)

```
ok, profile_kind, artist_tier?, buyer_vip?, role?, mdjb_id?, auth_uid?
```

**Extensiones candidatas (ticket futuro, no aplicar SQL ahora):**  
`is_commercial`, `artist_category` (si producto define columna), `sft_ok`.

### 7.2 `ArtistProfileReadDTO` (MOD-204)

Campos mínimos sugeridos desde matriz §3:

- Identidad: `userId`, `mdjbId`, `stageName`, `djName`, `username`, `fullName` (owner-only)
- Acceso: `role`, `commercialTier`, `soundfortipsActive`
- Público: bios, media, specialty, rate, city, rating, residency, socials
- Privado: Stripe/SFT instructions/fees, address, birthDate

### 7.3 `ClientProfileReadDTO` (MOD-103)

- Identidad: `userId`, `mdjbId`, `fullName`, `username`, `email`, `phone`
- Tipo: `buyerBillingTier`, `isCommercial`, `companyName`, `venueType`
- Loyalty UI: `loyaltyPoints`, `totalEventsBooked`, `discountEligible` (display; no confundir con snapshot VIP)
- Address / billing / notify / language / avatar

### 7.4 `PublicArtistCardDTO`

Proyección alineada a columnas expuestas por `public_dj_profiles` (sin PII de billing).

---

## 8. Módulos lab V2 ya alineados / pendientes

| Pieza lab | Path | Relación con esta matriz |
|-----------|------|---------------------------|
| Access snapshot service | `shared/services/access-snapshot/` | Consume §2.1 |
| Profile matrix | `shared/permissions/runtime/profile-matrix.ts` | Taxonomía §6 |
| SnapshotFlags | `permissions/runtime/types.ts` | `clientVip`, `sftOk` |
| MOD-103 / MOD-204 | Catálogo PLANIFICADO | Consumirán §7.2–7.3 |
| Legal identity bridge | `shared/services/legal/persistence/identity/` | Ortogonal (Legal Center); no sustituye Profile DTO |

---

## 9. Fuera de alcance (este Paso 1)

- Crear/alterar tablas o RLS
- Implementar writers
- Commit / push / deploy
- Cambiar V1 `web/` producción
- Resolver gaps de snapshot con nuevas columnas SQL (requiere ticket zona roja)

---

## 10. Criterios de cierre Paso 1

| Criterio | Estado |
|----------|--------|
| Root exclusivo documentado | ✅ |
| Rama parent registrada | ✅ `plan/v2-artist-agenda-matrix` @ `90f5c89…` |
| Inventario `dj_profiles` | ✅ |
| Inventario `client_profiles` | ✅ |
| RLS + triggers + vista pública | ✅ |
| RPC snapshot mapeado a tipos V2 | ✅ + gaps listados |
| Cero mutación schema / cero commit | ✅ |

---

## 11. Siguiente paso autorizado (solo tras OK PO)

**Paso 2 del Plan §4:** contrato TypeScript de dominio Profiles (`shared/services/profiles/` — types + spec) a partir de §7, **sin** writers y **sin** SQL.

---

*Discovery only — MiamiDJBeat-MigracionV2 — 2026-08-11*
