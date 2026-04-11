# Runbook Supabase — aplicar cambios y que todo fluya

**Idea clave:** lo que sube a **Vercel** es el sitio (`web/`). **Postgres, RLS y Edge Functions** viven en **Supabase** y hay que alinearlos **a mano** (SQL Editor o CLI). Si no, el front puede verse “nuevo” pero el backend queda desfasado.

---

## 1. Antes de tocar SQL (30 segundos)

1. Entra al [Dashboard del proyecto Supabase](https://supabase.com/dashboard) (el de producción).
2. **SQL → New query** (guarda cada script exitoso con un nombre si quieres historial).
3. Si algo falla, **lee el mensaje**: suele ser “relation already exists” (ok, idempotente) o “table does not exist” (falta un paso previo).

---

## 2. Comprobar qué ya tienes (opcional pero útil)

Ejecuta en SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'referral_sale_commissions',
    'course_purchases',
    'dj_ledger',
    'soundfortip_splits'
  )
ORDER BY table_name;
```

- Si **`referral_sale_commissions` no aparece** → necesitas el script **`12_monetization_referral_commissions.sql`** (ver paso 3).
- Si **`course_purchases` no aparece** → aplica el paso 4.
- Si **`dj_ledger` aparece** → aplica el paso 5 (seguridad RLS).

---

## 3. Tablas de monetización / referidos (si faltan)

**Archivo en el repo:** `web/sql/migrations/12_monetization_referral_commissions.sql`

- Crea `referral_sale_commissions`, `soundfortip_splits`, funciones auxiliares, etc.
- Debe ejecutarse **antes** del comentario de política nueva (paso siguiente).
- Si tu BD ya tiene esas tablas, el script usa `CREATE TABLE IF NOT EXISTS` en lo principal; igual puede mostrar avisos en políticas duplicadas — revisa el error; a veces conviene ejecutar solo el bloque que falta.

**Dependencia:** `dj_profiles` debe existir (proyecto MDJ ya lo usa).

---

## 4. Comentario de política referidos ($30 / $20)

**Archivo:** `web/sql/migrations/13_referral_policy_flat_2026.sql`

- Solo actualiza el **COMMENT** de la tabla `referral_sale_commissions` (documentación en BD).
- **Fallará** si la tabla `referral_sale_commissions` no existe → completa el paso 3 primero.

---

## 5. Compras de curso (Stripe → webhook)

**Archivo:** `supabase/migrations/20260411120000_course_purchases.sql`

- Crea la tabla `public.course_purchases` (idempotente).
- Necesaria si usas `create-course-checkout` / `stripe-webhook` para el curso DJ.

---

## 6. Seguridad: `dj_ledger` (RLS)

**Archivo:** `supabase/migrations/20260411180000_fix_dj_ledger_rls_remove_open_policy.sql`

- Quita la política permisiva **"System full access"** y deja solo lectura de filas propias para `authenticated`.
- Aplica **solo si** la tabla `public.dj_ledger` existe (normalmente ya la creó `20260302_flow_tab_implementation.sql`).

Si `dj_ledger` **no existe** en tu proyecto, **no ejecutes** este archivo (o créala antes con las migraciones antiguas del repo).

---

## 7. Orden recomendado (resumen)

| Orden | Archivo | Cuándo |
|------|---------|--------|
| A | `web/sql/migrations/12_monetization_referral_commissions.sql` | Si no tienes aún tablas de monetización/referidos |
| B | `web/sql/migrations/13_referral_policy_flat_2026.sql` | Después de A (o si `referral_sale_commissions` ya existe) |
| C | `supabase/migrations/20260411120000_course_purchases.sql` | Curso + webhook |
| D | `supabase/migrations/20260411180000_fix_dj_ledger_rls_remove_open_policy.sql` | Si existe `dj_ledger` |

---

## 8. Edge Functions (después del SQL)

Desde la carpeta del repo, con [Supabase CLI](https://supabase.com/docs/guides/cli) enlazada al proyecto:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy stripe-webhook
supabase functions deploy create-course-checkout
```

En **Supabase → Project Settings → Edge Functions → Secrets**, confirma las variables que usan esas funciones (Stripe, etc.).

---

## 9. Comprobar que “fluye”

1. **Vercel:** último deployment en verde (rama `main`).
2. **Supabase → Table Editor:** ves `course_purchases` (si aplicaste C) y/o `referral_sale_commissions` (si aplicaste A).
3. **Web:** prueba referidos según `REGRESSION-CHECKPOINT.md` (Local Storage, login, botón WEB del perfil).

---

## 10. Si algo rompe

- **Rollback SQL:** depende de lo ejecutado; las migraciones aquí son en su mayoría aditivas o `DROP POLICY IF EXISTS`. No borres tablas a ciegas sin backup.
- **Rollback código:** `git revert` o deploy de un commit anterior en Vercel.

---

*Mantén este runbook al día cuando añadas nuevas migraciones en `supabase/migrations/` o `web/sql/migrations/`.*
