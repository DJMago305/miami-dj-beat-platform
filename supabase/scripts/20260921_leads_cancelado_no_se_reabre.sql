-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr) -- APLICADO 2026-09-21
-- Hallazgo: un DJ (rol authenticated, no staff) podía pasar un evento CANCELLED a COMPLETED con un update directo.
-- Regla nueva dentro de leads_proteger_columnas_de_dinero(): en la rama de no-staff, un evento CANCELLED no cambia de estado
-- (el cambio se descarta y queda un warning LEADS_DINERO_BLOQUEADO con la clave status_reabierto). El staff sí puede reabrir.
-- Cancelar (cualquier estado → CANCELLED) sigue permitido para el cliente y el DJ.
do $t$
declare d text; nuevo text;
begin
  d := pg_get_functiondef('public.leads_proteger_columnas_de_dinero()'::regprocedure);
  if position('status_reabierto' in d) > 0 then return; end if;
  nuevo := replace(d, E'      if coalesce(old.balance_paid, 0) > 0 and new.total_amount is distinct from old.total_amount then',
    E'      if upper(coalesce(old.status, '''')) = ''CANCELLED'' and new.status is distinct from old.status then\n        v_cambios := v_cambios || jsonb_build_object(''status_reabierto'', new.status);\n        new.status := old.status;\n      end if;\n      if coalesce(old.balance_paid, 0) > 0 and new.total_amount is distinct from old.total_amount then');
  if nuevo = d then raise exception 'patrón no encontrado'; end if;
  execute nuevo;
end $t$;
