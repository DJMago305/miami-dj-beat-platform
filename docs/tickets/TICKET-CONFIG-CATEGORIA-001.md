# TICKET-CONFIG-CATEGORIA-001
## Panel "Categoría" en account-settings.html

**Creado:** 2026-06-22 20:05 UTC-4  
**Auditoría previa:** MODO SOLO LECTURA — 2026-06-22  
**Estado:** 🟡 ABIERTO — Pendiente autorización del Capitán  
**Riesgo:** BAJO  
**Prioridad:** Media

---

## Problema

`account-settings.html` no tiene ningún panel ni campo para que el artista edite su categoría/especialidad artística. El campo `artist_specialty` existe en `dj_profiles` y en `public_dj_profiles` view, pero el artista no tiene forma de editarlo desde CONFIG.

La única forma actual de escribir `artist_specialty` es desde `jobs.html` (auto-generado al seleccionar roles) — no hay control manual.

---

## Causa raíz

| Archivo | Situación |
|---|---|
| `dj_profiles.artist_specialty` | Campo existe. Tipo TEXT. Migración `20260418140000`. |
| `public_dj_profiles` view | Incluye `artist_specialty` ✅ |
| `account-settings.html` | 0 campos para `category`, `specialty`, `roles` — desconectado ❌ |
| `dj-dashboard.html` | Tiene `cfg-category` que guarda `dj_profiles.category` (campo diferente, no expuesto en view pública) |

---

## Alcance del fix

**Archivo único:** `web/account-settings.html`

### Cambios necesarios

**1. Sidebar** — Nuevo botón entre "Cuenta" y "Agenda":
```html
<button class="acct-side-link" onclick="showPanel('categoria',this)">
  <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
  </svg>
  Categoría
</button>
```

**2. Panel nuevo** — `<div id="panel-categoria" class="acct-panel">`:
- Campo texto libre: `cfg-artist-specialty` → placeholder: "DJ · Open Format · Latin"
- Descripción: "Esta línea aparece en tu perfil público encima del nombre."
- Botón Save → `.update({ artist_specialty: value }).eq('user_id', uid)`
- Hidratación al cargar: `set('cfg-artist-specialty', p.artist_specialty || '')`

**3. Sin cambios en Supabase** — campo ya existe y ya está en la view pública.

---

## PROHIBIDO en este ticket

- Tocar `dj-profile.html` (hero público)
- Tocar navegación / header
- Tocar `mdj-shared-header.js`
- Tocar Stripe
- Crear nuevas columnas en Supabase
- Modificar la `public_dj_profiles` view

---

## Ticket relacionado

- **TICKET-PROFILE-HERO-SPECIALTY-001** — Fix del render del hero para usar `p.artist_specialty` en `#pub-role-label` (ticket separado).

---

## Criterio de éxito

El artista puede escribir "DJ · Open Format · Latin" en CONFIG → hacer Save → la línea se persiste en `dj_profiles.artist_specialty` → visible en el perfil público una vez se aplique TICKET-PROFILE-HERO-SPECIALTY-001.
