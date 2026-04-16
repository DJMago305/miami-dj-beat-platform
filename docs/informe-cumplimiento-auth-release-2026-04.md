# Informe de cumplimiento y estado del trabajo

**Fecha del informe:** abril 2026  
**Alcance:** protocolos del workspace, releases Git, vídeos hero en rentals, asset Halloween, Plan A (perfil tras login), Plan B (cambio de contraseña en cuenta).

---

## 1. Protocolos del workspace (`.cursorrules`)

| Regla | Cómo se respetó |
|--------|------------------|
| **Archivos bloqueados** (`index.html`, `styles.css`, `dj-dashboard.html`, `jobs.html`, etc.) | No se aplicaron cambios de maquetación ni “de paso” en esos archivos en las tareas de auth/cuenta. El trabajo de **cuenta** fue en `account-settings.html`, `auth.js`, `login.html`, `translations.js` (ámbito explícito). |
| **Solo zona seleccionada** | Cambios acotados a auth, ajustes de cuenta y, en hilos anteriores, rentals/hero sin tocar barras congeladas de perfil DJ. |
| **Modelo de tiers (cliente / artista / PRO)** | Plan A distingue `talent`/`dj` → fila en `dj_profiles`; resto (salvo admin/manager) → `client_profiles`. Sin colapsar permisos en un único “user” genérico. |
| **I18N** | Nuevas claves en **inglés canónico** en `translations.js` + español donde aplica (`account-password-*`, `account-security-title`, etc.). |
| **Documentación** | Este archivo se creó **solo porque el usuario pidió guardar el informe**; no se añadieron otros markdown no solicitados. |

---

## 2. Línea temporal de entregas (Git)

| Commit | Descripción |
|--------|-------------|
| `18cb262` | **Release** amplio en `main` (snapshot producción 2026-04-14): muchos HTML/JS, assets, migración billing Zelle, etc. |
| — | Tag anotado **`release/produccion-2026-04-14`**: punto de **reversión** documentado en el mensaje del commit (rollback vía `git checkout` del tag). |
| `01b40d4` | **`Halloween.mp4`** añadido (~27 MB) tras compresión; compatible con GitHub + **Git LFS** (`*.mp4` en `.gitattributes`). |
| `13d11c4` | **Plan A + Plan B**: perfil faltante tras login + cambio de contraseña en ajustes de cuenta. |

**Estado al generar el informe:** `main` sincronizado con `origin/main` (sin cambios locales pendientes en la verificación previa).

---

## 3. Detalle por iniciativa

### 3.1 Vídeos hero (rentals / modales)

- **`mdjHeroVideoPrime`** en `web/js/rentals.js`: fuerza `muted`, `loop`, `playsInline` y atributos antes de `load()`/`play()` en swaps de hero.
- **`preload="auto"`** en heroes relevantes en `rentals.html` donde antes era `metadata` (más buffer, menos retardo perceptible).
- Uso del helper en catálogo multi-vídeo, hovers, DJ/FX/lighting, Hora Loca, staff/payasos, etc.

### 3.2 Despliegue y punto de regresión

- Commit de release + push a GitHub.
- Tag `release/produccion-2026-04-14` subido para volver a ese estado de código.
- **Nota:** el primer release excluyó `Halloween.mp4` por tamaño (>100 MB en GitHub); se incorporó después comprimido en `01b40d4`.

### 3.3 Plan A — Perfil al iniciar sesión (`mdjEnsureAuthProfileRows`)

- Cubre el caso **signup sin INSERT** (p. ej. confirmación de email sin sesión JWT al registrar).
- Crea **`dj_profiles`** o **`client_profiles`** según metadata, si falta fila; **no** actúa para `admin`/`manager`.
- Se ejecuta: tras **login con contraseña**, en **arranque con sesión** (header global), y en **`SIGNED_IN` / `INITIAL_SESSION`**.
- Expuesto como **`window.mdjEnsureAuthProfileRows`**.

### 3.4 Plan B — Seguridad en cuenta (`account-settings.html`)

- Campos con IDs y `data-i18n`.
- Flujo: **`signInWithPassword`** (contraseña actual) → **`updateUser({ password })`** → **`refreshSession`**.
- Validaciones: campos obligatorios, mínimo 6 caracteres, confirmación, nueva ≠ actual.
- Mensajes y etiquetas en **`translations.js`** (EN + ES) y cache bust en script de traducciones.

---

## 4. Checklist de corrección

| Ítem | Estado |
|------|--------|
| Código en `main` y push a `origin` | Sí (commits listados arriba) |
| Tag de rollback publicado | `release/produccion-2026-04-14` |
| LFS para MP4 | Sí (incl. Halloween) |
| RLS / políticas existentes para insert propio | Reutilizadas (Plan A/B no añadieron migración nueva; depende de migraciones ya aplicadas en Supabase) |
| i18n nuevas claves | Añadidas en `translations.js` |
| Sin tocar barras/contratos “sealed” del perfil DJ en estos cambios | Sí |

---

## 5. Notas operativas

1. **Supabase:** Aplicar en producción las migraciones necesarias (`client_profiles` insert propio, `dj_profiles` insert propio, etc.) si aún no están desplegadas.
2. **Vercel:** Confirmar en el dashboard que el deployment activo corresponde al commit deseado de `main`.
3. **Doble llamada** a `mdjEnsureAuthProfileRows` en algunos flujos (boot + `SIGNED_IN`) es **intencional** e **idempotente**.

---

## 6. Cómo revertir en código

```bash
git fetch origin
git checkout release/produccion-2026-04-14
# o crear rama:
git checkout -b hotfix-desde-release release/produccion-2026-04-14
```

El tag marca el snapshot del **release grande** (`18cb262`). Los commits posteriores (`01b40d4` Halloween, `13d11c4` auth A/B) están en `main` por encima de ese tag. Para el estado **más reciente**, usar la punta de `main`.

---

## 7. Conclusión

Los protocolos del repo (alcance, i18n, modelo cliente/artista, sin tocar zonas bloqueadas en estas tareas) se siguieron; las entregas quedaron **commiteadas, etiquetadas donde correspondía y subidas a `main`**.
