-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Cancelaciones con motivo obligatorio y alerta URGENTE al staff (DJ, artista y cliente). Paso 1 = base de datos.
-- · Nadie que no sea staff cancela por su cuenta: pide la cancelación con solicitar_cancelacion() (motivo obligatorio)
--   y el staff la atiende (tomar / aprobar / rechazar).
-- · Un DJ que cancela NO cancela el evento del cliente: aprobar = quitarle el evento a ESE DJ (queda sin DJ para reasignar).
--   Un cliente que cancela: aprobar = el evento pasa a CANCELLED.
-- · Turnos de residencia: se registra y se alerta; el efecto (reasignar/omitir la noche) lo hace el staff a mano.

-- ═════════ 1. Tabla ═════════
create table if not exists public.cancelaciones_solicitadas (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  solicitante_user_id uuid not null,
  solicitante_rol     text not null check (solicitante_rol in ('dj', 'cliente')),  -- los artistas comparten dj_profiles con los DJ
  solicitante_nombre  text,
  lead_id             uuid references public.leads(id) on delete set null,
  residency_id        uuid,
  fecha_evento        date,
  evento_titulo       text,
  motivo_categoria    text not null check (motivo_categoria in ('emergencia_salud', 'conflicto_agenda', 'cliente_pidio', 'pago_o_lugar', 'otro')),
  motivo_detalle      text not null check (length(btrim(motivo_detalle)) >= 10),
  critica             boolean not null default false,          -- faltan 3 días o menos
  estado              text not null default 'urgente' check (estado in ('urgente', 'en_atencion', 'resuelta', 'rechazada')),
  atendido_por        uuid,
  atendido_en         timestamptz,
  resuelta_en         timestamptz,
  nota_staff          text,
  check (lead_id is not null or residency_id is not null)
);
create index if not exists cancelaciones_estado_idx on public.cancelaciones_solicitadas (estado, critica desc, fecha_evento);
alter table public.cancelaciones_solicitadas enable row level security;
revoke all on public.cancelaciones_solicitadas from anon, authenticated;
grant select on public.cancelaciones_solicitadas to authenticated;
drop policy if exists cancelaciones_ver_propias on public.cancelaciones_solicitadas;
create policy cancelaciones_ver_propias on public.cancelaciones_solicitadas for select to authenticated using (solicitante_user_id = auth.uid());
drop policy if exists cancelaciones_ver_staff on public.cancelaciones_solicitadas;
create policy cancelaciones_ver_staff on public.cancelaciones_solicitadas for select to authenticated using (public.is_staff(auth.uid()));

