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

-- Allow authenticated users (managers) to upload/update installers
-- Note: Replace 'MANAGER' logic if using app_metadata or different roles
create policy "Managers can upload installers"
on storage.objects for insert
with check (
  bucket_id = 'installers' AND
  (
    select role from dj_profiles where user_id = auth.uid()
  ) = 'MANAGER'
);

create policy "Managers can update installers"
on storage.objects for update
using (
  bucket_id = 'installers' AND
  (
    select role from dj_profiles where user_id = auth.uid()
  ) = 'MANAGER'
);
