# PROFILE-TAXONOMY.md

**Ticket:** TICKET-V2-PROFILE-TAXONOMY-001  
**Fecha:** 2026-07-06  
**Tipo:** Documentación V2 — **sin código** · **sin runtime**  
**Estado:** **PENDIENTE DE APROBACIÓN PO PARA MOD-003 PERMISSIONS**

---

## Propósito

Definir la **taxonomía oficial de perfiles recuperables** en MiamiDJBeat-MigracionV2: subtipos dentro de cada plantilla de portal (Client · Artist · Staff).

Esta taxonomía es **requisito previo a MOD-003 Permissions** y a futuros dashboards V2. **No autoriza implementación** hasta ticket runtime + OK PO explícito.

---

## Concepto — Plantilla recuperable

En V2, cada **portal** expone una **plantilla de perfil recuperable** al boot/hydrate:

| Portal | Plantilla base | Fila / identidad V1 (referencia) | MDJB suffix |
|--------|----------------|----------------------------------|-------------|
| **Client Portal** | Buyer profile | `client_profiles` | **C** |
| **Artist Portal** | Performer profile | `dj_profiles` | **A** |
| **Staff Portal** | Staff profile | `dj_profiles` (rol staff) | **S** / **M** |

Cada plantilla admite **subtipos** documentados abajo. Session almacena identidad mínima; **Permissions** (MOD-003) resolverá capabilities y flags por subtipo.

---

## 1 — Client Portal · Client Profile Types

Subtipos de comprador dentro del Client Portal. **No** confundir con tiers de artista (LITE/PRO/ELITE).

| ID | Nombre oficial | Descripción | Señales producto (futuro MOD-003+) |
|----|----------------|-------------|-------------------------------------|
| `client.regular` | **Regular Client** | Cliente inicial / estándar. Cuenta registrada para contratar servicios, shop y bookings sin historial VIP ni entidad comercial. | Snapshot buyer base; capabilities `client.*` estándar |
| `client.vip` | **VIP Client** | Cliente recurrente con historial de **múltiples rentas o contrataciones** con la marca. Lealtad, crown + label VIP, cupones (paridad V1 `client_profiles` VIP). | Flag `clientVip`; capability `client.vip.benefits` |
| `client.commercial` | **Commercial Client** | Cliente que contrata **a través de una empresa**: club, venue, restaurante, corporación, organización u otro negocio. Perfil vinculado a entidad comercial (facturación/contratos distintos de persona física regular). | Capabilities B2B futuras; dashboards comerciales; sin mezclar con performer/staff |

### Reglas Client

| # | Regla |
|---|-------|
| CT-01 | Un usuario buyer tiene **un** subtipo Client activo por sesión (regular \| vip \| commercial). |
| CT-02 | VIP **no** es tier de artista ni staff. |
| CT-03 | Commercial Client **no** implica rol staff ni fila `dj_profiles` performer. |
| CT-04 | Invitado (guest) **no** es subtipo Client — es ausencia de plantilla recuperada. |

**Referencia Blueprint:** `MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` §3 — actualizado con tres subtipos + invitado.

---

## 2 — Staff Portal · Staff Roles

Subtipos operativos dentro del Staff Portal. Autoridad Postgres sigue `is_staff` / `is_staff_management` (V1 parity).

| ID | Nombre oficial | Descripción | Escritura producción (V1 parity) |
|----|----------------|-------------|----------------------------------|
| `staff.owner` | **Owner** | Dueño de marca; acceso management pleno. | `is_staff_management` |
| `staff.manager` | **Manager** | Operaciones internas plenas (event flows, invoices manuales). | `is_staff_management` |
| `staff.seller` | **Seller** | Staff limitado; sin escritura en módulos sensibles de producción. | `is_staff` sin management |

### Nota de alineación Blueprint

El Blueprint §5 también documenta rol **Admin** como par `is_staff_management`. Para taxonomía V2 recuperable, los tres subtipos PO registrados son **Owner · Manager · Seller**. Admin se trata como variante management documentada en ROLE-MATRIX — **no** expandir alcance en este ticket.

### Reglas Staff

