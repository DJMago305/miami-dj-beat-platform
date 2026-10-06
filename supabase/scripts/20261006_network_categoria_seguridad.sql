-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Categoria «Seguridad» en el Network (personal de seguridad que se contrata de vez en cuando)
-- Pedido del PO (2026-10-05): «Segurida (La Cueva del Pirata) es un seguridad… deberia estar en una categoria».
-- Crea la lista «Seguridad» (si no existe) y le agrega los 9 contactos de referencia cuyo nombre/empresa dice seguridad o security.
-- Los MUEVE: tambien los saca de «Venues» (bloque final, solo esas 9 fichas). NO incluye a «Jesus Seguro» (puede ser seguro/aseguradora, no seguridad).
-- Idempotente: volver a correrlo no duplica nada.
insert into public.network_lists (name, created_by)
select 'Seguridad', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
 where not exists (select 1 from public.network_lists where lower(btrim(name)) = 'seguridad');

insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        '7d1ccb8c-35bd-4ece-98b6-23e12763efa2',  -- Alain Security
        '3d556a41-a2d7-4f8e-a72e-c2f3ff87ac7a',  -- Charlie Segurida (Mojitobar)
        '37f11ae4-5e7f-48b0-9605-e07f7330e9a3',  -- Jimagua Seguridad (CubaOcho)
        '98200144-70a6-46d6-956e-e19098773030',  -- Lazaro Seguridad (La Cueva del Pirata / Rio Grande)
        '84b42cc3-f240-4687-b208-f1caea6f86e0',  -- Maikel security flavour
        '66f1ca37-e547-4253-a6ec-39df56bd215e',  -- Pichon Seguridad (Mojitobar)
        'b235fcec-abed-457d-ad60-6ed9ab42ab0b',  -- Richard (empresa: Seguridad)
        '4f60bf5d-9bcc-45e4-9f17-acbd1da0ebdd',  -- Segurida (La Cueva del Pirata / Rio Grande)
        '2cbf4404-d3e6-4e27-b4ac-3a42c14acdc9')  -- Yandel Seguridad (Mojitobar Miami)
 where lower(btrim(l.name)) = 'seguridad'
on conflict do nothing;

-- Comprobacion: debe dar  1 lista «Seguridad»  y  9 miembros
select l.name, count(m.*) as miembros
  from public.network_lists l
  left join public.network_list_members m on m.list_id = l.id
 where lower(btrim(l.name)) = 'seguridad'
 group by l.name;

-- MOVER: los que estaban en «Venues» salen de ahi (pedido del PO: «muevelos a esa pestana»). Solo estas 9 fichas, nunca el resto de «Venues».
delete from public.network_list_members m
 using public.network_lists v
 where v.id = m.list_id and lower(btrim(v.name)) = 'venues'
   and m.fuente = 'referencia'
   and m.contacto_id in (
        '7d1ccb8c-35bd-4ece-98b6-23e12763efa2','3d556a41-a2d7-4f8e-a72e-c2f3ff87ac7a','37f11ae4-5e7f-48b0-9605-e07f7330e9a3',
        '98200144-70a6-46d6-956e-e19098773030','84b42cc3-f240-4687-b208-f1caea6f86e0','66f1ca37-e547-4253-a6ec-39df56bd215e',
        'b235fcec-abed-457d-ad60-6ed9ab42ab0b','4f60bf5d-9bcc-45e4-9f17-acbd1da0ebdd','2cbf4404-d3e6-4e27-b4ac-3a42c14acdc9');

-- Comprobacion final: «Seguridad» = 9 y «Venues» pasa de 115 a 109 (salen 6; los otros 3 no estaban ahi)
select l.name, count(m.*) as miembros
  from public.network_lists l left join public.network_list_members m on m.list_id = l.id
 where lower(btrim(l.name)) in ('seguridad','venues') group by l.name order by l.name;
