-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Bartenders confirmados por el PO (Nelson de El Valle, Maghela Palmiery de Mojitobar y Evelio Olozabar de Conga Bar) -> lista «Bartender» del Network
-- Dato del PO (2026-10-05). Los agrega a la lista «Bartender» que ya existe y los MUEVE: los saca de «Venues» (regla del PO: en «Venues» solo los duenos).
-- Idempotente. Las otras dos fichas que parecen bartender estan comentadas: descomentalas SOLO si el PO las confirma.
insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', c.id
  from public.network_lists l
  join public.network_referencia_contactos c on c.id in (
        '9df4505e-5b0e-40d4-a20c-57f56ac9fe37',  -- Nelson (El Valle Restaurant)
        'a8a23db5-07cb-4da6-b9cd-e2eac02d61ac',  -- Maghela Palmiery (Mojitobar)
        'f6fba7bc-5d86-40fe-9b90-4f896d24b47c'   -- Evelio Olozabar (Conga Bar)
        -- ,'d048aec5-1577-4349-a542-230041b1c003'  -- Alexandra (Mojitobar Bar Tender)   [por confirmar]
        -- ,'e67bdc26-c234-46e3-95de-3c1045c6f993'  -- Jessica Bartender (Riviera Live)  [por confirmar]
  )
 where lower(btrim(l.name)) = 'bartender'
on conflict do nothing;

delete from public.network_list_members m
 using public.network_lists v
 where v.id = m.list_id and lower(btrim(v.name)) = 'venues' and m.fuente = 'referencia'
   and m.contacto_id in ('9df4505e-5b0e-40d4-a20c-57f56ac9fe37','a8a23db5-07cb-4da6-b9cd-e2eac02d61ac','f6fba7bc-5d86-40fe-9b90-4f896d24b47c');

-- Comprobacion: «Bartender» debe pasar de 2 a 5 miembros (con Nelson, Maghela y Evelio)
select l.name, count(m.*) as miembros
  from public.network_lists l left join public.network_list_members m on m.list_id = l.id
 where lower(btrim(l.name)) = 'bartender' group by l.name;
