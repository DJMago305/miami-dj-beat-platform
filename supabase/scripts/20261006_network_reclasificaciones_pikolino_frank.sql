-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Reclasificaciones pedidas por el PO (2026-10-05)
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

-- Comprobacion: Pikolino solo en «Animador» (6 miembros) y Frank solo en «Sonidista» (3 miembros)
select r.nombre, (select string_agg(l.name, ', ') from public.network_list_members m join public.network_lists l on l.id = m.list_id
                   where m.contacto_id = r.id and m.fuente = 'referencia') as listas
  from public.network_referencia_contactos r
 where r.id in ('54e3507c-5b59-48a5-a257-6029300bcaff', '1ee4d644-c5ac-4f15-8b73-b918e3189259');
