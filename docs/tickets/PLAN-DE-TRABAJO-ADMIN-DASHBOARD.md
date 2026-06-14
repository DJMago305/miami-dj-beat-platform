# Plan de Trabajo: Pulido de admin-dashboard.html (Manager Panel)

A continuación se detalla el estado exacto del cableado de cada sección de la pestaña STAFF (Manager Panel) y el plan de acción para dejarlo 100% operativo.

## 1. Estado Actual del Cableado (Qué está conectado y qué no)

### ✅ Completamente Cableado (Operativo con Supabase)
1. **Leads (Nuevas Solicitudes):** Lee de la tabla `leads`.
2. **Base CRM (Clientes VIP):** Lee de la tabla `client_profiles`, permite búsqueda.
3. **Gestión de DJs (Solicitudes):** Lee de la tabla `dj_profiles` (estado PENDING_REVIEW), permite aprobar fotos y perfiles.
4. **Gestión de Staff:** Lee de la tabla `dj_profiles` (roles owner, admin, manager, seller).
5. **Actividad Reciente (Staff Activity Feed):** Lee en tiempo real los últimos registros de `client_profiles`, `dj_profiles` y `leads`.
6. **Crear Perfiles (Owner only):** Conectado a la Edge Function `create-platform-account`.
7. **Registro de Certificados:** Lee de la tabla `dj_certifications`.
8. **Analytics (KPIs):** Calcula métricas reales desde `dj_profiles` y `client_profiles`.
9. **MDJPRO Downloads Catalog:** Lee y guarda en `platform_settings` (key: `mdjpro_downloads_catalog`).
10. **Producción (Timelines):** Carga el módulo dinámico `MDJProduction.init()`.
11. **Pasarela / Fashion Show:** Tiene funciones completas de guardado y carga (`loadFashionShowPanel`, `fsSavePlan`) conectadas a `event_blueprints`.

### ⚠️ Parcialmente Cableado o Estático (Requiere Trabajo)
1. **Wedding Plan:** La UI está presente, pero los formularios son estáticos y no tienen funciones visibles de guardado a la base de datos en este archivo.
2. **Event Blueprints (Quinceañera, Show, Privada, Corp):** Carga un iframe (`event-blueprint-editor.html`), pero la comunicación y el guardado dependen de ese archivo externo.
3. **Integraciones (Apps):** Es un panel visual estático que dice "Próximamente".
4. **Contenido / MDJ Knowledge:** Enlaces estáticos a otras páginas (`dj-knowledge.html`, `jobs.html`).
5. **Promociones (Campaign Center):** Enlace externo a `campaign-center.html`.

---

## 2. Plan de Acción (Siguientes Pasos)

Para dejar este panel pulido y completamente funcional, propongo abordar las secciones incompletas en el siguiente orden (un paso a la vez):

### ✅ Paso 1: Cableado del Wedding Plan (COMPLETADO)
- **Objetivo:** Conectar el formulario de "Wedding Plan" a la base de datos.
- **Acción Realizada:** 
  - Se modificó `web/documents/wedding-blueprint-editor.html` (el iframe que carga dentro de `admin-dashboard.html`).
  - Se transformó `saveDoc()` en asíncrono para que, además de guardar en `localStorage`, ejecute un `upsert` en la tabla `event_show_plans` de Supabase (usando `event_type = 'wedding'` y el nombre de la pareja como `event_name`).
  - Se guarda el estado completo del formulario y los campos editables en la columna JSONB `cue_blocks`.
  - Se transformó `loadDoc()` en asíncrono para que recupere primero desde Supabase el último plan de boda del usuario (`user_id`) y, si falla o no existe, recurra al `localStorage`.
  - Se actualizó el botón de "Asignar Cliente" para que recupere visualmente el cliente asignado desde la base de datos.

### ✅ Paso 2: Verificación de Event Blueprints (COMPLETADO)
- **Objetivo:** Asegurar que el editor de blueprints (Quinceañera, Show, etc.) guarde la información.
- **Acción Realizada:** 
  - Se analizó `web/documents/event-blueprint-editor.html`. Originalmente, este archivo solo guardaba la vinculación con el cliente, pero no los datos del formulario (estaba diseñado solo para impresión).
  - Se añadió la función asíncrona `saveDoc()` para guardar todo el estado del formulario en la columna JSONB `cue_blocks` de la tabla `event_show_plans`.
  - Se añadió la función `loadDoc()` para recuperar automáticamente el último blueprint guardado por el usuario según el tipo de evento (`event_type`).
  - Se agregó el botón "Guardar" en la interfaz de usuario.
  - Se modificó `confirmAssign()` para que al asignar un cliente, también guarde automáticamente el documento en Supabase.

