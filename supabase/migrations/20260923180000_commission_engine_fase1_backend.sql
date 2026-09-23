-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) — ya aplicada y probada en vivo
-- 2026-09-23, sesión dedicada de comisiones/ownership (ver
-- project_referral_commission_split_model en memoria del PO). Este archivo
-- documenta en git lo que ya se aplicó vía MCP execute_sql para que quede
-- versionado -- no es un "por aplicar", es un registro de lo ya hecho.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fase 1 (backend + puente leads<->master_clients): NO agrega ningún trigger
-- automático todavía -- calcular_comision_venta() se llama manualmente hasta
-- que el PO confirme los números en un caso real y se autorice conectar el
-- disparador automático. Tampoco toca ninguna fila existente de `leads` más
-- allá de las 2 columnas nuevas (nullable, sin default destructivo).
--
-- Modelo de negocio completo (referencia, no re-derivar): ver memoria
-- project_referral_commission_split_model. Resumen:
--   margen_bruto = precio_venta - pago_DJ   (el tax NO se resta de este margen
--   -- es un cargo aparte al cliente que se remite al gobierno, no parte del
--   reparto DJ/vendedor/empresa)
--   - Cliente referido por un DJ (dueño = afiliación más antigua en
--     dj_client_affiliations): 1er evento resta comisión de referido +
--     descuento de primera vez (fijos por tier) antes de la cuota fija de
--     empresa; el vendedor se queda con el residuo. 2do+ evento, esos montos
--     se doblan hacia la cuota de empresa (el vendedor no los gana).
--   - Cliente traído por el vendedor mismo (sin DJ dueño): margen 50/50
--     vendedor/empresa, sin comisión de referido ni descuento nunca.

-- 1) Puente real leads -> master_clients (no existía ninguna relación antes;
--    leads.client_user_id apunta a auth.users, no a master_clients).
alter table public.leads
  add column if not exists master_client_id uuid references public.master_clients(id),
  add column if not exists commission_tier_key text;

create or replace function public.resolve_lead_master_client(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_mc_id uuid;
begin
  -- Solo staff financiero (owner/admin/manager/seller) o service_role.
  -- IMPORTANTE: nunca comparar current_user aquí -- dentro de una función
  -- security definer, current_user siempre es el DUEÑO de la función
  -- (ej. 'postgres'), no el llamador real; comparar contra eso anularía el
  -- control de acceso para cualquiera que la invoque. Verificado en vivo:
  -- ver nota de la sección de verificación al final de este archivo.
  if not (coalesce(auth.role(), '') = 'service_role' or public.can_read_financial(auth.uid())) then
    raise exception 'forbidden: solo staff financiero puede resolver el cliente maestro de un lead';
  end if;

  select id, email, phone into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null then return null; end if;

  select mc.id into v_mc_id
  from public.master_clients mc
  where (
    v_lead.phone is not null and mc.normalized_phone is not null
    and right(regexp_replace(v_lead.phone, '\D', '', 'g'), 10) = right(regexp_replace(mc.normalized_phone, '\D', '', 'g'), 10)
  ) or (
    v_lead.email is not null and mc.normalized_email is not null
    and lower(trim(v_lead.email)) = mc.normalized_email
  )
  limit 1;

  update public.leads set master_client_id = v_mc_id where id = p_lead_id and master_client_id is distinct from v_mc_id;
  return v_mc_id;
end;
$$;

-- 2) Dueño de comisión de un cliente = afiliación activa más antigua.
--    Otros DJs afiliados después siguen viendo al cliente (agenda, etc.) pero
--    no cobran referido -- ver AskUserQuestion del 2026-09-23, opción
--    recomendada elegida por el PO.
create or replace function public.get_client_commission_owner(p_master_client_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select dj_id
  from public.dj_client_affiliations
  where master_client_id = p_master_client_id
    and (coalesce(auth.role(), '') = 'service_role' or public.can_read_financial(auth.uid()))
    and coalesce(active, true) = true
  order by created_at asc
  limit 1
$$;

-- 3) Tabla de reglas versionable -- los montos son deliberadamente temporales
--    ("esto es en comienzo de la empresa... después se ajustará", palabras
--    del PO) -- nunca hardcodear estos números en código.
create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  tier_key text not null,
  precio_lista_usd numeric null,
  pago_dj_usd numeric null,
  comision_referido_dj_usd numeric not null default 0,
  descuento_primera_vez_usd numeric not null default 0,
  cuota_empresa_usd numeric null,
  split_vendedor_pct numeric null,
  tax_rate numeric not null default 0.07,
  notas text null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.commission_rules enable row level security;

