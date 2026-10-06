-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Jose Web Side: hace paginas web (proveedor), lo conocio en Cachita's; NO es contacto de un venue
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

-- Comprobacion: la ficha con empresa «Web Side (paginas web)»; «Proveedores» pasa de 10 a 11 y «Venues» baja en 1
select r.nombre, r.empresa, r.notas, r.telefono,
       (select string_agg(l.name, ', ') from public.network_list_members m join public.network_lists l on l.id = m.list_id
         where m.contacto_id = r.id and m.fuente = 'referencia') as listas
  from public.network_referencia_contactos r
 where r.id = '174fc214-cfc6-421e-900b-e24c5f41f34f';
