-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - LIMPIEZA DEL NETWORK (2026-10-05): todo lo que el PO aclaro, en un solo script
-- Junta, en este orden: Cueva del Pirata -> Rio Grande; Henrry (dueno Mojitobar); Fathy Dincer (dueno Conga Bar/Lombardi's); Jose Web Side -> Proveedores;
-- Mario Valerio -> Amigo; Pikolino -> Animador y Frank -> Sonidista; Bartenders (Nelson, Maghela, Evelio); pestana Managers (25); Dailyn -> Cliente.
-- Ya corridos por el PO y por eso NO van aqui: telefono de Wendy, categoria Seguridad (+ sacarlos de Venues) y Julio Navarete.
-- Todo es idempotente (volver a correrlo no duplica ni rompe nada) y solo toca las fichas nombradas por su id. El ultimo SELECT resume las listas.

-- ═══════ 20261006_cueva_del_pirata_ahora_rio_grande.sql ═══════
-- Dato del PO (2026-10-05) y notas ya guardadas en la ficha de Rio Grande Churrascaria. Solo escribe network_referencia_contactos.empresa
-- (texto libre, mismo rotulo que ya lleva la ficha del local: conserva el nombre anterior para poder buscarlo). No toca notas, telefonos ni listas.
-- Idempotente: las filas que ya dicen «Rio Grande» no se tocan.
update public.network_referencia_contactos
   set empresa = 'Rio Grande Churrascaria (antes La Cueva del Pirata)'
 where empresa ilike '%cueva%pirata%'
   and empresa not ilike '%rio grande%'
   and id not in ('f82adca2-9574-4f5d-8185-182c63b81bf0','89fc763a-84fa-4ac8-bb84-18a93aa594d7');   -- las dos «Lily» no trabajan ahi: ver su bloque aparte

-- ═══════ 20261006_network_henrry_mojitobar_dueno.sql ═══════
-- Dato del PO (2026-10-05). Corrige solo esta ficha: era una nota de «verificar si sigue trabajando ahi». Sigue en «Venues» (los duenos van como venues).
-- Idempotente: si la nota ya dice «Dueno de Mojitobar», no se toca.
update public.network_referencia_contactos
   set empresa = 'Mojitobar (Dolphin Mall; antes Bayside)',
       notas   = 'Dueno de Mojitobar. Hoy el local activo es Dolphin Mall; antes estaba en Bayside (cerrado). Confirmado por el PO.'
 where id = '00a6b19f-4b8d-4f8f-a142-c9017c3ff2cf'      -- Henrry (+1 954 495-5986)
   and coalesce(notas,'') not like 'Dueno de Mojitobar%';

-- ═══════ 20261006_network_fathy_dincer_dueno.sql ═══════
-- Dato del PO (2026-10-05). Solo escribe empresa y notas de UNA ficha; sigue en «Venues» (los duenos van como venues). Idempotente.
update public.network_referencia_contactos
   set empresa = 'Conga Bar y Lombardi''s (dueno)',
       notas   = case when coalesce(notas,'') like 'Dueno de Conga Bar%' then notas
                      else btrim('Dueno de Conga Bar y de Lombardi''s. Confirmado por el PO. ' || coalesce(notas,'')) end
 where id = '4f5ded13-9347-4dd4-b8e0-534164bb7584';   -- Fathy Dincer (305) 333-7493

-- ═══════ 20261006_network_jose_web_side_proveedor.sql ═══════
-- Dato del PO (2026-10-05). Lo MUEVE de «Venues» a «Proveedores» y corrige su ficha (el restaurante era donde lo conocio, no su empresa).
-- Solo toca esta ficha. Idempotente.
update public.network_referencia_contactos
   set empresa = 'Web Side (paginas web)',
       notas   = case when coalesce(notas,'') like '%Hace paginas web%' then notas
                      else btrim(coalesce(notas,'') || ' Hace paginas web (Web Side). Lo conocio en Cachita''s / Cachira Restaurante.') end
 where id = '174fc214-cfc6-421e-900b-e24c5f41f34f';

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', '174fc214-cfc6-421e-900b-e24c5f41f34f'
  from public.network_lists l
 where lower(btrim(l.name)) = 'proveedores'
on conflict do nothing;

delete from public.network_list_members m
 using public.network_lists v
 where v.id = m.list_id and lower(btrim(v.name)) = 'venues'
   and m.fuente = 'referencia'
   and m.contacto_id = '174fc214-cfc6-421e-900b-e24c5f41f34f';

-- ═══════ 20261006_network_amigo_mario_valerio.sql ═══════
-- Dato del PO (2026-10-05). Agrega a la lista «Amigo» que ya existe y lo saca de «Venues». Idempotente.
insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', '311936f8-853e-472a-9a1b-6d58745e0826'   -- Mario Valerio (Cachita Restaurante)
  from public.network_lists l
 where lower(btrim(l.name)) = 'amigo'
on conflict do nothing;

delete from public.network_list_members m
 using public.network_lists v
 where v.id = m.list_id and lower(btrim(v.name)) = 'venues' and m.fuente = 'referencia'
   and m.contacto_id = '311936f8-853e-472a-9a1b-6d58745e0826';   -- Mario Valerio sale de «Venues» (regla: ahi solo duenos)

-- ═══════ 20261006_network_reclasificaciones_pikolino_frank.sql ═══════
--   * Pikolino (Show Event) es ANIMADOR: estaba en «Cliente» (lo habia puesto un patron de evento/promotor) -> pasa a «Animador».
--   * Frank Sonidista (CubaOcho) es SONIDISTA: estaba en «Venues» -> pasa a «Sonidista».
-- Solo estas 2 fichas, por su id. Mueve (agrega a la lista correcta y saca de la equivocada). Idempotente.
insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', x.contacto_id
  from public.network_lists l
  join (values ('animador',  '54e3507c-5b59-48a5-a257-6029300bcaff'::uuid),   -- Pikolino
               ('sonidista', '1ee4d644-c5ac-4f15-8b73-b918e3189259'::uuid)                                      -- Frank Sonidista (CubaOcho)
       ) as x(lista, contacto_id) on lower(btrim(l.name)) = x.lista
on conflict do nothing;

delete from public.network_list_members m
 using public.network_lists l
 where l.id = m.list_id and m.fuente = 'referencia'
   and (   (lower(btrim(l.name)) = 'cliente' and m.contacto_id = '54e3507c-5b59-48a5-a257-6029300bcaff')   -- Pikolino sale de «Cliente»
        or (lower(btrim(l.name)) = 'venues'  and m.contacto_id = '1ee4d644-c5ac-4f15-8b73-b918e3189259'));   -- Frank sale de «Venues»

-- ═══════ 20261006_network_bartender_nelson.sql ═══════
-- Dato del PO (2026-10-05). Los agrega a la lista «Bartender» que ya existe y los MUEVE: los saca de «Venues» (regla del PO: en «Venues» solo los duenos).
-- Idempotente. Las otras dos fichas que parecen bartender estan comentadas: descomentalas SOLO si el PO las confirma.
insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        '9df4505e-5b0e-40d4-a20c-57f56ac9fe37',  -- Nelson (El Valle Restaurant)
        'a8a23db5-07cb-4da6-b9cd-e2eac02d61ac',  -- Maghela Palmiery (Mojitobar)
        'f6fba7bc-5d86-40fe-9b90-4f896d24b47c')  -- Evelio Olozabar (Conga Bar)
        -- ,'d048aec5-1577-4349-a542-230041b1c003'  -- Alexandra (Mojitobar Bar Tender)   [por confirmar]
        -- ,'e67bdc26-c234-46e3-95de-3c1045c6f993'  -- Jessica Bartender (Riviera Live)  [por confirmar]
 where lower(btrim(l.name)) = 'bartender'
