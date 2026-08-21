-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENTORNO: ***  P R O D U C C I O N  ***                                  ║
-- ║  Proyecto Supabase: hkuvuqupbxwkiykxvqdr                                 ║
-- ║  VERIFICAR el ref en la URL antes de ejecutar.                           ║
-- ║                                                                          ║
-- ║  QUE CREA: la tabla de suscripciones a notificaciones web (Web Push).    ║
-- ║  Es la libreta de direcciones: cada fila es UN dispositivo que dijo que   ║
-- ║  si. Sin operadoras, sin coste por mensaje.                              ║
-- ║                                                                          ║
-- ║  Es idempotente: se puede correr dos veces sin romper nada.              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

create table if not exists public.push_suscripciones (
    id          uuid primary key default gen_random_uuid(),

    -- De quien es el dispositivo. Sale del JWT verificado, nunca del cuerpo.
    user_id     uuid not null references auth.users(id) on delete cascade,

    -- El buzon que nos dio el navegador. Es unico por dispositivo: si el mismo
    -- cliente entra desde el movil y desde el portatil, son DOS filas, y las
    -- dos deben recibir. Por eso la clave unica es el endpoint, no el usuario.
    endpoint    text not null unique,

    -- Las dos piezas con las que se cifra el mensaje para ESE dispositivo.
    -- Sin ellas el aviso viaja en claro, y no se permite: va el nombre del
    -- cliente y los datos de su evento.
    p256dh      text not null,
    auth        text not null,

    -- Para saber a quien avisar cuando algo se rompe en un solo tipo de equipo.
    agente      text,

    creado_en   timestamptz not null default now(),
    -- Se toca en cada envio con exito. Un buzon que lleva meses sin responder
    -- esta muerto y hay que limpiarlo.
    ultimo_ok   timestamptz,
    -- Los servidores de push responden 404/410 cuando el usuario desinstalo o
    -- revoco el permiso. Esa fila se borra: insistir es gastar y molestar.
    fallos      int not null default 0
);

create index if not exists push_suscripciones_user_idx
    on public.push_suscripciones (user_id);

comment on table public.push_suscripciones is
    'Dispositivos que aceptaron recibir avisos. Un aviso por aqui no cuesta nada y no pasa por operadoras -- ver el SMS bloqueado por error 30032.';

-- ── QUIEN VE QUE ──────────────────────────────────────────────────────────────
alter table public.push_suscripciones enable row level security;

-- Cada quien ve y borra SOLO sus propios dispositivos. Un artista no puede
-- listar los buzones de un cliente ni los de otro artista.
drop policy if exists push_suscripciones_propias on public.push_suscripciones;
create policy push_suscripciones_propias on public.push_suscripciones
    for all to authenticated
    using      (user_id = auth.uid())
    with check (user_id = auth.uid());

-- El envio lo hace la funcion con service_role, que se salta RLS por diseno.
-- No se concede lectura amplia a nadie mas: la lista de dispositivos de los
-- clientes no es dato de consulta general.
