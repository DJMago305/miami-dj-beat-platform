-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO tras revisar
--   a mano el lote de 300 contactos importados esta noche.
-- ============================================================
--
-- 1) "Alex Baila Con Micho" y "Victor Sahylin Bailaconmicho": el PO
--    aclaró que NO son parte del grupo Baila Con Micho -- son amigos
--    cercanos del grupo (de ahí el nombre, puesto así solo para
--    diferenciarlos) y en realidad son clientes potenciales que van
--    seguido a los lugares donde el PO toca. Se marcan como "Cliente"
--    con nota explicando el origen del nombre.
--
-- 2) "Bladimer Timbalero" y "Benjamin Timbalero": el PO confirmó que
--    son DOS personas distintas (mismo oficio, teléfonos distintos,
--    verificado). Se crea la categoría "Timbalero" para los dos, con
--    nota cruzada en cada ficha aclarando que no son la misma persona
--    -- pedido explícito para "no confundir a ELIXIS" cuando use esta
--    lista más adelante.

UPDATE public.network_referencia_contactos
   SET notas = 'Cliente potencial -- amigo cercano de gente de Baila Con Micho (de ahi el nombre), pero no forma parte del grupo. Va frecuentemente a los lugares donde toca el PO.'
 WHERE nombre IN ('Alex Baila Con Micho', 'Victor  Sahylin Bailaconmicho');

INSERT INTO public.network_list_members (list_id, fuente, contacto_id)
SELECT (SELECT id FROM public.network_lists WHERE name = 'Cliente'), 'referencia', id
FROM public.network_referencia_contactos
WHERE nombre IN ('Alex Baila Con Micho', 'Victor  Sahylin Bailaconmicho');

INSERT INTO public.network_lists (id, name, created_by)
VALUES (gen_random_uuid(), 'Timbalero', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4');

INSERT INTO public.network_list_members (list_id, fuente, contacto_id)
SELECT (SELECT id FROM public.network_lists WHERE name = 'Timbalero'), 'referencia', id
FROM public.network_referencia_contactos
WHERE nombre IN ('Bladimer Timbalero', 'Benjamin Timbalero');

UPDATE public.network_referencia_contactos
   SET notas = COALESCE(notas,'') || CASE WHEN notas IS NULL OR notas='' THEN '' ELSE ' -- ' END || 'Timbalero distinto de Benjamin Timbalero (mismo oficio, personas diferentes, telefonos distintos).'
 WHERE nombre = 'Bladimer Timbalero';

UPDATE public.network_referencia_contactos
   SET notas = COALESCE(notas,'') || CASE WHEN notas IS NULL OR notas='' THEN '' ELSE ' -- ' END || 'Timbalero distinto de Bladimer Timbalero (mismo oficio, personas diferentes, telefonos distintos).'
 WHERE nombre = 'Benjamin Timbalero';

NOTIFY pgrst, 'reload schema';
