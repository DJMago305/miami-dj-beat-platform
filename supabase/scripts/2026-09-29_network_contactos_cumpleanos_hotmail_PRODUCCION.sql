-- ═══════════════════════════════════════════════════════════════════════
-- ENTORNO: 🔴 PRODUCCIÓN (djmago305@gmail.com's Project · ref hkuvuqupbxwkiykxvqdr)
-- NO es 🧪 mdjb-ensayo. Verificar el ref en la URL del SQL Editor antes de correr.
-- ═══════════════════════════════════════════════════════════════════════
--
-- Ticket: alta de 15 contactos personales de Gerardo A Valle (DJMago305) en
-- public.network_referencia_contactos, recuperados de recordatorios de
-- cumpleaños del calendario de su correo Hotmail (gerardoa4@hotmail.com).
-- + 1 actualización de notas en un contacto ya existente (Mildrey Sotelo).
--
-- Convención confirmada contra filas existentes antes de escribir este script:
--   - Cumpleaños con año desconocido -> birth_date con año centinela 1604
--     (ej. filas "Chavelys Valle" 1604-09-14, "Elisabeth Iglesias" 1604-09-20,
--     mismas que usan origen_csv 'Recordatorios de calendario (gerardoa4@hotmail.com)')
--     + birth_date_year_conocido = false.
--   - origen_persona_id  = '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'
--     origen_persona_nombre = 'Gerardo A Valle (DJMago305)'
--     (mismo patrón que las filas que el usuario agregó directamente)
--   - created_by = mismo uuid que origen_persona_id en filas equivalentes.
--   - "Andy Whitestar" (fila nueva #4) es persona DISTINTA del contacto ya
--     existente "Andy Manager" (id 5861dce9-daa4-4131-aff6-c261bc30dd0b,
--     Guantanamera Cigars) -- esa fila NO se toca.
--
-- Ejecutar dentro de una transacción para poder revisar antes de confirmar.

BEGIN;

INSERT INTO public.network_referencia_contactos
  (nombre, birth_date, birth_date_year_conocido, notas, origen_csv, origen_persona_id, origen_persona_nombre, created_by)
VALUES
  ('Sahily Guzman', '1604-09-29', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Jesus Salado', '1604-09-28', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Magzi Yury Estupinan', '1604-09-28', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Andy Whitestar', '1604-09-27', false,
   'Distinto de "Andy Manager" (contacto ya existente, Guantanamera Cigars) -- no fusionar.',
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Arlet Mena Paz', '1604-09-25', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Yanet Batista', '1604-09-24', false,
   'Vive en North Platte, NE. Originaria de Sagua, Villa Clara, Cuba. Amiga en común con Wendy Ayala (esposa del usuario). Perfil FB: facebook.com/yanet.batista.33',
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Humberto García Cabrera', '1604-09-24', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Yoesvel Llerena Suri', '1604-09-23', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Jc Mary', '1604-09-23', false,
   'Nombre completo en FB: Jc N Mary. Vive en Fort Lauderdale, FL. Originaria de Sagua la Grande (misma ciudad natal del usuario). Owner/Agent en Sebanda Insurance Corp. Perfil FB: facebook.com/normayciro',
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Lorenzo Caraballo', '1604-09-23', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Harent Álvarez Trueba', '1604-09-23', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Horacio Fernandez', '1604-09-22', false, NULL,
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Alexander Villavicencio Perez', '1604-09-21', false,
   'Vive en Naples, FL. Perfil FB: @alexander.villavicencioperez',
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Alejandro Villavicencio Perez', '1604-09-21', false,
   'Vive en La Habana, Cuba. Posible hermano de Alexander Villavicencio Perez (mismo apellido, mismo cumpleaños).',
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'),

  ('Gianni Rodriguez', '1604-09-21', false,
   'Primo del usuario (confirmado). Vive en Miami, FL. Perfil FB: facebook.com/gianni.rodriguez.71',
   'recordatorios_cumpleanos_hotmail_2026-09', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4');

-- Actualización: apéndice de notas en el contacto ya existente "Mildrey Sotelo"
-- (id ed7cb25c-05b2-4049-ac29-b53ea82cc2d6). Al momento de escribir este script
-- su columna notas está en NULL -- se hace un append condicional de todas formas
-- por seguridad, para no pisar contenido si alguien la editó entretanto.
UPDATE public.network_referencia_contactos
SET notas = CASE
              WHEN notas IS NULL OR btrim(notas) = '' THEN
                'Conocida por el usuario como ''Mildre Ulloa'' -- Ulloa es el apellido de su esposo (Sotelo es su apellido real/de soltera). Confirmado por el usuario 2026-09-29 que es la misma persona.'
              ELSE
                notas || E'\n\n' || 'Conocida por el usuario como ''Mildre Ulloa'' -- Ulloa es el apellido de su esposo (Sotelo es su apellido real/de soltera). Confirmado por el usuario 2026-09-29 que es la misma persona.'
            END
WHERE id = 'ed7cb25c-05b2-4049-ac29-b53ea82cc2d6';

COMMIT;

-- ── Verificación (correr después del COMMIT) ──────────────────────────────
-- SELECT id, nombre, birth_date, birth_date_year_conocido, notas, origen_csv
-- FROM public.network_referencia_contactos
-- WHERE origen_csv = 'recordatorios_cumpleanos_hotmail_2026-09'
-- ORDER BY birth_date DESC;
--
-- SELECT id, nombre, notas, birth_date, birth_date_year_conocido
-- FROM public.network_referencia_contactos
-- WHERE id = 'ed7cb25c-05b2-4049-ac29-b53ea82cc2d6';