on conflict do nothing;

delete from public.network_list_members m
 using public.network_lists v
 where v.id = m.list_id and lower(btrim(v.name)) = 'venues' and m.fuente = 'referencia'
   and m.contacto_id in ('9df4505e-5b0e-40d4-a20c-57f56ac9fe37','a8a23db5-07cb-4da6-b9cd-e2eac02d61ac','f6fba7bc-5d86-40fe-9b90-4f896d24b47c');

-- ═══════ 20261006_network_pestana_managers.sql ═══════
-- Decision del PO (2026-10-05): «los managers los vamos a poner como una pestana aparte y los duenos de los negocios como venues».
-- Crea la lista «Managers» (si no existe), agrega las 25 fichas cuyo nombre dice Manager/GM o que el PO confirmo como manager
-- (Murilo, Julio Navarete, Ruben, Elvis Marina = manager del Miami Yacht Club, Jhonatan Tobar = antiguo manager de Mojitobar) y las SACA de «Venues» (solo esas, por su id).
-- NO toca a los duenos (Alex Salman, Marcel) ni a «Bory Representante» / «Cosa Rica Representante La Moda» (representante no es manager: por confirmar).
-- Idempotente: volver a correrlo no duplica nada.
insert into public.network_lists (name, created_by)
select 'Managers', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'managers');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        'fe67145c-01fe-44c6-85b4-80576d1a824c',  -- Andres Manager (Mojitobar),
        '5861dce9-daa4-4131-aff6-c261bc30dd0b',  -- Andy Manager (Guantanamera Cigars),
        'dc922f30-7cda-4d5a-a798-91e0f292084b',  -- Annie Manager (Whiskey Joe,s Miami),
        'faa134b4-dfbd-4a79-8e26-8d45eebaf6b0',  -- Beba Manager (La Cobacha),
        '79bb775b-a9d1-4124-bc72-00057da4735e',  -- Bory Manager (Riviera Live),
        'bbbf8068-c76b-4d0c-8362-64f811a75291',  -- Chino Manager (La Cueva del Pirata),
        'c77ceace-df80-48ed-aae1-edc3f67faeeb',  -- Chris GM General Manager (Mojitobar Sawgrass),
        '3c31daf0-f1fa-46e6-86fe-3ee8c7518a95',  -- Elvis Marina (Miami Yacht Club),
        '2caefe12-9cd3-4e74-814e-88ac58d023eb',  -- Gavy Manager (Whiskey Joes miami),
        '9c68e48c-f03a-43c1-ab55-a4e87436ebfc',  -- Jhonatan Tobar (Mojitobar),
        '360b1bea-54f2-4ede-b003-88a80f234e78',  -- Jose Manager (Hooters Bayside),
        '1b955c78-f294-4575-b229-0d8bc27e2639',  -- Julio Navarete (Rio Grande Churrascaria (antes La Cueva del Pirata)),
        'b79c0984-faae-4d43-93d4-a81f97a9ab87',  -- Laura Manager (Kanty Y Rico),
        '32c2a24a-701c-4809-9119-bc9052aa875a',  -- Luis Manager (Toreros Brasilian Churrascaria),
        '2bad2535-37ff-4223-95c0-cf920ebfffbf',  -- Micky Manager (Breakwater South Beach),
        '631ee118-2642-4fba-af67-d4f0aef8ec6e',  -- Miguel Manager (La Cueva del Pirata),
        '38520047-d40c-4a2c-9548-71cad8872f9e',  -- Murillo Manager (Spice Resto Lounge),
        'd42eb307-efb4-4375-8b0d-b44af0df0736',  -- Murilo (Spice Resto Lounger),
        'b6a98aee-7a66-42a6-b85f-f83a1ebf114f',  -- Omar Managar (La Cueva del Pirata),
        '220fba9d-5faa-47f9-b23d-a8d00e814d4d',  -- Paulo Manager (Mogitobar Sawgras),
        'ffa03642-2d8b-4670-906d-923e33c4a967',  -- Rachel Manager (Toreros),
        'b1aad33a-8882-43ab-932e-90161c64344e',  -- Robert Zomosa Chacal Manager (El Chacal),
        'f4b865f6-ef5c-4d1f-8ce6-63599537baa3',  -- Roberto Manager (Mojitos Cuba 8),
        '284daa36-ba71-41e3-8546-60f0eb7c5c40',  -- Ruben Manager Bar (Amsterdam),
        '36a86f65-7297-4fda-8b8b-dcc7bfb1397b')  -- Yasmany Manager (sin lugar))
 where lower(btrim(l.name)) = 'managers'
