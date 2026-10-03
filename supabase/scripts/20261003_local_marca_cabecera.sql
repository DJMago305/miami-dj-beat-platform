-- 🔴 PRODUCCIÓN (proyecto hkuvuqupbxwkiykxvqdr). Aditivo e idempotente.
-- YA APLICADO en producción el 2026-10-03 por el PO y verificado (4 columnas, restricción de ajuste, función solo para authenticated; probado con rollback y con la subida real).
-- Marca del LOCAL (decisión del PO, 2026-10-03): la cabecera (héroe) y el logo son del local, no de una sola cuenta: todo el equipo
-- del local ve la misma marca, y SOLO el dueño del local (o el Owner/admin de la plataforma) puede cambiarla y ajustarla.
-- `venues.cover_image_url` ya existe (se llena desde staff-admin). Aquí se agregan el logo y el ajuste de la cabecera (posición y zoom).
-- Requiere 20261003_equipo_del_local_roles.sql (is_venue_owner).

alter table public.venues add column if not exists brand_logo_url text;
alter table public.venues add column if not exists cover_focal_x numeric not null default 50;
alter table public.venues add column if not exists cover_focal_y numeric not null default 50;
alter table public.venues add column if not exists cover_zoom    numeric not null default 100;

alter table public.venues drop constraint if exists venues_cover_ajuste_check;
alter table public.venues add constraint venues_cover_ajuste_check check (
  cover_focal_x between 0 and 100 and cover_focal_y between 0 and 100 and cover_zoom between 100 and 300
);

-- Única vía para que un dueño cambie la marca de su local. Las políticas de escritura de `venues` siguen siendo solo del staff
-- de la plataforma; esta función solo toca las columnas de marca y comprueba quién llama.
create or replace function public.venue_set_branding(
  p_venue_id uuid, p_logo_url text, p_cover_url text, p_focal_x numeric, p_focal_y numeric, p_zoom numeric
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not (public.is_venue_owner(p_venue_id) or public.is_platform_admin(auth.uid())) then
    raise exception 'venue_branding_not_owner';
  end if;
  -- Solo imágenes del almacenamiento propio (bucket avatars), nunca enlaces externos.
  if p_logo_url  is not null and (char_length(p_logo_url)  > 600 or p_logo_url  !~ '^https://[^/]+/storage/v1/object/public/avatars/') then
    raise exception 'venue_branding_invalid_logo';
  end if;
  if p_cover_url is not null and (char_length(p_cover_url) > 600 or p_cover_url !~ '^https://[^/]+/storage/v1/object/public/avatars/') then
    raise exception 'venue_branding_invalid_cover';
  end if;
  if p_focal_x is null or p_focal_y is null or p_zoom is null
     or p_focal_x not between 0 and 100 or p_focal_y not between 0 and 100 or p_zoom not between 100 and 300 then
    raise exception 'venue_branding_invalid_adjust';
  end if;
  update public.venues
     set brand_logo_url = p_logo_url, cover_image_url = p_cover_url,
         cover_focal_x = p_focal_x, cover_focal_y = p_focal_y, cover_zoom = p_zoom, updated_at = now()
   where id = p_venue_id;
end;
$$;
revoke all on function public.venue_set_branding(uuid, text, text, numeric, numeric, numeric) from public, anon;
grant execute on function public.venue_set_branding(uuid, text, text, numeric, numeric, numeric) to authenticated;
