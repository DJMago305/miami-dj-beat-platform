-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) — mismo patrón ya acordado con
-- el PO para este motor (ver 20260923180000_commission_engine_fase1_backend.sql
-- y ESTADO_MAESTRO 2026-09-24): `mdjb-ensayo` (PRUEBA) no tiene ni la tabla
-- `leads`, así que no es un espejo real de producción para este dominio.
-- Se aplica directo en producción, se prueba con datos sintéticos creados y
-- borrados en la misma sesión, NUNCA contra un lead real. Solo correr esto
-- después de que el PO confirme explícitamente aplicarlo.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Motor de Comisiones y Ownership — Fase 2, pieza "horas extra / add-ons".
--
-- Ya construido y en producción (Fase 1, PR #466/#481, NO se toca aquí):
-- get_client_commission_owner(), resolve_lead_master_client(),
-- commission_rules, calcular_comision_venta(), trg_leads_calcular_comision.
-- Ese reparto (paquete base: pago DJ fijo por tier, comisión de referido +
-- descuento de primera vez, cuota de empresa fija, vendedor con el residuo)
-- sigue exactamente igual.
--
-- Lo que faltaba (memoria project_referral_commission_split_model, ejemplo
-- del PO 2026-09-23): cuando se negocian horas extra o add-ons ENCIMA de un
-- paquete base, ese margen incremental es un caso aparte -- NO se lo queda
-- entero el vendedor (que es lo que pasaría hoy, porque la cuota de empresa
-- es fija por tier y el vendedor absorbe cualquier residuo). Ejemplo dado:
-- una hora extra vendida en $100 -> $50 para el DJ (él la trabaja), y del
-- margen restante de $50 -> $25 vendedor / $25 empresa.
--
-- Diseño: 2 columnas nuevas en `leads` para que el staff declare, del total
-- ya aprobado, cuánto es add-on/horas extra y cuánto de eso se le paga al DJ
-- por eso específicamente (aparte de su pago base del paquete). El resto de
-- la fórmula de Fase 1 sigue usando el paquete BASE (total y pago al DJ menos
-- el add-on), para no mezclar el margen del paquete con el del add-on -- si
-- no se separan, el add-on terminaría repartido como el paquete base (100%
-- al vendedor vía el residuo), no 50/50 como pidió el PO.

-- 1) Lo que el staff declara sobre el add-on, por lead.
alter table public.leads
  add column if not exists addon_amount_usd numeric null,
  add column if not exists addon_dj_payout_usd numeric null;

comment on column public.leads.addon_amount_usd is
  'Parte de total_aprobado_usd que corresponde a horas extra/add-ons negociados encima del paquete base (no el precio de lista del paquete). Null/0 = sin add-on, la mayoría de los leads.';
comment on column public.leads.addon_dj_payout_usd is
  'Parte de dj_agreed_payout_usd que el DJ recibe específicamente por ese add-on/hora extra (aparte de su pago base del paquete).';

-- 2) Regla versionable para el split del add-on -- igual que el resto del
--    motor, el porcentaje NO se hardcodea en la función, vive en
--    commission_rules (el PO ya avisó que esto se ajustará más adelante).
insert into public.commission_rules (tier_key, precio_lista_usd, pago_dj_usd, comision_referido_dj_usd, descuento_primera_vez_usd, cuota_empresa_usd, split_vendedor_pct, notas)
select 'addon_extra_horas', null, null, 0, 0, null, 0.5,
  'Horas extra/add-ons negociados encima de un paquete base (cualquier tier, cualquier origen de cliente). Ejemplo confirmado por el PO 2026-09-23: hora extra de $100 -> $50 al DJ, y del margen restante de $50 -> $25 vendedor / $25 empresa. Split de este margen, no del monto cobrado.'
where not exists (select 1 from public.commission_rules where tier_key = 'addon_extra_horas' and effective_to is null);

-- 3) Ledger: line items propios para el add-on, separados de los del
--    paquete base (mismo patrón que las demás columnas de esta tabla --
--    cada aportante tiene su propia columna, nunca un total mezclado).
alter table public.referral_sale_commissions
  add column if not exists addon_amount_usd numeric,
  add column if not exists addon_dj_payout_usd numeric,
  add column if not exists addon_comision_vendedor_usd numeric,
  add column if not exists addon_cuota_empresa_usd numeric;

-- 4) calcular_comision_venta(): se reemplaza completa (CREATE OR REPLACE,
--    misma firma) para restar el add-on del margen del paquete base ANTES
--    de aplicar la fórmula de Fase 1, y calcular el split del add-on aparte.
--    Sin add-on (columnas en null/0, el caso normal), el resultado es
--    idéntico al de Fase 1 -- no cambia ningún cálculo ya verificado.
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
  v_base_total numeric;
  v_addon_amount numeric;
  v_addon_dj_pay numeric;
  v_addon_margen numeric;
  v_addon_split_pct numeric;
  v_addon_vendedor numeric;
  v_addon_empresa numeric;
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

  -- Add-on/horas extra: se separan del paquete base antes de todo lo demás.
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

  v_tax := round(v_lead.total_aprobado_usd * coalesce(v_rule.tax_rate, 0.07), 2);
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

  insert into public.referral_sale_commissions (
    lead_id, master_client_id, client_origin, owner_dj_id, is_first_event, tier_key,
    pago_dj_usd, comision_referido_usd, descuento_usd, cuota_empresa_usd,
    vendedor_id, comision_vendedor_usd, precio_venta_usd, tax_usd, status,
    addon_amount_usd, addon_dj_payout_usd, addon_comision_vendedor_usd, addon_cuota_empresa_usd
  ) values (
    p_lead_id, v_lead.master_client_id, v_client_origin, v_owner_dj, v_is_first, v_lead.commission_tier_key,
    coalesce(v_lead.dj_agreed_payout_usd, 0), v_comision_ref, v_descuento, v_cuota_empresa,
    v_lead.assigned_staff_id, v_comision_vendedor, v_lead.total_aprobado_usd, v_tax, v_status,
    nullif(v_addon_amount, 0), nullif(v_addon_dj_pay, 0), v_addon_vendedor, v_addon_empresa
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
    calculado_en = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Verificación a correr en producción con datos sintéticos (crear y borrar
-- en la misma sesión, nunca contra un lead real):
--
-- Escenario: paquete_550, referido, 1er evento, MÁS una hora extra de $100
-- ($50 al DJ). total_aprobado_usd = 650, dj_agreed_payout_usd = 400
-- (350 base + 50 del add-on), addon_amount_usd = 100, addon_dj_payout_usd = 50.
-- Esperado: comision_referido=20, descuento=30, cuota_empresa=100,
-- comision_vendedor=50 (idéntico al escenario base -- el add-on no debe
-- alterar estos 4 números), addon_comision_vendedor_usd=25,
-- addon_cuota_empresa_usd=25.
--
-- Escenario de control: mismo lead pero SIN add-on (addon_amount_usd=null,
-- dj_agreed_payout_usd=350, total_aprobado_usd=550) debe dar EXACTAMENTE lo
-- mismo que ya está verificado en producción desde Fase 1 -- confirma que
-- esta migración no cambió el comportamiento existente.
-- ═══════════════════════════════════════════════════════════════════════════
