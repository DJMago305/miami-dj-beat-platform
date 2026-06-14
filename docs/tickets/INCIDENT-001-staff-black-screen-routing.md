# INCIDENT-001: Pantalla Negra en Panel Staff y Enrutamiento Incorrecto de Owner

## Resumen del Incidente
El Capitán reportó que el botón "STAFF" en la barra de navegación principal (para cuentas con rol `owner`) redirigía incorrectamente a `account-profile.html` (Configuración) en lugar de `admin-dashboard.html` (Panel de Gestión de Staff). 
Durante los primeros intentos de diagnóstico y corrección, el panel `admin-dashboard.html` comenzó a mostrar una pantalla completamente negra (sin contenido visible en `localhost`), lo que fue percibido como una pérdida, sabotaje o eliminación del contenido de Staff.

## Diagnóstico Forense

### 1. Problema de Enrutamiento (Botón STAFF)
- **Causa Raíz:** En el commit `1bddd01`, se introdujo una regla explícita en `web/mdj-shared-header.js` dentro de la función `mdjBuildArtistStaffMainNavHref()`:
  ```javascript
  if (role === 'owner') return './account-profile.html';
  ```
- **Impacto:** Esta regla forzaba a que el dueño de la plataforma no pudiera acceder al panel de Staff haciendo clic en el botón principal, enviándolo al perfil de cuenta.

### 2. Pantalla Negra (Bloqueo Visual Total)
- **Causa Raíz:** En el commit `b765553` (9 de junio de 2026), se agregó la llamada a la función `loadMdjproDownloadsCatalog()` dentro de `applyStaffDashboardRole()` en `web/admin-dashboard.html`. 
- **Mecanismo de Bloqueo:** El sistema utiliza una clase CSS de seguridad (`mdj-admin-gate-pending`) que oculta todo el `main.container` (fondo negro) hasta que el script de autenticación valida el rol y remueve la clase. Al fallar el script prematuramente en la carga del catálogo, la línea de desbloqueo `document.documentElement.classList.remove('mdj-admin-gate-pending');` nunca se ejecutaba.
- **Conclusión Forense:** El contenido HTML de Staff (`<div id="staff">`) **nunca fue borrado ni mutilado**. Estaba intacto en el código fuente, pero permanecía invisible por el "Auth Gate" (bloqueador de seguridad) debido a un error de ejecución de JavaScript.

## Resolución Quirúrgica Aplicada

1. **Corrección de Enrutamiento (`web/mdj-shared-header.js`):**
   - Se eliminó la excepción restrictiva para el rol `owner`.
   - Se actualizó la ruta para que apunte directamente al ancla de la sección: `return './admin-dashboard.html#staff';`.

2. **Desbloqueo Visual (`web/admin-dashboard.html`):**
   - Se eliminó la llamada prematura a `loadMdjproDownloadsCatalog()` dentro de `applyStaffDashboardRole()`. Esta función ya se estaba llamando de forma segura y redundante dentro del evento `DOMContentLoaded`.
   - Se actualizó el enlace HTML estático del botón STAFF en el DOM para incluir el ancla `#staff`.

3. **Activación Automática de Pestaña (`web/admin-dashboard.html`):**
   - Se implementó un listener para el evento `hashchange` y una función `handleHashNavigation()`.
   - Al entrar a `admin-dashboard.html#staff`, el sistema detecta el hash `#staff` y simula automáticamente el clic en el menú lateral correspondiente, mostrando la sección "Gestión de Staff" de inmediato, sin requerir clics adicionales del usuario y sin quedarse atascado en la vista por defecto de "Leads".

## Estado Actual
- **Status:** Resuelto (Restauración Quirúrgica Aprobada).
- **Archivos Modificados:**
  - `web/mdj-shared-header.js`
  - `web/admin-dashboard.html`
- **Acciones Pendientes:** Ninguna. El sistema de navegación de Staff para el Owner ha sido estabilizado y el contenido ha vuelto a ser visible.
