# MDJPRO — Nota obligatoria: copy público solo para artista (NO taller)

**Para:** Agente / Hans — leer antes de editar `downloads.html`, páginas enterprise, release notes web o textos visibles en miamidjbeat.com  
**Capitán:** 2026-06-11 — regla permanente  
**Incidente que originó la regla:** Instrucciones de instalación con Terminal, `xattr`, `sudo installer` y “alerta de seguridad” en `/downloads.html` — copy de **taller**, no de **producto final**.

---

## 1. Principio (no negociable)

Los artistas **pagan suscripción** por un producto **sin fricción**. Lo que ven en la web pública es el **proceso final del usuario**, no cómo trabajamos en desarrollo.

| Audiencia | Qué leemos / escribimos |
|-----------|-------------------------|
| **Artista / cliente PRO** | Descargar → instalar con clic → permisos Mac en contexto → usar la app |
| **Capitán + Agente (taller)** | Xcode, scripts, notarize, migraciones, tickets, Terminal, handoff, incidentes |

**Nunca mezclar la segunda fila en la primera.**

---

## 2. Prohibido en luz pública (miamidjbeat.com)

No colocar en HTML, `translations.js`, release notes visibles al artista, ni cajas de ayuda orientadas al usuario final:

- Comandos **Terminal**, `xattr`, `sudo installer`, rutas `$HOME/Downloads/...` como instrucción principal
- Workarounds **Gatekeeper** / “Apple could not verify” / builds **sin notarizar**
- Pasos de **desarrollador**: Xcode, ⌘B, DerivedData, `mdj-release.sh`, Storage upload, migraciones SQL
- Referencias a **tickets internos**, commits, SHA256, taller `~/Desktop/MDJ`, incidentes de workshop
- Copy que asusta (“alerta de seguridad”) cuando el **pkg notarizado** es el flujo normal
- Detalle de **arquitectura interna** (ScanStore, RLS, Edge, handoff `.mdjhandoff`) salvo páginas enterprise **informative** ya aprobadas — y aun así **sin** runbooks de deploy

**Dónde sí vive lo de taller:** `docs/tickets/`, `MDJPRO_PROJECT_STATE.md`, `scripts/`, skills de release, chat Capitán–Agente.

---

## 3. Copy permitido — flujo artista (canon)

### Descarga e instalación (`downloads.html`)

1. Cerrar MDJ PRO si está abierto (Cmd+Q)
2. Doble clic en el `.pkg` en Descargas
3. Seguir el instalador de macOS (contraseña si la pide)
4. Al terminar, **MDJ PRO se abre sola** (INSTALL-OPEN-008)
5. Primera vez: permisos Mac al usar **Load Root** / escaneo → **Permitir** + carpeta
6. Opcional: **Mantener en el Dock**
7. Ayuda humana: **miamidjbeat@gmail.com** — sin Terminal

### Release notes (web + About Mac)

- Qué **mejora** nota el artista (UX, idioma, versión en splash)
- **No** historial de incidentes de taller, commits ni “baseline post-incidente” en bullets de usuario

---

## 4. Checklist del agente (antes de cerrar cualquier edit público)

| # | Pregunta | Debe ser |
|---|----------|----------|
| 1 | ¿Un DJ no técnico puede seguir esto sin Terminal? | **Sí** |
| 2 | ¿Describe el producto que instalan desde la web notarizada? | **Sí** |
| 3 | ¿Menciona scripts, SQL, tickets o paths de taller? | **No** |
| 4 | ¿Asusta con “no verificado” si el ship es notarizado? | **No** |
| 5 | ¿Coincide con lo que pasa al instalar el `.pkg` real? | **Sí** |

Si alguna respuesta falla → **reescribir** antes de commit.

---

## 5. Corrección aplicada (2026-06-11)

| Archivo | Cambio |
|---------|--------|
| `web/downloads.html` | Eliminado bloque Terminal; 6 pasos artista |
| `web/translations.js` | Keys `dl-install-*` reescritas EN/ES |
| `web/js/downloads.js` | Eliminada generación dinámica de comando `xattr` |

---

## 6. Related

- [SUITE-ENTERPRISE-WEB-009](./MDJPRO-SUITE-ENTERPRISE-WEB-009.md) — páginas informative; mismo principio
- [NOTARIZE-005](./MDJPRO-NOTARIZE-005-apple-gatekeeper.md) — contexto histórico **solo doc**, no copy usuario
- [INSTALL-OPEN-008](./MDJPRO-INSTALL-OPEN-008-postinstall-auto-open.md) — “se abre sola” es copy artista válido
- Skill release: `.cursor/skills/mdjpro-release/SKILL.md` — pipeline taller, no pegar en web

---

**Recordatorio Hans:** El cliente no pasa por nuestro taller. El cliente pasa por el producto. Cero fricción de desarrollo en la luz pública.
