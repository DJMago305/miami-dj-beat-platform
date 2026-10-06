# Incidente — «DJ en Miami» (`find-dj.html`) muestra 0 talentos y una página vacía tras buscar «imformacion»
Fecha: 2026-10-05 · Reportado por el PO (captura con la sesión de Wendy) · Análisis forense de solo lectura (no se cambió nada).

## Resumen
No es una caída de datos. El directorio carga sus 5 talentos con normalidad. Lo que ocurrió es una **cadena de tres decisiones de diseño** que termina en un callejón sin salida:
1. El buscador del header no reconoce ninguna página, producto ni evento para «imformacion» (ni para «informacion» bien escrito) y, por defecto, ofrece «Buscar "…" en el directorio» (`header-smart-search.js`, `renderNameSearchQuickLink`).
2. Ese enlace navega a `find-dj.html?q=imformacion`, que filtra **solo por nombre/slug de talento** (`matchesQuery`, `find-dj-search.mjs`). Resultado: 0.
3. Con 0 resultados la página escribe «Se encontraron 0 talentos. (nombre/slug: “imformacion”)» y deja `#dj-grid` vacío: **sin sugerencia, sin «ver todos», sin contacto.**

## Evidencia (reproducido en producción, con header maestro presente)
| Prueba | Resultado |
|---|---|
| `find-dj.html` sin `q` | 200; `public_dj_talent?select=*&limit=500` → 200; «Se encontraron 5 talentos.» |
| `find-dj.html?q=imformacion` | Mensaje idéntico a la captura del PO; 0 tarjetas; `__findDjLast.data.length = 0` |
| Header, escribir «imformacion» / «informacion» | Solo ofrece «Buscar "…" en el directorio» (el typo no es la causa) |
| Header, escribir «dj» | Ofrece «Directorio de DJs / Ver todos los DJs disponibles» |
| Header, escribir «contacto» | Sin menú |
| Texto del propio sitio | «La búsqueda cubre páginas públicas, el directorio de talento y avances de nombre/fecha de eventos» |

## Por qué no es el incidente que se cerró antes
- **2026-09-23 (PR #450, `6676b4f9`)**: el problema era el contrario — `find-dj.html` dejaba pasar de más (cuenta de prueba «DJ PRO TEST» y perfiles incompletos). Se reescribió para leer solo `public_dj_talent`. Cerrado y sigue bien: hoy salen los 5 talentos reales.
- **TICKET-SEARCH-007** (`docs/tickets/`, abierto desde 2026-06-16, «no urgente»): documenta la «página fea» de resultados y el filtro que mezclaba categorías. **Sigue ABIERTO**, no cerrado. Este incidente es su misma zona (UI de resultados) pero un síntoma que ese ticket no recoge: el estado vacío.
- Ya existe precedente de cómo debe verse un estado vacío en esta misma página: el caso «sin DJ libre para esa fecha» (`dateParam && data.length === 0`) lleva el comentario «nunca un callejón sin salida» y un botón a `contact.html`. El estado vacío **por nombre** nunca recibió ese tratamiento.

## Indexación (la página está en `sitemap.xml`)
- `find-dj.html` tiene `canonical` a sí misma, **sin** `meta robots`, **sin** `meta description` y **sin** datos estructurados (`ld+json`: 0).
- El HTML que sirve el servidor trae `#state-msg` y `#dj-grid` **vacíos**: todo el listado se pinta con JavaScript tras consultar Supabase. Google renderiza JS, pero un rastreo sin renderizar ve solo el título y el H1.
- `?q=…` responde 200 con el mismo HTML y `canonical` a la URL base: no es una trampa de rastreo (el enlace con `q` solo se arma al hacer clic en el header, no hay enlaces rastreables a él), pero tampoco está marcado `noindex`.
- No consulté Search Console (no tengo sesión en este hilo): falta confirmar si Google tiene indexadas variantes `?q=` o cómo muestra la página.

## Causa raíz
Falta de un estado vacío con salida en la búsqueda por nombre de `find-dj.html`, más un buscador del header cuyo único «plan B» es mandar texto libre a un directorio que solo entiende nombres de talento.

## Qué se podría arreglar (nada hecho; requiere orden del PO, página indexada)
1. Estado vacío por nombre con salida: «No encontramos “…”» + botón «Ver todos los talentos» + «Contactar al equipo» (mismo patrón del estado por fecha).
2. Tolerancia a acentos/errores leves en `matchesQuery` («informacion»/«información», «imformacion»).
3. El header: si el texto no coincide con nada, ofrecer también las páginas de ayuda/contacto, no solo el directorio.
4. SEO de `find-dj.html`: `meta description`, `ItemList` en `ld+json`, y `noindex` solo para `?q=` si se confirma que Google las rastrea.
5. Revisar con Search Console qué URL de `find-dj` aparecen indexadas.
