# TICKET-V2-ARTIST-AGENDA-MATRIX-001 — Calendario Operacional Inteligente (Artista aislado + Owner·Matrix)

**Fecha de apertura:** 2026-08-10
**Última actualización:** 2026-08-10
**Prioridad:** Media-alta (re-arquitectura de agenda — habilitador de operación inteligente)
**Clasificación (directriz V1→V2):** **A) Permanente / V2-prep**
**Alcance:** Fundación de datos (Supabase local) + UI de lectura del artista; capas de servicio (notificaciones, IA) diferidas.

---

## Resumen ejecutivo

Re-arquitectura de la agenda del artista hacia un **Calendario Operacional Inteligente** de dos herramientas conectadas: la del **artista** (aislada, trabaja desde su propia base de datos) y el **Owner · Matrix** (consolida a todos los artistas, solo con consentimiento). Este documento es el **entregable del gate de diseño**: fija alcance, reglas no negociables, plan por riesgo ascendente y criterios de aceptación **antes de escribir una sola línea de código**. Persistencia **exclusiva en Supabase local** hasta que el PO abra el candado; los pasos de alto riesgo (envío real e IA) quedan protegidos al final.

---

## Estado actual (Product Owner)

```
GATE DE DISEÑO: APROBADO POR EL PO — 2026-08-10 (100%)
SIN CÓDIGO APLICADO · SIN MIGRACIÓN EN supabase/migrations/ · SIN COMMIT
PERSISTENCIA: SOLO SUPABASE LOCAL DE PRUEBA (gate vigente — no remoto)
PASOS 5–6 (alto riesgo): NO autorizados (por defecto)
PRÓXIMO: checkpoint fase 4 → rama dedicada → Supabase local → paso 1
```

**Gate de diseño aprobado.** La ejecución sigue bloqueada hasta abrir la rama dedicada; commit/push/deploy y persistencia remota siguen **no** autorizados.

---

## Decisión del gate de diseño (Product Owner)

> La ejecución (paso 1 en adelante) queda **bloqueada** hasta que el PO marque una decisión y autorice la rama dedicada. Aprobar este gate **no** autoriza commit/push/deploy ni persistencia remota.

| Decisión | Marcar | Notas |
|----------|:------:|-------|
| ✅ Aprobado — abrir rama y ejecutar pasos 1–4 | ☑ | Aprobado 100% |
| 🔧 Aprobado con ajustes (detallar en Notas) | ☐ | |
| ⛔ Rechazado / re-diseño | ☐ | |

**Product Owner:** PO — Miami DJ Beat  **Fecha:** 2026-08-10

**Autorización de rama dedicada:** ☐ Sí ☐ No → rama: `_________________________`

**Autorización explícita para pasos 5–6 (alto riesgo):** ☐ No (por defecto) ☐ Sí — requiere revisión de privacidad/credenciales aparte.

---

## Gate de rama (respetar Prioridad 0)

| Campo | Valor |
|-------|-------|
| Rama actual | `plan/v2-phase-4-api-client` (trabajo no relacionado) |
| Regla | **No abrir este módulo en paralelo.** Llegar a checkpoint limpio de fase 4 → rama/ticket propio |
| Persistencia | Solo Supabase local (gate de persistencia vigente hasta que el PO lo abra) |

---

## Objetivo

Convertir la agenda del artista en un **Calendario Operacional Inteligente** de dos herramientas conectadas:

- **Herramienta del Artista** (reutilizable, independiente): trabaja desde la base del propio artista; le recuerda fechas recurrentes de sus contactos para generarle trabajo. **Datos aislados** — un artista no ve datos de otro.
- **Owner · Matrix** (central): consolida a **todos** los artistas (solo con consentimiento) para gestionar eventos futuros.

Con memoria de continuidad **no punitiva** y notarización gobernada.

---

## Alcance

**Incluye (este ticket):**
- Esquema Supabase: consentimiento, contactos, eventos de agenda, memoria de continuidad, notarización.
- RLS: aislamiento por artista + acceso Matrix solo `is_staff_management` con consentimiento.
- UI de **lectura** del artista (gate de consentimiento, contactos, recordatorios).
- UI Matrix + Continuidad + pestaña **Notarización** (solo gestión).

**Excluye (fases posteriores, autorización explícita):**
- Envío real de notificaciones (WhatsApp/SMS/email).
- Agente IA de ventas + Manager IA.
- Sincronización con Calendario de Apple/Google (fase 2 opcional, encima — nunca el motor).

