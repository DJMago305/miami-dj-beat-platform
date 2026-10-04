# TICKET — Página propia "DJ en Key Largo" (SEO local, residencia Sundowners)

**Fecha de apertura:** 2026-10-03
**Origen:** el PO pidió un SEO de la zona de Key Largo tras el reporte operativo de DJ Yuyo del turno en Sundowners (poca gente, lluvia, temporada baja). Análisis hecho por el hilo GEO·SEO·IA con datos reales de Search Console y Analytics.
**Estado:** PROPUESTO — NO ejecutado. No hay rama, no hay cambios en `web/`. Espera aprobación del PO (palabra exacta: «aprobado»).

---

## 1. Evidencia (números reales, sacados el 2026-10-03)

| Fuente | Dato |
|---|---|
| Search Console (`sc-domain:miamidjbeat.com`, 90 días) | `florida-keys.html`: **9 impresiones, 0 clics, posición promedio 22.7** |
| Única consulta visible | «wedding entertainment in key largo fl»: 1 impresión, posición **62** (las otras 8 impresiones son consultas anonimizadas por Google) |
| Analytics GA4 (30 días) | `/florida-keys.html`: 18 vistas, 9 sesiones, prácticamente tráfico directo, no de buscador |
| Competencia en Google para «DJ Key Largo» | Dominan directorios (Zola, The Bash) y 4-5 DJs locales con precios iniciales de ~$1,000 a $2,000 |

**Lectura:** hoy hay una sola página para 4 ciudades (Key Largo, Islamorada, Marathon, Key West) y casi no recibe impresiones. Key Largo es la única consulta con nombre propio que aparece, y es la zona donde ya tenemos prueba real (residencia en Sundowners).

## 2. Qué existe hoy (no se rehace)

- `web/florida-keys.html`: título, descripción, canonical, schema `Service` + `FAQPage`, está en `sitemap.xml`, enlazada desde los pies de página de ~8 páginas de servicio. Su FAQ ya afirma la residencia semanal en Sundowners.
- Assets reales: `web/assets/florida-keys/fotos/keys-sundowners-hero.(jpg|webp)` y `keys-sundowners-card.(jpg|webp)`, más un video de Sundowners (ver `docs/ESTADO_MAESTRO.md` «Florida Keys»).
- Tabla real `residency_schedule` (fila de Sundowner Key Largo) y `financial_venues` (Sundowner Key Largo, con `address` en NULL).

## 3. Objetivo

Que Google muestre al sitio para búsquedas de **bodas, eventos y fiestas privadas en Key Largo**, y que `florida-keys.html` quede como página central de la región apuntando a la de Key Largo.

## 4. Alcance propuesto

**Entra:**
1. Página nueva `web/dj-key-largo.html` copiando el patrón de las páginas de servicio existentes (`dj-miami.html`, `club-dj.html`): encabezado maestro, hero con Playfair Display, pie de página, i18n ES/EN completo.
2. SEO on-page: `<title>` y descripción con «Key Largo», un solo H1, canonical, Open Graph, schema `Service` con `areaServed: Key Largo` y `FAQPage` (preguntas: cargo por traslado desde Miami, requisitos de energía en exteriores/agua, reuniones remotas, experiencia en el lugar, cómo cotizar, temporada y disponibilidad).
3. Contenido real y verificable: la residencia en Sundowners (día, horario y formato **leídos de `residency_schedule` antes de escribir**, no de memoria), fotos y video ya existentes, logística de equipo desde Miami.
4. Sección de temporada: bodas y fiestas fuera de temporada alta (septiembre-noviembre) con más disponibilidad de fechas. Sin cifras de turismo inventadas.
5. Enlaces internos: desde `florida-keys.html` (tarjeta/enlace a Key Largo) para que no quede huérfana, y entrada nueva en `sitemap.xml`.
6. Tarea fuera del repo: agregar Key Largo como zona de servicio en Google Business Profile.

