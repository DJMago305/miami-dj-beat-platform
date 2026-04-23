# MDJ — Operativo RLS & identidad (versión consolidada)

**Doctrina verificable (Supabase) vs. decisiones de arquitectura (MDJ).** Objetivo: no mezclar "lo que dice la plataforma" con "lo que decidimos nosotros".

---

## A. Reglas Supabase (doctrina verificable)

### 1. RLS obligatoria

Toda tabla expuesta por la Data API debe tener RLS activa. La seguridad real vive en las policies de Postgres, no en el frontend.

### 2. Separación identidad / negocio

- `auth.users` = identidad
- Tablas en `public` = datos de producto
- Relación por `id` = `auth.users.id`

### 3. JWT ≠ autoridad única

El JWT identifica al usuario. Los claims personalizados existen, pero solo son válidos si se sincronizan explícitamente (hook o backend). No sustituyen a RLS.

### 4. Lógica sensible fuera del cliente

- Triggers / Edge / backend para operaciones críticas
- No confiar en inputs del frontend

### 5. Funciones (precisión importante)

RLS no aplica a funciones. El control real es:

- `GRANT` / `REVOKE` `EXECUTE`
- lógica interna de la función
- revisión explícita de:
  - `SECURITY DEFINER`
  - `search_path`

### 6. Principio de menor privilegio

Policies específicas por operación. Evitar `USING (true)` salvo caso documentado y restringido.

---

## B. Reglas MDJ (decisiones de arquitectura)

### 1. Fuente única de privilegio

La autoridad vive en DB (tablas + funciones). JWT = caché / UX.

**Si se usan claims en producción:** deben venir de hook o proceso documentado; no se mezclan ad hoc con columnas de negocio.

### 2. No introducir `public.profiles` en este sprint

Eso es migración estructural, no requisito de Supabase.

### 3. Rol sensible no escribible desde cliente

- Nada de manager / admin / staff vía `INSERT` / `UPDATE` del cliente
- Promoción solo vía: trigger controlado, función segura, backend/admin

### 4. JWT requiere re-login tras cambios

Cambios en metadata / Auth no renuevan solos el token de sesiones ya abiertas.

### 5. No tocar redirect post-login ahora

Es parte del sistema crítico estabilizado.

---

## C. Checklist de PR (bloque estándar)

Pegar en cada PR que toque DB / Auth:

- [ ] Tabla tocada: RLS `ON` (si se expone por API)
- [ ] Policies: `FOR` + `TO` definidos; `USING` / `WITH CHECK` correctos; sin `USING (true)` amplio (o justificado y citado en el PR)
- [ ] Privilegios: no hay promoción de rol (staff / admin / manager) desde cliente; validado vía trigger / función / Edge
- [ ] Funciones: `EXECUTE` acotado; `SECURITY DEFINER` y `search_path` revisados
- [ ] Auth: si se tocó metadata o `auth.users` → script documentado (`supabase/scripts/identity_audit_contradictions.sql` / `reset_jwt_*` según el caso) + re-login probado
- [ ] Coherencia: una sola regla de privilegio elevado por política o función; si se usa JWT en RLS → criterio documentado (p. ej. Custom Access Token Hook)
- [ ] Exclusiones: el PR no incluye migración a `public.profiles` ni modifica el redirect post-login (salvo issue enlazado)

---

## D. Fuera de este sprint (congelado)

- No migración a `public.profiles`
- No RBAC fino vía custom JWT claims (hasta criterio explícito e issue)
- No cambios al redirect post-login (salvo issue y revisión de auth en cadena)

---

## Fórmula operativa final

**Supabase (base técnica)**

- Auth = identidad
- DB + RLS = autorización
- JWT = soporte de sesión, no la fuente de verdad
- Lógica crítica fuera del cliente

**MDJ (decisión estratégica)**

- Una sola verdad de privilegio en tablas/funciones acordadas
- Cero promoción de roles sensibles desde el cliente
- Sin migraciones estructurales en caliente mientras el login/identidad se estabiliza
- JWT como apoyo de UI y caché, no como juez de permisos

**Veredicto** — con disciplina: menos superficie de “doble verdad” (JWT vs DB), menos políticas abiertas por error, y menos tiempo en incidencias de identidad. La política vive en RLS, triggers y flujos controlados; el checklist de PR es el contrato de equipo.

**Auditoría complementaria (solo lectura):** `supabase/scripts/audit_security_baseline.sql` (informe unificado: RLS, policies, `SECURITY DEFINER`, `EXECUTE` public). **Conteo rápido (CI / cron):** `supabase/scripts/audit_security_baseline_fast_probe.sql` (`n_fast_total`). **Identidad Auth vs perfiles:** `supabase/scripts/identity_audit_contradictions.sql`. **Workflow opcional:** `.github/workflows/rls-baseline-audit.yml` (requiere `DIRECT_URL` o `SUPABASE_DB_URL` en secretos; desactivado por defecto en el job).

---

*Supabase ofrece identidad + API + RLS; MDJ mantiene la verdad de negocio en `dj_profiles` / `client_profiles` y funciones mientras dure la estabilización de auth.*
