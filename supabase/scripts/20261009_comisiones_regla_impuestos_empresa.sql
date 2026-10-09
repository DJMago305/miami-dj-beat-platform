-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr)
-- Comisiones de venta: el impuesto (7 %) sale de la parte de la EMPRESA, nunca de la del vendedor,
-- cuando el impuesto no se cobró aparte al cliente.
--   · leads.impuesto_cobrado_aparte  (null = no se cobró aparte → la empresa lo absorbe en la venta base;
--                                      true  = se cobró aparte → no se descuenta nada;
--                                      false = no se cobró aparte, ni en el add-on)
--   · El add-on (horas extra / sonidista subcontratado) solo descuenta impuesto si el flag es explícitamente false.
-- Reemplaza calcular_comision_venta(uuid) y protege la columna nueva (solo staff la cambia).
begin;
set local lock_timeout = '5s';

alter table public.leads add column if not exists impuesto_cobrado_aparte boolean;
comment on column public.leads.impuesto_cobrado_aparte is
  'null/false = el impuesto no se cobró aparte al cliente (la empresa lo absorbe de su parte); true = se cobró aparte.';

alter table public.referral_sale_commissions
  add column if not exists impuesto_cobrado_aparte boolean,
  add column if not exists impuesto_descontado_empresa_usd numeric not null default 0;

create or replace function public.calcular_comision_venta(p_lead_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
  v_base_total numeric;
  v_addon_amount numeric;
  v_addon_dj_pay numeric;
  v_addon_margen numeric;
  v_addon_split_pct numeric;
  v_addon_vendedor numeric;
  v_addon_empresa numeric;
  v_rate numeric;
  v_tax_base numeric := 0;
  v_tax_addon numeric := 0;
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

  v_addon_amount := coalesce(v_lead.addon_amount_usd, 0);
  v_addon_dj_pay := coalesce(v_lead.addon_dj_payout_usd, 0);
  v_addon_margen := v_addon_amount - v_addon_dj_pay;

  select * into v_rule from public.commission_rules
    where tier_key = 'addon_extra_horas' and effective_to is null
    order by effective_from desc limit 1;
  v_addon_split_pct := coalesce(v_rule.split_vendedor_pct, 0.5);

  if v_addon_amount <> 0 or v_addon_dj_pay <> 0 then
    v_addon_vendedor := round(v_addon_margen * v_addon_split_pct, 2);
    v_addon_empresa := v_addon_margen - v_addon_vendedor;
  else
    v_addon_vendedor := null;
    v_addon_empresa := null;
  end if;

  v_base_total := v_lead.total_aprobado_usd - v_addon_amount;

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

  v_pago_dj := coalesce(v_lead.dj_agreed_payout_usd, 0) - v_addon_dj_pay;

  select * into v_rule from public.commission_rules
    where tier_key = v_lead.commission_tier_key and effective_to is null
    order by effective_from desc limit 1;
  v_rule_found := v_rule.id is not null;

  v_rate := coalesce(v_rule.tax_rate, 0.07);
  v_tax := round(v_lead.total_aprobado_usd * v_rate, 2);
  v_margen_bruto := v_base_total - v_pago_dj;

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

  -- Regla de impuestos: el impuesto lo absorbe la empresa, nunca el vendedor.
  if coalesce(v_lead.impuesto_cobrado_aparte, false) = false and v_base_total > 0 then
    v_tax_base := round(v_base_total * v_rate, 2);
  end if;
  if coalesce(v_lead.impuesto_cobrado_aparte, true) = false and v_addon_amount > 0 then
    v_tax_addon := round(v_addon_amount * v_rate, 2);
  end if;
  if v_cuota_empresa is not null then v_cuota_empresa := v_cuota_empresa - v_tax_base; end if;
  if v_addon_empresa is not null then v_addon_empresa := v_addon_empresa - v_tax_addon; end if;

  insert into public.referral_sale_commissions (
    lead_id, master_client_id, client_origin, owner_dj_id, is_first_event, tier_key,
    pago_dj_usd, comision_referido_usd, descuento_usd, cuota_empresa_usd,
    vendedor_id, comision_vendedor_usd, precio_venta_usd, tax_usd, status,
    addon_amount_usd, addon_dj_payout_usd, addon_comision_vendedor_usd, addon_cuota_empresa_usd,
    impuesto_cobrado_aparte, impuesto_descontado_empresa_usd
  ) values (
    p_lead_id, v_lead.master_client_id, v_client_origin, v_owner_dj, v_is_first, v_lead.commission_tier_key,
    coalesce(v_lead.dj_agreed_payout_usd, 0), v_comision_ref, v_descuento, v_cuota_empresa,
    v_lead.assigned_staff_id, v_comision_vendedor, v_lead.total_aprobado_usd, v_tax, v_status,
    nullif(v_addon_amount, 0), nullif(v_addon_dj_pay, 0), v_addon_vendedor, v_addon_empresa,
    v_lead.impuesto_cobrado_aparte, v_tax_base + v_tax_addon
  )
  on conflict (lead_id) do update set
    master_client_id = excluded.master_client_id, client_origin = excluded.client_origin,
    owner_dj_id = excluded.owner_dj_id, is_first_event = excluded.is_first_event, tier_key = excluded.tier_key,
    pago_dj_usd = excluded.pago_dj_usd, comision_referido_usd = excluded.comision_referido_usd,
    descuento_usd = excluded.descuento_usd, cuota_empresa_usd = excluded.cuota_empresa_usd,
    vendedor_id = excluded.vendedor_id, comision_vendedor_usd = excluded.comision_vendedor_usd,
    precio_venta_usd = excluded.precio_venta_usd, tax_usd = excluded.tax_usd, status = excluded.status,
    addon_amount_usd = excluded.addon_amount_usd, addon_dj_payout_usd = excluded.addon_dj_payout_usd,
    addon_comision_vendedor_usd = excluded.addon_comision_vendedor_usd, addon_cuota_empresa_usd = excluded.addon_cuota_empresa_usd,
    impuesto_cobrado_aparte = excluded.impuesto_cobrado_aparte,
    impuesto_descontado_empresa_usd = excluded.impuesto_descontado_empresa_usd,
    calculado_en = now()
  returning id into v_id;

  return v_id;
end;
$function$;

-- Protección: un cliente/anon no puede tocar el indicador de impuesto (solo staff).
create or replace function public.leads_proteger_impuesto_flag()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user in ('authenticated', 'anon')
     and not (auth.uid() is not null and public.is_staff(auth.uid())) then
    if tg_op = 'INSERT' then
      new.impuesto_cobrado_aparte := null;
    else
      new.impuesto_cobrado_aparte := old.impuesto_cobrado_aparte;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_leads_proteger_impuesto_flag on public.leads;
create trigger trg_leads_proteger_impuesto_flag
  before insert or update on public.leads
  for each row execute function public.leads_proteger_impuesto_flag();

-- Verificación (solo lectura): las dos columnas nuevas existen y la función ya trae la regla.
select
  (select count(*) from information_schema.columns where table_schema='public' and table_name='leads' and column_name='impuesto_cobrado_aparte') as leads_col,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='referral_sale_commissions' and column_name in ('impuesto_cobrado_aparte','impuesto_descontado_empresa_usd')) as rsc_cols,
  (select position('impuesto_descontado_empresa_usd' in pg_get_functiondef('public.calcular_comision_venta(uuid)'::regprocedure)) > 0) as funcion_nueva;
commit;
