-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  ENTORNO: ***  P R O D U C C I O N  ***                                  ║
-- ║  Proyecto Supabase: hkuvuqupbxwkiykxvqdr                                 ║
-- ║  VERIFICAR el ref en la URL antes de ejecutar.                           ║
-- ║                                                                          ║
-- ║  QUE HACE: SOLO LEE. Ni un insert, ni un update, ni un delete.           ║
-- ║  PARA QUE: sacar el identificador (SID) que Twilio nos dio por cada SMS   ║
-- ║            que la pantalla dio por "enviado", y poder buscar ESE mensaje  ║
-- ║            en la consola de Twilio para ver si llego de verdad.           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- 1) Los ultimos SMS, con lo que sabemos de cada uno.
--    El telefono sale enmascarado: solo los ultimos 4 digitos, para poder
--    identificarlo sin dejar el numero completo en un resultado de consulta.
select
    creado_en           at time zone 'America/New_York' as pedido,
    resuelto_en         at time zone 'America/New_York' as resuelto,
    estado,
    destinatario_nombre                                 as para,
    '••••' || right(telefono, 4)                        as tel,
    twilio_sid                                          as sid_twilio,
    error                                               as motivo_del_fallo,
    left(mensaje, 60)                                   as mensaje
from public.elixis_sms_pending
order by creado_en desc
limit 25;

-- 2) Resumen: cuantos hay de cada estado.
--    Si aqui sale TODO en 'enviado' y aun asi no llega nada al telefono, el
--    problema NO esta en la plataforma: esta entre Twilio y la operadora.
select estado, count(*) as cuantos, max(creado_en) as el_ultimo
from public.elixis_sms_pending
group by estado
order by cuantos desc;

-- 3) Los que fallaron, con el motivo tal como lo dijo Twilio.
select creado_en at time zone 'America/New_York' as cuando,
       destinatario_nombre as para, error as lo_que_dijo_twilio
from public.elixis_sms_pending
where estado = 'fallido'
order by creado_en desc
limit 20;
