# MDJPRO-BOOTH-MANUAL-016 — Booth: conocimiento Manual MDJPRO + gates por rol

**Status:** **DONE localhost** — manual 17 cap. + role gates + bridge + **web classes jun-2026** · **Edge deploy pending** (`booth-chat`) · **await `APROBADO PUSH`**

**Related:** [MANUAL-ICONS-014](./MDJPRO-MANUAL-ICONS-014-enterprise-manual-svg-icons.md) · manual interactivo 6 langs

---

## 1. Objetivo

Booth = especialista digital MDJB + **Manual MDJPRO**:

- Conoce 17 capítulos y enlaza anclas `#00-intro.md` … `#16-support.md`
- Guía navegación web **dentro del rol** (cliente / artista / staff / invitado)
- **No** secretos, datos de terceros, ni talento fuera de Miami DJ Beat
- **Cap. 6 PRO:** explica, no desbloquea sin suscripción
- Ventas eventos → `/services.html` + escalado vendedor/manager

---

## 2. Archivos

| Archivo | Cambio |
|---------|--------|
| `web/mdj-assistant.js` | Manual catalog + `boothWebPlatformClassesReply` + downloads en site map + contexto LLM |
| `web/js/mdj-booth-manual-bridge.js` | **Nuevo** — contexto manual + identidad ligera |
| `web/manuals/MDJPRO_Manual/{es,en,fr,de,it,pt}/index.html` | Scripts supabase + bridge + assistant `?v=20260612-booth-manual-1` |
| `supabase/functions/booth-chat/index.ts` | System prompt §2C Manual + **§2D Clases web jun-2026** |

---

## 3. QA localhost

1. `http://localhost:8080/manuals/MDJPRO_Manual/es/index.html` — Booth abajo-derecha 🤖
2. Preguntar: **“capítulos del manual”** → índice 17 con links
3. **“cómo instalo MDJPRO”** → cap. 2 + link `#02-install.md`
4. **“librería wizard”** (sin PRO) → explica + `login.html?plan=pro`, no acceso gratis
5. **“abrir admin dashboard”** (cliente/invitado) → rechazo + ruta correcta
6. **“qué hay de nuevo en MDJPRO”** → V.2.6.5 + downloads + manual 6 langs
7. **“recorrido por Miami DJ Beat”** → web 9 pasos + artista + app V.2.6.5 tabla manual
8. **“solo la app MDJPRO”** → flujo app + capítulos #01–#16

**LLM:** requiere `supabase-config` cargado + Edge `booth-chat` desplegada en prod.

---

## 4. Deploy

| Paso | Autorización |
|------|----------------|
| Git push web | **`APROBADO PUSH`** |
| `supabase functions deploy booth-chat` | **`APROBADO DEPLOY PRODUCCIÓN`** |
