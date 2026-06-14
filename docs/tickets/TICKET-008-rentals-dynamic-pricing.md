# TICKET-008: Gestor Dinámico de Precios (Rentals)

## 🎯 Objetivo
Permitir que el Owner pueda modificar los precios de todos los servicios del portal de ventas (`rentals.html`) directamente desde el Manager Panel (`admin-dashboard.html`), sin necesidad de tocar el código fuente.

## 🧠 Contexto
Actualmente, los precios de los DJs, Músicos, Carpas, etc., están "hardcodeados" (escritos fijos) en el archivo `web/js/rentals.js`. Si el Owner quiere subir el precio de la Hora Loca de $650 a $700, debe pedirle a un programador que edite el código.
El objetivo es crear un "Gestor de Catálogo" en el dashboard del Owner que guarde estos precios en la base de datos (Supabase) y que `rentals.html` los lea en tiempo real.

## 🛠️ Plan de Acción (Paso a Paso)

### ✅ Paso 1: Preparar la Base de Datos (Supabase) (COMPLETADO)
- Utilizar la tabla existente `platform_settings` para guardar un gran objeto JSON llamado `rentals_catalog_prices`.
- Este JSON contendrá el mapeo de IDs y precios (ej. `{"dj_weddings": 1500, "live_sax": 400, "fx_sparks": 250}`).

### ✅ Paso 2: Crear la Interfaz en el Manager Panel (`admin-dashboard.html`) (COMPLETADO)
- Expandir la sección actual "Gestión de Tarifas de Mercado" (que actualmente solo guarda en `localStorage` para facturas manuales).
- Crear un formulario completo que liste todas las subcategorías de `rentals.js` (DJs, Músicos, FX, Lighting, etc.) con sus inputs de precio.
- Conectar el botón "Guardar Todo" para que haga un `upsert` en la tabla `platform_settings` (key: `rentals_catalog_prices`).
- Asegurar que este panel solo sea visible y editable por el rol `owner`.
  - **Acción:** Se actualizó `applyRoleRestrictions()` para ocultar todo el bloque `rentals-catalog-grid` a Sellers, Managers y Admins. Solo el Owner puede verlo y guardar.
  - **Acción de Limpieza (Minimalismo):** Se eliminó por completo la sección "MDJ Knowledge & Contenido" (accesos directos a Base de Conocimiento y Bolsa de Trabajo) del panel de Contenido y Precios por orden explícita del Capitán, para reducir peso visual y "cables innecesarios".

### ✅ Paso 3: Conectar el Portal de Ventas (`rentals.html` / `rentals.js`) (COMPLETADO)
- Modificar la inicialización de `rentals.js`. Antes de renderizar las tarjetas en la pantalla, debe hacer un `fetch` a Supabase para leer `rentals_catalog_prices`.
- Sobrescribir los precios base `price` y `fallbackPrice` del objeto `window.MDJ_RENTALS_DATA` con los valores descargados de la base de datos.
- Si la base de datos falla o está vacía, el sistema usará los precios "hardcodeados" como respaldo (Fallback de seguridad).

## 🔒 Reglas de Seguridad
- **Solo Owner:** Los roles `seller`, `manager` o `admin` no deben poder ver ni editar este panel de precios.
- **Rendimiento:** La consulta a Supabase en `rentals.html` debe ser lo primero que ocurra al cargar la página para evitar que el cliente vea un precio viejo y luego cambie de golpe.
