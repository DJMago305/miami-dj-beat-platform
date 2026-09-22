-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Recordatorios al DJ: 24 h y 2 h antes de cada evento/turno de su agenda (artist_agenda: asignaciones y residencias).
-- Reusa la tubería del cableado: _dj_notificar() -> bandeja (dj_notifications) + cola de push (avisos_pendientes).
-- Una tabla de control evita repetir: un recordatorio por (fila de agenda, ventana, hora de inicio). Si el evento se mueve,
-- la hora nueva cuenta como evento distinto y vuelve a recordar.
create table if not exists public.dj_recordatorios_enviados (
  agenda_id  uuid not null,
  ventana    text not null check (ventana in ('24h', '2h')),
  starts_at  timestamptz not null,
  enviado_en timestamptz not null default now(),
  primary key (agenda_id, ventana, starts_at)
);
alter table public.dj_recordatorios_enviados enable row level security;  -- sin políticas: solo servidor

create or replace function public.dj_recordatorios_generar()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare x record; v text; n24 int := 0; n2 int := 0; v_hora text; v_msg text;
begin
  for x in
    select a.id, a.dj_user_id, a.title, a.starts_at,
           case when a.starts_at > now() + interval '23 hours' and a.starts_at <= now() + interval '24 hours' then '24h'
                when a.starts_at > now() + interval '1 hour'   and a.starts_at <= now() + interval '2 hours'  then '2h' end as ventana
      from public.artist_agenda a
     where a.source in ('assignment', 'residency')
       and a.starts_at > now() + interval '1 hour' and a.starts_at <= now() + interval '24 hours'
  loop
    continue when x.ventana is null;
    begin
      insert into public.dj_recordatorios_enviados (agenda_id, ventana, starts_at) values (x.id, x.ventana, x.starts_at);
    exception when unique_violation then continue;
    end;
    v_hora := to_char(x.starts_at at time zone 'America/New_York', 'HH12:MI AM');
    if x.ventana = '24h' then
      v_msg := x.title || ' — mañana a las ' || v_hora || ' (' || to_char(x.starts_at at time zone 'America/New_York', 'DD/MM') || ').';
      n24 := n24 + 1;
    else
      v_msg := x.title || ' — en 2 horas, a las ' || v_hora || '.';
      n2 := n2 + 1;
    end if;
    perform public._dj_notificar(x.dj_user_id,
      case x.ventana when '24h' then 'evento_recordatorio_24h' else 'evento_recordatorio_2h' end,
      case x.ventana when '24h' then 'Recordatorio: evento mañana' else 'Recordatorio: tu evento es en 2 horas' end,
      v_msg, jsonb_build_object('agenda_id', x.id, 'ventana', x.ventana));
  end loop;
  return jsonb_build_object('recordatorios_24h', n24, 'recordatorios_2h', n2);
exception when others then
  raise warning 'DJ_RECORDATORIOS_ERROR %', sqlerrm;
  return jsonb_build_object('error', sqlerrm);
end $$;
revoke execute on function public.dj_recordatorios_generar() from public, anon, authenticated;

select cron.schedule('dj_recordatorios_24h_2h', '*/10 * * * *', $c$select public.dj_recordatorios_generar()$c$);
