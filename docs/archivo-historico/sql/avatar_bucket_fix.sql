-- 1. Crear el Bucket de Storage en Supabase
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 2. Habilitar lectura pública (Para que cualquiera pueda ver tu foto de perfil)
create policy "Public Access to Avatars" 
on storage.objects for select 
using ( bucket_id = 'avatars' );

-- 3. Habilitar inserción (Para que puedas subir tu foto)
create policy "Auth Insert to Avatars" 
on storage.objects for insert 
with check ( bucket_id = 'avatars' and auth.role() = 'authenticated' );

-- 4. Habilitar actualización y borrado (Para que puedas cambiarla)
create policy "Auth Update to Avatars" 
on storage.objects for update 
using ( bucket_id = 'avatars' and auth.uid() = owner ) 
with check ( bucket_id = 'avatars' and auth.uid() = owner );

create policy "Auth Delete to Avatars" 
on storage.objects for delete 
using ( bucket_id = 'avatars' and auth.uid() = owner );