on conflict do nothing;

delete from public.network_list_members m
 using public.network_lists v
 where v.id = m.list_id and lower(btrim(v.name)) = 'venues'
   and m.fuente = 'referencia'
   and m.contacto_id in (
        'fe67145c-01fe-44c6-85b4-80576d1a824c',
        '5861dce9-daa4-4131-aff6-c261bc30dd0b',
        'dc922f30-7cda-4d5a-a798-91e0f292084b',
        'faa134b4-dfbd-4a79-8e26-8d45eebaf6b0',
        '79bb775b-a9d1-4124-bc72-00057da4735e',
        'bbbf8068-c76b-4d0c-8362-64f811a75291',
        'c77ceace-df80-48ed-aae1-edc3f67faeeb',
        '3c31daf0-f1fa-46e6-86fe-3ee8c7518a95',
        '2caefe12-9cd3-4e74-814e-88ac58d023eb',
        '9c68e48c-f03a-43c1-ab55-a4e87436ebfc',
        '360b1bea-54f2-4ede-b003-88a80f234e78',
        '1b955c78-f294-4575-b229-0d8bc27e2639',
        'b79c0984-faae-4d43-93d4-a81f97a9ab87',
        '32c2a24a-701c-4809-9119-bc9052aa875a',
        '2bad2535-37ff-4223-95c0-cf920ebfffbf',
        '631ee118-2642-4fba-af67-d4f0aef8ec6e',
        '38520047-d40c-4a2c-9548-71cad8872f9e',
        'd42eb307-efb4-4375-8b0d-b44af0df0736',
        'b6a98aee-7a66-42a6-b85f-f83a1ebf114f',
        '220fba9d-5faa-47f9-b23d-a8d00e814d4d',
        'ffa03642-2d8b-4670-906d-923e33c4a967',
        'b1aad33a-8882-43ab-932e-90161c64344e',
        'f4b865f6-ef5c-4d1f-8ce6-63599537baa3',
        '284daa36-ba71-41e3-8546-60f0eb7c5c40',
        '36a86f65-7297-4fda-8b8b-dcc7bfb1397b');