-- ═════════ 2. Avisos al staff y a quien pide ═════════
create or replace function public._cancelacion_avisar_staff(p_titulo text, p_mensaje text, p_datos jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare s record;
begin
  for s in select user_id from public.dj_profiles where user_id is not null and lower(trim(coalesce(role, ''))) in ('owner', 'admin', 'manager') loop
    perform public._dj_notificar(s.user_id, 'cancelacion_urgente', p_titulo, p_mensaje, p_datos || jsonb_build_object('url', '/staff.html'));
  end loop;
end $$;
revoke execute on function public._cancelacion_avisar_staff(text, text, jsonb) from public, anon, authenticated;

-- Aviso a quien pidió (DJ: bandeja + cola; cliente: solo cola de push)
create or replace function public._cancelacion_avisar_solicitante(p_user uuid, p_rol text, p_tipo text, p_titulo text, p_mensaje text, p_datos jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_rol = 'dj' then
    perform public._dj_notificar(p_user, p_tipo, p_titulo, p_mensaje, p_datos || jsonb_build_object('url', '/dj-dashboard.html'));
  else
    begin
      insert into public.avisos_pendientes (destinatario, tipo, datos)
      values (p_user, p_tipo, p_datos || jsonb_build_object('titulo', p_titulo, 'mensaje', p_mensaje, 'url', '/client-portal.html'));
    exception when others then raise warning 'CANCELACION_AVISO_CLIENTE %', sqlerrm; end;
  end if;
end $$;
revoke execute on function public._cancelacion_avisar_solicitante(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

-- ═════════ 3. Pedir la cancelación (DJ, artista o cliente) ═════════
create or replace function public.solicitar_cancelacion(p_lead uuid, p_residency uuid, p_fecha date, p_categoria text, p_detalle text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_lead public.leads%rowtype; v_res public.residency_schedule%rowtype;
  v_prof public.dj_profiles%rowtype; v_rol text; v_nombre text; v_titulo text; v_fecha date; v_dj_efectivo uuid;
  v_critica boolean; v_id uuid; v_msg text; v_ex uuid;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  if p_categoria not in ('emergencia_salud', 'conflicto_agenda', 'cliente_pidio', 'pago_o_lugar', 'otro') then
    return jsonb_build_object('ok', false, 'error', 'motivo_invalido');
  end if;
  if length(btrim(coalesce(p_detalle, ''))) < 10 then
    return jsonb_build_object('ok', false, 'error', 'motivo_obligatorio', 'detalle', 'Explica el motivo (mínimo 10 caracteres).');
  end if;
  select * into v_prof from public.dj_profiles where user_id = v_uid limit 1;

  if p_lead is not null then
    select * into v_lead from public.leads where id = p_lead;
    if not found then return jsonb_build_object('ok', false, 'error', 'evento_no_encontrado'); end if;
    if upper(coalesce(v_lead.status, '')) in ('CANCELLED', 'COMPLETED') then
      return jsonb_build_object('ok', false, 'error', 'evento_ya_cerrado');
    end if;
    if v_prof.id is not null and v_lead.assigned_dj_id = v_prof.id then
      v_rol := 'dj'; v_nombre := coalesce(nullif(v_prof.stage_name, ''), v_prof.full_name);
    elsif (v_lead.client_user_id is not null and v_lead.client_user_id = v_uid) or (v_email <> '' and lower(btrim(coalesce(v_lead.email, ''))) = v_email) then
      v_rol := 'cliente'; v_nombre := coalesce(nullif(v_lead.contact_person, ''), v_lead.email);
    else
      return jsonb_build_object('ok', false, 'error', 'forbidden');
    end if;
    v_fecha := v_lead.event_date;
    v_titulo := coalesce(nullif(v_lead.event_type, ''), 'Evento') || coalesce(' — ' || nullif(v_lead.location, ''), '');
  else
    select * into v_res from public.residency_schedule where id = p_residency;
    if not found or p_fecha is null then return jsonb_build_object('ok', false, 'error', 'turno_no_encontrado'); end if;
    select dj_id into v_dj_efectivo from public.residency_schedule_exceptions
      where residency_id = p_residency and exception_date = p_fecha and coalesce(skip, false) = false and dj_id is not null;
    v_dj_efectivo := coalesce(v_dj_efectivo, v_res.dj_id);
    if v_prof.id is null or v_dj_efectivo is distinct from v_prof.id then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
    v_rol := 'dj'; v_nombre := coalesce(nullif(v_prof.stage_name, ''), v_prof.full_name);
    v_fecha := p_fecha; v_titulo := coalesce(v_res.venue, 'Turno') || ' — turno ' || v_res.shift;
  end if;

  select id into v_ex from public.cancelaciones_solicitadas
   where solicitante_user_id = v_uid and estado in ('urgente', 'en_atencion')
     and lead_id is not distinct from p_lead and residency_id is not distinct from p_residency and fecha_evento is not distinct from v_fecha limit 1;
  if v_ex is not null then return jsonb_build_object('ok', true, 'ya_existia', true, 'id', v_ex); end if;

  v_critica := v_fecha is not null and v_fecha - current_date <= 3;
  insert into public.cancelaciones_solicitadas (solicitante_user_id, solicitante_rol, solicitante_nombre, lead_id, residency_id, fecha_evento, evento_titulo,
                                                motivo_categoria, motivo_detalle, critica)
  values (v_uid, v_rol, v_nombre, p_lead, p_residency, v_fecha, v_titulo, p_categoria, btrim(p_detalle), v_critica)
  returning id into v_id;

  v_msg := coalesce(v_nombre, 'Alguien') || ' (' || case v_rol when 'dj' then 'DJ/artista' else 'cliente' end || ') pide cancelar '
           || v_titulo || case when v_fecha is not null then ' del ' || to_char(v_fecha, 'DD/MM/YYYY') else '' end
           || '. Motivo: ' || btrim(p_detalle) || case when v_critica then ' — FALTAN 3 DÍAS O MENOS.' else '' end;
  perform public._cancelacion_avisar_staff(case when v_critica then '🚨 URGENTE CRÍTICA: cancelación' else '🚨 URGENTE: cancelación' end, v_msg,
    jsonb_build_object('cancelacion_id', v_id, 'lead_id', p_lead, 'critica', v_critica));
  perform public._cancelacion_avisar_solicitante(v_uid, v_rol, 'cancelacion_recibida', 'Recibimos tu solicitud de cancelación',
    'El equipo la está revisando: ' || v_titulo || '. Hasta que te confirmemos, el evento sigue en pie.', jsonb_build_object('cancelacion_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id, 'critica', v_critica);
end $$;
revoke execute on function public.solicitar_cancelacion(uuid, uuid, date, text, text) from public, anon;
grant execute on function public.solicitar_cancelacion(uuid, uuid, date, text, text) to authenticated;

-- ═════════ 4. El staff la atiende ═════════
create or replace function public.staff_atender_cancelacion(p_id uuid, p_accion text, p_nota text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); c public.cancelaciones_solicitadas%rowtype; v_resultado text := '';
begin
  if v_uid is null or not public.is_staff(v_uid) then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  select * into c from public.cancelaciones_solicitadas where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_encontrada'); end if;
  if c.estado in ('resuelta', 'rechazada') then return jsonb_build_object('ok', true, 'ya_cerrada', true, 'estado', c.estado); end if;

  if p_accion = 'tomar' then
    update public.cancelaciones_solicitadas set estado = 'en_atencion', atendido_por = v_uid, atendido_en = now() where id = p_id;
    return jsonb_build_object('ok', true, 'estado', 'en_atencion');
  elsif p_accion = 'rechazar' then
    if length(btrim(coalesce(p_nota, ''))) < 5 then return jsonb_build_object('ok', false, 'error', 'nota_obligatoria'); end if;
    update public.cancelaciones_solicitadas set estado = 'rechazada', atendido_por = coalesce(atendido_por, v_uid), atendido_en = coalesce(atendido_en, now()),
           resuelta_en = now(), nota_staff = btrim(p_nota) where id = p_id;
    perform public._cancelacion_avisar_solicitante(c.solicitante_user_id, c.solicitante_rol, 'cancelacion_resuelta', 'Tu solicitud de cancelación no procede',
      c.evento_titulo || ' se mantiene. ' || btrim(p_nota), jsonb_build_object('cancelacion_id', p_id));
    return jsonb_build_object('ok', true, 'estado', 'rechazada');
  elsif p_accion = 'aprobar' then
    if c.lead_id is not null then
      if c.solicitante_rol = 'dj' then
        update public.leads set assigned_dj_id = null, assigned_dj_name = null where id = c.lead_id;
        v_resultado := 'El DJ quedó fuera del evento; el evento sigue y necesita otro DJ.';
      else
        update public.leads set status = 'CANCELLED' where id = c.lead_id;
        begin update public.event_builder_orders set order_status = 'cancelled' where lead_id = c.lead_id; exception when others then null; end;
        v_resultado := 'Evento cancelado.';
      end if;
    else
      v_resultado := 'Turno de residencia: ajustar/reasignar la noche a mano.';
    end if;
    update public.cancelaciones_solicitadas set estado = 'resuelta', atendido_por = coalesce(atendido_por, v_uid), atendido_en = coalesce(atendido_en, now()),
           resuelta_en = now(), nota_staff = nullif(btrim(coalesce(p_nota, '')), '') where id = p_id;
    perform public._cancelacion_avisar_solicitante(c.solicitante_user_id, c.solicitante_rol, 'cancelacion_resuelta', 'Tu solicitud de cancelación fue aprobada',
      c.evento_titulo || ': ya quedó cancelado por tu parte.' || coalesce(' ' || nullif(btrim(coalesce(p_nota, '')), ''), ''), jsonb_build_object('cancelacion_id', p_id));
    return jsonb_build_object('ok', true, 'estado', 'resuelta', 'resultado', v_resultado);
  end if;
  return jsonb_build_object('ok', false, 'error', 'accion_invalida');
end $$;
revoke execute on function public.staff_atender_cancelacion(uuid, text, text) from public, anon;
grant execute on function public.staff_atender_cancelacion(uuid, text, text) to authenticated;

-- ═════════ 5. Cerrar los atajos: nadie cancela ni borra por su cuenta sin pasar por aquí ═════════
-- 5a. Aviso al DJ cuando se le quita un evento SIN cancelar el evento ('desasignado'), con su propio texto.
create or replace function public._dj_asignacion_quitar(p_lead uuid, p_dj_profile uuid, p_tipo_evento text, p_fecha date, p_lugar text, p_motivo text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid; v_reasig boolean := p_motivo in ('reasignado', 'desasignado');
begin
  select user_id into v_user from public.dj_profiles where id = p_dj_profile;
  if v_user is null then return; end if;
  delete from public.artist_agenda where lead_id = p_lead and dj_user_id = v_user and source = 'assignment';
  delete from public.dj_ledger where dj_user_id = v_user and event_id = p_lead::text and status = 'pending' and coalesce(metadata->>'source','') = 'event_sale_expected';
  update public.financial_payables set status = 'VOID', updated_at = now()
   where source_type = 'LEAD' and source_id = p_lead and payee_id = p_dj_profile and purpose = 'DJ_PAYMENT' and status in ('PENDING','SCHEDULED');
  perform public._dj_notificar(v_user, case when v_reasig then 'evento_reasignado' else 'evento_cancelado' end,
    case when v_reasig then 'Ya no estás asignado a un evento' else 'Evento cancelado' end,
    coalesce(p_tipo_evento,'Evento') || case when p_fecha is not null then ' del ' || to_char(p_fecha,'DD/MM/YYYY') else '' end
      || case when nullif(p_lugar,'') is not null then ' en ' || p_lugar else '' end
      || case p_motivo when 'reasignado' then ' fue asignado a otro DJ.' when 'desasignado' then ' ya no está a tu cargo. Se quitó de tu agenda.' else ' fue cancelado. Se quitó de tu agenda.' end,
    jsonb_build_object('lead_id', p_lead, 'fecha', p_fecha, 'motivo', p_motivo));
end $$;
revoke execute on function public._dj_asignacion_quitar(uuid, uuid, text, date, text, text) from public, anon, authenticated;

do $t$
declare d text; nuevo text;
begin
  -- 5b. El trigger distingue «quitar DJ» (desasignado) de «cancelar evento» (cancelado)
  d := pg_get_functiondef('public.leads_sync_asignacion_dj()'::regprocedure);
  if position('desasignado' in d) = 0 then
    nuevo := replace(d, E'case when not v_new_activo then ''cancelado'' else ''reasignado'' end);',
      E'case when not v_new_activo then (case when new.assigned_dj_id is null and upper(coalesce(new.status, '''')) <> ''CANCELLED'' then ''desasignado'' else ''cancelado'' end) else ''reasignado'' end);');
    if nuevo = d then raise exception 'patrón desasignado no encontrado'; end if;
    execute nuevo;
  end if;
  -- 5c. Un no-staff no puede poner un evento en CANCELLED con un update directo (debe pedirlo con motivo)
  d := pg_get_functiondef('public.leads_proteger_columnas_de_dinero()'::regprocedure);
  if position('cancelacion_directa' in d) = 0 then
    nuevo := replace(d, E'      if upper(coalesce(old.status, '''')) = ''CANCELLED'' and new.status is distinct from old.status then',
      E'      if upper(coalesce(new.status, '''')) = ''CANCELLED'' and upper(coalesce(old.status, '''')) <> ''CANCELLED'' then\n        v_cambios := v_cambios || jsonb_build_object(''cancelacion_directa'', new.status);\n        new.status := old.status;\n      end if;\n      if upper(coalesce(old.status, '''')) = ''CANCELLED'' and new.status is distinct from old.status then');
    if nuevo = d then raise exception 'patrón cancelacion_directa no encontrado'; end if;
    execute nuevo;
  end if;
end $t$;

-- 5d. Un no-staff no borra órdenes con pagos NI órdenes confirmadas o con DJ asignado (debe pedir la cancelación con motivo)
create or replace function public.leads_no_borrar_pagados()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon') and not (auth.uid() is not null and public.is_staff(auth.uid())) then
    if coalesce(old.balance_paid, 0) > 0 then
      raise exception 'ORDEN_CON_PAGOS: esta orden ya tiene pagos y no se puede eliminar; pide la cancelación con motivo' using errcode = 'P0001';
    end if;
    if old.assigned_dj_id is not null or upper(coalesce(old.status, '')) in ('CONFIRMED', 'MATCHED') then
      raise exception 'ORDEN_ACTIVA: esta orden está confirmada o tiene DJ; pide la cancelación con motivo' using errcode = 'P0001';
    end if;
  end if;
  return old;
end $$;
