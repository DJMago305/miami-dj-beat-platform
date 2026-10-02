# Análisis forense del sitio — 2026-10-02

**Pedido por el PO.** Solo lectura: no se cambió código ni datos de producción durante el análisis (las sondas a funciones usaron un lead inexistente y peticiones sin firma/sin sesión; las pruebas con base de datos se revirtieron solas). Todo lo siguiente tiene evidencia; lo que no se pudo comprobar está en su propia sección.

## Veredicto
El sitio publicado **carga completo y sin errores de código**, los cobros están **cableados y las funciones responden**, y nada de lo que se tocó hoy rompió un cobro. **Hay UN hueco funcional confirmado, anterior a hoy:** la taquilla de venues (`venue-room.html`) está en 404 desde el 2026-09-12. Además hay deuda seria de trazabilidad (6 funciones desplegadas sin código en Git) y varias cosas sin probar de punta a punta.

## Verificado y bien
- **Todo el sitio publicado:** 74 páginas (sitemap + páginas clave) responden 200; 147 archivos JS/CSS únicos presentes (200); 126 archivos JavaScript sin errores de sintaxis.
- **Producción = `main`:** último despliegue Production `39fa94ce` (2026-10-02 18:10 UTC) = `origin/main`.
- **Identidad y rutas, en vivo hoy con sesiones reales:** Owner, artista, vendedora y cliente se clasifican bien; un cliente es devuelto a su portal si pide `staff.html`, `dj-dashboard.html` o `staff-admin.html`.
- **Cobros — cableado y vida de las funciones:** `create-event-payment` responde 404 "Lead no encontrado" a un lead inexistente (arranca y lee la base); `stripe-webhook` exige firma (400 sin ella); `submit-cart-checkout` responde 401 "Sesión requerida" (la versión endurecida está desplegada; la vulnerable ya no). El depósito se llama desde `client-portal.js` (3 sitios), `admin-quick-invoice.html` y `production-module.js`; el archivo `client-portal.js` publicado contiene la llamada. El webhook, ante `checkout.session.completed` con `lead_id`, suma a `balance_paid`, actualiza `payment_status` y avisa a staff.
- **Ningún archivo de cobro fue tocado hoy:** últimos cambios en `create-event-payment` (2026-09-29, #588 Capa C), `stripe-webhook` (2026-09-28, aviso a staff y migración de claves) y el resto del 21 al 28 de septiembre.
- **Cron de reconciliación del calendario:** 4 corridas en 24 h, todas 200. `elixis-chat`: 3 llamadas, todas 200.

## ROTO, confirmado
**Taquilla de venues y salas con QR — 404 desde 2026-09-12.**
- `web/venue-room.html` devuelve **404 en producción**. Fue borrada en el commit `f2ecb1fe` (2026-09-12, "borrar 17 páginas huérfanas"), seis días después de que `ESTADO_MAESTRO` diera el módulo por "CERRADO, en producción" (2026-09-06).
- Una página a la que se llega por QR no tiene enlaces entrantes por diseño, así que la limpieza la tomó por huérfana.
- `vercel.json` (raíz y `web/`) **conserva** la regla `/venues/:venueSlug/:roomSlug → /venue-room.html`, por lo que `/venues/mojitos-calle-8/sala-principal` también da 404.
- `create-venue-ticket-checkout` sigue desplegada, pero ningún archivo de `web/` la llama y su `successUrl`/`cancelUrl` apuntan a la página inexistente: un cliente que pagara caería en un 404.
- **Alcance real hoy:** la base solo tiene los datos de QA (1 venue, 1 sala, 1 evento, 1 tipo de entrada); no hay clientes reales afectados todavía.
- **No se sabe qué hilo hizo ese borrado:** el commit va con la identidad de git del PO, la misma que usan todos los agentes en esta máquina. No ocurrió hoy.
- **Reparación: HECHA en la rama `fix/restaurar-taquilla-venue-room`, sin comitear ni desplegar** (ver sección siguiente).

## Riesgos y deuda
1. **6 funciones desplegadas cuyo código nunca estuvo en Git**: `beatbooth`, `mdj-ai-assistant` (asistentes antiguos con Gemini), `mdj-analytics-log` (inserta en `mdj_marketing_events`), `mdj-meta-capi` (envía eventos a Meta), `create-soundfortips-checkout` y `soundfortips-dj-decision` (propinas antiguas con cobro retenido en Stripe). Creadas en abril de 2026, **sin ningún llamante** (ni sitio, ni funciones SQL, ni cron, ni triggers, ni otro archivo del repo). Con `verify_jwt` activo pero aceptando la clave pública, son puntos de entrada que pueden crear sesiones de Stripe o gastar cuota de Gemini. Su código se bajó con la CLI a una carpeta temporal fuera del repositorio (`…/scratchpad/funciones-huerfanas/`) para que no se pierda. **Decisión pendiente del PO:** versionarlas en `supabase/functions/` o retirarlas.
2. **Depósitos: ningún pago registrado todavía — esperado: el PO confirma que aún no hay clientes (no es un defecto).** Lo que implica es que el cobro de punta a punta nunca se ha ejercitado, así que hay que cerrarlo bien ANTES de que lleguen. 0 leads con `balance_paid > 0`; 6 leads viejos con sesión LIVE de Stripe creada y sin pagar (todos CANCELLED). Las dos compras registradas son de prueba: entradas de venue $1,00 (2026-09-06) y merch $37,44 (2026-08-28), ambas con sesión `cs_test_`. No hay evidencia en la base de un cobro real de $1.
3. **Comisión incorrecta al aprobar un total:** crea una fila `pending` sin vendedor ni DJ con reparto 50/50 sobre el total con impuesto. Sin exposición hoy; no se corrige sola; lógica del dominio financiero.
4. **CI `rls-baseline-audit.yml`:** falló por última vez el 2026-09-18 (corridas de desarrollo) y desde entonces sale "omitido": la auditoría de RLS no está corriendo.
5. **Advisors de seguridad de Supabase:** 7 avisos (1 ERROR `security_definer_view`; WARN: `function_search_path_mutable`, `extension_in_public`, `anon_security_definer_function_executable`, `authenticated_security_definer_function_executable`, `auth_leaked_password_protection`; INFO `rls_enabled_no_policy`). No se detalló cada uno.
6. **Calendario, Pasos 11, 15 y 18 sin probar de verdad** (11: sin confirmación posterior a "no probado aún en pantalla"; 15: el cron corre pero la limpieza de una fecha realmente borrada en Google nunca se ejercitó; 18: cambio de año solo por aritmética).
7. **PR #632 (checkout público Fase 4) abierto, sin mergear:** falta decidir cómo probar el cobro.

## Errores míos de hoy (para que conste)
- Los PRs #620 y #622 cambiaron `mdj-identity.js` y el header sin subir el `?v=` (caché inmutable de un año en Vercel); corregido en #625 y #626.
- Dije "sin llamadas en 24 h" a `submit-cart-checkout` con una consulta de registros armada con un campo que no existe; ya está rehecho con el campo correcto y es cierto (solo mis sondas de hoy).
- Afirmé que el carrito Amazon y el checkout estaban "sin empezar" leyendo un plan viejo; estaba hecho (#605, #602, #608) y no estaba documentado.
- La primera versión endurecida de `submit-cart-checkout` habría rechazado todos los leads (`0` contra `NULL`); se detectó con una prueba contra la base real **antes** de redesplegar.
- 15 PRs y 31 despliegues el mismo día (calendario por pasos): costo evitable.
- En este análisis, mi primer recorrido dio 404 falsos en `/dj/*` porque ignoré `<base href="/">`; corregido y repetido.

## No se pudo verificar
Panel de Stripe (cobros LIVE reales), un cobro real o de prueba de punta a punta de depósitos, Safari 13, entrega real de correos/SMS, Google Calendar real en los Pasos 11/15/18, el chat público de Margi tras el cambio de hoy.

## Prioridades propuestas (nada se ejecuta sin aprobación del PO)
1. Restaurar la taquilla de venues (`venue-room.html`) y probarla.
2. Decidir el destino de las 6 funciones huérfanas (versionar o retirar), empezando por las dos de cobro.
3. Decidir la prueba del cobro de depósitos y mergear el PR #632.
4. Una pasada de verificación de los Pasos 11, 15 y 18 del calendario, sin PRs.
5. Revisar los 7 avisos de Supabase y reactivar la auditoría de RLS.

## Reparación de la taquilla (2026-10-02, tarde) — lo que se encontró al probarla
Restaurar el archivo tal cual **no bastaba**. Se probó con un servidor local que imita la regla de `vercel.json` (`/venues/:venue/:sala → /venue-room.html`):
1. **Hueco 1, de diseño (ya existía el 6/9):** la página carga sus archivos con rutas relativas (`./supabase-config.js`) y no tiene `<base>`. En la ruta del QR, el navegador pedía `/venues/mojitos-calle-8/supabase-config.js`, la regla lo reescribía y devolvía la misma página HTML como si fuera el script: la página se quedaba en "Cargando…" con `Unexpected token '<'`. **Arreglo:** `<base href="/" />` (el mismo que ya usan las páginas `/dj/*`) y el script `mdj-identity.js` que el header necesita hoy.
2. **Hueco 2, de diseño:** la página llamaba a `create-venue-ticket-checkout` sin `success_url`/`cancel_url`; la función mandaba entonces al cliente a `venue-room.html?ticket_payment=...` (sin venue ni sala) y la página lo mostraba como "Sala no encontrada" (ni siquiera leía `ticket_payment`). **Arreglo:** la página manda sus propias direcciones de retorno (conservan `/venues/:venue/:sala`) y muestra un aviso al volver ("Gracias por tu compra. Estamos confirmando tu pago." / "El pago se canceló. No se te cobró.").
3. **Hueco 3 (retorno sin sala):** los enlaces de pago que genera ELIXIS llaman a la función sin direcciones de retorno, y el cliente volvía a "Sala no encontrada". **Arreglo:** si vuelve con `ticket_payment=success|cancelled` y sin sala, ve "Gracias por tu compra" / "Pago cancelado" (probado en local; sin parámetros sigue "Sala no encontrada").
4. `web/scripts/check-hygiene.mjs`: `venue-room.html` declarada en `ALLOW` con su razón (se llega por QR, no por enlaces).
- **Probado en vivo, en la ruta real del QR:** la sala carga completa (MOJITOS CALLE 8, Sala Principal, QR generado, botones de compartir, entrada General QA $1.00), 78 recursos sin ningún error; retorno `?ticket_payment=success` y `?ticket_payment=cancelled` muestran su aviso con la sala visible; la dirección de regreso que mandó la página llegó a Stripe y la función la aceptó. `check-hygiene` y `check-i18n` en verde.
- **Incidente durante la prueba (consta):** mi intento de interceptar la llamada de compra falló (`getSupabaseClient().functions` crea un objeto nuevo en cada acceso) y se envió la petición real a `create-venue-ticket-checkout`, que creó **una sesión de Stripe de PRUEBA (`cs_test_`)** sin pagar; no se ingresó ninguna tarjeta, no se creó ninguna orden (sigue 1 orden en `venue_ticket_orders`, la de prueba del 6/9) y la sesión caduca sola. El navegador salió de la página de Stripe por la dirección de cancelación.
- **Hallazgo clave para vender entradas de verdad:** la taquilla usa su propia clave (`STRIPE_SECRET_KEY_VENUE`) y el merch la suya (`STRIPE_SECRET_KEY_MERCH`); ambas dan sesiones de PRUEBA. Depósitos, cuotas, cursos, suscripciones y propinas usan `STRIPE_SECRET_KEY`. **Restaurar la página no hace que cobre dinero real:** para eso hay que decidir si esas dos claves pasan a modo real (y qué secreto de webhook les corresponde: el webhook solo tiene `STRIPE_WEBHOOK_SECRET` y `STRIPE_WEBHOOK_SECRET_MERCH`, ninguno propio de la taquilla). Decisión del PO.
- **No probado:** un pago completado de punta a punta (ni de prueba) ni la entrega de entradas (`paid_pending_fulfillment`).