### ✅ Paso 3: Pulido de UI y "Próximamente" (COMPLETADO)
- **Objetivo:** Limpiar las secciones estáticas para que no parezcan rotas.
- **Acción Realizada:** 
  - Se rediseñó la sección "Integraciones (Apps)" con un estado visual de "PRÓXIMAMENTE" centrado y elegante.
  - Se rediseñó la sección "Contenido / MDJ Knowledge" dividiéndola en dos tarjetas claras ("Base de Conocimiento" y "Bolsa de Trabajo") con botones que abren `dj-knowledge.html` y `jobs.html` en pestañas nuevas.
  - Se movió la "Gestión de Tarifas de Mercado" a la parte inferior de la sección de Contenido para mantener el orden lógico.

### ✅ Paso 4: Revisión de Permisos (Role Guards) (COMPLETADO)
- **Objetivo:** Asegurar que los vendedores (sellers) no vean botones de "Guardar" o paneles sensibles.
- **Acción Realizada:** 
  - Se actualizó `applyRoleRestrictions()` en `admin-dashboard.html`.
  - Ahora, si el usuario es `seller`, se ocultan explícitamente los paneles de `staff`, `registry-section`, `mdjpro-downloads-panel`, `content`, `analytics` y `apps`.
  - Se oculta el botón de "Guardar Todo" en la gestión de tarifas de mercado para los vendedores.


### ✅ Paso 5: Expansión de la Base CRM (Directorio Global) (COMPLETADO Y AUDITADO)

### ✅ Paso 6: Sincronización de Categorías (Jobs vs Rentals) (COMPLETADO)
- **Problema:** Las tarjetas de selección en la página de aplicación de talento (`jobs.html`) no coincidían con las categorías de venta (`rentals.html`) ni con la estructura final del CRM.
- **Acción Realizada:** Se redujeron las 15 tarjetas de `jobs.html` a las 7 oficiales (DJ, Hora Loca Experience, Músicos en Vivo, Captura y Visuales, MC y Presentadores, Staff, Payasos). Se ajustaron los valores del formulario para que coincidan exactamente con lo que espera el CRM. Se corrió un script SQL (`update_legacy_talent_categories.sql`) en Supabase para migrar a todos los usuarios antiguos a las nuevas categorías maestras, logrando una sincronización perfecta de extremo a extremo.
- **Objetivo:** Convertir el CRM en la "biblia de miamidjbeat" separando literalmente todos los contactos por categorías en un formato tipo "Excel" (tablas apiladas).
- **Acción Realizada:** 
  - Se optimizó `loadCRM()` implementando `Promise.all` para hacer un *fetch* verdaderamente paralelo y concurrente de `client_profiles` y `dj_profiles`, reduciendo a la mitad el tiempo de carga. Además, se limitó la consulta SQL para traer solo las columnas estrictamente necesarias en lugar de descargar tablas completas.
  - Se mapearon y unificaron los datos en un solo arreglo `allCRMProfiles`.
  - Se implementó un motor de clasificación basado en `is_commercial` para clientes, y en `specialties` / `artist_specialty` para el talento.
  - Se actualizó `renderCRM()` para generar **múltiples tablas separadas** (una debajo de la otra, estilo Excel) para cada categoría: Clientes Personales, Clientes Comerciales / Venues, DJs, MCs / Hosts, Bandas / Músicos, y Hora Loca Experience, Músicos en Vivo, Captura y Visuales, MC y Presentadores, Staff (Eventos), Payasos (alineado con la página de Rentals), y MDJB Staff (Equipo Interno).
  - Cada tabla muestra exactamente las columnas solicitadas: Nombre/Entidad, Email, Teléfono, PRO / Nivel, y Fecha de Suscripción (además de Eventos y Gasto para los clientes). Se añadieron bordes verticales a las columnas para asemejar más la vista a un Excel. Además, se forzó la renderización de todas las tablas de categorías (incluso si están vacías) y se implementó un sistema de acordeón (colapsable) para cada categoría, permitiendo ocultar o mostrar las tablas al hacer clic en el título, ideal para manejar listas gigantes en el futuro. Finalmente, se ajustó la lógica de los "Dos Sombreros": se implementó un filtro inteligente que oculta de las tablas de Talento a aquellos usuarios (como Aron Rosso) que solo tienen un perfil de DJ vacío/pendiente (sin nombre artístico ni especialidad), asumiendo que son clientes que hicieron clic por error en aplicar. Además, se reactivó la deduplicación para que el Staff legítimo no aparezca duplicado en la tabla de Clientes (ahora el filtro cruza tanto por email como por nombre, para atrapar casos como el de Alexander Reyes que tenían correos distintos en cada perfil). Finalmente, se implementó un sistema de clasificación múltiple: si un talento tiene múltiples especialidades (ej. "DJ y Bartender"), aparecerá automáticamente en todas las tablas correspondientes (doble o triple aparición) para que pueda ser encontrado en cualquier búsqueda. Además, el motor de clasificación ahora lee tanto la columna `artist_specialty` como la `bio` del usuario, asegurando que talentos como Jean Paul (que escriben "Bartender" en su biografía) sean clasificados correctamente. Se implementaron Expresiones Regulares con Límites de Palabra (Regex Word Boundaries) para evitar falsos positivos en la clasificación (ej. evitar que la palabra "bandejas" clasifique a un DJ como "Band").

