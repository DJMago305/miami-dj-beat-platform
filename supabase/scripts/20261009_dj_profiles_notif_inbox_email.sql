-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr)
-- AJUSTES · PREFERENCIA «avisos de la bandeja por correo» (account-settings.html, casilla #notif-inbox-email).
-- Por qué: la hoja de ajustes guarda dj_profiles.notif_inbox_email, pero esa columna nunca existió en producción (verificado 2026-10-09):
-- cada «Guardar» fallaba en silencio y la preferencia no se conservaba. La casilla nace marcada, así que el valor por defecto es true.
-- Qué hace: agrega la columna (boolean, no nula, por defecto true). Idempotente. NO toca datos existentes (todos quedan en true = comportamiento actual).

alter table public.dj_profiles add column if not exists notif_inbox_email boolean not null default true;

notify pgrst, 'reload schema';

-- ── Comprobación (solo lectura). Esperado: columna=1, filas_en_false=0 ──
select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'dj_profiles' and column_name = 'notif_inbox_email') as columna,
       (select count(*) from public.dj_profiles where notif_inbox_email is not true) as filas_en_false;