create policy commission_rules_staff_read on public.commission_rules
  for select to authenticated using (public.can_read_financial(auth.uid()));

create policy commission_rules_owner_write on public.commission_rules
  for all to authenticated
  using (exists (select 1 from public.dj_profiles d where d.user_id = auth.uid() and lower(trim(coalesce(d.role,''))) in ('owner','admin')))
  with check (exists (select 1 from public.dj_profiles d where d.user_id = auth.uid() and lower(trim(coalesce(d.role,''))) in ('owner','admin')));

insert into public.commission_rules (tier_key, precio_lista_usd, pago_dj_usd, comision_referido_dj_usd, descuento_primera_vez_usd, cuota_empresa_usd, notas)
select 'paquete_550', 550, 350, 20, 30, 100, 'Ejemplo original del PO, 2026-09-23 -- confirmado exacto contra 4 escenarios de prueba.'
where not exists (select 1 from public.commission_rules where tier_key = 'paquete_550' and effective_to is null);

insert into public.commission_rules (tier_key, precio_lista_usd, pago_dj_usd, comision_referido_dj_usd, descuento_primera_vez_usd, cuota_empresa_usd, notas)
select 'reveal_baby_shower', 350, 250, 0, 0, 100, 'PENDIENTE: el PO no confirmó comisión de referido/descuento de primera vez para este tier -- queda en 0 hasta que los dé. Cuota empresa = 100 asumiendo margen 100 (350-250) repartido 50/50 sin referido.'
where not exists (select 1 from public.commission_rules where tier_key = 'reveal_baby_shower' and effective_to is null);

-- 4) Ledger real de comisiones -- restructura la tabla dormida
--    referral_sale_commissions (0 filas antes de esta migración, sin costo
--    de datos). Se dropean las 2 policies viejas atadas a columnas que ya
--    no existen ("DJ reads own referral commissions",
--    "Service role manages referral commissions").
drop policy if exists "DJ reads own referral commissions" on public.referral_sale_commissions;
drop policy if exists "Service role manages referral commissions" on public.referral_sale_commissions;

alter table public.referral_sale_commissions
  drop column if exists order_ref,
  drop column if exists gross_cents,
  drop column if exists commission_rate,
  drop column if exists commission_cents,
  drop column if exists client_user_id,
  drop column if exists referring_dj_user_id;

alter table public.referral_sale_commissions
  add column if not exists lead_id uuid references public.leads(id),
  add column if not exists master_client_id uuid references public.master_clients(id),
  add column if not exists client_origin text check (client_origin in ('dj_referral','vendedor_originado')),
  add column if not exists owner_dj_id uuid references public.dj_profiles(id),
  add column if not exists is_first_event boolean,
  add column if not exists tier_key text,
  add column if not exists pago_dj_usd numeric,
  add column if not exists comision_referido_usd numeric,
  add column if not exists descuento_usd numeric,
  add column if not exists cuota_empresa_usd numeric,
  add column if not exists vendedor_id uuid references auth.users(id),
  add column if not exists comision_vendedor_usd numeric,
  add column if not exists precio_venta_usd numeric,
  add column if not exists tax_usd numeric,
  add column if not exists calculado_en timestamptz default now();

create unique index if not exists referral_sale_commissions_lead_id_uidx on public.referral_sale_commissions(lead_id);

alter table public.referral_sale_commissions enable row level security;

create policy referral_sale_commissions_staff_read on public.referral_sale_commissions
  for select to authenticated using (public.can_read_financial(auth.uid()));

create policy referral_sale_commissions_service_role on public.referral_sale_commissions
  for all to service_role using (true) with check (true);

