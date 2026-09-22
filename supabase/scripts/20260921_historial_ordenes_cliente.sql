-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Historial de órdenes del cliente (pedido del PO, 2026-09-21):
--   · Una orden cancelada (o que no se ejecutó) sale de «Próximos» y va a «Historial».
--   · Si el cliente no la borra, DESAPARECE SOLA a los 30 días. «Desaparecer» = OCULTAR al cliente (oculto_cliente_en); la fila y sus pagos
--     quedan guardados para staff y contabilidad. NUNCA se destruye un registro con pagos.
--   · El cliente puede BORRAR (ocultar) una orden de su historial y RESTAURAR una cancelada que no tuvo pagos ni DJ, con la fecha vigente y
--     dentro del plazo; si tuvo pagos o DJ, solo el staff la reabre.
-- Supuestos del PO aún sin confirmar palabra por palabra: 30 días, ocultar (no borrar de verdad), restaurar según la regla de arriba.

-- ═════════ 1. Columnas ═════════
alter table public.leads add column if not exists cancelada_en      timestamptz;   -- cuándo pasó a CANCELLED (la fija el servidor)
alter table public.leads add column if not exists oculto_cliente_en timestamptz;   -- ya no se muestra en el portal del cliente

-- ═════════ 2. Disparador: cancelada_en la maneja el servidor; oculto_cliente_en solo por las funciones ═════════
create or replace function public.leads_ciclo_historial()
returns trigger language plpgsql set search_path = public, pg_temp as $$
declare v_cliente boolean := current_user in ('authenticated', 'anon') and not (auth.uid() is not null and public.is_staff(auth.uid()));
begin
  if tg_op = 'INSERT' then
    new.cancelada_en := case when upper(coalesce(new.status, '')) = 'CANCELLED' then now() else null end;
    if v_cliente then new.oculto_cliente_en := null; end if;
  else
    if upper(coalesce(new.status, '')) = 'CANCELLED' and upper(coalesce(old.status, '')) <> 'CANCELLED' then
      new.cancelada_en := now();
    elsif upper(coalesce(new.status, '')) <> 'CANCELLED' then
      new.cancelada_en := null;
    elsif v_cliente then
      new.cancelada_en := old.cancelada_en;
    end if;
    if v_cliente then new.oculto_cliente_en := old.oculto_cliente_en; end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_leads_z_historial on public.leads;
create trigger trg_leads_z_historial before insert or update on public.leads
  for each row execute function public.leads_ciclo_historial();

-- Las ya canceladas empiezan a contar desde hoy (no se conoce su fecha real): nada se oculta de golpe.
update public.leads set cancelada_en = now() where upper(coalesce(status, '')) = 'CANCELLED' and cancelada_en is null;

-- ═════════ 3. El cliente borra (oculta) una orden de su historial ═════════
create or replace function public.cliente_ocultar_orden(p_lead uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', ''))); l public.leads%rowtype;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  select * into l from public.leads where id = p_lead;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_encontrada'); end if;
  if not ((l.client_user_id is not null and l.client_user_id = v_uid) or (v_email <> '' and lower(btrim(coalesce(l.email, ''))) = v_email)) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if not (upper(coalesce(l.status, '')) in ('CANCELLED', 'COMPLETED') or (l.event_date is not null and l.event_date < current_date)) then
    return jsonb_build_object('ok', false, 'error', 'no_es_historial');
  end if;
  update public.leads set oculto_cliente_en = now() where id = p_lead;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.cliente_ocultar_orden(uuid) from public, anon;
grant execute on function public.cliente_ocultar_orden(uuid) to authenticated;

