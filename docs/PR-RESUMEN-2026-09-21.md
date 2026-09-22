# Resumen del PR — rama `feature/dj-alertas-campana-push` (2026-09-21)

**Estado: NO abierto. Sin commit.** CLAUDE.md §1/§7: solo se abre con el «aprobado» del PO, y antes el PO debe VER los cambios (confirmación visual directa). Este documento es el borrador de la descripción.

## Título sugerido
`feat: cancelaciones + avisos de DJ, historial del cliente, roles decididos por el servidor, categoría única/idioma/tarifas de artista, menú Trabajos y página del flair bartender`

## Tamaño y advertencia
La rama está a **0 commits** de `origin/main` (0/0): todo el trabajo está **sin comitear** — 117 archivos modificados (+2,463 / −1,155) y unos 50 nuevos, más 184 archivos del banco de diseño (PNG) y 15 de `web/assets/branding/` que **no** deben entrar. Es MUCHO para una sola revisión → propuesta: **un PR, varios commits por tema** (plan al final).

## Qué cambia, por tema
**A. Roles, contenedores y seguridad (incidente «cliente dentro de la hoja del artista»)**
- Causas cerradas: `account-settings.html` sin guarda de rol; `login.html` obedecía `?redirect=`; `auth.js` mandaba roles desconocidos a la hoja del artista; buscador del header; 3 enlaces de cliente hacia la hoja del artista; el portal del cliente no expulsaba al artista.
- El rol lo decide el SERVIDOR (`app_metadata.role`); `user_type` (editable por el usuario) queda solo como pista heredada vía `mdjUserTypeLegacy()`. Edge functions `verify-client-billing-unlock` y `notify-new-device-login` ya no aceptan `user_type` como prueba de staff.
- Causa raíz de perfiles duales: la hoja de ajustes guardaba siempre en `client_profiles` (retirado `handleClientSettingsSubmit`) y `mdjEnsureAuthProfileRows` trataba al owner como cliente.
- Nuevo `scripts/verificar-contenedores.mjs` (C1–C9 + auditoría de BD). Docs: `docs/contenedores-y-rutas.md`, `docs/incidentes/2026-09-21-cruce-cliente-artista.md`.

**B. Cancelaciones, historial y avisos** (trabajo previo de la sesión): campana y avisos push del DJ, recordatorios 24 h/2 h, cancelación del DJ/artista/cliente con urgencia para el staff y política de reembolso, historial de órdenes del cliente (ocultar/restaurar, autolimpieza 30 días), calendario del portal.

**C. Categoría única, idioma, tarifas y Trabajos**
- Fuente única `web/js/mdj-categorias.js` (12 categorías, subcategorías, idioma, `derivar()`, dibujo de círculos). Usada por `jobs.html` (`jobs-categorias.js`) y por Configuración de cuenta (panel Categoría; el sistema viejo se eliminó).
- Una sola categoría, elegida solo desde el nuevo desplegable **TRABAJOS** (`mdjb-shared-header.js`, 12 categorías alfabéticas); quien entra con sesión ve lo ya configurado. Hora Loca con 15 tipos; bartender clásico / flair / mixólogo; DJ productor y DJ animador; idioma es/en/bilingüe en todas.
- Tarifas privadas de artista (`artist_rates`, solo staff) + herramienta ELIXIS `consultar_tarifa_artista`; bartender de flair = $1,200/evento como base (SKU `staff_bartender_flair`).
- Nuevo hero de `jobs.html` («El mundo artístico evoluciona · Da tu primer paso»), aviso «MDJ PRO…» retirado.
- Network ↔ cuentas por teléfono.

**D. SEO / páginas de servicio y Servicios**
- Nueva `web/flair-bartender-miami.html` (ES/EN, Service + FAQPage + BreadcrumbList, `sitemap.xml`, hero con el video ya publicado en el bucket). Enlazada desde el bloque Bartender de `staff-dj.html` (Flair es subcategoría, no fila del hub).
- Servicios (`rentals.html`/`services.html`): tarjetas nuevas DJs / Música en Vivo / Staff; «DJs» lleva a la NUEVA página `dj-miami.html` (hub oficial de servicios de DJ, indexable: Service + FAQPage + BreadcrumbList, sitemap); el hub de talento queda con 3 filas; 4 tarjetas por fila, video de fondo nítido; fechas temáticas con «Agregar a mi evento» (carrito + pendiente hasta iniciar sesión).
- Nueva `event-entertainment-miami.html` (Entretenimiento y Talento) y botón de regreso compartido (solo íconos: regreso + casita a Inicio; `web/js/mdj-back-button.js`) en 24 páginas de servicio. El modal viejo del hub de talento (`#talent-selector-modal`) YA SE RETIRÓ (rentals.html, services.html, ~600 líneas de `js/rentals.js`).
- Menú rápido de Servicios espeja el hub; la pestaña SERVICIOS queda marcada en el hub y en toda página de servicio. Páginas nuevas de captación: clases de baile para bodas y para vals de quinceañera (aliado sin nombrar, por acuerdo comercial). payasos-dj ampliada (magia, globoflexia, pinta caritas); Música en Vivo con «Desde $1,500» en bandas/orquestas y lista de videos del hero corregida (11 páginas tenían `loop`); FAQ ampliadas en 23 páginas.
- Migas visibles retiradas de 20 páginas de servicio (queda `BreadcrumbList` en JSON-LD); `seasonal-parties.html` alineada con el hub («Themed Parties & Special Events»).

**E. Banco de diseño** `docs/referencias-diseno/` (índice, notas, piezas) y auditoría de íconos (solo informes).

