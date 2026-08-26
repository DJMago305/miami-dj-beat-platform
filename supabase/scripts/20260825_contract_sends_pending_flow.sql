-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-08-25
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO
-- ============================================================
--
-- CONTEXTO
-- --------
-- El motor de contratos (web/contracts-engine.html) necesitaba persistir
-- en Supabase los envíos "pendientes de firma" (📨 Generar Enlace
-- Tokenizado) para poder: (a) resolver el contrato por token desde el
-- enlace remoto SIN login, y (b) alimentar una campana de notificaciones
-- global con el conteo real de pendientes, entre dispositivos.
--
-- Se investigó primero meter esto directo en `signed_contracts`, pero esa
-- tabla es estructuralmente incompatible con un registro "aún sin firmar":
--   - signature_png_base64, audit_sha256 y signer_name son NOT NULL (no
--     existen todavía en el momento del envío).
--   - Tiene una política de RLS "Bloqueo total: contratos firmados son
--     inmutables" (UPDATE ... USING (false)) — por diseño, a propósito,
--     para que un contrato firmado nunca pueda alterarse. Forzar un flujo
--     de "insertar PENDING, luego actualizar a SIGNED" ahí violaría esa
--     ley de inmutabilidad legal.
--
-- Por eso esta migración crea una tabla NUEVA Y SEPARADA, exclusivamente
-- operativa (cola de tareas, no registro legal), que nunca toca el
-- esquema ni las políticas de `signed_contracts`. El flujo real de firma
-- sigue exactamente igual que antes: `guardar_contrato_firmado` (ya tiene
-- EXECUTE para anon, verificado antes de escribir esto) sigue siendo el
-- único que inserta en `signed_contracts`. Esta migración solo agrega el
-- "antes" (registro del envío) y el "después" (marcar resuelto).
--
-- ============================================================

-- 1) Tabla operativa de envíos pendientes (NO es un registro legal)
create table if not exists public.contract_sends (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  contract_type text not null,
  form_payload jsonb not null,
  artist_profile_id uuid references public.dj_profiles(id),
  recipient text,
  recipient_name text,
  channel text,
  status text not null default 'PENDING',
  created_by uuid references auth.users(id),
  sent_at timestamptz not null default now(),
  resolved_contract_id uuid references public.signed_contracts(id),
  resolved_at timestamptz
);

alter table public.contract_sends enable row level security;

-- Staff (autenticado) registra el envío al generar el enlace.
drop policy if exists "Staff puede registrar envios pendientes" on public.contract_sends;
create policy "Staff puede registrar envios pendientes"
  on public.contract_sends for insert
  to authenticated
  with check (true);

-- Cualquier staff con rol real (owner/admin/manager/seller) ve TODA la
-- cola — es una tabla operativa compartida del equipo, no un dato privado
-- de quien la creó. Así la campana global cuenta lo mismo para cualquier
-- staff, no solo para quien envió el contrato.
drop policy if exists "Staff puede ver la cola de envios pendientes" on public.contract_sends;
create policy "Staff puede ver la cola de envios pendientes"
  on public.contract_sends for select
  to authenticated
  using (
    exists (
      select 1 from public.dj_profiles
      where dj_profiles.user_id = auth.uid()
        and dj_profiles.role in ('owner','admin','manager','seller')
    )
  );

-- A propósito: SIN política de UPDATE/DELETE para authenticated ni anon.
-- La única forma de resolver un envío es la función de abajo (SECURITY
-- DEFINER) — así ni el remitente ni el firmante externo pueden alterar la
-- fila directamente, solo a través del flujo controlado de firma.

-- 2) Resolver un envío pendiente por su token — sin exponer la tabla a
--    anon (evita que alguien liste/enumere todos los envíos; solo puede
--    obtener UNO si ya conoce el token exacto que le llegó por link).
create or replace function public.resolver_envio_por_token(p_token text)
returns table (
  id uuid, token text, contract_type text, form_payload jsonb,
  artist_profile_id uuid, recipient text, recipient_name text,
  status text, sent_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select id, token, contract_type, form_payload, artist_profile_id,
         recipient, recipient_name, status, sent_at
  from public.contract_sends
  where token = p_token and status = 'PENDING'
  limit 1;
$$;
grant execute on function public.resolver_envio_por_token(text) to anon, authenticated;

-- 3) Marcar un envío como firmado, vinculándolo al registro real de
--    signed_contracts ya creado por guardar_contrato_firmado. Se llama
--    DESPUÉS de que ese insert tuvo éxito — nunca reemplaza ni toca esa
--    tabla, solo cierra el ciclo de esta cola operativa.
create or replace function public.marcar_envio_firmado(p_token text, p_signed_contract_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.contract_sends
  set status = 'SIGNED', resolved_contract_id = p_signed_contract_id, resolved_at = now()
  where token = p_token and status = 'PENDING';
$$;
grant execute on function public.marcar_envio_firmado(text, uuid) to anon, authenticated;
