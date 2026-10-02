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
