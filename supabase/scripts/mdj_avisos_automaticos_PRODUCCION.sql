-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENTORNO: ***  P R O D U C C I O N  ***                                  ║
-- ║  Proyecto Supabase: hkuvuqupbxwkiykxvqdr                                 ║
-- ║  VERIFICAR el ref en la URL antes de ejecutar.                           ║
-- ║                                                                          ║
-- ║  QUE CREA: el buzon de salida de avisos y el disparador que lo llena      ║
-- ║  cuando una orden cambia de estado. Idempotente.                         ║
-- ║                                                                          ║
-- ║  ⚠ TOCA UNA TABLA VIVA (event_builder_orders): le anade un trigger.      ║
-- ║  Por eso el trigger NO PUEDE FALLAR NUNCA -- ver la nota de abajo.        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 1. EL BUZON ───────────────────────────────────────────────────────────────
-- Mismo molde que elixis_sms_pending: se ENCOLA aqui y otro proceso despacha.
-- No se llama a internet desde la base: eso obligaria a guardar credenciales
-- dentro de Postgres. Asi ademas queda rastro de que se quiso mandar y cuando.
create table if not exists public.avisos_pendientes (
    id           uuid primary key default gen_random_uuid(),

    destinatario uuid not null references auth.users(id) on delete cascade,

    -- El QUE paso, no el texto. El texto lo redacta el despachador, asi se
    -- puede cambiar la redaccion o traducirla sin tocar la base.
    tipo         text not null,
    datos        jsonb not null default '{}'::jsonb,

    estado       text not null default 'pendiente'
                 check (estado in ('pendiente','enviado','sin_dispositivo','fallido')),

    creado_en    timestamptz not null default now(),
    enviado_en   timestamptz,
    intentos     int not null default 0,
    error        text
);

-- El despachador solo mira los pendientes; el indice es sobre eso.
create index if not exists avisos_pendientes_cola_idx
    on public.avisos_pendientes (estado, creado_en)
    where estado = 'pendiente';

comment on table public.avisos_pendientes is
    'Buzon de salida de avisos push. Se llena solo por trigger; lo vacia mdj-avisos-despachar.';

alter table public.avisos_pendientes enable row level security;
-- Nadie lo lee desde el navegador. Lo escribe el trigger (SECURITY DEFINER) y
-- lo vacia la funcion con service_role, que se salta RLS por diseno.
-- Sin politicas = cerrado para anon y authenticated. Es lo que se quiere.

-- ── 2. EL DISPARADOR ──────────────────────────────────────────────────────────
create or replace function public.avisos_al_cambiar_orden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_tipo text;
begin
    -- Sin cliente no hay a quien avisar (una orden puede venir de un lead sin cuenta).
    if new.user_id is null then
        return new;
    end if;

    -- Que cambio. Solo interesan los saltos que el cliente nota.
    if new.order_status is distinct from old.order_status then
        if new.order_status = 'confirmed' then
            v_tipo := 'orden_confirmada';
        elsif new.order_status = 'cancelled' then
            v_tipo := 'orden_cancelada';
        end if;
    elsif new.payment_status is distinct from old.payment_status then
        if new.payment_status = 'deposit_paid' then
            v_tipo := 'deposito_recibido';
        elsif new.payment_status = 'paid_full' then
            v_tipo := 'pago_completo';
        end if;
    end if;

    if v_tipo is null then
        return new;
    end if;

    -- ⚠ EL AVISO NUNCA PUEDE TUMBAR LA ORDEN.
    -- Si esto fallara sin proteger, un error al encolar haria caer el UPDATE
    -- entero y el cliente no podria confirmar su evento. Un aviso perdido es
    -- molesto; una reserva que no se guarda es perder al cliente.
    begin
        insert into public.avisos_pendientes (destinatario, tipo, datos)
        values (
            new.user_id,
            v_tipo,
            jsonb_build_object(
                'orden',  new.draft_id,
                'evento', coalesce(new.event_name, ''),
                'fecha',  new.event_date,
                'total',  new.total_usd
            )
        );
    exception when others then
        raise warning '[avisos] no se pudo encolar (%): %', v_tipo, sqlerrm;
    end;

    return new;
end;
$$;

revoke execute on function public.avisos_al_cambiar_orden() from public, anon, authenticated;

drop trigger if exists avisos_orden_trg on public.event_builder_orders;
create trigger avisos_orden_trg
    after update on public.event_builder_orders
    for each row execute function public.avisos_al_cambiar_orden();

-- ── 3. COMPROBACION (solo lectura, para correr despues) ───────────────────────
-- select tipo, estado, count(*) from public.avisos_pendientes group by 1,2;
