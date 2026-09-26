-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- Se aplica por partes, en orden, con aprobación del PO
-- entre cada una. ESTADO (2026-09-26): PARTES 1 y 2 YA APLICADAS en producción (migración
-- "calendar_google_tokens_vault_parte1" + Parte 2 vía SQL; verificado: 6 de 6 secretos descifran y
-- coinciden con el original; anon/authenticated sin EXECUTE). 5 Edge Functions desplegadas y probadas.
-- PARTE 3 TAMBIÉN APLICADA (2026-09-26, con candado que abortaba si algún secreto no descifraba o no
-- coincidía): refresh_token y access_token quedaron en NULL en las 6 filas de Google; sincronización
-- real verificada después (webhook + reconcile).
-- ─────────────────────────────────────────────────────────────────────────────
-- Cifrar el refresh_token de Google Calendar en Supabase Vault (mismo patrón que la contraseña
-- de Apple: 20260919_calendar_caldav_apple_columns.sql + 20260920_calendar_caldav_vault_wrappers.sql).
-- Antes de esto, user_calendar_integrations.refresh_token / access_token estaban en texto plano (sonda V17).
--
-- Decisión de diseño: el access_token deja de guardarse (dura ~1 h y todas las funciones lo
-- renuevan desde el refresh_token); solo el refresh_token va a Vault, un secreto por fila.
--
-- ORDEN (cada parte es independiente y reversible hasta la 3):
--   PARTE 1  Columna + funciones de Vault (solo agrega, no cambia nada existente).
--   PARTE 2  Copia los refresh_token actuales a Vault (idempotente; el texto plano sigue ahí).
--   ── desplegar las 5 Edge Functions nuevas y probar sincronización real ──
--   PARTE 3  Borra el texto plano (refresh_token y access_token quedan en NULL). Irreversible
--            para el texto plano, pero el secreto en Vault ya lo tiene.
-- ─────────────────────────────────────────────────────────────────────────────

-- ═══ PARTE 1 · columna + wrappers ═══════════════════════════════════════════

alter table public.user_calendar_integrations
  add column if not exists google_refresh_token_secret_id uuid references vault.secrets(id) on delete set null;

comment on column public.user_calendar_integrations.google_refresh_token_secret_id is
  'Referencia a vault.secrets: el refresh_token de Google, cifrado. Reemplaza a refresh_token (texto plano, en desuso).';

create or replace function public.calendar_google_guardar_token(p_token text, p_nombre text default null)
returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_id uuid;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'token_vacio';
  end if;
  v_id := vault.create_secret(
    p_token,
    coalesce(p_nombre, 'gcal_refresh_' || gen_random_uuid()::text),
    'Refresh token de Google Calendar (OAuth)'
  );
  return v_id;
end;
$$;

create or replace function public.calendar_google_actualizar_token(p_secret_id uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'token_vacio';
  end if;
  perform vault.update_secret(p_secret_id, p_token);
end;
$$;

create or replace function public.calendar_google_leer_token(p_secret_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token from vault.decrypted_secrets where id = p_secret_id;
  return v_token;
end;
$$;

-- Supabase concede EXECUTE a anon/authenticated por defecto en funciones nuevas de `public`
-- y `revoke ... from public` NO lo quita (lección del 2026-09-20 con las de Apple): se revoca
-- a los tres roles explícitamente y se concede solo a service_role.
revoke all on function public.calendar_google_guardar_token(text, text) from public, anon, authenticated;
revoke all on function public.calendar_google_actualizar_token(uuid, text) from public, anon, authenticated;
revoke all on function public.calendar_google_leer_token(uuid) from public, anon, authenticated;
grant execute on function public.calendar_google_guardar_token(text, text) to service_role;
grant execute on function public.calendar_google_actualizar_token(uuid, text) to service_role;
grant execute on function public.calendar_google_leer_token(uuid) to service_role;

-- ═══ PARTE 2 · copiar los tokens actuales a Vault (idempotente) ═════════════
-- Un secreto por fila. Solo toca filas de Google con refresh_token en texto plano y sin secreto.
-- El texto plano NO se borra aquí: las funciones viejas siguen funcionando hasta el despliegue.

do $$
declare
  r record;
  v_id uuid;
begin
  for r in
    select id, refresh_token
    from public.user_calendar_integrations
    where provider = 'google'
      and refresh_token is not null and length(trim(refresh_token)) > 0
      and google_refresh_token_secret_id is null
  loop
    v_id := public.calendar_google_guardar_token(r.refresh_token, 'gcal_refresh_' || r.id::text);
    update public.user_calendar_integrations set google_refresh_token_secret_id = v_id where id = r.id;
  end loop;
end;
$$;

-- ═══ PARTE 3 · borrar el texto plano (YA APLICADA el 2026-09-26; se deja como referencia) ═════
-- Volver a correr antes la PARTE 2 por si se conectó alguien entre el despliegue y este paso.
--
-- update public.user_calendar_integrations
--    set refresh_token = null, access_token = null, updated_at = now()
--  where provider = 'google' and google_refresh_token_secret_id is not null;
