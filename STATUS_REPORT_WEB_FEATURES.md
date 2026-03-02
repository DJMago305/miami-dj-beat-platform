# Estado Actual de MDJPRO y Miami DJ Beat Platform (23 Feb 2026)

Este reporte detalla todas las páginas, componentes interactivos e integraciones que actualmente están operativas en el portal web de la plataforma.

## 1. Páginas Principales (Frontend)

-   **`index.html` (Inicio Mágnetico & Landing Page):**
    -   **Hero Section:** Formulario de captura inicial "Reserve your event" (Tipo de evento, Fecha, Presupuesto, Referido) conectado a Formspree / MVP Status.
    -   **Disponibilidad Rápida (Big Day):** Selectores rápidos de mes/día/año para chequear agenda.
    -   **Servicios y Cobertura:** Explicación de servicios (DJ, Lighting, MC) y áreas (Miami-Dade, Keys).
    -   **Portafolio (Experiencias y Residencias):** Casos de éxito y residencias semanales en Mojitos Calle 8 y El Valle.
    -   **Marketplace Links:** Accesos rápidos a Servicios de Evento (`rentals.html`) y Herramientas DJ (`dj-tools.html`).
    -   **Contacto Inferior:** Formulario completo para solicitar disponibilidad directamente.

-   **`jobs.html` (Reclutamiento y Aplicación PRO):**
    -   Selección de ruta: Plan Lite (descargas) o Plan Pro (empleo).
    -   **Formulario Dinámico PRO:** Ingreso de datos completos del DJ.
    -   Modal inteligente para el ingreso de "Dirección Física Profesional".
    -   Herramienta de Carga de Foto con funciones de vista previa y ZOOM (+/-). *Permite pegar imagen desde Portapapeles*.
    -   Asistente "Helper" para agregar y formatear fácilmente el historial de experiencia del DJ.
    -   Checkboxes para hardware (tech rider), roles (MC, DJ, Animador) e idiomas.
    -   Conexión a base de datos (`dj_profiles` en Supabase) guardando imagen en Base64 y estatus `PENDING_REVIEW`.

-   **`client-portal.html` (Portal del Cliente - Eventos):**
    -   Acceso mediante ID de lead (`?lead=ID`).
    -   Módulo "Cuenta Regresiva" (Countdown) hasta el día del evento.
    -   Módulo "Logística": Muestra ubicación, gate code y contactos. Es **editable en modo Manager** (`?mode=manager`).
    -   Módulo "Mi Pack de Servicios": Carrusel/Lista de ítems de la factura. El Manager puede agregar servicios personalizados con precios estipulados.
    -   Estado de Cuenta y Abonos: Tracking de pagos pendientes y barra de progreso. El Manager puede registrar "Abonos".
    -   Módulo "Califica tu Experiencia": Aparece tras la fecha del evento para recolectar feedback de calidad del DJ.
    -   **Chat "AI Sync":** Simulación de chat en tiempo real cliente-manager con traducción instantánea AI (ES-EN).

-   **`dj-dashboard.html` & `dj-profile.html` (Área del Talento):**
    -   Páginas protegidas por Auth de Supabase.
    -   `dj-profile.html`: Edición de datos personales, enlaces sociales de Spotify/Soundcloud y tarjeta de presentación.
    -   `dj-dashboard.html`: Panel de recompensas (MDJ-Coins/Tokens), acceso a entrenamientos (Academia MDJPRO) y descargas PRO exclusivas.

