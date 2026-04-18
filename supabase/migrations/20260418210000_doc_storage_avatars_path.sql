-- Frontend (dj-dashboard, account-settings) must upload to bucket `avatars` with object name
-- `{auth.uid()}/...` so existing policies on storage.objects pass:
--   (storage.foldername(name))[1] = auth.uid()::text
-- Paths like `avatars/<uid>.jpg` or bucket `dj-photos` without matching policies caused RLS insert failures.
SELECT 1;
