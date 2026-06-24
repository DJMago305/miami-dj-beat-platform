# TICKET-PROFILE-HERO-SPECIALTY-001
## Hero público dj-profile.html — usar artist_specialty en #pub-role-label

**Creado:** 2026-06-22 20:05 UTC-4  
**Auditoría previa:** MODO SOLO LECTURA — 2026-06-22  
**Estado:** 🟡 ABIERTO — Pendiente autorización del Capitán  
**Riesgo:** BAJO-MEDIO (dj-profile.html es archivo de alta visibilidad)  
**Prioridad:** Media-Alta

---

## Problema

DJYuyo (y cualquier artista sin `roles` configurado) muestra solo "HIALEAH" encima de su nombre en el perfil público. Falta la línea artística "DJ · OPEN FORMAT" o equivalente.

---

## Causa raíz técnica

`dj-profile.html` línea ~4597-4608: el hero `#pub-role-label` se construye ÚNICAMENTE con `p.roles` (mapeado por `ROLE_LABELS`) + `p.city` + `p.region`.

```javascript
// Estado actual — dj-profile.html ~L4597
if (p.roles) {
    const roleArr = p.roles.split(',').map(r => (ROLE_LABELS[r.trim().toUpperCase()] || r.trim()));
    roleLine = roleArr.join(' · ');
}
if (p.city || p.region) {
    const loc = [p.city, p.region].filter(Boolean).join(' · ');
    roleLine = roleLine ? (roleLine + ' · ' + loc) : loc;
}
roleEl.textContent = mdjSanitizeHeroRoleLine(roleLine);
```

El campo `p.artist_specialty` existe en la data (viene de `public_dj_profiles` view) pero **nunca se usa en este bloque**.

---

## Evidencia del campo en DB

| Campo | Estado |
|---|---|
| `dj_profiles.artist_specialty` | Existe (migración `20260418140000`) |
| `public_dj_profiles` view | Expone `artist_specialty` ✅ |
| `dj-profile.html` uso de `artist_specialty` | 0 referencias — completamente ignorado ❌ |

---

## Flujo roto actual

```
jobs.html → guarda: roles='DJ', artist_specialty='Open Format · DJ'

dj-profile.html hero:
  p.roles = 'DJ' → ROLE_LABELS['DJ'] = 'Certified DJ'
  p.artist_specialty = 'Open Format · DJ'  ← IGNORADO
  p.city = 'HIALEAH'
  → resultado: "Certified DJ · HIALEAH"  (o solo "HIALEAH" si roles=null)
```

---

## Fix mínimo propuesto (NO implementar hasta autorización)

Modificar el bloque de `#pub-role-label` en `dj-profile.html` para usar `p.artist_specialty` como primera fuente de la línea artística, fallback a `p.roles`:

```javascript
// Propuesta — reemplaza el bloque actual
const roleEl = document.getElementById('pub-role-label');
if (roleEl) {
    let roleLine = '';
    // Prioridad 1: artist_specialty (ej: "DJ · Open Format · Latin")
    if (p.artist_specialty) {
        roleLine = p.artist_specialty.trim();
    } else if (p.roles) {
        // Fallback: roles mapeados (ej: "Certified DJ")
        const roleArr = p.roles.split(',').map(r => (ROLE_LABELS[r.trim().toUpperCase()] || r.trim()));
        roleLine = roleArr.join(' · ');
    }
    if (p.city || p.region) {
        const loc = [p.city, p.region].filter(Boolean).join(' · ');
        roleLine = roleLine ? (roleLine + ' · ' + loc) : loc;
    }
    roleEl.textContent = mdjSanitizeHeroRoleLine(roleLine);
}
```

---

## Resultado esperado

```
artist_specialty = 'DJ · Open Format'
city = 'HIALEAH'
→ #pub-role-label: "DJ · Open Format · HIALEAH"
```

---

## Alcance del fix

**Archivo único:** `web/dj-profile.html` — solo el bloque `#pub-role-label` (líneas ~4597–4608)

---

## PROHIBIDO en este ticket

- Tocar hero CSS / layout del hero
- Tocar navegación / header
- Tocar `mdj-shared-header.js`
- Tocar Stripe / Supabase schema
- Modificar `ROLE_LABELS` (se mantiene como fallback)
- Hacer cambios en `account-settings.html` (eso es TICKET-CONFIG-CATEGORIA-001)

---

## Dependencias

- **TICKET-CONFIG-CATEGORIA-001** — Debe existir UI para que el artista edite `artist_specialty`. Independiente del orden de implementación pero el flujo completo requiere ambos tickets.

---

## Advertencia sobre semántica dual de artist_specialty

`admin-dashboard.html` usa `artist_specialty` como código interno de staff (valores: 'dj', 'bartender', 'drone', etc. — dropdown). `jobs.html` lo usa como texto público legible ("Open Format · DJ"). Esta doble semántica es una deuda técnica existente. El fix del hero usa la semántica de `jobs.html` (texto libre público), que es la correcta para el display artístico.

---

## Criterio de éxito

El perfil público de DJYuyo muestra "DJ · Open Format · HIALEAH" (o lo que tenga guardado en `artist_specialty`) encima del nombre, en lugar de solo "HIALEAH".
