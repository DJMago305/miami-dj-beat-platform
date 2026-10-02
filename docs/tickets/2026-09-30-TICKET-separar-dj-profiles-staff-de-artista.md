# TICKET — Separar los datos de staff/vendedor de la tabla `dj_profiles` (hoy compartida con artistas)

**Fecha de apertura:** 2026-09-30
**Origen:** forense pedido por el PO tras la creación de la cuenta de vendedora de Wendy, que destapó identidad partida en 4 capas (ver `docs/ESTADO_MAESTRO.md` [2026-09-30] "Cuenta de Wendy — 3 bugs reales") y un hallazgo de seguridad real ya cerrado (6 políticas RLS públicas en `dj_profiles` que exponían teléfono/comisión/Stripe de staff sin sesión — ver `docs/ESTADO_MAESTRO.md` [2026-09-30] "Hallazgo de seguridad en dj_profiles").
**Estado:** Documentado, NO ejecutado — decisión explícita del PO de dejarlo pendiente por ahora.

---

## 1. El hallazgo, con números reales

`public.dj_profiles` es la ÚNICA tabla de "persona en el roster" del sistema — la usan artistas Y staff (owner/admin/manager/seller), distinguidos solo por la columna `role`. No es un error de una sesión puntual: es una decisión de arquitectura de hace mucho tiempo.

**Tamaño del dato (bajo, hoy):**
- 129 columnas en la tabla, la inmensa mayoría específicas de artista (15+ campos de redes sociales, disponibilidad/horario, certificación, SoundForTips, tarifa por hora). Staff/vendedor usa un subconjunto pequeño (nombre, teléfono, email, foto, rol, comisión) — el resto queda `NULL` para ellos.
- Solo **10 filas reales existen hoy**: 8 artistas (`role='dj'`), 1 Owner, 1 vendedora (Wendy).

**Tamaño del código que depende de esta estructura (alto):**

| Qué | Cuántos |
|---|---|
| Páginas web (`web/*.html`, `web/js/*.js`) que leen/escriben `dj_profiles` directamente | 46 |
| Edge Functions que la usan | 36 |
| Migraciones/scripts SQL que la referencian | 142 |
| Funciones SQL de permisos que dependen de `dj_profiles.role` (`is_staff`, `can_read_financial`, etc.) | **61** |

`dj_profiles.role` es el mecanismo central de identidad y permisos de todo el sitio, no un detalle aislado — está referenciado en al menos 61 funciones SQL de control de acceso.

## 2. Por qué no es una emergencia (a pesar del susto de hoy)

La exposición real y peligrosa — cualquiera sin sesión podía leer teléfono/comisión/Stripe de staff — **ya se cerró hoy mismo** (6 políticas RLS `anon` eliminadas de la tabla base; acceso público solo vía `public_dj_profiles`, ya filtrada). Con eso cerrado, lo que queda es deuda de arquitectura, no una fuga activa.

## 3. Qué implicaría separarlo de verdad

- Crear una tabla propia (ej. `staff_profiles`) con solo las columnas reales que usa staff (nombre, teléfono, email, foto, rol, comisión, bio si aplica).
- Migrar las 2 filas no-artista existentes (Owner, Wendy) — trivial en volumen.
- Reescribir, una por una, las 61 funciones SQL de permisos que hoy asumen que "toda persona con rol de staff está en `dj_profiles`" — este es el trabajo real y el que concentra el riesgo de regresión (romper acceso de Owner, comisiones, RLS financiero).
- Actualizar los 46 archivos web + 36 Edge Functions que consultan `dj_profiles` para saber cuándo mirar la tabla nueva en vez de la vieja.
- Proyecto de varias semanas, no de días — merece su propia sesión de planificación dedicada cuando se decida ejecutar, con pruebas en PRUEBA antes de tocar PRODUCCIÓN.

## 4. Decisión del PO (2026-09-30)

"Déjalo documentado por ahora" — no se ejecuta nada de la sección 3 hasta que el PO lo pida explícitamente en una sesión dedicada.
