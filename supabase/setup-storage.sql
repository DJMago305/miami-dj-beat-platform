-- ───────────────────────────────────────────────────────────
-- Supabase Storage Setup for App Installers
-- ───────────────────────────────────────────────────────────

-- Create a bucket for the installers
insert into storage.buckets (id, name, public)
values ('installers', 'installers', true)
on conflict (id) do nothing;

-- Set up access policies for the 'installers' bucket
-- Allow public read access to everyone
create policy "Public Access to Installers"
on storage.objects for select
using ( bucket_id = 'installers' );

-- Staff (admin / manager / seller): aplicar migración 20260430180000_staff_roles_unify_is_staff.sql
-- que define public.is_staff(uuid) y políticas "Staff can upload/update installers".
-- Si el bucket aún usa políticas antiguas "Managers can upload installers", sustituir por la migración.
