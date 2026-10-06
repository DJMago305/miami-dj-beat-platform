-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Fathy Dincer: dueno de Conga Bar y de Lombardi's
-- Dato del PO (2026-10-05). Solo escribe empresa y notas de UNA ficha; sigue en «Venues» (los duenos van como venues). Idempotente.
update public.network_referencia_contactos
   set empresa = 'Conga Bar y Lombardi''s (dueno)',
       notas   = case when coalesce(notas,'') like 'Dueno de Conga Bar%' then notas
                      else btrim('Dueno de Conga Bar y de Lombardi''s. Confirmado por el PO. ' || coalesce(notas,'')) end
 where id = '4f5ded13-9347-4dd4-b8e0-534164bb7584';   -- Fathy Dincer (305) 333-7493

-- Comprobacion: la ficha con la empresa y la nota nuevas
select nombre, empresa, notas, telefono
  from public.network_referencia_contactos
 where id = '4f5ded13-9347-4dd4-b8e0-534164bb7584';
