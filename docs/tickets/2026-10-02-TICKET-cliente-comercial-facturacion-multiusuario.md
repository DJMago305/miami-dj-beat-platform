# TICKET — Cliente Comercial: facturación corporativa + múltiples usuarios por cuenta

**Fecha de apertura:** 2026-10-02
**Origen:** el PO pidió "crear una plantilla nueva para clientes comerciales, independiente de la de artista, como lo hace IBM" — asumiendo que no existía nada todavía.
**Estado:** Documentado, NO ejecutado — decisión explícita del PO de dejarlo pendiente para sesión dedicada.

---

## 1. Hallazgo clave: esto NO se construye desde cero

Antes de diseñar nada se investigó el sistema real, y **"Cliente Comercial" ya existe como concepto en la plataforma**, con su propia rama de creación separada de Artista desde el día uno — el miedo original del PO (que se cree "desde la plantilla de artista o DJ", el mismo problema que ya documenta `docs/tickets/2026-10-01-TICKET-plantilla-cliente-separada-de-artista.md`) **no aplica aquí**: `commercial_client` nunca pasa por `dj_profiles`.

Piezas reales ya construidas:

| Pieza | Dónde | Qué hace |
|---|---|---|
| Columnas en base de datos | `client_profiles.is_commercial` (bool), `.company_name`, `.venue_type` — migración `20260527190000_client_profiles_commercial.sql` | Marca un cliente como B2B, guarda nombre de negocio y tipo de local (nightclub\|lounge\|banquet_hall\|rooftop\|hotel\|restaurant\|venue_rental\|other) |
| Creación de cuenta | `supabase/functions/create-platform-account/index.ts` (líneas 55, 94-95, 106-108, 157-175) | `account_type='commercial_client'` es una rama propia desde el inicio — exige `biz_name`, escribe directo a `client_profiles` con `is_commercial:true`. Nunca toca `dj_profiles`. Gate: solo el Owner puede invocarla. |
| CRM de staff | `web/staff-admin.html` (líneas 6972, 7054, 7060, 9834-9843) | Lista de clientes muestra badge "Comercial" vs. "Personal" y antepone el nombre de la empresa |
| Contratos | `web/contracts-engine.html` (líneas 2498-2514) | Busca y muestra clientes comerciales por `company_name` al armar un contrato |
| Facturación / producción | `web/js/production-module.js` (líneas 812, 926, 953, 1898-1907) | Las facturas de producción ya usan `company_name` como el nombre que aparece en el documento |
| Mensajería | `web/system-messages.html` (línea 646-649) | Segmenta destinatarios por "Comercial" vs. "Personal" |
| Otros | `web/documents/event-blueprint-editor.html` (línea 779-785) | Autocompleta cliente mostrando la empresa si es comercial |

**Pero: cero cuentas reales existen.** `select * from client_profiles where is_commercial=true` en producción devuelve 0 filas — todo este camino está escrito pero nunca ejercido con una cuenta de verdad. Riesgo real de bugs latentes nunca detectados.

## 2. Lo que el PO pidió que SÍ falta de verdad

Conversación del 2026-10-02: el PO confirmó que un Cliente Comercial necesita, además de lo que ya existe:

1. **Datos de empresa más completos** — hoy solo hay `company_name`/`venue_type`. Falta: identificación fiscal (EIN/tax ID), dirección comercial explícita (hoy comparte las mismas columnas `address_*`/`billing_*` genéricas de cualquier Cliente, no hay un campo separado para "dirección del negocio").
2. **Facturación distinta** — términos de pago corporativos (ej. factura a 30 días) y varios eventos bajo un mismo contrato. Hoy el sistema de pagos (Stripe, `leads.total_amount`/`total_aprobado_usd`) asume pago inmediato por evento individual — no existe ningún concepto de "cuenta corriente" o "contrato marco" con múltiples eventos facturados juntos.
3. **Múltiples usuarios/contactos bajo una misma cuenta** — el más grande de los tres. Hoy TODO el sistema asume 1 fila de `auth.users` = 1 cuenta = 1 persona (artista, staff o cliente). No existe ningún concepto de "organización" con varios usuarios de Auth vinculados a un mismo `client_profiles.id`. Esto es un cambio de arquitectura de autenticación, no un campo nuevo — compara en tamaño con la deuda ya documentada en `docs/tickets/2026-09-30-TICKET-separar-dj-profiles-staff-de-artista.md`.

## 3. Qué falta decidir antes de tocar código (no ejecutar sin sesión dedicada)

