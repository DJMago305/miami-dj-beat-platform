-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Extensión de R15 sobre la tabla R14 (public.libro_incidentes), a pedido del PO
-- 2026-09-22 tras probar la v1: el campo "Incidente" pasa de botón fijo a barra
-- inteligente con categorías (como el selector de Evento), permite reportar
-- varios incidentes en un mismo envío, se agrega un resumen del evento
-- (asistencia + ventas) y una nota adicional -- todo opcional, nada obligatorio.
-- REGLA DE DISEÑO QUE NO CAMBIA: sigue siendo insert-only. Esta migración NO
-- agrega ningún UPDATE/DELETE en ningún camino -- cada "campo nuevo" que hacía
-- falta adjuntar a una fila ya insertada se resolvió incluyéndolo en el propio
-- INSERT, nunca corrigiéndolo después.

alter table public.libro_incidentes
  add column if not exists subtipo          text,
  add column if not exists asistencia       text,
  add column if not exists ventas           text,
  add column if not exists nota_adicional   text,
  add column if not exists grupo_reporte    uuid,
  add column if not exists reportado_por_rol text not null default 'dj',
  add column if not exists evento_manual_nombre text,
  add column if not exists evento_manual_fecha  date;

-- La descripción deja de ser obligatoria: ahora una fila puede llevar solo
-- asistencia/ventas/nota_adicional, o solo un subtipo de incidente, sin texto libre.
alter table public.libro_incidentes alter column descripcion drop not null;
alter table public.libro_incidentes drop constraint if exists libro_incidentes_descripcion_check;

alter table public.libro_incidentes drop constraint if exists libro_incidentes_tipo_check;
alter table public.libro_incidentes add constraint libro_incidentes_tipo_check
  check (tipo in ('incidente', 'facturacion', 'resumen_evento'));

alter table public.libro_incidentes add constraint libro_incidentes_subtipo_check
  check (subtipo is null or subtipo in ('lluvia', 'corte_de_luz', 'sonido', 'incendio', 'otro'));

alter table public.libro_incidentes add constraint libro_incidentes_asistencia_check
  check (asistencia is null or asistencia in ('baja', 'media', 'full'));

alter table public.libro_incidentes add constraint libro_incidentes_ventas_check
  check (ventas is null or ventas in ('bajo', 'medio', 'alto'));

alter table public.libro_incidentes add constraint libro_incidentes_rol_check
  check (reportado_por_rol in ('dj', 'staff'));

-- Reemplaza la función de escritura (misma vía única de entrada, firma nueva):
-- un solo envío del formulario puede generar varias filas (un resumen del
-- evento + N incidentes), todas ligadas por `grupo_reporte` para que R16 las
-- muestre juntas. `ya_existia_reporte` es la única señal de posible duplicado
-- que el llamador recibe -- NUNCA el contenido de lo ya guardado (el artista
-- sigue sin poder leer el libro, a propósito, ver R14/R15 original).
drop function if exists public.libro_incidentes_reportar(uuid, text, text, numeric);
drop function if exists public.libro_incidentes_reportar(uuid, text, text, jsonb, text, text, boolean, numeric);

