-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - SEPARACION DEL RESTO DE «VENUES» (propuesta para que el PO la revise)
-- Pedido del PO (2026-10-05): «ya sabes mas o menos como separar, hazlo y yo compruebo que no te falte nada».
-- CORRER DESPUES de 20261006_network_limpieza_completa.sql. Regla: en «Venues» quedan SOLO los duenos de negocios.
-- Lo que hace con las fichas que siguen en «Venues» tras la limpieza (77): las pasa a su lista y las saca de «Venues».
--   * Dueños (Alex Salman, Marcel): se quedan.   * Comida / Restaurantes (lugares para comer o encargar).   * Contabilidad (la contadora del PO).
--   * Managers (Cesar Reyes, ex manager de Mojitobar).   * Promotor.   * Bartender (Alexandra y Jessica Bartender: su nombre/lugar lo dice).   * Personal de venues (el resto: gente que trabaja en un local, sin rol claro en su nombre).
-- Idempotente. Cada lista nueva se crea solo si no existe. Nada se borra de la base: solo cambian las listas.

-- ── Comida / Restaurantes ──
insert into public.network_lists (name, created_by)
select 'Comida / Restaurantes', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'comida / restaurantes');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        'a53ba0ba-74a9-4bcb-aaa8-c1dd4dec8a3d',  -- Rio Grande Churrascaria (Rio Grande Churrascaria (antes La Cueva ),
        'bd1c3e2c-198e-44e7-8ccf-ce0a73209d27',  -- Sushi Bar De La 67 (sin lugar),
        'b1512b08-ba43-416b-88cf-e46a2f5d3230')  -- Terraza (La Cueva del Pirata))
 where lower(btrim(l.name)) = 'comida / restaurantes'
on conflict do nothing;

-- ── Contabilidad (contadora personal del PO; ficha sensible) ──
insert into public.network_lists (name, created_by)
select 'Contabilidad', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'contabilidad');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        '40f22498-64ae-45f5-8865-82fcfbefeaeb',  -- Javier Contador (Mojitobar) [propuesta: un contador es buen contacto]
        'c4143f40-574c-40ba-a732-28870f242d3b')  -- Sirley Contadora (Riviera Live Invoice))
 where lower(btrim(l.name)) = 'contabilidad'
on conflict do nothing;

-- ── Promotor ──
insert into public.network_lists (name, created_by)
select 'Promotor', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'promotor');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        '46b3eaf4-d381-49e0-bbe1-de114f7a81fe',  -- Randdy Promotor Ok (La Cueva Del Pirata),
        '8116d55c-4cbe-4bb1-b6d7-6875e548c891')  -- Yesenia Promicion New York (Mojitobar Bayside))
 where lower(btrim(l.name)) = 'promotor'
on conflict do nothing;

-- ── Bartender (propuesta: Alexandra y Jessica; Angel y Magela confirmados por el PO) ──
insert into public.network_lists (name, created_by)
select 'Bartender', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'bartender');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        'ad378eb1-369c-4ad0-ad7d-1f43e7c41c05',  -- Mirian (Conga Bar): bartender
        'ea959740-46fb-4d03-bbfc-a1ac0d8ec738',  -- Angel Y Magela (Mojitobar Sawgrass): Magela es bartender
        'd048aec5-1577-4349-a542-230041b1c003',  -- Alexandra (Mojitobar Bar Tender),
        'e67bdc26-c234-46e3-95de-3c1045c6f993')  -- Jessica Bartender (Riviera Live))
 where lower(btrim(l.name)) = 'bartender'
on conflict do nothing;

-- ── Managers: Cesar Reyes (ex manager de Mojitobar) y «Mojitobar Invoice» (contacto de facturacion / propuestas) ──
insert into public.network_lists (name, created_by)
select 'Managers', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'managers');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', x.cid
  from public.network_lists l
  join (values ('4b5b705b-98fe-4eb4-997b-083a2b5f0d8c'::uuid),   -- Cesar Reyes (Mojitobar)
               ('ab2b70b4-a6d7-4809-b963-03e8a9eceff2'::uuid)                                      -- Mojitobar Invoice (contacto de facturacion de Mojitobar)
       ) as x(cid) on lower(btrim(l.name)) = 'managers'
on conflict do nothing;

