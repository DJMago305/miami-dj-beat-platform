-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Pestana «Managers» en el Network (los managers aparte; los duenos de negocios se quedan en «Venues»)
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
        '36a86f65-7297-4fda-8b8b-dcc7bfb1397b'  -- Yasmany Manager (sin lugar))
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

-- Comprobacion: «Managers» = 25; «Venues» baja en los que estaban ahi
select l.name, count(m.*) as miembros
  from public.network_lists l left join public.network_list_members m on m.list_id = l.id
 where lower(btrim(l.name)) in ('managers','venues') group by l.name order by l.name;