1. **Facturación**: ¿se modela como una tabla nueva (`commercial_accounts` o similar) con términos de pago + relación 1-a-muchos a `leads`/eventos, o se extiende `client_profiles` con un campo de términos y se deja el resto igual? Depende de cuántos clientes comerciales reales se esperan en el corto plazo.
2. **Multi-usuario**: ¿un modelo de "organización + miembros" (como Slack/Google Workspace — una fila de organización, N usuarios de Auth con un rol dentro de ella), o más simple, "usuario principal + invitados con permiso de solo-ver"? Esto determina si hace falta tocar RLS de TODA la plataforma (leads, pagos, calendario) para que reconozca "pertenece a la misma organización" en vez de "es el mismo `user_id`".
3. **Antes de diseñar lo nuevo**: probar el camino YA EXISTENTE (`commercial_client` vía `create-platform-account`) con una cuenta de prueba real, para confirmar que lo que ya está escrito funciona de punta a punta (crear, loguear, ver en staff-admin/contracts-engine/facturas) antes de construir más encima de una base nunca probada.

## 4. Explícitamente fuera de alcance ahora

No se toca nada de código en esta sesión — el PO pidió documentarlo. Se ejecuta en su propia sesión dedicada: primero probar lo existente (paso 3.3), después decidir el modelo de facturación y multi-usuario (3.1 y 3.2), recién ahí construir.

---

## 5. Auditoría de solo lectura (2026-10-02, tarde) — antes de construir la plantilla propia

**Regla del PO (firme):** cada categoría usa su PROPIA plantilla; nada se crea desde la plantilla de artista (solo se replican cuentas nuevas de artistas). Ver memoria `feedback_cada_categoria_su_propia_plantilla`.

**Lo que se verificó (código y base de producción, sin escribir nada):**
- `create-platform-account`, rama `commercial_client`: escribe SOLO a `client_profiles` (`is_commercial:true`, `company_name`, `venue_type`). **No toca `dj_profiles`.** ✔
- El único disparador sobre `auth.users` (`trg_mdj_rol_al_registrarse`) solo fija el rol de la sesión (`artist` si `user_type` es talent/dj/artist; si no, `client`). **No crea ninguna fila en `dj_profiles` por su cuenta.** ✔
- Producción: 4 clientes, **0 comerciales**, 10 `dj_profiles`; ningún cliente es además artista (`talent`). El camino nunca se ha ejercido con una cuenta real.
- El Owner crea la cuenta desde `staff-admin.html` (tarjeta «Cuenta Cliente Comercial», pide nombre del negocio y tipo de local).

**Los huecos reales (lo que impide que sea una categoría con plantilla propia):**
1. **No hay plantilla/portal propio.** Después de la invitación → `reset-password.html` → `login.html`, el comercial cae en el MISMO `client-portal.html` que un cliente personal. `mdj-identity.js` no distingue comercial (lo clasifica `buyer` igual que a un cliente) y ningún JS de portal/login lee `is_commercial`.
2. **La cuenta comercial vive en la tabla de clientes con una marca** (`is_commercial`), no tiene datos propios de empresa (EIN, dirección del negocio) ni vínculo con locales/salas/eventos.
3. **No existe el vínculo cuenta ↔ local** (`venue_staff`, ver ticket de la sala de mesas fase 2): sin él, no hay a qué entrar con permisos.

**Propuesta (por pasos mínimos, cada uno se confirma):**
1. Portal propio `commercial-portal.html` (plantilla propia, con su propio encabezado y secciones: Mis locales/salas, Editor de salas, Eventos y mapas, Entradas/mesas, Equipo). Nada copiado de `dj-profile`/plantilla de artista; la base visual sale del portal de clientes y del editor de salas.
2. Enrutar al comercial a ese portal tras iniciar sesión (cambio en la lógica compartida de identidad/ruteo → requiere autorización explícita del PO y verificación en pantalla).
3. Tabla propia de datos de empresa y `venue_staff` (SQL a PRODUCCIÓN, lo corre el PO).
4. Probar el camino completo con una cuenta comercial de prueba creada por el PO (yo no creo cuentas).

### Avance (2026-10-02, noche)
- **Paso 1 HECHO:** `web/commercial-portal.html` (EN DESARROLLO, `noindex`): sesión requerida, solo `is_commercial`; datos reales de la empresa, acceso al Portal del Cliente y al editor de salas.
- **Paso 2 HECHO (autorizado por el PO):** ruteo del comercial a su portal con una guardia única, `web/js/commercial-redirect.js`, cargada en `client-portal.html` (a donde llegan los tres caminos: `auth.js`, su respaldo y MI PERFIL del header, que no se tocaron). Actúa solo en la entrada simple (sin parámetros); `?lead=`, `?mode=` y `?cuenta=cliente` se respetan para no dejar sin acceso a un comercial que también renta servicios. Lógica probada con un entorno simulado (6 casos); **el camino positivo real NO está probado: sigue sin existir ninguna cuenta comercial.**
- **Pendiente:** paso 3 (datos de empresa propios + `venue_staff`, SQL a producción que corre el PO) y paso 4 (prueba completa con una cuenta comercial de prueba que cree el PO desde staff-admin).

