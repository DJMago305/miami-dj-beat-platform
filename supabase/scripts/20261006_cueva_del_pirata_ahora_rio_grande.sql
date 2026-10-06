-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - «La Cueva del Pirata» ahora es «Rio Grande Churrascaria» (mismo local, 1255 W 46th St Ste 27, Hialeah)
-- Dato del PO (2026-10-05) y notas ya guardadas en la ficha de Rio Grande Churrascaria. Solo escribe network_referencia_contactos.empresa
-- (texto libre, mismo rotulo que ya lleva la ficha del local: conserva el nombre anterior para poder buscarlo). No toca notas, telefonos ni listas.
-- Idempotente: las filas que ya dicen «Rio Grande» no se tocan.
update public.network_referencia_contactos
   set empresa = 'Rio Grande Churrascaria (antes La Cueva del Pirata)'
 where empresa ilike '%cueva%pirata%'
   and empresa not ilike '%rio grande%'
   and id not in ('f82adca2-9574-4f5d-8185-182c63b81bf0','89fc763a-84fa-4ac8-bb84-18a93aa594d7');   -- las dos «Lily» no trabajan ahi: ver su bloque aparte

-- Comprobacion: debe dar  0 filas pendientes  y  todas las del local con el rotulo nuevo
select count(*) filter (where empresa ilike '%cueva%pirata%' and empresa not ilike '%rio grande%') as pendientes,
       count(*) filter (where empresa ilike '%rio grande%') as con_rotulo_nuevo
  from public.network_referencia_contactos;
