-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: "anays
--   gonzales michel valdes amber son los responsables de la hora loca
--   de baila con micho, ellos deben aparecer también en hora loca".
-- ============================================================
--
-- Los 3 ya existían como contacto de referencia y ya estaban en la
-- categoría "Bailarin/a (Baila Con Micho)" (el grupo general del
-- equipo de baile). El PO pide que, además, queden marcados bajo una
-- categoría "Hora Loca" propia -- son las 3 personas responsables
-- específicamente de ese servicio dentro de Baila Con Micho.

INSERT INTO public.network_lists (id, name, created_by)
VALUES (gen_random_uuid(), 'Hora Loca', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4');

INSERT INTO public.network_list_members (list_id, fuente, contacto_id)
SELECT l.id, 'referencia', r.id
FROM public.network_lists l
JOIN public.network_referencia_contactos r ON r.nombre IN ('Michel Valdez', 'Amber', 'Anays Gonzalez')
WHERE l.name = 'Hora Loca';

NOTIFY pgrst, 'reload schema';