-   **`downloads.html` (Página de Descarga de App MDJPRO):**
    -   Tarjeta de descarga rediseñada estilo premium Serato.
    -   Integración de Branding CSS Puro (Logo tipo "M" e insignias MDJPRO sin necesidad de imágenes rasterizadas).
    -   Sistema de Pestañas dinámicas (Tabs) para transicionar entre "Funciones" (What's New) y "Requisitos del Sistema" (Tech Specs).
    -   Tablas de requerimientos ocultas para Mac/Windows (Layout oscuro minimalista).
    -   Menú Acordeón al pie para manuales y guías externas.

-   **`rentals.html` (Catálogo A/V & Producción):**
    -   Galería estática de productos para alquiler de equipo corporativo (PA Systems, iluminación, estructuras).

-   **`dj-tools.html` (Lead Magnet y Samples):**
    -   Kits de Audio, Remixes y Librerías descargables. Funciona como cebo para capturar emails de nuevos DJs al ecosistema Lite.

-   **`login.html` (Autenticación):**
    -   Sistema unificado de Login/Registro alimentado por `supabase.auth`. Captura perfil inicial básico.

## 2. Herramientas Administrativas y Motores Lógicos

-   **`admin-dashboard.html` (Cerebro del Manager):**
    -   Protección por rol (Manager o Super Admin). Revisa metadata o tabla de perfiles en Supabase.
    -   **Panel de Leads:** Lista todos los eventos solicitados, calculando "Lealtad" (Tier: Dorado, Plata, Nuevo) basado en el conteo de correos del cliente.
    -   Generación Mágica de "Event Blueprint": Visualiza las respuestas directas del Party Planner del cliente.
    -   Generación Directa de Factura (Enlaza Client Portal o Activa `invoice-generator.js`).
    -   Manejo de Solicitudes DJ: Verificación en crudo de la tabla `dj_profiles` y botón dinámico para aprobar talento (Pasa a status `PRO_VERIFIED`).
    -   **Base de Precios de Mercado:** Permite ajustar los costos variables (Audio Base, MC Pro, Sparks) y guardarlos en LocalStorage para proformas dinámicas.

-   **`party-planner.html` (Event Blueprint Generator):**
    -   Wizard paso a paso de ultra-alta conversión con ramas condicionales según el tipo de evento seleccionado en Landing (Wedding vs Club vs Babyshower).
    -   Opción "Confío en el Criterio Profesional": Permite saltar pasos técnicos para clientes que delegan todo en MDJPRO.
    -   Mensajes "💡 Recomendación" automáticos (Ej: "Cuidado, requieres más audio superior a 200 personas").
    -   Generación directa a PDF final: Archivo PDF estructurado con certificaciones de "Cero Fallo MDJPRO" e inyección de todos los datos organizados por módulo.
    -   Actualiza automáticamente la tabla madre en base de datos al finalizar.

## 3. Integraciones de Infraestructura Operativas

-   **Base de Datos / Backend (Supabase):**
    -   Autenticación (`auth.users`) operativa.
    -   Tablas Activas utilizadas: `dj_profiles` (Gestión de roles y data del DJ) y `leads` (Solicitudes de clientes, Blueprints del Party Planner y data del evento).
-   **Sistema Multi-idioma (`translations.js` / `i18n.js`):**
    -   Framework de switch estático de idioma en todo el NavBar. Múltiple cobertura para EN/ES ya mapeado por data-attributes.
-   **Captura de Contacto (Formspree):**
    -   Solución temporal pero funcional para `hero-contact-form`, `bottom-contact-form` y `footer-form` rebotando correos directamente al admin ante ausencia de API de email propia.
-   **Generador PDF (`jspdf.umd.min.js`):**
    -   Activo tanto para crear Facturas/Proformas (`invoice-generator.js`) como para exportar los Event Blueprints del planificador de bodas/fiestas (`party-planner.js`).

## 4. Estilos Core (`styles.css` / `profile.css` / `mdj-assistant.css`)
-   Implementación exhaustiva de *Glassmorphism* y Dark Mode premium.
-   Sistema responsivo para menús móviles tipo hamburguesa, Sticky Header y Side-panels.
-   Animaciones de scroll y hover efectes 3D refinados implementados nativamente.
-   Aislamiento de la lógica visual del i18n y alertas preventivas.
