-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- PROBADO EN TRANSACCIÓN DESHECHA; se aplica a pedido del PO (2026-09-21: «arregla lo de DJYuyo y cablea todo»).
-- CABLEADO DE LA ASIGNACIÓN DE UN DJ (docs/auditoria-cableado-asignacion-dj.md). Todo desde el SERVIDOR: ya no depende de que alguien pulse un botón.
--   1. DJYuyo: su turno del viernes noche (Sundowner Key Largo) se liga por dj_id a su perfil (antes solo por nombre, y él no lo veía).
--   2. Rotación semanal DJYuyo/DJSolitario: base = DJYuyo; DJSolitario en los viernes alternos (25-sep, 9-oct, 23-oct, …) como excepciones.
--   3. EVENTOS (leads): al asignar / cambiar DJ / fecha / hora / lugar / pago, o cancelar / borrar el evento:
--        · agenda personal del DJ (artist_agenda, source 'assignment') → la lee su panel «Mi calendario» y ELIXIS (consultar_agenda_artista)
--        · NOTA en su bandeja (dj_notifications) y aviso en la cola push (avisos_pendientes) al asignar y al cancelar/mover/reasignar
--        · CASH FLOW: pago esperado en dj_ledger (status 'pending', metadata.source 'event_sale_expected') y cuenta por pagar en
--          financial_payables (DJ_PAYMENT / PENDING); al cancelar se anulan. staff_release_event_dj_payout CONVIERTE el pendiente en
--          'available' (sin duplicar la fila).
--   4. TURNOS (residency_schedule + excepciones): residency_sync_agenda() escribe una fila de agenda por fecha (source 'residency'),
--      respeta excepciones (reemplazo / omitir), avisa cuando algo cambia y se extiende cada día (cron). La carga inicial es silenciosa.
-- Nada de esto puede tumbar una asignación: cada bloque atrapa sus errores y deja un WARNING (LEADS_ASIGNACION_DJ_ERROR / RESIDENCY_SYNC_ERROR).

-- ═════════ 0. Infraestructura ═════════
create unique index if not exists artist_agenda_residency_clave on public.artist_agenda (agent_id) where source = 'residency';