## Base de datos — YA APLICADO en producción (no lo hace el PR; el PR solo deja el registro)
Scripts nuevos en `supabase/scripts/`: `20260921_roles_servidor_categorias_idiomas.sql`, `..._auditoria_roles_bd.sql`, `..._network_enlace_cuentas_por_telefono.sql`, `..._tarifas_artista_privadas.sql`, más los de cancelaciones/historial/avisos/asignación (ver `docs/ESTADO_MAESTRO.md`, cada uno con su estado aplicado/preparado).
Cambios de hoy: `user_role()` por defecto = client · trigger de alta con rol · política única de INSERT en `dj_profiles` · `dj_profiles.categoria` + `idiomas` (con checks) · `artist_rates` (RLS) + `artist_rate_effective()` · `mdj_auditar_roles()` / `mdj_auditar_identidad()` · columnas de enlace en `network_referencia_contactos` + trigger + cron diario · 12 cuentas con rol asignado · 4 filas sobrantes de `client_profiles` respaldadas en `_respaldo_client_profiles_20260921` y borradas. Auditoría hoy: **0 graves**, 2 avisos (clientes sin identidad).

## Despliegues que hace el PO (funciones de servidor con cambios en este PR)
1. `elixis-chat` (herramienta de tarifas, SKU flair, filtro de idioma) · 2. `verify-client-billing-unlock` · 3. `notify-new-device-login` · 4. `mdj-avisos-despachar` · 5. `create-event-payment` (confirmar si ya está).
`supabase functions deploy <nombre> --project-ref hkuvuqupbxwkiykxvqdr`. Hasta desplegar las 2 de seguridad, el hueco de `user_type` sigue abierto en producción.

## Verificado
Verificador de contenedores 0 graves (en rojo contra `origin/main`: 23) · `node --check` de todos los JS cambiados y nuevos · 96 bloques JSON-LD válidos, 0 inválidos · pruebas en el navegador (login/roles, hoja de ajustes con el perfil del PO, jobs con sesión, desplegable, hub, 20 páginas sin migas, página del flair ES/EN) · pruebas de permisos en la base con JWT simulado y transacciones revertidas (roles, alta de artista, tarifas, idiomas, categoría).

## NO verificado (decir claro)
- Guardar el perfil / la categoría con sesión de **artista real y de owner** (solo se probó el render; el guardado se probó en la base con JWT simulado).
- El alta real de un artista nuevo desde `jobs.html` (categoría/idiomas hasta `dj_profiles`).
- Las 5 funciones de servidor (sin `deno`: solo sintaxis, sin chequeo de tipos ni prueba en vivo).
- Inglés y móvil de la mayoría de las páginas; el desplegable con dedo real.
- Los tokens de login ya emitidos conservan el rol viejo hasta el próximo inicio de sesión.

## Riesgos / cosas que cambian de comportamiento
- Un artista con **varias categorías** guardadas queda con **una** al elegir (regla del PO).
- Los datos personales que un artista/owner guardaba también en `client_profiles` ya no van allí.
- ~72 HTML con `?v=` subido (mecánico) → mucho ruido en el diff.

## Exclusiones y decisiones de alcance (PO)
- **No entra:** `web/assets/branding/{campanas,djmago305,fotos-chroma,miamidjbeat}/` (23 MB sin revisar).
- **Decidir:** 10 archivos con solo cambio de `?v=` que no son de este ticket — 6 manuales de `web/manuals/MDJPRO_Manual/*` y `web/dj/djyuyo.html`, `web/dj/djsolitario.html`, etc. (MDJPRO: «cero cambios sin orden») → recomiendo **revertir esos bumps**.
- `docs/categorias-artistas-generos-BORRADOR.md` es un borrador sin aprobar: fuera del PR salvo que lo quieras.
- 184 PNG del banco de diseño: decidir si viajan en este PR o en uno de documentación aparte.

## Plan de commits (un PR)
1) A roles/contenedores/seguridad + SQL de roles · 2) B cancelaciones/avisos/historial + SQL · 3) C categorías/idiomas/tarifas/Trabajos + elixis + SQL · 4) D SEO (flair, migas, temáticas, sitemap, translations) · 5) E banco de diseño · 6) `?v=` mecánicos. **Agregar por nombre** (`git add <archivo>`), nunca `git add .` (CLAUDE.md §8).

## Antes de abrir
1. El PO ve y aprueba visualmente (artista, staff, owner y cliente). 2. `git diff origin/main --stat` solo con archivos de esta lista. 3. `node scripts/verificar-contenedores.mjs` en 0 graves (y con `SUPABASE_DB_URL` para el chequeo de BD). 4. El PO despliega las funciones. 5. Tras el despliegue: `select * from public.mdj_auditar_roles();` = 0 graves.

## Pendientes de contenido (PO)
Subir al bucket `assets`: `quinceanera/videos/quince-vals-clip.mp4` (y, para Música en Vivo, el video de bandas y orquestas + los de mariachis); precios de mariachis y solistas; original horizontal sin sello del video de Amira; destino del recorte del video de Gabriela; permiso de las familias para publicar.

## Decisiones pendientes del PO
`pro.test+001` (cuenta de prueba) · quitar código viejo de cliente aún presente en `account-settings.html` (solo lectura de `client_profiles`) · si las migas se quedan en `wedding-planning.html` · qué hilo envía las URLs nuevas a Search Console · precio base para orquestas/bandas (sin definir).

## Rollback
Base: cada script tiene su reversa (`drop`/`alter`) o su respaldo (`_respaldo_client_profiles_20260921`). Código: revertir el PR. Los `?v=` se pueden revertir sin efecto funcional.
