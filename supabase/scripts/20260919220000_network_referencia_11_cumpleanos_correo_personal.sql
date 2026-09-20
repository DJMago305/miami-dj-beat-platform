-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Origen: recordatorios de calendario del correo personal
-- gerardoa4@hotmail.com del PO (ya archivados), también guardados en
-- su hoja "Miami DJ Beat - Banco de Contactos" (pestaña Familia).
-- Aportados por el hilo GEO·SEO·IA, confirmados por el PO explícitamente
-- en el chat ("sí, importa los 11 así").
--
-- Solo se conoce mes/día real -- año desconocido, mismo placeholder
-- 1604 + birth_date_year_conocido=false que ya usa el resto de Network
-- para este caso (ver 20260919070000_network_referencia_cumpleanos.sql).
-- Chavelys Valle es prima confirmada del PO -> categoría Familia
-- (network_lists id f91092e6-c408-4f05-9bcf-834ebf20ac22) + nota. El
-- resto entra SIN categoría -- el PO no ha confirmado su relación.
-- ============================================================

INSERT INTO public.network_referencia_contactos
  (nombre, birth_date, birth_date_year_conocido, notas, origen_csv, created_by, origen_persona_id, origen_persona_nombre)
VALUES
  ('Elisabeth Iglesias',      '1604-09-20', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Genadys Verdecia Romero', '1604-09-20', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Kenny Gonzalez',          '1604-09-18', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Fabio Ramis',             '1604-09-17', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Yuniesky Diaz',           '1604-09-14', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Chavelys Valle',          '1604-09-14', false, 'Prima del PO (Gerardo A Valle).', 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Naki Olano Machado',      '1604-09-12', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Luisjavier Rodriguez',    '1604-09-12', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Jaren Perez',             '1604-09-12', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Osvi Galessi Villa',      '1604-09-12', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Eliana Morales',          '1604-09-11', false, NULL, 'Recordatorios de calendario (gerardoa4@hotmail.com)', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)');

-- Chavelys Valle -> categoría Familia
INSERT INTO public.network_list_members (list_id, fuente, contacto_id)
SELECT 'f91092e6-c408-4f05-9bcf-834ebf20ac22', 'referencia', id
FROM public.network_referencia_contactos
WHERE nombre = 'Chavelys Valle' AND origen_csv = 'Recordatorios de calendario (gerardoa4@hotmail.com)';
