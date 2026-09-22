-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Política de reembolso en las cancelaciones de CLIENTES (regla del PO, 2026-09-21). El reloj cuenta desde el PRIMER PAGO:
--   · dentro de 24 h del pago      → se puede cancelar y reembolsar lo pagado MENOS la comisión de Stripe (gasto de transferencia)
--   · entre 24 h y 7 días          → decide el staff caso por caso
--   · más de 7 días desde el pago  → sin reembolso: queda como gasto ejecutivo y se negocia con el board
-- El sistema SOLO sugiere y registra la decisión. NO mueve dinero: el reembolso se hace a mano en el panel de Stripe.
-- Comisión de Stripe = ESTIMADO (2.9 % + $0.30 por pago; el monto exacto está en Stripe).

-- ═════════ 1. Fecha del primer pago en leads (no existía; sin ella no hay reloj) ═════════
alter table public.leads add column if not exists primer_pago_en timestamptz;

create or replace function public.leads_registrar_primer_pago()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    new.primer_pago_en := case when coalesce(new.balance_paid, 0) > 0 then now() else null end;
  else
    new.primer_pago_en := old.primer_pago_en;                      -- inmutable: ni cliente ni DJ la tocan
    if old.primer_pago_en is null and coalesce(old.balance_paid, 0) = 0 and coalesce(new.balance_paid, 0) > 0 then
      new.primer_pago_en := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_leads_z_primer_pago on public.leads;   -- «z»: corre DESPUÉS de leads_proteger_columnas_de_dinero
create trigger trg_leads_z_primer_pago before insert or update on public.leads
  for each row execute function public.leads_registrar_primer_pago();

-- ═════════ 2. Columnas en la solicitud (foto del momento en que se pide) + decisión del staff ═════════
alter table public.cancelaciones_solicitadas
  add column if not exists pagado_usd              numeric,
  add column if not exists horas_desde_pago        numeric,
  add column if not exists politica_sugerida       text,
  add column if not exists reembolso_sugerido_usd  numeric,
  add column if not exists stripe_fee_estimado_usd numeric,
  add column if not exists politica_texto          text,
  add column if not exists tratamiento_pago        text,
  add column if not exists reembolso_usd           numeric;
alter table public.cancelaciones_solicitadas drop constraint if exists cancelaciones_tratamiento_chk;
alter table public.cancelaciones_solicitadas add constraint cancelaciones_tratamiento_chk
  check (tratamiento_pago is null or tratamiento_pago in ('reembolso_menos_stripe', 'reembolso_parcial', 'sin_reembolso_gasto_ejecutivo', 'negociar_board'));