---

## Plan por prioridades (aprobado 2026-08-10)

| # | Paso | Riesgo | Depende de |
|---|------|--------|-----------|
| **0** | Checkpoint de fase 4 · validación PO · abrir rama/ticket propio | — | — |
| **1** | Parte 1 SQL (consent + contacts + events + RLS) en Supabase **local** | Bajo | 0 |
| **2** | Parte 2 SQL (continuidad + notarización) local | Bajo | 1 |
| **3** | UI de **lectura** del artista (gate consentimiento, contactos, recordatorios) | Bajo | 1 |
| **4** | Matrix del owner + Continuidad + Notarización (solo gestión) | Medio | 2,3 |
| **5** | Envío real de notificaciones (Edge Functions + `service_role`) | **Alto** | 4 + autorización |
| **6** | Agente IA de ventas + Manager IA | **Alto** | 4,5 + autorización |

**Principio:** datos antes que UI; lectura (segura) antes que escribir-al-mundo (sensible). 5 y 6 al final por riesgo de credenciales/privacidad/autorización.

---

## Reglas de negocio a preservar (no negociables)

1. **Aislamiento por artista** en RLS, no en frontend: `auth.uid() = artist_user_id`.
2. **Consentimiento = única llave al Matrix:** acceso de gestión requiere `EXISTS(consent, no revocado)`.
3. **Continuidad NO punitiva:** la popularidad **solo suma**. Un vacío nunca la baja; si se notariza, queda protegido/explicado; si no, **se pasa por alto** (sin sanción).
4. **Notarización gobernada:** solo `is_staff_management`; el **Manager IA** solo con **orden explícita del owner** (`owner_order_ref`, obligatoria por CHECK). El DJ **lee** las notas sobre sí mismo (transparencia).
5. **Uso restringido de las notas:** solo uso y desarrollo **interno** de la empresa. **No** personal, **no** bullying, **no** medidas contra ningún artista.
6. **Seguridad:** sin claves en frontend; envío/IA solo server-side.

---

## Entregables de diseño (ya producidos)

| # | Entregable | Estado |
|---|------------|--------|
| 1 | Propuesta SQL Parte 1 — `docs/architecture/temporal-intelligence/artist-agenda-matrix_PROPOSED_migration.sql` | ✅ Escrita · **sin aplicar / sin commit** |
| 2 | Propuesta SQL Parte 2 — `docs/architecture/temporal-intelligence/artist-agenda-continuity_PROPOSED_addendum.sql` | ✅ Escrita · **sin aplicar / sin commit** |
| 3 | Prototipo interactivo — Calendario (Artista/Matrix/Continuidad/Notarización) | ✅ Artefacto |
| 4 | Prototipo — Motor de Automatización IA | ✅ Artefacto |
| 5 | Diagrama — Mapa Maestro del Sistema | ✅ Artefacto |

*Nombres sugeridos al promover:* `supabase/migrations/20260810120000_artist_agenda_matrix_foundation.sql` y `20260810121000_artist_agenda_continuity_memory.sql`.

---

## Criterios de aceptación (fase de fundación · pasos 1–4)

- [ ] Migraciones Parte 1 y 2 aplican en Supabase **local** con exit 0.
- [ ] Prueba RLS con JWT de artista: solo ve **sus** contactos/eventos; cero fugas de otros artistas.
- [ ] Prueba RLS de gestión: Matrix ve todos **solo** con consentimiento; sin consentimiento, no ve.
- [ ] `dj_engagement_summary()` nunca resta; vacío sin nota = ignorado; vacío notarizado = protegido.
- [ ] Insertar nota `manager_ia` **sin** `owner_order_ref` **falla** (CHECK).
- [ ] El DJ puede leer sus notas; no puede escribir notarizaciones.
- [ ] UI de lectura del artista con gate de consentimiento al primer ingreso.
- [ ] Sin commit / push / deploy sin aprobación PO.

---

## Detalle abierto para el PO

- `artist_agenda_consent.artist_user_id`: evaluar `DEFAULT auth.uid()` (insert limpio del artista) — señalado, no aplicado.
- Índices por fecha para el motor de disparadores (optimización, opcional).

---

## Referencias

- Memoria de proyecto: re-arquitectura de agenda del artista (decisión Opción A + modelo no punitivo).
- Directrices: clasificación V1→V2; seguridad-first (sin claves en frontend); persistencia local antes que remota.
