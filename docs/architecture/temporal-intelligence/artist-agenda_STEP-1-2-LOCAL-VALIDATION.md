# Informe de validación local — Pasos 1–2 (Fundación + Continuidad)

**Ticket:** TICKET-V2-ARTIST-AGENDA-MATRIX-001 (A / V2-prep)
**Fecha:** 2026-08-10
**Ejecutado por:** validación asistida (Claude) bajo autorización del owner ("Camino A")
**Veredicto:** ✅ **PASA** — el esquema aplica limpio y las reglas núcleo se cumplen a nivel de base de datos.

---

## Alcance validado

- **Parte 1** — `artist-agenda-matrix_PROPOSED_migration.sql` (consent + contacts + events + RLS + funciones + vista).
- **Parte 2** — `artist-agenda-continuity_PROPOSED_addendum.sql` (continuidad + `dj_continuity_notes` + notarización + funciones/vistas).

Ambos archivos se aplicaron **tal cual** (sin editarlos) contra una base de datos de prueba.

---

## Entorno (100% local, sin remoto, sin tocar otros tickets)

- **Método (Camino A):** base de datos **temporal y desechable** (`agenda_matrix_test`) creada dentro de un stack Supabase local que ya estaba corriendo.
- **Stubs base:** se crearon versiones mínimas y fieles de los objetos de los que dependen las migraciones (`auth.users`, `auth.uid()`, `auth.role()`, `public.dj_profiles`, `public.is_staff_management` con su definición real del repo, `public.update_updated_at_column`).
- **Aislamiento:** no se leyó ni escribió nada remoto; la base `postgres` del stack anfitrión quedó **intacta**; la DB temporal se **borró** al terminar; los archivos copiados al contenedor se **eliminaron**.

> Nota: es una validación de **esquema + lógica RLS**, no una migración aplicada. La promoción a `supabase/migrations/` y cualquier commit siguen pendientes de OK explícito.

---

## Resultado de aplicación

- Parte 1: aplica sin error (todas las tablas, índices, triggers, políticas, funciones y la vista se crearon; `COMMIT` correcto).
- Parte 2: aplica sin error (columnas nuevas, `dj_continuity_notes`, `CHECK ck_ia_requires_owner_order`, funciones y vistas; `COMMIT` correcto).

---

## Pruebas (JWT + roles) y evidencia

| # | Qué verifica | Esperado | Resultado |
|---|--------------|----------|-----------|
| **T1** | Artista A solo ve **sus** contactos | 2, y 0 de B | ✅ `OK T1: Artista A ve solo sus 2 contactos; NO ve a B` |
| **T2** | Artista B solo ve **su** contacto | 1 | ✅ `OK T2: Artista B ve solo su 1 contacto` |
| **T3** | Matrix (owner) ve **solo con consentimiento** | 2 de A, 0 de B | ✅ `OK T3: Matrix ve los 2 de A ... y NO ve a B` |
| **T4** | `manager_ia` **sin** orden del owner | rechazado (CHECK) | ✅ `OK T4: ... RECHAZADO por el CHECK` |
| **T5** | `manager_ia` **con** orden del owner | aceptado | ✅ `OK T5: ... se acepta` |

Salida final: `✅ TODAS LAS PRUEBAS PASARON`.

Mecánica: cada prueba de artista/matrix se corrió con `SET LOCAL ROLE authenticated` + `request.jwt.claims` del usuario correspondiente, de modo que la RLS se evaluó como lo haría Supabase con un JWT real.

---

## Reglas núcleo confirmadas

1. **Aislamiento por artista** — en RLS (`auth.uid() = artist_user_id`), no en frontend. (T1, T2)
2. **Consentimiento = única llave al Matrix** — `is_staff_management` + `EXISTS(consent)`. (T3)
3. **Notarización gobernada** — `manager_ia` exige `owner_order_ref` (CHECK). (T4, T5)

---

## Cobertura complementaria (2026-08-10, misma sesión)

Se cerraron los 3 asserts que faltaban — todos **PASAN**:

| # | Qué verifica | Resultado |
|---|--------------|-----------|
| **A1** | Aislamiento de **eventos**: A ve sus 4, no ve a B | ✅ |
| **A2** | Matrix ve eventos **solo** de artistas con consentimiento | ✅ |
| **B1** | Transparencia: el DJ **lee** las notas sobre sí mismo | ✅ |
| **B2** | El DJ **no puede** escribir notarizaciones (bloqueado por RLS) | ✅ |
| **C**  | `dj_engagement_summary` **solo suma**: reb=4, protegidos=1, ignorados=1, popularidad=5 (el vacío ignorado NO resta) | ✅ |

**Cobertura de la fundación (pasos 1–2): completa a nivel de datos.** Único pendiente = **UI (paso 3)**.

---

## Conclusión

La fundación de datos (pasos 1–2) está **validada en local**: el SQL aplica limpio y las reglas no negociables de aislamiento, consentimiento y notarización se cumplen. Listo para avanzar al **paso 3 (UI de lectura del artista)** cuando el owner lo autorice. Nada aplicado a remoto; nada commiteado sin OK.