-- ═════════ 3. Cálculo de la sugerencia ═════════
create or replace function public._politica_reembolso(p_lead uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare l record; paid numeric; horas numeric; fee numeric; n int; pol text; sug numeric; txt text; cuando text;
begin
  select balance_paid, primer_pago_en, deposit_required_usd into l from public.leads where id = p_lead;
  paid := coalesce(l.balance_paid, 0);
  if paid <= 0 then
    return jsonb_build_object('pagado', 0, 'politica', 'sin_pago', 'texto', 'Sin pagos registrados: no hay nada que reembolsar.');
  end if;
  n := case when l.deposit_required_usd is not null and paid > l.deposit_required_usd + 0.01 then 2 else 1 end;
  fee := least(paid, round(paid * 0.029 + 0.30 * n, 2));
  if l.primer_pago_en is null then
    return jsonb_build_object('pagado', paid, 'politica', 'decision_staff', 'fee', fee,
      'texto', 'Pagó $' || to_char(paid, 'FM999990.00') || ' (sin fecha de pago registrada): decide el staff.');
  end if;
  horas := round((extract(epoch from now() - l.primer_pago_en) / 3600)::numeric, 1);
  cuando := case when horas < 48 then horas::text || ' h' else round(horas / 24)::text || ' días' end;
  if horas <= 24 then
    pol := 'reembolso_menos_stripe'; sug := greatest(paid - fee, 0);
    txt := 'Pagó $' || to_char(paid, 'FM999990.00') || ' hace ' || cuando || ' (dentro de 24 h): se puede cancelar y reembolsar ~$'
           || to_char(sug, 'FM999990.00') || ' (lo pagado menos ~$' || to_char(fee, 'FM999990.00') || ' de comisión de Stripe).';
  elsif horas > 168 then
    pol := 'sin_reembolso_gasto_ejecutivo'; sug := 0;
    txt := 'Pagó $' || to_char(paid, 'FM999990.00') || ' hace ' || cuando || ' (más de una semana): sin reembolso; queda como gasto ejecutivo y se negocia con el board.';
  else
    pol := 'decision_staff'; sug := null;
    txt := 'Pagó $' || to_char(paid, 'FM999990.00') || ' hace ' || cuando || ' (entre 24 h y una semana): decide el staff.';
  end if;
  return jsonb_build_object('pagado', paid, 'horas', horas, 'politica', pol, 'sugerido', sug, 'fee', fee, 'texto', txt);
end $$;
revoke execute on function public._politica_reembolso(uuid) from public, anon, authenticated;

-- ═════════ 4. Pedir la cancelación: ahora guarda la foto de la política y la incluye en la alerta al staff ═════════
create or replace function public.solicitar_cancelacion(p_lead uuid, p_residency uuid, p_fecha date, p_categoria text, p_detalle text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid(); v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_lead public.leads%rowtype; v_res public.residency_schedule%rowtype;
  v_prof public.dj_profiles%rowtype; v_rol text; v_nombre text; v_titulo text; v_fecha date; v_dj_efectivo uuid;
  v_critica boolean; v_id uuid; v_msg text; v_ex uuid; v_pol jsonb := null;
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
      v_pol := public._politica_reembolso(p_lead);
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
                                                motivo_categoria, motivo_detalle, critica,
                                                pagado_usd, horas_desde_pago, politica_sugerida, reembolso_sugerido_usd, stripe_fee_estimado_usd, politica_texto)
  values (v_uid, v_rol, v_nombre, p_lead, p_residency, v_fecha, v_titulo, p_categoria, btrim(p_detalle), v_critica,
          (v_pol ->> 'pagado')::numeric, (v_pol ->> 'horas')::numeric, v_pol ->> 'politica', (v_pol ->> 'sugerido')::numeric, (v_pol ->> 'fee')::numeric, v_pol ->> 'texto')
  returning id into v_id;

  v_msg := coalesce(v_nombre, 'Alguien') || ' (' || case v_rol when 'dj' then 'DJ/artista' else 'cliente' end || ') pide cancelar '
           || v_titulo || case when v_fecha is not null then ' del ' || to_char(v_fecha, 'DD/MM/YYYY') else '' end
           || '. Motivo: ' || btrim(p_detalle) || case when v_critica then ' — FALTAN 3 DÍAS O MENOS.' else '' end
           || coalesce(' PAGO: ' || (v_pol ->> 'texto'), '');
  perform public._cancelacion_avisar_staff(case when v_critica then '🚨 URGENTE CRÍTICA: cancelación' else '🚨 URGENTE: cancelación' end, v_msg,
    jsonb_build_object('cancelacion_id', v_id, 'lead_id', p_lead, 'critica', v_critica));
  -- Al solicitante NO se le promete reembolso: eso lo decide el staff.
  perform public._cancelacion_avisar_solicitante(v_uid, v_rol, 'cancelacion_recibida', 'Recibimos tu solicitud de cancelación',
    'El equipo la está revisando: ' || v_titulo || '. Hasta que te confirmemos, el evento sigue en pie.', jsonb_build_object('cancelacion_id', v_id));
  return jsonb_build_object('ok', true, 'id', v_id, 'critica', v_critica, 'politica', v_pol);
end $$;
revoke execute on function public.solicitar_cancelacion(uuid, uuid, date, text, text) from public, anon;
grant execute on function public.solicitar_cancelacion(uuid, uuid, date, text, text) to authenticated;

-- ═════════ 5. El staff atiende: al aprobar una cancelación de cliente CON pago debe registrar el tratamiento del dinero ═════════
drop function if exists public.staff_atender_cancelacion(uuid, text, text);
create or replace function public.staff_atender_cancelacion(p_id uuid, p_accion text, p_nota text default null, p_tratamiento text default null, p_reembolso_usd numeric default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid(); c public.cancelaciones_solicitadas%rowtype; v_resultado text := ''; v_extra text := '';
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
    if c.solicitante_rol = 'cliente' and coalesce(c.pagado_usd, 0) > 0 then
      if p_tratamiento is null then
        return jsonb_build_object('ok', false, 'error', 'tratamiento_obligatorio', 'detalle', 'Esta orden tiene pagos: indica qué pasa con el dinero.', 'sugerencia', c.politica_texto);
      end if;
      if p_tratamiento not in ('reembolso_menos_stripe', 'reembolso_parcial', 'sin_reembolso_gasto_ejecutivo', 'negociar_board') then
        return jsonb_build_object('ok', false, 'error', 'tratamiento_invalido');
      end if;
      if p_tratamiento in ('reembolso_menos_stripe', 'reembolso_parcial') and (coalesce(p_reembolso_usd, 0) <= 0 or p_reembolso_usd > c.pagado_usd) then
        return jsonb_build_object('ok', false, 'error', 'monto_reembolso_invalido', 'detalle', 'El reembolso debe ser mayor que 0 y no pasar de lo pagado ($' || c.pagado_usd || ').');
      end if;
      v_extra := ' El equipo te confirmará los detalles del pago.';
    end if;
    if c.lead_id is not null then
      if c.solicitante_rol = 'dj' then
        update public.leads set assigned_dj_id = null, assigned_dj_name = null where id = c.lead_id;
        v_resultado := 'El DJ quedó fuera del evento; el evento sigue y necesita otro DJ.';
      else
        update public.leads set status = 'CANCELLED' where id = c.lead_id;
        begin update public.event_builder_orders set order_status = 'cancelled' where lead_id = c.lead_id; exception when others then null; end;
        v_resultado := 'Evento cancelado.' || case when p_tratamiento is not null then ' Pago: ' || p_tratamiento
                         || coalesce(' $' || p_reembolso_usd, '') || ' (el reembolso se hace a mano en Stripe).' else '' end;
      end if;
    else
      v_resultado := 'Turno de residencia: ajustar/reasignar la noche a mano.';
    end if;
    update public.cancelaciones_solicitadas set estado = 'resuelta', atendido_por = coalesce(atendido_por, v_uid), atendido_en = coalesce(atendido_en, now()),
           resuelta_en = now(), nota_staff = nullif(btrim(coalesce(p_nota, '')), ''),
           tratamiento_pago = p_tratamiento, reembolso_usd = case when p_tratamiento in ('reembolso_menos_stripe', 'reembolso_parcial') then p_reembolso_usd end
     where id = p_id;
    perform public._cancelacion_avisar_solicitante(c.solicitante_user_id, c.solicitante_rol, 'cancelacion_resuelta', 'Tu solicitud de cancelación fue aprobada',
      c.evento_titulo || ': ya quedó cancelado por tu parte.' || coalesce(' ' || nullif(btrim(coalesce(p_nota, '')), ''), '') || v_extra, jsonb_build_object('cancelacion_id', p_id));
    return jsonb_build_object('ok', true, 'estado', 'resuelta', 'resultado', v_resultado);
  end if;
  return jsonb_build_object('ok', false, 'error', 'accion_invalida');
end $$;
revoke execute on function public.staff_atender_cancelacion(uuid, text, text, text, numeric) from public, anon;
grant execute on function public.staff_atender_cancelacion(uuid, text, text, text, numeric) to authenticated;
