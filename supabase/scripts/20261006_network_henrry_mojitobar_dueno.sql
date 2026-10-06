-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Henrry (Mojitobar): es el DUENO de Mojitobar, ahora en Dolphin Mall (antes en Bayside)
-- Dato del PO (2026-10-05). Corrige solo esta ficha: era una nota de «verificar si sigue trabajando ahi». Sigue en «Venues» (los duenos van como venues).
-- Idempotente: si la nota ya dice «Dueno de Mojitobar», no se toca.
update public.network_referencia_contactos
   set empresa = 'Mojitobar (Dolphin Mall; antes Bayside)',
       notas   = 'Dueno de Mojitobar. Hoy el local activo es Dolphin Mall; antes estaba en Bayside (cerrado). Confirmado por el PO.'
 where id = '00a6b19f-4b8d-4f8f-a142-c9017c3ff2cf'      -- Henrry (+1 954 495-5986)
   and coalesce(notas,'') not like 'Dueno de Mojitobar%';

-- Comprobacion: la ficha con la empresa y la nota nuevas, y en la lista «Venues»
select r.nombre, r.empresa, r.notas, r.telefono,
       (select string_agg(l.name, ', ') from public.network_list_members m join public.network_lists l on l.id = m.list_id
         where m.contacto_id = r.id and m.fuente = 'referencia') as listas
  from public.network_referencia_contactos r
 where r.id = '00a6b19f-4b8d-4f8f-a142-c9017c3ff2cf';
