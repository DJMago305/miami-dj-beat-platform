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
PASOS 1–2 (fundación + continuidad): VALIDADOS EN LOCAL — 2026-08-10 (sandbox desechable)
SIN CÓDIGO APLICADO A REMOTO · SIN MIGRACIÓN EN supabase/migrations/ · SIN COMMIT
PERSISTENCIA: SOLO SUPABASE LOCAL DE PRUEBA (gate vigente — no remoto)
PASOS 5–6 (alto riesgo): NO autorizados (por defecto)
PRÓXIMO: paso 3 — UI de lectura del artista
```

**Evidencia de validación (pasos 1–2):** `docs/architecture/temporal-intelligence/artist-agenda_STEP-1-2-LOCAL-VALIDATION.md`

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

- **Calendario del Artista** (reutilizable, independiente): trabaja desde la base del propio artista; le recuerda fechas recurrentes de sus contactos para generarle trabajo. **Datos aislados** — un artista no ve datos de otro.
- **Calendario del Staff = Agenda Owner = Matrix** (central): son la **misma** superficie — la que tiene **toda** la información general de todos los artistas (solo con consentimiento). Gobernada por `public.is_staff_management` (**admin / owner / manager**). Se puede rotular "Agenda Owner"; es equivalente al calendario del staff de gestión.

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

**Ubicación y reemplazo (definido por el owner — 2026-08-10):**
- El Calendario Operacional Inteligente **reemplaza** al calendario/agenda actual (p. ej. `web/js/agenda-engine.js` en dashboards de artista).
- Se ubica en la **parte inferior de la app de Clima** (sección weather).
- ⚠ El reemplazo del calendario viejo activa la regla permanente **"no remoción sin reporte"**: requiere **reporte de análisis técnico + visual** antes de remover/reemplazar. Se ejecuta en la fase de UI (paso 3–4), **no** en la fundación de datos.
- ⚠ La integración en la app de Clima toca la **re-arquitectura de clima (diferida)**: coordinar con esa línea, **no** expandirla desde este ticket.

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

- [x] Migraciones Parte 1 y 2 aplican en Supabase **local** con exit 0. *(2026-08-10)*
- [x] Prueba RLS con JWT de artista: solo ve **sus** contactos y eventos; cero fugas. *(contactos T1/T2; eventos A1/A2)*
- [x] Prueba RLS de gestión: Matrix ve todos **solo** con consentimiento; sin consentimiento, no ve. *(contactos T3; eventos A2)*
- [x] `dj_engagement_summary()` nunca resta; vacío sin nota = ignorado; vacío notarizado = protegido. *(C: reb=4, protegidos=1, ignorados=1, popularidad=5)*
- [x] Insertar nota `manager_ia` **sin** `owner_order_ref` **falla** (CHECK). *(T4/T5)*
- [x] El DJ puede leer sus notas; no puede escribir notarizaciones. *(B1/B2)*
- [ ] UI de lectura del artista con gate de consentimiento al primer ingreso. *(paso 3)*
- [x] Sin commit / push / deploy sin aprobación PO. *(respetado)*

---

## Detalle abierto para el PO

- `artist_agenda_consent.artist_user_id`: evaluar `DEFAULT auth.uid()` (insert limpio del artista) — señalado, no aplicado.
- Índices por fecha para el motor de disparadores (optimización, opcional).

---

## Reanudar (próxima sesión) — checkpoint 2026-08-10

Estado: pasos 1–2 (datos) validados en local; UI artista+owner consolidada y visible en localhost con datos de muestra. Todo commiteado en `plan/v2-artist-agenda-matrix`, **sin push**, sin migración promovida.

Orden de prioridades confirmado por el owner para retomar:
1. **Conexión con credenciales (tú):** `supabase login` → `link --project-ref <ref>` → `db pull` → `start` para levantar el local real. Luego yo promuevo las 2 SQL a `supabase/migrations/`, aplico local y cableo la página del calendario de mock → datos en vivo.
2. **Integración progresiva con la app de Clima + reemplazo del calendario viejo** — previo **reporte técnico/visual** (regla de no-remoción sin reporte); coordinar con la línea de clima (diferida).
3. **Motor de Automatización IA de ventas** como pieza propia de la app, solo con autorización explícita (paso de alto riesgo).

Ver en localhost: `cd web && python3 -m http.server 8123 --bind 127.0.0.1` → `http://localhost:8123/calendario-operacional-inteligente.html`

---

## Referencias

- Memoria de proyecto: re-arquitectura de agenda del artista (decisión Opción A + modelo no punitivo).
- Directrices: clasificación V1→V2; seguridad-first (sin claves en frontend); persistencia local antes que remota.