| # | Regla |
|---|-------|
| ST-01 | Staff roles viven en fila `dj_profiles.role` — **única** fuente operativa con RLS (Constitución V2 / V1). |
| ST-02 | Seller **nunca** hereda capabilities management por JWT solo. |
| ST-03 | Owner STAFF nav → Staff Portal; **prohibido** mezclar con buyer profile (INCIDENT-001 parity). |

---

## 3 — Artist Portal · Artist Categories

Subtipos de **disciplina / categoría artística** dentro del Artist Portal. Ortogonal al **tier comercial** artista (LITE · PRO · ELITE).

| ID | Nombre oficial | Descripción |
|----|----------------|-------------|
| `artist.dj` | **DJ** | Disc jockey — categoría principal MDJB roster. |
| `artist.singer_solo` | **Singer / Solo Artist** | Vocalista o acto solista. |
| `artist.band_group` | **Band / Orchestra / Group** | Agrupación multi-miembro. |
| `artist.mc_host` | **MC / Host** | Maestro de ceremonias / host. |
| `artist.dancer_performer` | **Dancer / Performer** | Baile / performance escénica. |
| `artist.clown_kids` | **Clown / Kids Entertainment** | Entretenimiento infantil. |
| `artist.musician` | **Musician** | Músico instrumental (no DJ). |
| `artist.custom` | **Other Custom Artist Category** | Categoría personalizada aprobada por producto. |

### Tier comercial (no confundir)

| Tier | Señal | Notas |
|------|-------|-------|
| LITE | `mdj_artist_commercial_tier=0` | Base gratis |
| PRO | tier `1` | SFT elegible |
| ELITE | tier `2` | Máximo nivel artista |

**Categoría artística ≠ tier comercial.** Un `artist.dj` puede ser LITE, PRO o ELITE.

### Reglas Artist

| # | Regla |
|---|-------|
| AR-01 | Categoría afecta roster, talent selector hub y dashboards — **no** reemplaza `principal: performer`. |
| AR-02 | SFT gate sigue PRO/tier — **no** se concede por categoría sola. |
| AR-03 | Nombre legal vs stage name permanece separado (certificados, contratos). |

---

## Impacto en MOD-003 Permissions (futuro — no implementar aún)

| Área | Uso de taxonomía |
|------|------------------|
| **Snapshot flags** | `clientProfileType`, `staffRole`, `artistCategory`, `clientVip`, `artistTier` |
| **Capability gates** | Ej. `client.vip.benefits` solo si `client.vip`; commercial B2B TBD en catálogo |
| **ROLE-MATRIX** | Extender matriz con columnas por subtipo recuperable |
| **ACCESS-RULES** | Guards UI/dashboard por portal + subtipo |
| **Session hydrate** | Session **no** persiste capabilities[] — Permissions re-fetch on restore |
| **Dashboards V2** | Client VIP/commercial views · Artist category modules · Staff seller vs management shells |

### Orden de construcción recomendado (post-PO)

1. PO aprueba esta taxonomía (**TICKET-V2-PROFILE-TAXONOMY-001**).
2. Ticket MOD-003 runtime acotado — mapeo snapshot + `hasCapability()`.
3. Dashboards portal-específicos en tickets separados (MOD-101+).

---

## Fuera de alcance (este ticket)

| Item | Motivo |
|------|--------|
| Código TS/JS/HTML/CSS | Documentación únicamente |
| Supabase migrations | Ticket infra futuro |
| Cambios `web/` V1 | Lab aislado |
| Commit / push / PR | Gobernanza PO |

---

## Referencias cruzadas

| Documento | Relación |
|-----------|----------|
| `MiamiDJBeat-V2-SYSTEM-BLUEPRINT.md` §3–5 | Portales — subtipos referenciados |
| `MiamiDJBeat-MigracionV2/shared/permissions/PERMISSIONS-SPEC.md` | MOD-003 spec — actualizar en ticket MOD-003 |
| `MiamiDJBeat-MigracionV2/shared/permissions/ROLE-MATRIX.md` | Matriz roles/capabilities |
| `docs/V2/SESSION-SUMMARIES/2026-07-05.md` | Addendum closeout MOD-002 + taxonomía |
| `docs/DECISIONS.md` DECISION-V2-005 | MOD-002 local baseline — prerequisito runtime |

---

*TICKET-V2-PROFILE-TAXONOMY-001 — Documentation only — 2026-07-06*
