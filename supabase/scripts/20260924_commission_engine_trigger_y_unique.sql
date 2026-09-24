-- ============================================================================
-- ENTORNO: correr primero en PRUEBA (mdjb-ensayo, ref rtbsovavmtnjpbbpwsin)
-- NUNCA directo en PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) sin que el PO confirme
-- visualmente el resultado ahí primero.
-- ============================================================================
--
-- Motor de Comisiones y Ownership — Fase 1, lo que faltaba de verdad.
--
-- Verificado en PRODUCCIÓN (solo lectura, nada modificado) el 2026-09-24:
-- ya existen y están bien hechos `commission_rules` (con los 2 tiers reales
-- ya sembrados, paquete_550 y reveal_baby_shower), `get_client_commission_owner`,
-- `resolve_lead_master_client` y `calcular_comision_venta` -- NO se recrean
-- ni se tocan aquí, este script no los duplica.
--
-- Dos huecos reales encontrados:
-- 1) `referral_sale_commissions` no tiene UNIQUE en `lead_id` -- el
--    `on conflict (lead_id) do update` de calcular_comision_venta() habría
--    fallado en el primer uso real con "no unique or exclusion constraint
--    matching the ON CONFLICT specification".
-- 2) No existe ningún trigger que dispare calcular_comision_venta() cuando
--    total_aprobado_usd cambia -- hoy solo se podría llamar a mano.
--
-- Verificado que el trigger es seguro de disparar bajo la sesión de
-- cualquier staff real: is_staff() y can_read_financial() usan EXACTAMENTE
-- el mismo set de roles (admin/owner/manager/seller), así que quien
-- legítimamente aprueba un total (dispara este trigger) siempre pasa el
-- chequeo de permiso dentro de calcular_comision_venta().

-- 1) UNIQUE en lead_id (una sola fila de comisión por lead, se actualiza si se recalcula)
alter table public.referral_sale_commissions
  add constraint referral_sale_commissions_lead_id_key unique (lead_id);

-- 2) Trigger: recalcula la comisión cada vez que total_aprobado_usd pasa a
-- tener un valor real (o cambia de valor). No hace nada si sigue en null.
create or replace function public.trg_calcular_comision_venta()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.total_aprobado_usd is not null
     and (old.total_aprobado_usd is null or old.total_aprobado_usd is distinct from new.total_aprobado_usd) then
    perform public.calcular_comision_venta(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leads_calcular_comision on public.leads;
create trigger trg_leads_calcular_comision
  after insert or update of total_aprobado_usd on public.leads
  for each row
  execute function public.trg_calcular_comision_venta();

-- ============================================================================
-- VERIFICACIÓN (correr después, en el mismo PRUEBA) -- usa datos sintéticos,
-- créalos y bórralos en la misma sesión, nunca contra leads reales.
-- ============================================================================
--
-- Escenario 1: referido, 1er evento, paquete_550 -- debe dar
-- comisión_referido=20, descuento=30, cuota_empresa=100, comision_vendedor=50
-- (margen bruto 200 = 550-350, menos 20 menos 30 menos 100 = 50)
--
-- select id, client_origin, is_first_event, pago_dj_usd, comision_referido_usd,
--        descuento_usd, cuota_empresa_usd, comision_vendedor_usd, status
-- from public.referral_sale_commissions
-- where lead_id = '<id del lead de prueba>';
