-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- YA APLICADO el 2026-09-19 vía apply_migration
-- ("calendar_caldav_apple_columns"). Este archivo es el ESPEJO en el repo, reconstruido el 2026-09-21
-- desde el esquema real de producción (nombres, tipos, FK y comentarios verificados con pg_attribute).
-- Columnas para conectar Apple/iCloud Calendar (CalDAV) en user_calendar_integrations.

alter table public.user_calendar_integrations
  add column if not exists caldav_username text,
  add column if not exists caldav_password_secret_id uuid references vault.secrets(id) on delete set null,
  add column if not exists caldav_principal_url text,
  add column if not exists caldav_calendar_url text;

comment on column public.user_calendar_integrations.caldav_username is 'Apple ID (email) usado para CalDAV -- solo aplica a provider=apple.';
comment on column public.user_calendar_integrations.caldav_password_secret_id is 'Referencia a vault.secrets -- la contraseña de aplicación de Apple, cifrada. Nunca se guarda en texto plano.';
comment on column public.user_calendar_integrations.caldav_principal_url is 'URL del principal CalDAV descubierta en la conexión (p.ej. https://pXX-caldav.icloud.com/<id>/principal/).';
comment on column public.user_calendar_integrations.caldav_calendar_url is 'URL de la colección de calendario CalDAV descubierta (donde se leen/escriben los eventos).';
