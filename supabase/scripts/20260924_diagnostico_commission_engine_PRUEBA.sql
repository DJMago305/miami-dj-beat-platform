-- ============================================================================
-- ENTORNO: PRUEBA (mdjb-ensayo, rtbsovavmtnjpbbpwsin)
-- Este script NO modifica nada -- son puras consultas de lectura, para ver
-- qué existe realmente acá antes de mandar una migración a ciegas.
-- ============================================================================

-- 1) ¿Cuáles de las piezas del motor de comisiones ya existen acá?
select 'tabla: commission_rules' as pieza, exists(select 1 from information_schema.tables where table_schema='public' and table_name='commission_rules') as existe
union all
select 'tabla: referral_sale_commissions', exists(select 1 from information_schema.tables where table_schema='public' and table_name='referral_sale_commissions')
union all
select 'tabla: dj_client_affiliations', exists(select 1 from information_schema.tables where table_schema='public' and table_name='dj_client_affiliations')
union all
select 'tabla: master_clients', exists(select 1 from information_schema.tables where table_schema='public' and table_name='master_clients')
union all
select 'tabla: leads', exists(select 1 from information_schema.tables where table_schema='public' and table_name='leads')
union all
select 'columna: leads.master_client_id', exists(select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='master_client_id')
union all
select 'columna: leads.commission_tier_key', exists(select 1 from information_schema.columns where table_schema='public' and table_name='leads' and column_name='commission_tier_key')
union all
select 'función: get_client_commission_owner', exists(select 1 from pg_proc where proname='get_client_commission_owner')
union all
select 'función: resolve_lead_master_client', exists(select 1 from pg_proc where proname='resolve_lead_master_client')
union all
select 'función: calcular_comision_venta', exists(select 1 from pg_proc where proname='calcular_comision_venta')
union all
select 'función: is_staff', exists(select 1 from pg_proc where proname='is_staff')
union all
select 'función: can_read_financial', exists(select 1 from pg_proc where proname='can_read_financial');

-- 2) Si "tabla: leads" dio true, ¿qué columnas reales tiene (para comparar con producción)?
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='leads' order by ordinal_position;
