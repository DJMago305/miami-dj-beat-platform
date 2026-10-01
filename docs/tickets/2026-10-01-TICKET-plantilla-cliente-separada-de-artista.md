# TICKET: separar la plantilla de cuenta Cliente de la de Artista/DJ

**Fecha:** 2026-10-01
**Reportado por:** el PO, al probar el Paso 9 (sync bidireccional de Google Calendar) con la cuenta de cliente de prueba de Wendy.
**Estado:** Pendiente — el PO pidió documentarlo y no tocarlo a medio arreglo de un incidente de producción en curso.

## Qué se encontró

Probando con una cuenta real de Cliente, `calendar-oauth-callback` redirigía a `dj-profile.html` (la página de Artista) en vez de `client-account.html` — bug real, ya corregido (ver `docs/ESTADO_MAESTRO.md`, entrada del mismo día). Al investigarlo salió un patrón más de fondo: varias piezas del sync de calendario (`google-calendar-sync.ts`, `procesarEventosGoogle`) tratan "Cliente" como un caso secundario de "Artista/DJ" — primero intentan resolver el nombre contra `dj_profiles`, y solo si eso falla prueban `client_profiles`. Es decir, la cuenta de Cliente se comporta como una variante de la plantilla de Artista, no como su propio tipo de cuenta de primera clase.

El PO lo resume así: la cuenta de prueba de Cliente (Wendy) se creó "desde la plantilla de artista o de DJ", y antes de que haya clientes reales usando esto hay que sacar esa plantilla de un depósito separado, propio de Cliente, no reusar la de Artista.

## Por qué importa

- Es la causa raíz de por qué el bug de `dj-profile.html` nunca se notó antes: ninguna cuenta de Cliente real había probado el flujo completo de Google Calendar hasta hoy.
- Cualquier función nueva que siga el mismo patrón ("intenta DJ primero, si no hay, intenta Cliente") va a seguir arrastrando esta ambigüedad y puede volver a fallar de formas parecidas pero distintas.
- Es más seguro corregirlo ANTES de que haya clientes reales con cuentas activas, para no tener que migrar datos de cuentas ya en uso.

## Qué falta decidir (no ejecutar sin sesión dedicada)

1. Auditoría real de qué comparte hoy la cuenta de Cliente con la de Artista/DJ -- tablas, funciones RPC, Edge Functions -- para saber el tamaño real del cambio antes de tocar nada (mismo patrón que `project_dj_profiles_staff_artist_shared_table_debt.md`, que ya documenta que `dj_profiles` mezcla Staff y Artista en una sola tabla de 129 columnas; esto podría ser un problema hermano, o parte del mismo).
2. Definir una plantilla/flujo de creación de cuenta Cliente que no dependa en ningún punto de resolver primero contra `dj_profiles`.
3. Revisar, uno por uno, los lugares que hoy hacen "intenta DJ, si no hay intenta Cliente" (`google-calendar-sync.ts` es uno confirmado; puede haber más) y decidir si deben invertirse, separarse, o si el patrón en sí ya es aceptable una vez la cuenta se cree bien desde el inicio.

## Explícitamente fuera de alcance ahora

No se toca nada de esto en la sesión de hoy -- el PO pidió documentarlo y seguir con el Paso 9 en curso. Se ejecuta en su propia sesión dedicada, con la auditoría de arriba hecha primero.
