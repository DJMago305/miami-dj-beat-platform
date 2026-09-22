-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr) -- APLICADO 2026-09-21
-- Las cancelaciones mueven dinero (reembolsos / gasto ejecutivo): solo owner, admin y manager las ven y las deciden
-- (is_staff_management); los vendedores (seller) NO. Además el push urgente abre el panel (?cancelaciones=1).
do $t$
declare d text; nuevo text;
begin
  d := pg_get_functiondef('public.staff_atender_cancelacion(uuid,text,text,text,numeric)'::regprocedure);
  if position('is_staff_management' in d) = 0 then
    nuevo := replace(d, 'not public.is_staff(v_uid)', 'not public.is_staff_management(v_uid)');
    if nuevo = d then raise exception 'patrón no encontrado'; end if;
    execute nuevo;
  end if;
  drop policy if exists cancelaciones_ver_staff on public.cancelaciones_solicitadas;
  create policy cancelaciones_ver_staff on public.cancelaciones_solicitadas for select to authenticated using (public.is_staff_management(auth.uid()));
  d := pg_get_functiondef('public._cancelacion_avisar_staff(text,text,jsonb)'::regprocedure);
  if position('cancelaciones=1' in d) = 0 then
    nuevo := replace(d, '''/staff.html''', '''/staff.html?cancelaciones=1''');
    if nuevo = d then raise exception 'patrón url no encontrado'; end if;
    execute nuevo;
  end if;
end $t$;
