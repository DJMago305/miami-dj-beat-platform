-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr) -- APLICADO 2026-09-21
-- Hallazgo: la política leads_delete_client deja a un cliente borrar su orden aunque ya tenga pagos (balance_paid > 0),
-- y con ella desaparece el registro del pago. Probado antes de arreglar: cliente con $250 pagados borró 1 fila.
-- Regla: quien no es staff (rol authenticated/anon) NO puede borrar una orden con pagos. El staff y el servidor sí.
create or replace function public.leads_no_borrar_pagados()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if current_user in ('authenticated', 'anon')
     and not (auth.uid() is not null and public.is_staff(auth.uid()))
     and coalesce(old.balance_paid, 0) > 0 then
    raise exception 'ORDEN_CON_PAGOS: esta orden ya tiene pagos y no se puede eliminar; contacta al equipo para cancelarla'
      using errcode = 'P0001';
  end if;
  return old;
end $$;
drop trigger if exists trg_leads_a_no_borrar_pagados on public.leads;
create trigger trg_leads_a_no_borrar_pagados before delete on public.leads
  for each row execute function public.leads_no_borrar_pagados();