-- Elvis Marina: la nota dice de que club es (nombre correcto: «Miami Yacht Club», 1001 MacArthur Causeway, Watson Island, Miami)
update public.network_referencia_contactos
   set notas = btrim(coalesce(notas,'') || ' Manager del Miami Yacht Club (1001 MacArthur Causeway, Watson Island, Miami).')
 where id = '3c31daf0-f1fa-46e6-86fe-3ee8c7518a95' and coalesce(notas,'') not like '%Manager del Miami Yacht Club%';

-- ═══════ Dailyn (ex bartender de Mojitobar Bayside) -> cliente de fiestas privadas ═══════
-- Dato del PO (2026-10-05): fue bartender de Mojitos Bayside; ahora tiene un salon de belleza o spa; el PO ya le hizo fiestas privadas (baby shower de su nina).
-- Corrige la ficha (ya no trabaja en Mojitobar), la pasa de «Venues» a «Cliente». El nombre del salon/spa queda por confirmar.
update public.network_referencia_contactos
   set empresa = 'Salon de belleza o spa (nombre por confirmar)',
       notas   = 'Fue bartender de Mojitobar Bayside. Hoy tiene un salon de belleza o spa (nombre por confirmar). Cliente: el PO le ha hecho fiestas privadas (baby shower de su nina).'
 where id = '337f3a75-ec06-4980-9f4c-8439f37c111b'          -- Dailyn (+1 954 990-9078)
   and coalesce(notas,'') not like 'Fue bartender de Mojitobar Bayside%';

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', '337f3a75-ec06-4980-9f4c-8439f37c111b'
  from public.network_lists l where lower(btrim(l.name)) = 'cliente'
