-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - HAUNTING HOUSE: tarifa del local = $600 por sesion (5 sesiones)
-- Dato del PO (2026-10-05): "hountong house en el tropical park seria 600 por cada secion".
-- Solo escribe tarifa_venue_cents. Ningun disparador reacciona a esa columna (trg_elixis_evento_pago_cash_flow escucha
-- user_id/tipo/estado/pago_dj_cents/fecha_inicio/es_confidencial_staff) y solo get_business_* y los RPC de agenda la leen.
-- Idempotente: volver a correrlo no cambia nada.
update public.elixis_agenda_eventos
   set tarifa_venue_cents = 60000
 where id in (
         '36ae40ab-c150-435a-965e-2124b6a6800c',  -- 24-sep  semana 1 de 5
         'c5f72215-3ca8-4fef-94d0-ddd78abff87e',  --  1-oct  semana 2 de 5
         '6f35e3a4-9716-4fa2-9f43-630a68efc4fc',  --  8-oct  semana 3 de 5
         '49b2a082-5a3e-44ab-950d-0fdab99cfa63',  -- 15-oct  semana 4 de 5
         '126714c4-6dc4-4e22-a7f8-d483f7dcfd7a')  -- 22-oct  semana 5 de 5
   and venue_nombre = 'Haunting House'
   and estado = 'activo'
   and tarifa_venue_cents is distinct from 60000;

-- Comprobacion: debe dar  5 / 300000 / 0
select count(*) filter (where tarifa_venue_cents = 60000) as sesiones_con_600,
       coalesce(sum(tarifa_venue_cents), 0) as total_centavos,
       count(*) filter (where tarifa_venue_cents is null) as sesiones_sin_tarifa
  from public.elixis_agenda_eventos
 where venue_nombre = 'Haunting House' and estado = 'activo';