create or replace function public.libro_incidentes_reportar(
  p_dj_event_id     uuid,
  p_asistencia      text    default null,
  p_ventas          text    default null,
  p_incidentes      jsonb   default '[]'::jsonb,   -- [{"subtipo":"lluvia"}, {"subtipo":"incendio"}]
  p_detalles        text    default null,          -- texto libre, compartido por los incidentes de este envío
  p_nota_adicional  text    default null,
  p_facturacion     boolean default false,
  p_monto_reportado numeric default null,
  p_evento_manual_nombre text default null,        -- solo si el evento no está en dj_events ("Otro")
  p_evento_manual_fecha  date default null
) returns table(incidente_id uuid, ya_existia_reporte boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_rol       text;
  v_grupo     uuid := gen_random_uuid();
  v_existia   boolean;
  v_item      jsonb;
  v_new_id    uuid;
  v_ids       uuid[] := '{}';
  v_manual_nombre text := nullif(trim(coalesce(p_evento_manual_nombre, '')), '');
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;

  if p_dj_event_id is not null and not exists (
    select 1 from public.dj_events where id = p_dj_event_id and dj_user_id = auth.uid()
  ) then
    raise exception 'ese evento no es tuyo';
  end if;

  if p_asistencia is not null and p_asistencia not in ('baja','media','full') then
    raise exception 'asistencia inválida';
  end if;
  if p_ventas is not null and p_ventas not in ('bajo','medio','alto') then
    raise exception 'ventas inválido';
  end if;

  v_rol := case when public.is_staff(auth.uid()) then 'staff' else 'dj' end;

  v_existia := p_dj_event_id is not null and exists (
    select 1 from public.libro_incidentes where dj_event_id = p_dj_event_id
  );

  -- resumen del evento: solo si viene al menos un dato para él
  if p_asistencia is not null or p_ventas is not null
     or (p_nota_adicional is not null and trim(p_nota_adicional) <> '') then
    insert into public.libro_incidentes
      (user_id, dj_event_id, tipo, descripcion, asistencia, ventas, nota_adicional, reportado_por_rol, grupo_reporte,
       evento_manual_nombre, evento_manual_fecha)
    values
      (auth.uid(), p_dj_event_id, 'resumen_evento', nullif(trim(coalesce(p_detalles, '')), ''),
       p_asistencia, p_ventas, nullif(trim(p_nota_adicional), ''), v_rol, v_grupo,
       v_manual_nombre, p_evento_manual_fecha)
    returning libro_incidentes.id into v_new_id;
    v_ids := array_append(v_ids, v_new_id);
  end if;

  -- una fila por cada incidente marcado
  for v_item in select * from jsonb_array_elements(coalesce(p_incidentes, '[]'::jsonb))
  loop
    if (v_item->>'subtipo') is null or (v_item->>'subtipo') not in ('lluvia','corte_de_luz','sonido','incendio','otro') then
      raise exception 'tipo de incidente inválido';
    end if;
    insert into public.libro_incidentes
      (user_id, dj_event_id, tipo, subtipo, descripcion, reportado_por_rol, grupo_reporte,
       evento_manual_nombre, evento_manual_fecha)
    values
      (auth.uid(), p_dj_event_id, 'incidente', v_item->>'subtipo',
       nullif(trim(coalesce(p_detalles, '')), ''), v_rol, v_grupo,
       v_manual_nombre, p_evento_manual_fecha)
    returning libro_incidentes.id into v_new_id;
    v_ids := array_append(v_ids, v_new_id);
  end loop;

  -- facturación: mismo camino de siempre, sin cambios de comportamiento
  if p_facturacion then
    if p_detalles is null or trim(p_detalles) = '' then
      raise exception 'describe qué pasó con la facturación';
    end if;
    insert into public.libro_incidentes
      (user_id, dj_event_id, tipo, descripcion, monto_reportado, reportado_por_rol, grupo_reporte,
       evento_manual_nombre, evento_manual_fecha)
    values
      (auth.uid(), p_dj_event_id, 'facturacion', trim(p_detalles), p_monto_reportado, v_rol, v_grupo,
       v_manual_nombre, p_evento_manual_fecha)
    returning libro_incidentes.id into v_new_id;
    v_ids := array_append(v_ids, v_new_id);
  end if;

  if array_length(v_ids, 1) is null then
    raise exception 'no hay nada que reportar';
  end if;

  return query select unnest(v_ids), v_existia;
end $$;

revoke all on function public.libro_incidentes_reportar(uuid, text, text, jsonb, text, text, boolean, numeric, text, date) from public, anon;
grant execute on function public.libro_incidentes_reportar(uuid, text, text, jsonb, text, text, boolean, numeric, text, date) to authenticated;