-- Mojitobar Invoice: a este contacto se mandaban las invoices cuando el PO trabajaba en Mojitos Bayside; el nombre del manager no se sabe; sirve para mandar propuestas (dato del PO).
update public.network_referencia_contactos
   set notas = btrim(coalesce(notas,'') || ' Contacto de facturacion de Mojitobar: aqui se mandaban las invoices cuando el PO trabajaba en Mojitos Bayside. Nombre del manager desconocido. Sirve para mandar propuestas.')
 where id = 'ab2b70b4-a6d7-4809-b963-03e8a9eceff2' and coalesce(notas,'') not like '%Contacto de facturacion de Mojitobar%';

update public.network_referencia_contactos
   set notas = btrim(coalesce(notas,'') || ' Fue manager de Mojitobar (dato del PO).')
 where id = '4b5b705b-98fe-4eb4-997b-083a2b5f0d8c' and coalesce(notas,'') not like '%Fue manager de Mojitobar%';

-- Mirian (Conga Bar): bartender de Conga Bar; el PO cree que ya se fue a Colombia (por confirmar).
update public.network_referencia_contactos
   set notas = btrim(coalesce(notas,'') || ' Bartender de Conga Bar. El PO cree que ya se fue a Colombia (por confirmar).')
 where id = 'ad378eb1-369c-4ad0-ad7d-1f43e7c41c05' and coalesce(notas,'') not like '%se fue a Colombia%';

-- Angel Y Magela: la misma Magela bartender (ver Maghela Palmiery); Angel, su esposo, hoy es policia y antes fue bartender de Mojitos Bayside (dato del PO).
update public.network_referencia_contactos
   set notas = btrim(coalesce(notas,'') || ' Magela es bartender (la misma de Maghela Palmiery). Angel, su esposo, hoy es policia; antes fue bartender de Mojitos Bayside.')
 where id = 'ea959740-46fb-4d03-bbfc-a1ac0d8ec738' and coalesce(notas,'') not like '%hoy es policia%';

-- ── Abogados: Humberto Abogado (dato del PO: «un abogado es un buen contacto») ──
insert into public.network_lists (name, created_by)
select 'Abogados', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'abogados');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', '5c4bff55-621e-4054-a892-3d463db146eb'      -- Humberto Abogado (Mojitobar)
  from public.network_lists l where lower(btrim(l.name)) = 'abogados'
on conflict do nothing;

-- ── Cantante: Widel Portal, cantante, amigo de Marichal (dato del PO) ──
insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', 'b2908bbb-4813-4d25-bef5-8766721c764d'      -- Widel Portal
  from public.network_lists l where lower(btrim(l.name)) = 'cantante'
on conflict do nothing;

update public.network_referencia_contactos
   set notas = btrim(coalesce(notas,'') || ' Cantante, amigo de Marichal (dato del PO).')
 where id = 'b2908bbb-4813-4d25-bef5-8766721c764d' and coalesce(notas,'') not like '%amigo de Marichal%';