on conflict do nothing;

delete from public.network_list_members m
 using public.network_lists v
 where v.id = m.list_id and lower(btrim(v.name)) = 'venues' and m.fuente = 'referencia'
   and m.contacto_id = '337f3a75-ec06-4980-9f4c-8439f37c111b';

-- ═══════ Chris GM (Mojitobar Sawgrass): candidato a publicidad; si no responde, se borra ═══════
-- Dato del PO (2026-10-05): es manager, ni se acuerda de el; se le puede mandar publicidad de los servicios y, si no hay interes, se borra.
-- Solo agrega una linea a la nota (no borra nada). Idempotente.
update public.network_referencia_contactos
   set notas = btrim(coalesce(notas,'') || ' [Pendiente de prospeccion] Manager (GM) de Mojitobar Sawgrass; el PO no lo recuerda. Mandarle publicidad de los servicios; si no muestra interes, borrar la ficha.')
 where id = 'c77ceace-df80-48ed-aae1-edc3f67faeeb' and coalesce(notas,'') not like '%Pendiente de prospeccion%';

-- ═══════ Henry Cuesta (dueno de Sundowners Key Largo y antes de La Cueva del Pirata) y Lily (su ex esposa; dos fichas = una persona) ═══════
-- Dato del PO (2026-10-05). Henry va a «Venues» (dueno). Lily no es empleada: su ficha dejaba «La Cueva Del Pirata» como empresa; se aclara y se une el 2.o telefono a una sola ficha.
-- NO se borra ninguna ficha: la segunda «Lily» queda marcada como duplicada para que el PO decida.
update public.network_referencia_contactos
   set empresa = 'Sundowners Key Largo (dueno)',
       notas   = btrim(coalesce(notas,'') || ' Dueno de Sundowners Key Largo; tambien fue dueno de La Cueva del Pirata (hoy Rio Grande Churrascaria). Ex esposo de Lily.')
 where id = '25d7891f-6775-4c52-8107-27cbb7fc9382' and coalesce(notas,'') not like '%tambien fue dueno de La Cueva del Pirata%';

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', '25d7891f-6775-4c52-8107-27cbb7fc9382'
  from public.network_lists l where lower(btrim(l.name)) = 'venues'
on conflict do nothing;

update public.network_referencia_contactos
   set empresa = 'Ex esposa de Henry (Sundowners Key Largo / La Cueva del Pirata)',
       phones_extra = case when phones_extra is null or phones_extra = '[]'::jsonb
                           then '[{"tipo": "personal", "numero": "7864910173"}]'::jsonb else phones_extra end,
       notas   = btrim(coalesce(notas,'') || ' Ex esposa de Henry, dueno de Sundowners Key Largo y antes de La Cueva del Pirata. Misma persona que la otra ficha «Lily» (7864910173, agregado aqui como 2.o telefono).')
 where id = 'f82adca2-9574-4f5d-8185-182c63b81bf0' and coalesce(notas,'') not like '%Ex esposa de Henry%';

update public.network_referencia_contactos
   set empresa = 'Ex esposa de Henry (Sundowners Key Largo / La Cueva del Pirata)',
       notas   = btrim(coalesce(notas,'') || ' DUPLICADA: es la misma persona que la ficha «Lily» con (786) 387-6870 (ya tiene este telefono). Se puede borrar esta ficha.')
 where id = '89fc763a-84fa-4ac8-bb84-18a93aa594d7' and coalesce(notas,'') not like '%DUPLICADA%';

-- ═══════ RESUMEN FINAL (deberia mostrar: Animador 6, Sonidista 3, Bartender 5, Amigo 2, Managers 25, Proveedores 11, Seguridad 9, Venues = 109 menos lo que salga aqui) ═══════
select l.name, count(m.*) as miembros
  from public.network_lists l left join public.network_list_members m on m.list_id = l.id
 where lower(btrim(l.name)) in ('animador','sonidista','bartender','amigo','managers','proveedores','seguridad','venues','cliente')
 group by l.name order by l.name;
