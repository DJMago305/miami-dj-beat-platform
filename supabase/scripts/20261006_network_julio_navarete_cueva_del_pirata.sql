-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Julio Navarete: era manager de La Cueva del Pirata (ahora Rio Grande), NO de Conga Bar
-- Dato del PO (2026-10-05): en Conga Bar estuvo muy poco tiempo. Solo escribe empresa y notas de UNA ficha. No cambia listas ni telefono.
-- Idempotente: si la nota ya esta, no se vuelve a agregar.
update public.network_referencia_contactos
   set empresa = 'Rio Grande Churrascaria (antes La Cueva del Pirata)',
       notas   = case when coalesce(notas,'') like '%poco tiempo en Conga Bar%' then notas
                      else btrim(coalesce(notas,'') || ' Manager de La Cueva del Pirata (ahora Rio Grande Churrascaria); estuvo muy poco tiempo en Conga Bar.') end
 where id = '1b955c78-f294-4575-b229-0d8bc27e2639';   -- Julio Navarete, (786) 506-4893

-- Comprobacion: debe dar  1 fila con empresa «Rio Grande Churrascaria (antes La Cueva del Pirata)»
select nombre, empresa, notas, telefono
  from public.network_referencia_contactos
 where id = '1b955c78-f294-4575-b229-0d8bc27e2639';