-- ── Personal de venues (el resto) ──
insert into public.network_lists (name, created_by)
select 'Personal de venues', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'personal de venues');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        'b19c79eb-7b24-43e1-9726-a8cd229cd73d',  -- Alain (Mojitobar Miami),
        '886a0a23-8cf0-41aa-983e-3021d1e5fe6f',  -- Alejandro (El Yonky),
        '6223bd2f-1a8c-401c-8d21-5f84dcf94db3',  -- Amanda (Mojitobar),
        'b7627479-835e-4274-9729-191b11874b53',  -- Anelim El Valle Restaurant (sin lugar),
        'f54d817c-095e-4b06-9c8a-a1f2dc717ce4',  -- Annie Duce (Whiskey Joe`s Miami),
        '3a227e61-d48e-4d03-974b-1cd1274d83e3',  -- Aura (Mojitobar Sawgrass),
        '4095ec84-a287-46dd-90e6-4a213ba32396',  -- Benjamine Chaff (Mojitobar Fort laudardale),
        'b07b01ba-0f7f-4317-906c-2edf4ca403f0',  -- Bernar (La Cueva del Pirata),
        '939d12d2-fccf-40a7-ad69-78c9518ecdd3',  -- Boris (Spice Resto Lounge),
        '040752e9-c971-4099-8baf-932169eae861',  -- Bory Representante (Kola Loka),
        '72565073-db0d-4e7b-aa65-238acaa27eaa',  -- Catalina (Mojito Bar),
        'a0356a6e-367f-44bd-a447-61dc4811df3d',  -- Cristian (Neme Bar),
        '2a578bb7-017b-40ed-8fa1-838ef19e744b',  -- Dago Pay Roll (Divino Pecado),
        '9b2679a0-f407-4b6a-94be-595eb0c68083',  -- Danny (Whiskey Joes),
        'b82b94fb-27d7-4771-bbda-ab3e467c544e',  -- David (Edison South Beach),
        'f56de1a3-30d9-4d29-a9de-e2f7b12a7a2d',  -- Eduardo Pino Targetas (La Cueva del Pirata),
        'f6df1323-0114-4797-bb17-aac13a3f8fc0',  -- El Flaco (Mojitobar Bayside),
        '518c9ef7-e111-4b16-99e8-06b836bb757b',  -- Erick Padrino (Mojitobar),
        '3fb31dc5-e0ba-4cc1-8e68-fff8bf3ecc54',  -- Felix (Spice Resto Lounge),
        '2b04cd12-35f1-40e3-96c0-a43b495b68ae',  -- Fonseca Suarez\\, (Las Vegas Restaurante),
        '14e92056-8ff5-473f-887f-9a479a73b3a0',  -- Freddy (Mojitobar),
        '63b2b072-0e9c-40b5-9822-c7901044188c',  -- Gerardo Avila (Mojito Bar),
        '4e44ccca-485f-4b6f-b80d-ba740f3bd107',  -- Gordo (Flavor Club),
        'b697e35b-884e-4ba1-92d2-6b46308c5187',  -- Gustavo (Mojitobar Bayside),
        '775b7b96-3f73-42a2-b8ff-5baa204c6f9a',  -- Jenifer (Mojitobar),
        'd9cdf148-1868-4f9a-94cb-81aa73d8caf6',  -- Jorge Quesada (El Valle Restaurant),
        'f95281fd-1d4f-48dc-a178-b3f56405dcd7',  -- Jorgito (Cafeteria Honda),
        'b1fb8762-c31d-4652-86e8-8cd3984474d6',  -- Juan J Alvarado (Caribe Restaurant),
        'fc16a85e-f054-4052-8caf-db45a9e6f180',  -- Julio  Bayside (Congabar),
        '7754dffb-d706-467a-b136-b0a6a5dc2680',  -- Kamila (Conga Bar),
        '81f5b217-97da-45da-aea4-365fe219031c',  -- Karen (Mojitobar),
        '88962c56-d43c-48cf-87ed-7fbdf8483cf6',  -- Lellany (Mojito Bar),
        'f8a68743-7b6a-4190-bfd7-f105a2e97214',  -- Lia Roman (La Cueva del Pirata),
        'f82adca2-9574-4f5d-8185-182c63b81bf0',  -- Lily (La Cueva Del Pirata),
        '89fc763a-84fa-4ac8-bb84-18a93aa594d7',  -- Lily (La Cueva Del Pirata),
        '0abb1951-9053-4a64-ab5d-e5b37e7bf4c3',  -- Loida (La Cueva Del Pirata),
        '8e1fafcc-f9a9-46df-9f92-91c28d7fcdd8',  -- Luis Mojitobar (Boranica),
        'f02e7ea4-e3b6-4636-a42e-5d0ba9283ac0',  -- Maikel (Mojitobar Bar),
        'acfed833-2025-41a3-911a-7a8b765388cb',  -- Maikel Cuba (Mojitobar Dontown),
        '5c90bf69-5d67-4c10-8188-dde6551dadd5',  -- Mario Boricua (Mojitobar),
        '1c2296ef-f2be-4f79-994c-ed3d6ad63d98',  -- Mary (La Cueva del Pirata),
        'b36fbaf1-c258-4486-ba03-7d08af753a21',  -- Mayito Garcia Garcia (Mojito Bar - Bayside Marketplace),
        'b87e465b-8709-4f60-aa89-a5642e20cf62',  -- Nohamy (La Cueva del Pirata),
        '412d45f4-f125-4042-9fcf-89ce45ac3147',  -- Party (Alexis Mojitobar),
        'c6cd8fd1-99d2-44a2-93b0-a7c34ffd4a05',  -- Raiskel Chef (La Cueva del Pirata),
        'a5dfbff3-b025-4f9f-a270-1542e53fb17e',  -- Raulier (La Zona Cubana),
        '1d6868f4-79e8-466a-ac53-df64f20bfa97',  -- Rey (Mojitobar Sawgrass),
        'b67d8d0f-93ca-407b-80b3-ae8dea836946',  -- Richard Velezuela Amigo De Jhonatan (Divino pecado),
        'a31ad468-9a64-4b85-81ea-b4df9ff2fc2e',  -- Roberto Demena (Ambar Motor),
        '00ea537b-1666-4f54-86be-98462cd5b6d0',  -- Rolando (Congabar Lombardis),
        '0d80564c-8b57-411e-be65-4c22e9cec079',  -- Rosie Ramos (CubaOcho),
        '37280d5c-53ff-45ba-a047-1cca374b0672',  -- Sadier Padrino (Mojitobar),
        '55050e8a-7230-4f8a-b1a9-25559535feba',  -- Saily (Mojitibar Bayside),
        '86178894-1c58-4650-9f77-0c07023e7fe7',  -- Savier (Conga Bar),
        '38a9dc82-b8e4-460d-9490-6bdd1e12b345',  -- Sikiu (Mojitobar),
        '7b6260a6-4b4c-4bc4-882a-10d4681d753d',  -- Wilfredo Figerodo Director Artistico (Riviera Live),
        '52d5670a-86ea-46a6-8098-1e4c2b323993',  -- Wilfrido (Flavor Nigth Club),
        'ad166596-63da-4f27-b33d-d341c08fe2a8',  -- Yaimy Cuba (Mojitobar),
        '9a5e0cf7-712c-46ea-8246-439e44b4be4e',  -- Yeni Esposa De Cubita  Cuba (Mojitobar),
        '2a441b32-dee6-480f-a91c-81ba1c40270b',  -- Yianko Rodriguez (Conga Bar),
        '64ae5d73-b1ae-4a32-855e-e9421395c485',  -- Yoel (Habana Nice Hotel),
        'a310fdc7-1ae7-4906-884a-a7321b7eeff9')  -- Yunuo Mojito Bar (Jaz))
 where lower(btrim(l.name)) = 'personal de venues'
on conflict do nothing;

-- Marca de vigencia para el trabajo de revision (el PO las va editando una por una): las que NO traian ya un estado quedan «por verificar».
-- Las que ya decian [Estado: CERRADO] o [Estado: verificar…] se respetan tal cual.
update public.network_referencia_contactos
   set notas = btrim(coalesce(notas,'') || ' [Por verificar si sigue trabajando ahi]')
 where id in (
        'b19c79eb-7b24-43e1-9726-a8cd229cd73d',
        '886a0a23-8cf0-41aa-983e-3021d1e5fe6f',
        '6223bd2f-1a8c-401c-8d21-5f84dcf94db3',
        'b7627479-835e-4274-9729-191b11874b53',
        'f54d817c-095e-4b06-9c8a-a1f2dc717ce4',
        '3a227e61-d48e-4d03-974b-1cd1274d83e3',
        '4095ec84-a287-46dd-90e6-4a213ba32396',
        'b07b01ba-0f7f-4317-906c-2edf4ca403f0',
        '939d12d2-fccf-40a7-ad69-78c9518ecdd3',
        '040752e9-c971-4099-8baf-932169eae861',
        '72565073-db0d-4e7b-aa65-238acaa27eaa',
        'a0356a6e-367f-44bd-a447-61dc4811df3d',
        '2a578bb7-017b-40ed-8fa1-838ef19e744b',
        '9b2679a0-f407-4b6a-94be-595eb0c68083',
        'b82b94fb-27d7-4771-bbda-ab3e467c544e',
        'f56de1a3-30d9-4d29-a9de-e2f7b12a7a2d',
        'f6df1323-0114-4797-bb17-aac13a3f8fc0',
        '518c9ef7-e111-4b16-99e8-06b836bb757b',
        '3fb31dc5-e0ba-4cc1-8e68-fff8bf3ecc54',
        '2b04cd12-35f1-40e3-96c0-a43b495b68ae',
        '14e92056-8ff5-473f-887f-9a479a73b3a0',
        '63b2b072-0e9c-40b5-9822-c7901044188c',
        '4e44ccca-485f-4b6f-b80d-ba740f3bd107',
        'b697e35b-884e-4ba1-92d2-6b46308c5187',
        '775b7b96-3f73-42a2-b8ff-5baa204c6f9a',
        'd9cdf148-1868-4f9a-94cb-81aa73d8caf6',
        'f95281fd-1d4f-48dc-a178-b3f56405dcd7',
        'b1fb8762-c31d-4652-86e8-8cd3984474d6',
        'fc16a85e-f054-4052-8caf-db45a9e6f180',
        '7754dffb-d706-467a-b136-b0a6a5dc2680',
        '81f5b217-97da-45da-aea4-365fe219031c',
        '88962c56-d43c-48cf-87ed-7fbdf8483cf6',
        'f8a68743-7b6a-4190-bfd7-f105a2e97214',
        'f82adca2-9574-4f5d-8185-182c63b81bf0',
        '89fc763a-84fa-4ac8-bb84-18a93aa594d7',
        '0abb1951-9053-4a64-ab5d-e5b37e7bf4c3',
        '8e1fafcc-f9a9-46df-9f92-91c28d7fcdd8',
        'f02e7ea4-e3b6-4636-a42e-5d0ba9283ac0',
        'acfed833-2025-41a3-911a-7a8b765388cb',
        '5c90bf69-5d67-4c10-8188-dde6551dadd5',
        '1c2296ef-f2be-4f79-994c-ed3d6ad63d98',
        'b36fbaf1-c258-4486-ba03-7d08af753a21',
        'b87e465b-8709-4f60-aa89-a5642e20cf62',
        '412d45f4-f125-4042-9fcf-89ce45ac3147',
        'c6cd8fd1-99d2-44a2-93b0-a7c34ffd4a05',
        'a5dfbff3-b025-4f9f-a270-1542e53fb17e',
        '1d6868f4-79e8-466a-ac53-df64f20bfa97',
        'b67d8d0f-93ca-407b-80b3-ae8dea836946',
        'a31ad468-9a64-4b85-81ea-b4df9ff2fc2e',
        '00ea537b-1666-4f54-86be-98462cd5b6d0',
        '0d80564c-8b57-411e-be65-4c22e9cec079',
        '37280d5c-53ff-45ba-a047-1cca374b0672',
        '55050e8a-7230-4f8a-b1a9-25559535feba',
        '86178894-1c58-4650-9f77-0c07023e7fe7',
        '38a9dc82-b8e4-460d-9490-6bdd1e12b345',
        '7b6260a6-4b4c-4bc4-882a-10d4681d753d',
        '52d5670a-86ea-46a6-8098-1e4c2b323993',
        'ad166596-63da-4f27-b33d-d341c08fe2a8',
        '9a5e0cf7-712c-46ea-8246-439e44b4be4e',
        '2a441b32-dee6-480f-a91c-81ba1c40270b',
        '64ae5d73-b1ae-4a32-855e-e9421395c485',
        'a310fdc7-1ae7-4906-884a-a7321b7eeff9')
   and coalesce(notas,'') not like '%[Estado:%'
   and coalesce(notas,'') not like '%Por verificar%';

-- ── SACAR de «Venues» todo lo anterior (los duenos se quedan) ──
delete from public.network_list_members m
 using public.network_lists v
 where v.id = m.list_id and lower(btrim(v.name)) = 'venues' and m.fuente = 'referencia'
   and m.contacto_id in (
        'b19c79eb-7b24-43e1-9726-a8cd229cd73d',
        '886a0a23-8cf0-41aa-983e-3021d1e5fe6f',
        '6223bd2f-1a8c-401c-8d21-5f84dcf94db3',
        'b7627479-835e-4274-9729-191b11874b53',
        'ea959740-46fb-4d03-bbfc-a1ac0d8ec738',
        'f54d817c-095e-4b06-9c8a-a1f2dc717ce4',
        '3a227e61-d48e-4d03-974b-1cd1274d83e3',
        '4095ec84-a287-46dd-90e6-4a213ba32396',
        'b07b01ba-0f7f-4317-906c-2edf4ca403f0',
        '939d12d2-fccf-40a7-ad69-78c9518ecdd3',
        '040752e9-c971-4099-8baf-932169eae861',
        '72565073-db0d-4e7b-aa65-238acaa27eaa',
        '4b5b705b-98fe-4eb4-997b-083a2b5f0d8c',
        'a0356a6e-367f-44bd-a447-61dc4811df3d',
        '2a578bb7-017b-40ed-8fa1-838ef19e744b',
        '9b2679a0-f407-4b6a-94be-595eb0c68083',
        'b82b94fb-27d7-4771-bbda-ab3e467c544e',
        'f56de1a3-30d9-4d29-a9de-e2f7b12a7a2d',
        'f6df1323-0114-4797-bb17-aac13a3f8fc0',
        '518c9ef7-e111-4b16-99e8-06b836bb757b',
        '3fb31dc5-e0ba-4cc1-8e68-fff8bf3ecc54',
        '2b04cd12-35f1-40e3-96c0-a43b495b68ae',
        '14e92056-8ff5-473f-887f-9a479a73b3a0',
        '63b2b072-0e9c-40b5-9822-c7901044188c',
        '4e44ccca-485f-4b6f-b80d-ba740f3bd107',
        'b697e35b-884e-4ba1-92d2-6b46308c5187',
        '5c4bff55-621e-4054-a892-3d463db146eb',
        '40f22498-64ae-45f5-8865-82fcfbefeaeb',
        '775b7b96-3f73-42a2-b8ff-5baa204c6f9a',
        'd9cdf148-1868-4f9a-94cb-81aa73d8caf6',
        'f95281fd-1d4f-48dc-a178-b3f56405dcd7',
        'b1fb8762-c31d-4652-86e8-8cd3984474d6',
        'fc16a85e-f054-4052-8caf-db45a9e6f180',
        '7754dffb-d706-467a-b136-b0a6a5dc2680',
        '81f5b217-97da-45da-aea4-365fe219031c',
        '88962c56-d43c-48cf-87ed-7fbdf8483cf6',
        'f8a68743-7b6a-4190-bfd7-f105a2e97214',
        'f82adca2-9574-4f5d-8185-182c63b81bf0',
        '89fc763a-84fa-4ac8-bb84-18a93aa594d7',
        '0abb1951-9053-4a64-ab5d-e5b37e7bf4c3',
        '8e1fafcc-f9a9-46df-9f92-91c28d7fcdd8',
        'f02e7ea4-e3b6-4636-a42e-5d0ba9283ac0',
        'acfed833-2025-41a3-911a-7a8b765388cb',
        '5c90bf69-5d67-4c10-8188-dde6551dadd5',
        '1c2296ef-f2be-4f79-994c-ed3d6ad63d98',
        'b36fbaf1-c258-4486-ba03-7d08af753a21',
        'ad378eb1-369c-4ad0-ad7d-1f43e7c41c05',
        'ab2b70b4-a6d7-4809-b963-03e8a9eceff2',
        'b87e465b-8709-4f60-aa89-a5642e20cf62',
        '412d45f4-f125-4042-9fcf-89ce45ac3147',
        'c6cd8fd1-99d2-44a2-93b0-a7c34ffd4a05',
        'a5dfbff3-b025-4f9f-a270-1542e53fb17e',
        '1d6868f4-79e8-466a-ac53-df64f20bfa97',
        'b67d8d0f-93ca-407b-80b3-ae8dea836946',
        'a31ad468-9a64-4b85-81ea-b4df9ff2fc2e',
        '00ea537b-1666-4f54-86be-98462cd5b6d0',
        '0d80564c-8b57-411e-be65-4c22e9cec079',
        '37280d5c-53ff-45ba-a047-1cca374b0672',
        '55050e8a-7230-4f8a-b1a9-25559535feba',
        '86178894-1c58-4650-9f77-0c07023e7fe7',
        '38a9dc82-b8e4-460d-9490-6bdd1e12b345',
        'b2908bbb-4813-4d25-bef5-8766721c764d',
        '7b6260a6-4b4c-4bc4-882a-10d4681d753d',
        '52d5670a-86ea-46a6-8098-1e4c2b323993',
        'ad166596-63da-4f27-b33d-d341c08fe2a8',
        '9a5e0cf7-712c-46ea-8246-439e44b4be4e',
        '2a441b32-dee6-480f-a91c-81ba1c40270b',
        '64ae5d73-b1ae-4a32-855e-e9421395c485',
        'a310fdc7-1ae7-4906-884a-a7321b7eeff9',
        '46b3eaf4-d381-49e0-bbe1-de114f7a81fe',
        '8116d55c-4cbe-4bb1-b6d7-6875e548c891',
        'a53ba0ba-74a9-4bcb-aaa8-c1dd4dec8a3d',
        'bd1c3e2c-198e-44e7-8ccf-ce0a73209d27',
        'b1512b08-ba43-416b-88cf-e46a2f5d3230',
        'c4143f40-574c-40ba-a732-28870f242d3b',
        'd048aec5-1577-4349-a542-230041b1c003',
        'e67bdc26-c234-46e3-95de-3c1045c6f993');

-- Comprobacion: «Venues» debe quedar con 4 duenos (Alex Salman, Marcel, Henrry, Fathy Dincer)
select l.name, count(m.*) as miembros
  from public.network_lists l left join public.network_list_members m on m.list_id = l.id
 where lower(btrim(l.name)) in ('venues','abogados','personal de venues','comida / restaurantes','contabilidad','promotor','bartender','managers')
 group by l.name order by l.name;