-- ═════════ 4. El cliente restaura una orden cancelada (solo si no hay dinero ni DJ de por medio) ═════════
create or replace function public.cliente_restaurar_orden(p_lead uuid, p_dias int default 30)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', ''))); l public.leads%rowtype;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  select * into l from public.leads where id = p_lead;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_encontrada'); end if;
  if not ((l.client_user_id is not null and l.client_user_id = v_uid) or (v_email <> '' and lower(btrim(coalesce(l.email, ''))) = v_email)) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if upper(coalesce(l.status, '')) <> 'CANCELLED' then return jsonb_build_object('ok', false, 'error', 'no_cancelada'); end if;
  if l.oculto_cliente_en is not null then return jsonb_build_object('ok', false, 'error', 'ya_oculta'); end if;
  if coalesce(l.balance_paid, 0) > 0 or l.assigned_dj_id is not null then return jsonb_build_object('ok', false, 'error', 'requiere_staff'); end if;
  if l.event_date is null or l.event_date < current_date then return jsonb_build_object('ok', false, 'error', 'fecha_pasada'); end if;
  if l.cancelada_en is null or l.cancelada_en < now() - make_interval(days => p_dias) then return jsonb_build_object('ok', false, 'error', 'vencida'); end if;
  update public.leads set status = 'NEW' where id = p_lead;
  begin update public.event_builder_orders set order_status = 'pending' where lead_id = p_lead and order_status = 'cancelled'; exception when others then null; end;
  return jsonb_build_object('ok', true, 'estado', 'NEW');
end $$;
revoke execute on function public.cliente_restaurar_orden(uuid, int) from public, anon;
grant execute on function public.cliente_restaurar_orden(uuid, int) to authenticated;

-- ═════════ 5. Autolimpieza diaria: lo que no se ejecutó y el cliente no borró se OCULTA a los N días ═════════
create or replace function public.historial_autolimpieza(p_dias int default 30)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare n integer;
begin
  update public.leads set oculto_cliente_en = now()
   where oculto_cliente_en is null
     and (
       (upper(coalesce(status, '')) = 'CANCELLED' and cancelada_en is not null and cancelada_en < now() - make_interval(days => p_dias))
       or (upper(coalesce(status, '')) in ('NEW', 'MATCHED') and event_date is not null and event_date < current_date - p_dias
           and coalesce(balance_paid, 0) = 0 and assigned_dj_id is null)
     );
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.historial_autolimpieza(int) from public, anon, authenticated;

select cron.schedule('historial_autolimpieza_diaria', '40 6 * * *', $c$select public.historial_autolimpieza(30)$c$);

-- ═════════ 6. Recuperar una orden BORRADA (oculta) — botón «Restaurar» junto al «+» del calendario ═════════
-- «Borrar» solo oculta, así que se puede recuperar. Vuelve a Historial; si estaba cancelada, su reloj de 30 días
-- EMPIEZA DE NUEVO (si no, la limpieza nocturna la volvería a ocultar). No revive la orden (eso lo hace «Restaurar» del Historial).
-- No se ofrecen las órdenes NEW/MATCHED vencidas que la limpieza ocultó: nunca se ejecutaron.
create or replace function public.cliente_recuperar_orden_borrada(p_lead uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', ''))); l public.leads%rowtype;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  select * into l from public.leads where id = p_lead;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_encontrada'); end if;
  if not ((l.client_user_id is not null and l.client_user_id = v_uid) or (v_email <> '' and lower(btrim(coalesce(l.email, ''))) = v_email)) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if l.oculto_cliente_en is null then return jsonb_build_object('ok', false, 'error', 'no_esta_borrada'); end if;
  if upper(coalesce(l.status, '')) in ('NEW', 'MATCHED') and l.event_date is not null and l.event_date < current_date then
    return jsonb_build_object('ok', false, 'error', 'no_recuperable');
  end if;
  update public.leads
     set oculto_cliente_en = null,
         cancelada_en = case when upper(coalesce(status, '')) = 'CANCELLED' then now() else cancelada_en end
   where id = p_lead;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.cliente_recuperar_orden_borrada(uuid) from public, anon;
grant execute on function public.cliente_recuperar_orden_borrada(uuid) to authenticated;