-- Nota + aviso al DJ (bandeja dj_notifications + cola avisos_pendientes). Nunca lanza error.
create or replace function public._dj_notificar(p_user uuid, p_tipo text, p_titulo text, p_mensaje text, p_datos jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_user is null then return; end if;
  begin
    insert into public.dj_notifications (dj_user_id, title, message, type, link)
    values (p_user, p_titulo, p_mensaje, p_tipo, '/dj-dashboard.html');
  exception when others then raise warning 'DJ_NOTIFICAR bandeja: %', sqlerrm; end;
  begin
    insert into public.avisos_pendientes (destinatario, tipo, datos)
    values (p_user, p_tipo, p_datos || jsonb_build_object('titulo', p_titulo, 'mensaje', p_mensaje));
  exception when others then raise warning 'DJ_NOTIFICAR cola: %', sqlerrm; end;
end $$;
revoke execute on function public._dj_notificar(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Quita al DJ de un evento (agenda + pago esperado + cuenta por pagar) y le avisa. motivo: cancelado | reasignado | eliminado
create or replace function public._dj_asignacion_quitar(p_lead uuid, p_dj_profile uuid, p_tipo_evento text, p_fecha date, p_lugar text, p_motivo text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;
begin
  select user_id into v_user from public.dj_profiles where id = p_dj_profile;
  if v_user is null then return; end if;
  delete from public.artist_agenda where lead_id = p_lead and dj_user_id = v_user and source = 'assignment';
  delete from public.dj_ledger where dj_user_id = v_user and event_id = p_lead::text and status = 'pending' and coalesce(metadata->>'source','') = 'event_sale_expected';
  update public.financial_payables set status = 'VOID', updated_at = now()
   where source_type = 'LEAD' and source_id = p_lead and payee_id = p_dj_profile and purpose = 'DJ_PAYMENT' and status in ('PENDING','SCHEDULED');
  perform public._dj_notificar(v_user, case p_motivo when 'reasignado' then 'evento_reasignado' else 'evento_cancelado' end,
    case p_motivo when 'reasignado' then 'Ya no estás asignado a un evento' else 'Evento cancelado' end,
    coalesce(p_tipo_evento,'Evento') || case when p_fecha is not null then ' del ' || to_char(p_fecha,'DD/MM/YYYY') else '' end
      || case when nullif(p_lugar,'') is not null then ' en ' || p_lugar else '' end
      || case p_motivo when 'reasignado' then ' fue asignado a otro DJ.' else ' fue cancelado. Se quitó de tu agenda.' end,
    jsonb_build_object('lead_id', p_lead, 'fecha', p_fecha, 'motivo', p_motivo));
end $$;
revoke execute on function public._dj_asignacion_quitar(uuid, uuid, text, date, text, text) from public, anon, authenticated;

-- ═════════ 1. EVENTOS (leads) → agenda, notas, cash flow ═════════
create or replace function public.leads_sync_asignacion_dj()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_old_activo boolean := false; v_new_activo boolean; v_user uuid; v_owner uuid;
  v_st time; v_en time; v_ini timestamptz; v_fin timestamptz;
  v_pago integer; v_titulo text; v_cuerpo text; v_nuevo_dj boolean; v_movido boolean;
begin
  begin
    v_new_activo := new.assigned_dj_id is not null and new.event_date is not null and upper(coalesce(new.status,'')) <> 'CANCELLED';
    if tg_op = 'UPDATE' then
      v_old_activo := old.assigned_dj_id is not null and old.event_date is not null and upper(coalesce(old.status,'')) <> 'CANCELLED';
      if v_old_activo and (not v_new_activo or new.assigned_dj_id is distinct from old.assigned_dj_id) then
        perform public._dj_asignacion_quitar(old.id, old.assigned_dj_id, old.event_type, old.event_date, old.location,
          case when not v_new_activo then 'cancelado' else 'reasignado' end);
      end if;
    end if;

    if v_new_activo then
      select user_id into v_user from public.dj_profiles where id = new.assigned_dj_id;
      if v_user is null then
        raise warning 'LEADS_ASIGNACION_DJ_ERROR lead=% el perfil del DJ no tiene cuenta (user_id)', new.id;
        return new;
      end if;
      v_owner := coalesce((select user_id from public.dj_profiles where lower(trim(role)) = 'owner' limit 1), v_user);
      v_st := coalesce(nullif(new.event_start_time::text,'')::time, time '18:00');
      v_ini := (new.event_date + v_st)::timestamp at time zone 'America/New_York';
      if nullif(new.event_end_time::text,'') is not null then
        v_en := new.event_end_time::time;
        v_fin := ((new.event_date + v_en)::timestamp at time zone 'America/New_York') + case when v_en <= v_st then interval '1 day' else interval '0' end;
      else
        v_fin := v_ini + interval '5 hours';
      end if;
      v_pago := greatest(0, round(coalesce(new.dj_agreed_payout_usd, 0) * 100)::integer);
      v_titulo := coalesce(nullif(new.event_type,''), 'Evento') || coalesce(' — ' || nullif(new.location,''), '');
      v_cuerpo := 'Evento asignado' || case when nullif(new.event_start_time::text,'') is null then ' (horario por confirmar)' else '' end
        || case when v_pago > 0 then '. Pago acordado: $' || to_char(v_pago / 100.0, 'FM999990.00') else '' end;

      insert into public.artist_agenda (dj_user_id, staff_user_id, starts_at, ends_at, title, body, lead_id, source, agent_id)
      values (v_user, v_owner, v_ini, v_fin, v_titulo, v_cuerpo, new.id, 'assignment', 'leads_sync_asignacion_dj')
      on conflict (lead_id, dj_user_id) where lead_id is not null and source = 'assignment'
      do update set starts_at = excluded.starts_at, ends_at = excluded.ends_at, title = excluded.title, body = excluded.body;

      -- CASH FLOW: pago esperado (artista) + cuenta por pagar (staff)
      if v_pago > 0 and not exists (select 1 from public.dj_ledger where dj_user_id = v_user and event_id = new.id::text and type = 'income' and coalesce(metadata->>'source','') = 'event_sale_release') then
        update public.dj_ledger set amount_cents = v_pago
         where dj_user_id = v_user and event_id = new.id::text and status = 'pending' and coalesce(metadata->>'source','') = 'event_sale_expected';
        if not found then
          insert into public.dj_ledger (dj_user_id, type, amount_cents, status, event_id, metadata)
          values (v_user, 'income', v_pago, 'pending', new.id::text,
                  jsonb_build_object('source','event_sale_expected','lead_id', new.id,'evento', v_titulo,'fecha', new.event_date));
        end if;
        update public.financial_payables set amount_cents = v_pago, due_date = new.event_date, updated_at = now()
         where source_type = 'LEAD' and source_id = new.id and payee_id = new.assigned_dj_id and purpose = 'DJ_PAYMENT' and status in ('PENDING','SCHEDULED');
        if not found and not exists (select 1 from public.financial_payables where source_type='LEAD' and source_id = new.id and payee_id = new.assigned_dj_id and purpose='DJ_PAYMENT') then
          insert into public.financial_payables (source_type, source_id, payee_type, payee_id, purpose, amount_cents, currency, status, due_date)
          values ('LEAD', new.id, 'DJ_PROFILE', new.assigned_dj_id, 'DJ_PAYMENT', v_pago, 'USD', 'PENDING', new.event_date);
        end if;
      end if;

      -- NOTA al DJ: al asignarlo, o si se movió el evento
      v_nuevo_dj := tg_op = 'INSERT' or not v_old_activo or new.assigned_dj_id is distinct from old.assigned_dj_id;
      v_movido := tg_op = 'UPDATE' and v_old_activo and not v_nuevo_dj and (
           new.event_date is distinct from old.event_date or new.event_start_time is distinct from old.event_start_time
        or new.event_end_time is distinct from old.event_end_time or new.location is distinct from old.location);
      if v_nuevo_dj then
        perform public._dj_notificar(v_user, 'evento_asignado', 'Nuevo evento asignado',
          v_titulo || ' el ' || to_char(new.event_date,'DD/MM/YYYY') || coalesce(' a las ' || to_char(v_st,'HH12:MI AM'), '')
            || case when v_pago > 0 then '. Pago acordado: $' || to_char(v_pago / 100.0,'FM999990.00') else '' end,
          jsonb_build_object('lead_id', new.id, 'fecha', new.event_date, 'lugar', new.location));
      elsif v_movido then
        perform public._dj_notificar(v_user, 'evento_movido', 'Tu evento cambió',
          v_titulo || ' ahora es el ' || to_char(new.event_date,'DD/MM/YYYY') || coalesce(' a las ' || to_char(v_st,'HH12:MI AM'), ''),
          jsonb_build_object('lead_id', new.id, 'fecha', new.event_date, 'lugar', new.location));
      end if;
    end if;
  exception when others then
    raise warning 'LEADS_ASIGNACION_DJ_ERROR lead=% %', new.id, sqlerrm;
  end;
  return new;
end $$;
revoke execute on function public.leads_sync_asignacion_dj() from public, anon, authenticated;

drop trigger if exists trg_leads_sync_asignacion_dj on public.leads;
create trigger trg_leads_sync_asignacion_dj
  after insert or update of assigned_dj_id, event_date, event_start_time, event_end_time, status, location, event_type, dj_agreed_payout_usd on public.leads
  for each row execute function public.leads_sync_asignacion_dj();

-- Si se BORRA el evento (p. ej. el botón «Delete» del portal): limpiar y avisar
create or replace function public.leads_borrado_asignacion_dj()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin
    if old.assigned_dj_id is not null and upper(coalesce(old.status,'')) <> 'CANCELLED' then
      perform public._dj_asignacion_quitar(old.id, old.assigned_dj_id, old.event_type, old.event_date, old.location, 'eliminado');
    end if;
  exception when others then raise warning 'LEADS_ASIGNACION_DJ_ERROR (borrado) lead=% %', old.id, sqlerrm; end;
  return old;
end $$;
revoke execute on function public.leads_borrado_asignacion_dj() from public, anon, authenticated;
drop trigger if exists trg_leads_borrado_asignacion_dj on public.leads;
create trigger trg_leads_borrado_asignacion_dj before delete on public.leads for each row execute function public.leads_borrado_asignacion_dj();

-- Al liberar el pago del DJ: el pendiente pasa a 'available' (no se duplica la fila)
do $$
declare d text; nuevo text;
begin
  d := pg_get_functiondef('public.staff_release_event_dj_payout(uuid)'::regprocedure);
  if position('event_sale_expected' in d) > 0 then return; end if;   -- ya cableado
  nuevo := regexp_replace(d,
    '(INSERT INTO public\.dj_ledger \(dj_user_id, type, amount_cents, status, event_id, metadata\)\s+VALUES \(.*?\n    \)\n  \);)',
    E'UPDATE public.dj_ledger SET status = ''available'', amount_cents = v_payout_cents,\n         metadata = metadata || jsonb_build_object(''source'', ''event_sale_release'', ''lead_id'', p_lead_id, ''released_by'', v_uid, ''staff_invoice_id'', v_lead.staff_invoice_id)\n   WHERE dj_user_id = v_dj_user AND event_id = p_lead_id::text AND type = ''income'' AND status = ''pending'' AND coalesce(metadata->>''source'', '''') = ''event_sale_expected'';\n  IF NOT FOUND THEN\n  \\1\n  END IF;', 's');
  if nuevo = d then raise exception 'no se pudo cablear staff_release_event_dj_payout (patrón no encontrado)'; end if;
  execute nuevo;
end $$;

-- ═════════ 2. TURNOS (residency_schedule) → agenda por fecha ═════════
create or replace function public.residency_sync_agenda(p_dias int default 60, p_residency uuid default null, p_notificar boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record; e record; x record; d date; v_hay boolean; v_dj uuid; v_user uuid; v_owner uuid; v_clave text;
  v_ini timestamptz; v_fin timestamptz; v_titulo text; v_cuerpo text; v_deseadas text[]; v_ins int := 0; v_upd int := 0; v_del int := 0;
  v_pago numeric;
begin
  v_owner := (select user_id from public.dj_profiles where lower(trim(role)) = 'owner' limit 1);
  for r in select * from public.residency_schedule where active and (p_residency is null or id = p_residency) loop
    v_deseadas := '{}';
    for d in select g::date from generate_series(current_date, current_date + p_dias, interval '1 day') g loop
      continue when extract(dow from d)::int <> r.day_of_week;
      continue when r.start_date is not null and d < r.start_date;
      continue when r.end_date is not null and d > r.end_date;
      select * into e from public.residency_schedule_exceptions where residency_id = r.id and exception_date = d;
      v_hay := found;
      continue when v_hay and e.skip;
      if v_hay and (e.dj_id is not null or nullif(e.dj_name,'') is not null) then
        v_dj := coalesce(e.dj_id, (select id from public.dj_profiles where lower(stage_name) = lower(e.dj_name) limit 1));
      else
        v_dj := coalesce(r.dj_id, (select id from public.dj_profiles where lower(stage_name) = lower(r.dj_name) limit 1));
      end if;
      select user_id into v_user from public.dj_profiles where id = v_dj;
      continue when v_user is null;
      v_clave := 'residency:' || r.id || ':' || d;
      v_deseadas := v_deseadas || v_clave;
      v_ini := (d + r.start_time)::timestamp at time zone 'America/New_York';
      v_fin := ((d + r.end_time)::timestamp at time zone 'America/New_York') + case when r.end_time <= r.start_time then interval '1 day' else interval '0' end;
      v_titulo := coalesce(r.venue, 'Turno') || ' — turno ' || r.shift;
      v_pago := r.dj_pay_usd;
      v_cuerpo := 'Turno asignado' || coalesce(' · ' || nullif(r.series_name,''), '')
        || case when coalesce(v_pago,0) > 0 then '. Pago acordado: $' || to_char(v_pago,'FM999990.00') else '' end;

      select * into x from public.artist_agenda where source = 'residency' and agent_id = v_clave;
      if not found then
        insert into public.artist_agenda (dj_user_id, staff_user_id, starts_at, ends_at, title, body, source, agent_id)
        values (v_user, coalesce(v_owner, v_user), v_ini, v_fin, v_titulo, v_cuerpo, 'residency', v_clave);
        v_ins := v_ins + 1;
        if p_notificar then
          perform public._dj_notificar(v_user, 'evento_asignado', 'Turno asignado',
            v_titulo || ' el ' || to_char(d,'DD/MM/YYYY') || ' de ' || to_char(r.start_time,'HH12:MI AM') || ' a ' || to_char(r.end_time,'HH12:MI AM')
              || case when coalesce(v_pago,0) > 0 then '. Pago acordado: $' || to_char(v_pago,'FM999990.00') else '' end,
            jsonb_build_object('residency_id', r.id, 'fecha', d));
        end if;
      elsif x.dj_user_id is distinct from v_user then
        delete from public.artist_agenda where id = x.id;
        if p_notificar then
          perform public._dj_notificar(x.dj_user_id, 'evento_reasignado', 'Ya no tienes este turno',
            v_titulo || ' del ' || to_char(d,'DD/MM/YYYY') || ' pasó a otro DJ.', jsonb_build_object('residency_id', r.id, 'fecha', d));
        end if;
        insert into public.artist_agenda (dj_user_id, staff_user_id, starts_at, ends_at, title, body, source, agent_id)
        values (v_user, coalesce(v_owner, v_user), v_ini, v_fin, v_titulo, v_cuerpo, 'residency', v_clave);
        v_upd := v_upd + 1;
        if p_notificar then
          perform public._dj_notificar(v_user, 'evento_asignado', 'Turno asignado',
            v_titulo || ' el ' || to_char(d,'DD/MM/YYYY') || ' de ' || to_char(r.start_time,'HH12:MI AM') || ' a ' || to_char(r.end_time,'HH12:MI AM')
              || case when coalesce(v_pago,0) > 0 then '. Pago acordado: $' || to_char(v_pago,'FM999990.00') else '' end,
            jsonb_build_object('residency_id', r.id, 'fecha', d));
        end if;
      elsif x.starts_at is distinct from v_ini or x.ends_at is distinct from v_fin or x.title is distinct from v_titulo or x.body is distinct from v_cuerpo then
        update public.artist_agenda set starts_at = v_ini, ends_at = v_fin, title = v_titulo, body = v_cuerpo where id = x.id;
        v_upd := v_upd + 1;
        if p_notificar and (x.starts_at is distinct from v_ini or x.ends_at is distinct from v_fin) then
          perform public._dj_notificar(v_user, 'evento_movido', 'Tu turno cambió',
            v_titulo || ' ahora es el ' || to_char(d,'DD/MM/YYYY') || ' de ' || to_char(r.start_time,'HH12:MI AM') || ' a ' || to_char(r.end_time,'HH12:MI AM'),
            jsonb_build_object('residency_id', r.id, 'fecha', d));
        end if;
      end if;
    end loop;
    -- fechas que ya no corresponden (omitidas, cambio de turno, regla desactivada…) dentro de la ventana
    for x in select * from public.artist_agenda
              where source = 'residency' and agent_id like 'residency:' || r.id || ':%'
                and starts_at >= now() and starts_at <= (current_date + p_dias + 1)
                and not (agent_id = any (v_deseadas)) loop
      delete from public.artist_agenda where id = x.id;
      v_del := v_del + 1;
      if p_notificar then
        perform public._dj_notificar(x.dj_user_id, 'evento_cancelado', 'Turno cancelado',
          x.title || ' del ' || to_char(x.starts_at at time zone 'America/New_York','DD/MM/YYYY') || ' fue cancelado. Se quitó de tu agenda.',
          jsonb_build_object('residency_id', r.id));
      end if;
    end loop;
  end loop;
  return jsonb_build_object('nuevas', v_ins, 'cambiadas', v_upd, 'quitadas', v_del);
exception when others then
  raise warning 'RESIDENCY_SYNC_ERROR %', sqlerrm;
  return jsonb_build_object('error', sqlerrm);
end $$;
revoke execute on function public.residency_sync_agenda(int, uuid, boolean) from public, anon, authenticated;

-- Cambios en turnos o excepciones → recalcular y avisar (salvo carga silenciosa: set_config('mdj.silencio','on',true))
create or replace function public.residency_cambio_trigger()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_silencio boolean := coalesce(current_setting('mdj.silencio', true), '') = 'on';
begin
  begin
    if tg_table_name = 'residency_schedule' then
      v_id := coalesce(new.id, old.id);
      if tg_op = 'DELETE' then
        for v_id in select id from public.artist_agenda where source = 'residency' and agent_id like 'residency:' || old.id || ':%' and starts_at >= now() loop
          perform public._dj_notificar(a.dj_user_id, 'evento_cancelado', 'Turno cancelado', a.title || ' fue cancelado. Se quitó de tu agenda.', '{}'::jsonb)
            from public.artist_agenda a where a.id = v_id and not v_silencio;
          delete from public.artist_agenda where id = v_id;
        end loop;
        return null;
      end if;
    else
      v_id := coalesce(new.residency_id, old.residency_id);
    end if;
    perform public.residency_sync_agenda(60, v_id, not v_silencio);
  exception when others then raise warning 'RESIDENCY_SYNC_ERROR (trigger) %', sqlerrm; end;
  return null;
end $$;
revoke execute on function public.residency_cambio_trigger() from public, anon, authenticated;
drop trigger if exists trg_residency_schedule_sync on public.residency_schedule;
create trigger trg_residency_schedule_sync after insert or update or delete on public.residency_schedule for each row execute function public.residency_cambio_trigger();
drop trigger if exists trg_residency_exceptions_sync on public.residency_schedule_exceptions;
create trigger trg_residency_exceptions_sync after insert or update or delete on public.residency_schedule_exceptions for each row execute function public.residency_cambio_trigger();

-- ═════════ 3. DATOS: DJYuyo y la rotación con DJSolitario ═════════
do $$
declare v_yuyo uuid := '7067f607-1c8b-4013-8916-6d591e24e935'; v_sol uuid := '85b3f2a3-ad73-43f9-9d6f-4c1e3a38857d';
        v_sol_user uuid := 'b31e0e33-abfb-49a3-9cf3-076fbbc659a6'; v_regla uuid := 'ca248010-28b7-4f27-9937-4bae85b0dee2';
begin
  perform set_config('mdj.silencio', 'on', true);
  update public.residency_schedule set dj_id = v_yuyo where id = v_regla and dj_id is null;
  -- rotación: DJSolitario en los viernes alternos desde el 25-sep (DJYuyo trabajó el 18-sep y vuelve el 2-oct)
  insert into public.residency_schedule_exceptions (residency_id, exception_date, skip, dj_name, dj_id, notes)
  select v_regla, g::date, false, 'DJSolitario', v_sol, 'Rotación semanal DJYuyo/DJSolitario'
    from generate_series('2026-09-25'::date, '2026-12-31'::date, interval '14 days') g
  on conflict (residency_id, exception_date) do nothing;
  perform public.residency_sync_agenda(60, null, false);   -- carga inicial silenciosa
  -- una sola nota puntual: lo que le toca a DJSolitario este viernes
  perform public._dj_notificar(v_sol_user, 'evento_asignado', 'Te toca este viernes',
    'Sundowner Key Largo, turno noche, viernes 25/09/2026 de 05:00 PM a 11:30 PM. Pago acordado: $250. Alternas cada semana con DJYuyo.',
    jsonb_build_object('residency_id', v_regla, 'fecha', '2026-09-25'));
end $$;

-- Extender la ventana de agenda todos los días (silencioso)
select cron.schedule('residency_sync_agenda_daily', '30 6 * * *', $c$select public.residency_sync_agenda(60, null, false)$c$);