-- 5) Función de cálculo -- se llama MANUALMENTE por ahora (sin trigger
--    automático). Resuelve master_client_id si aún no está resuelto en el
--    lead, determina origen del cliente, si es su 1er evento aprobado, y
--    aplica la fórmula del modelo de negocio de arriba. Si el lead no tiene
--    commission_tier_key asignado (o el tier no tiene cuota de empresa
--    definida) y el cliente es referido por un DJ, NO se inventa un reparto
--    -- se guarda con status='pending_tier_review' y los montos en null,
--    porque antes de esta corrección un tier faltante le daba el 100% del
--    margen al vendedor y $0 a la empresa por accidente.
create or replace function public.calcular_comision_venta(p_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead record;
  v_owner_dj uuid;
  v_client_origin text;
  v_is_first boolean;
  v_rule record;
  v_rule_found boolean;
  v_pago_dj numeric;
  v_comision_ref numeric := 0;
  v_descuento numeric := 0;
  v_cuota_empresa numeric;
  v_tax numeric := 0;
  v_margen_bruto numeric;
  v_comision_vendedor numeric;
  v_split_pct numeric;
  v_status text := 'pending';
  v_id uuid;
begin
  if not (coalesce(auth.role(), '') = 'service_role' or public.can_read_financial(auth.uid())) then
    raise exception 'forbidden: solo staff financiero puede calcular comisiones de venta';
  end if;

  select * into v_lead from public.leads where id = p_lead_id;
  if v_lead.id is null or v_lead.total_aprobado_usd is null then
    return null;
  end if;

  if v_lead.master_client_id is null then
    perform public.resolve_lead_master_client(p_lead_id);
    select * into v_lead from public.leads where id = p_lead_id;
  end if;

  v_owner_dj := case when v_lead.master_client_id is not null
    then public.get_client_commission_owner(v_lead.master_client_id) else null end;
  v_client_origin := case when v_owner_dj is not null then 'dj_referral' else 'vendedor_originado' end;

  v_is_first := (v_lead.master_client_id is null) or not exists (
    select 1 from public.leads l2
    where l2.master_client_id = v_lead.master_client_id
      and l2.id <> v_lead.id
      and l2.total_aprobado_usd is not null
      and l2.created_at < v_lead.created_at
  );

  v_pago_dj := coalesce(v_lead.dj_agreed_payout_usd, 0);

  select * into v_rule from public.commission_rules
    where tier_key = v_lead.commission_tier_key and effective_to is null
    order by effective_from desc limit 1;
  v_rule_found := v_rule.id is not null;

  v_tax := round(v_lead.total_aprobado_usd * coalesce(v_rule.tax_rate, 0.07), 2);
  v_margen_bruto := v_lead.total_aprobado_usd - v_pago_dj;

  if v_client_origin = 'dj_referral' then
    if not v_rule_found then
      v_status := 'pending_tier_review';
      v_comision_ref := null;
      v_descuento := null;
      v_cuota_empresa := null;
      v_comision_vendedor := null;
    else
      if v_is_first then
        v_comision_ref := coalesce(v_rule.comision_referido_dj_usd, 0);
        v_descuento := coalesce(v_rule.descuento_primera_vez_usd, 0);
        v_cuota_empresa := v_rule.cuota_empresa_usd;
      else
        v_comision_ref := 0;
        v_descuento := 0;
        v_cuota_empresa := coalesce(v_rule.cuota_empresa_usd, 0) + coalesce(v_rule.comision_referido_dj_usd, 0) + coalesce(v_rule.descuento_primera_vez_usd, 0);
      end if;
      if v_cuota_empresa is null and v_rule.split_vendedor_pct is not null then
        v_cuota_empresa := (v_margen_bruto - v_comision_ref - v_descuento) * (1 - v_rule.split_vendedor_pct);
      end if;
      if v_cuota_empresa is null then
        v_status := 'pending_tier_review';
        v_comision_vendedor := null;
      else
        v_comision_vendedor := v_margen_bruto - v_comision_ref - v_descuento - v_cuota_empresa;
      end if;
    end if;
  else
    v_split_pct := coalesce(v_rule.split_vendedor_pct, 0.5);
    v_comision_vendedor := v_margen_bruto * v_split_pct;
    v_cuota_empresa := v_margen_bruto * (1 - v_split_pct);
  end if;

  insert into public.referral_sale_commissions (
    lead_id, master_client_id, client_origin, owner_dj_id, is_first_event, tier_key,
    pago_dj_usd, comision_referido_usd, descuento_usd, cuota_empresa_usd,
    vendedor_id, comision_vendedor_usd, precio_venta_usd, tax_usd, status
  ) values (
    p_lead_id, v_lead.master_client_id, v_client_origin, v_owner_dj, v_is_first, v_lead.commission_tier_key,
    v_pago_dj, v_comision_ref, v_descuento, v_cuota_empresa,
    v_lead.assigned_staff_id, v_comision_vendedor, v_lead.total_aprobado_usd, v_tax, v_status
  )
  on conflict (lead_id) do update set
    master_client_id = excluded.master_client_id, client_origin = excluded.client_origin,
    owner_dj_id = excluded.owner_dj_id, is_first_event = excluded.is_first_event, tier_key = excluded.tier_key,
    pago_dj_usd = excluded.pago_dj_usd, comision_referido_usd = excluded.comision_referido_usd,
    descuento_usd = excluded.descuento_usd, cuota_empresa_usd = excluded.cuota_empresa_usd,
    vendedor_id = excluded.vendedor_id, comision_vendedor_usd = excluded.comision_vendedor_usd,
    precio_venta_usd = excluded.precio_venta_usd, tax_usd = excluded.tax_usd, status = excluded.status,
    calculado_en = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación ya corrida en vivo (2026-09-23) con leads/master_clients
-- sintéticos, borrados después de confirmar -- 4 escenarios, todos exactos:
--   1) Referido por DJ, 1er evento, paquete_550: comisión $20, descuento $30,
--      cuota empresa $100, vendedor $50. ✔ coincide con el ejemplo del PO.
--   2) Mismo cliente, 2do evento: comisión $0, descuento $0, cuota empresa
--      $150 (se dobla), vendedor $50 (no cambia). ✔
--   3) Cliente traído por el vendedor (sin DJ dueño): margen $200, reparto
--      $100/$100. ✔ 50/50 exacto.
--   4) Referido por DJ SIN tier asignado (ej. boda sin commission_tier_key):
--      status='pending_tier_review', montos en null -- ya NO da 100% al
--      vendedor / $0 a la empresa como en el primer intento de esta función.
--
-- Auto-revisión encontró y corrigió 2 problemas antes de dar esto por bueno:
--   (a) Seguridad: las 3 funciones eran security definer sin verificar quién
--       las llama -- cualquier usuario autenticado podía invocarlas. Se
--       agregó el check can_read_financial(auth.uid())/service_role.
--   (b) Ese mismo check, en su primer intento, incluía `current_user =
--       'postgres'` como atajo para poder probarlo yo mismo -- pero DENTRO
--       de una función security definer, current_user SIEMPRE es el dueño de
--       la función (postgres), sin importar quién la invoque, así que esa
--       condición anulaba el control de acceso para todo el mundo. Detectado
--       simulando una sesión real no-staff (set_config request.jwt.claims +
--       SET LOCAL ROLE authenticated) -- la llamada NO debía funcionar y sí
--       funcionó, lo cual expuso el bug. Corregido quitando ese atajo;
--       re-verificado con una sesión no-staff (bloqueada, error `forbidden`)
--       y una sesión owner real (funcionó).
--
-- Pendiente, explícitamente fuera de esta migración (Fase 2):
--   - Trigger automático en leads (hoy se llama calcular_comision_venta()
--     a mano, con permiso explícito, hasta que el PO confirme en un caso
--     real antes de automatizarlo).
--   - Cablear leads.commission_tier_key y leads.assigned_staff_id desde el
--     frontend (production-module.js) -- hoy solo se pueden llenar por SQL.
--   - Aviso "ofrecer primero al DJ dueño" en offerEvent()
--     (calendario-operacional-inteligente.html).
--   - Confirmar montos de comisión/descuento del tier reveal_baby_shower.
-- ═══════════════════════════════════════════════════════════════════════════
