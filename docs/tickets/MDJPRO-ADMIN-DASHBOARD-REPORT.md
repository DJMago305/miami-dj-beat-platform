# Reporte de Estado: Panel de Administración (admin-dashboard.html)

## Leads (Nuevas Solicitudes) (#leads)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Carga inicial en `loadAdminData`)

## Base CRM (Clientes VIP) (#crm)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Función `loadCRM()`)

## Gestión de DJs (Solicitudes) (#djs)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Carga inicial en `loadAdminData`)

## Gestión de Staff (#staff)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Función `loadStaff()` y `loadStaffActivity()`)

## Crear Perfiles (#create-profiles)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Función `submitCreateProfile()` vía Edge Function)

## Registro de Certificados (#registry-section)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Función `loadCertificationRegistry()`)

## Analytics (KPIs) (#analytics)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Función `loadAnalytics()`, lee de `dj_profiles` y `client_profiles`)

## Contenido / MDJ Knowledge (#content)
- **UI Presente:** Sí
- **Cableado (Datos):** Parcial (Enlaces estáticos a `dj-knowledge.html` y `jobs.html`)

## MDJPRO Downloads Catalog (#mdjpro-downloads-panel)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Función `loadMdjproDownloadsCatalog()` de `platform_settings`)

## Integraciones (Apps) (#apps)
- **UI Presente:** Sí
- **Cableado (Datos):** No (UI estática "Próximamente")

## Producción (Timelines) (#production)
- **UI Presente:** Sí
- **Cableado (Datos):** Sí (Inicia `window.MDJProduction.init()`, carga `production-templates.js`)

## Promociones (Campaign Center) (#promociones)
- **UI Presente:** No (o está en otro archivo)
- **Cableado (Datos):** Enlace externo (`campaign-center.html`)

## Wedding Plan (#wedding-plan)
- **UI Presente:** Sí
- **Cableado (Datos):** UI Estática (Formularios sin función de guardado a DB visible en este archivo)

## Event Blueprints (Quinceañera, Show, Privada, Corp) (#event-blueprint)
- **UI Presente:** Sí
- **Cableado (Datos):** UI Estática (Función `loadEventBlueprint(type)` cambia títulos pero no guarda a DB)

## Pasarela / Fashion Show (#fashion-show-panel)
- **UI Presente:** Sí
- **Cableado (Datos):** UI Estática (Función `openFashionShowPanel()` muestra modal, no guarda a DB)

