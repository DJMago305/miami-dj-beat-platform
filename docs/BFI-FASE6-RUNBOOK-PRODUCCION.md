# Fase 6 — Runbook de Producción (Motor BFI + ELIXIS)

> **Objetivo:** encender en PRODUCCIÓN el stack financiero ya probado en mdjb-ensayo:
> 13 tablas + RLS + motor (Edge Function) + import de datos reales + ELIXIS delegando.
> **Regla de oro:** cada paso tiene su **🚦 GATE** — el PO aprueba ANTES de ejecutarlo.
> Nada se corre en producción sin ese OK explícito. Todo es reversible.

## Proyectos
- 🔴 **PRODUCCIÓN:** `djmago305@gmail.com's Project` · ref `hkuvuqupbxwkiykxvqdr`
- 🧪 **PRUEBA (ya validado):** `mdjb-ensayo` · ref `rtbsovavmtnjpbbpwsin`

## Diferencias PRUEBA → PRODUCCIÓN (críticas)
| | Prueba (mdjb-ensayo) | Producción |
|---|---|---|
| `is_staff` / rol | stub + TEST_BYPASS | **rol real** de `dj_profiles` (incluye owner) — ya corregido en el motor |
| `FINANCIAL_ENGINE_TEST_BYPASS_STAFF` | `=1` | **NO setear** (candado real activo) |
| deploy del motor | `--no-verify-jwt` | **con verify_jwt** (JWT válido requerido) |
| datos | seed de muestra | `residency_schedule` **real** |

---

## Paso 0 — Pre-flight (sin tocar prod)
- [ ] Confirmar que ELIXIS funciona hoy en prod (línea base).
- [ ] Confirmar que `public.is_staff(p_uid)` y `dj_profiles.role` existen en prod (sí, verificado en migraciones).
- [ ] Backup: producción tiene point-in-time recovery (plan Pro). Aun así, todos los pasos son aditivos/reversibles.

## Paso A — DDL: las 13 tablas `financial_` a producción
- **Acción:** aplicar el esquema canónico (13 tablas, aditivo, `CREATE TABLE IF NOT EXISTS`).
- **Cómo:** en el **SQL Editor de PRODUCCIÓN**, pegar `supabase/canonical-financial-design/20260804230000_canonical_financial_architecture_v1_ddl.sql` (encabezado `🔴 PRODUCCIÓN` + doble confirmación).
- **Verificar:** el query de conteo → 13 tablas `financial_`, cada una con sus columnas.
- **🚦 GATE:** el PO confirma antes de correr.
- **Rollback:** `DROP TABLE public.financial_* CASCADE` (están vacías) — o dejarlas (inertes).

## Paso B — RLS: confidencialidad staff-only
- **Acción:** aplicar `supabase/canonical-financial-design/rls_financial_staff_only.sql`. En prod, el stub de `is_staff` **NO se crea** (ya existe la real) — la guarda `to_regprocedure` lo evita.
- **Verificar:** 13 tablas con `rls_activo=true` + 1 policy; y la prueba de rol (artista → 0 filas).
- **🚦 GATE.**  · **Rollback:** `DROP POLICY` + `DISABLE ROW LEVEL SECURITY` por tabla.

## Paso C — financial-engine a producción
- **Acción:** desplegar la Edge Function apuntando a **prod**, SIN bypass, con verify_jwt.
- **Cómo:** `supabase functions deploy financial-engine --project-ref hkuvuqupbxwkiykxvqdr`
  (NO setear `FINANCIAL_ENGINE_TEST_BYPASS_STAFF`).
- **Verificar:** `health` = ok; y `getNetCash` con TU sesión (rol owner) responde (candado real deja pasar al owner). Un no-staff recibe `NOT_STAFF`.
- **🚦 GATE.**  · **Rollback:** `supabase functions delete financial-engine` (o dejarla, sin uso).

## Paso D — Import: residencias reales → modelo canónico
- **Acción:** `action:"import_residencies"` en prod → lee tu `residency_schedule` real → crea venues + agreements. Idempotente.
- **Verificar:** el resumen `{residencies, venuesCreated, agreementsCreated}` refleja tus venues reales; re-ejecutar da 0.
- **🚦 GATE.**  · **Rollback:** borrar los `financial_venues`/`financial_venue_agreements` creados (o dejarlos).

## Paso E — ELIXIS delegando (se enciende la Fase 5)
- **Acción:** redesplegar `elixis-chat` a prod (ya trae el tool-use). Como ahora `financial-engine` existe en prod y comparten proyecto, la delegación funciona. `ANTHROPIC_API_KEY` ya está en prod.
- **Cómo:** `supabase functions deploy elixis-chat --project-ref hkuvuqupbxwkiykxvqdr`
- **Verificar:** preguntarle a ELIXIS "¿cuánta caja tengo?" → **delega al motor y responde con la cifra REAL** (no inventa). Si el motor cayera, ELIXIS lo dice (degradación elegante).
- **🚦 GATE.**  · **Rollback:** redesplegar la versión previa de elixis-chat (el tool degrada solo, así que aun sin rollback no rompe).

## Paso F — Fase 4: UI a datos reales (frontend, en paralelo)
- **Acción:** cablear el Matrix + cash flow para leer del `financial-engine` (KPIs reales) en vez del demo; quitar el banner "maqueta".
- **Verificar:** el Matrix muestra tus cifras reales.
- **🚦 GATE.** (Cambio de frontend, reversible por commit.)

---

## Orden y quién ejecuta
1. **A, B** (SQL) → los corre el PO en el editor de prod (yo le doy el SQL con encabezado 🔴).
2. **C, D, E** (functions/curl) → los puede correr Claude vía CLI apuntando a `--project-ref hkuvuqupbxwkiykxvqdr`, **con el GATE del PO en cada uno**.
3. **F** (UI) → commit de frontend.

**Ninguna acción de producción se ejecuta sin el 🚦 GATE explícito del PO en ese paso.**