**No entra (decisión explícita):**
- No se borra ni se mueve `florida-keys.html` (sigue siendo la página central de la región).
- No se menciona asistencia, ventas ni el reporte de Yuyo en la página: es información operativa interna, no contenido de marketing.
- No se inventan reseñas, precios ni fechas. Si no hay reseña real de Sundowners, la sección de reseñas no se publica.
- No se tocan `staff.html`, `dj-profile.html` ni `mdjb-shared-header.js` (en pausa por el Hilo Maestro).

## 5. Pendientes que bloquean o condicionan

| # | Qué falta | Quién |
|---|---|---|
| 1 | Confirmar nombre de URL (`dj-key-largo.html` propuesto) | PO |
| 2 | Fotos propias adicionales de Key Largo/Sundowners (hoy solo hay 2 + 1 video; el sitio ya mostró espacios vacíos cuando los assets no estaban subidos a Storage) | PO |
| 3 | Reseña real de Sundowners o de un cliente de Keys, con permiso para publicarla | PO |
| 4 | Confirmar con el Hilo Maestro la jurisdicción de `web/*.html` de servicios (`docs/JURISDICCIONES.md` no nombra SEO/páginas de servicio) | Hilo Maestro |
| 5 | Subir cualquier asset nuevo a Supabase Storage antes de mostrarlo | quien ejecute |

## 6. Verificación antes de pedir «aprobado» al PO

- `node web/scripts/check-hygiene.mjs` y `node web/scripts/check-i18n.mjs` en verde (página enlazada, sin claves i18n faltantes).
- Revisión en el navegador dentro del contenedor real (con `#mainHeader` presente), en ES y EN, escritorio y móvil, mostrando foto y video cargando desde Storage, no solo localhost.
- `?v=` de cache-bust actualizado si se toca un CSS/JS compartido.
- Validar el JSON-LD (sin errores de sintaxis).

## 7. Medición (línea base y revisión)

- **Línea base (2026-10-03):** 9 impresiones, 0 clics, posición 22.7 para `florida-keys.html`; 0 páginas dedicadas a Key Largo.
- **Revisión a los 60 días de publicada:** impresiones y clics de la página nueva y de `florida-keys.html`, consultas con «key largo», posición de «wedding entertainment in key largo fl» (hoy 62).
- Solicitar indexación de la URL nueva en Search Console al publicar.

## 8. Reglas de gobernanza (CLAUDE.md)

- Rama nueva desde `main` actualizado: `feature/pagina-dj-key-largo`.
- Cero commit y cero PR hasta que el PO vea el resultado y diga «aprobado» o «me gusta así».
- Antes de abrir el PR: `git diff origin/main --stat` solo con archivos de esta tarea (`dj-key-largo.html`, `florida-keys.html`, `sitemap.xml`, `translations.js`, assets).
- `git add` nominal, nunca `git add .` ni `-A`.

## 9. Estado al 2026-10-04 (página construida y revisada por el PO)
- Construida: `web/dj-key-largo.html` (Service + FAQPage con 7 preguntas, canonical propio), enlazada desde `web/florida-keys.html`, en `sitemap.xml`, claves `kl-*` es/en en `translations.js`.
- Revisada en el navegador dentro del contenedor real (menú presente), escritorio 1440 px y móvil 375 px, ES y EN. Video por URL absoluta de Storage (regla `.mp4`).
- **Pendiente 1 — horas del domingo:** el letrero que aparece en la foto del local dice «Brunch with DJ, every Sunday 10 AM – 2 PM»; el texto de la página dice 12 a 5 p. m. (coincide con la regla del turno en la base de datos y con lo indicado por el PO). El PO aprobó la página tal cual; queda la decisión de cambiar la foto o dejar el texto sin horas. `florida-keys.html` (ya publicada) usa la misma foto y el mismo texto.
- **Pendiente 2 — menú de servicios:** agregar `dj-key-largo` a `MDJ_PAGINAS_SERVICIOS` en `mdjb-shared-header.js` (archivo pausado: lo hace el Hilo Maestro).
- **Pendiente 3 — `florida-keys.html`:** su `.mp4` sigue con ruta relativa (el script compartido lo reescribe, pero pide primero una ruta que da 404 en producción).
- Medición: línea base de Search Console de la sección 7; revisar a 28 días.
