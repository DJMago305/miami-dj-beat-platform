-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido del PO: "sigue revisando el
--   resto de la lista de 300" -- cruce de teléfonos (últimos 7 dígitos)
--   contra las 944 fichas completas de network_referencia_contactos.
-- ============================================================
--
-- 4 duplicados exactos confirmados y corregidos (misma persona, mismo
-- teléfono, mismo contexto -- no requieren juicio del PO):

-- Evelio (bare) duplica a Evelio Olozabar (mismo telefono, misma empresa Conga Bar)
DELETE FROM public.network_list_members WHERE fuente='referencia' AND contacto_id='1bfd03b2-40bd-461e-aca2-4622dcc8d5f1';
DELETE FROM public.network_referencia_contactos WHERE id='1bfd03b2-40bd-461e-aca2-4622dcc8d5f1';

-- Jorge Felix Animador (agregado esta noche) duplica a Jorge Felix (ya existia, FORM1) -- se enriquece el original con el rol
UPDATE public.network_referencia_contactos SET notas = 'Animador.' WHERE id='ad15d734-8feb-47f1-b743-373d938dca5a';
DELETE FROM public.network_list_members WHERE fuente='referencia' AND contacto_id='024f12eb-dc27-458c-978e-b2d75a073142';
DELETE FROM public.network_referencia_contactos WHERE id='024f12eb-dc27-458c-978e-b2d75a073142';

-- Miguel (bare) duplica a Miguel Manager (mismo telefono, misma empresa, mismas notas)
DELETE FROM public.network_list_members WHERE fuente='referencia' AND contacto_id='32a2c1c5-dccb-49cd-be2b-393b88ccc506';
DELETE FROM public.network_referencia_contactos WHERE id='32a2c1c5-dccb-49cd-be2b-393b88ccc506';

-- "Alain Paparazzi Cubano" (fila aparte) duplica a "Alain" con empresa=Paparazzi Cubano (mismo telefono)
DELETE FROM public.network_list_members WHERE fuente='referencia' AND contacto_id='59e4b8c6-d84a-4aa7-92fa-51c666c0434c';
DELETE FROM public.network_referencia_contactos WHERE id='59e4b8c6-d84a-4aa7-92fa-51c666c0434c';

-- Nota: "Alfredo Machado" x2 (mismo telefono) NO es duplicado -- es
-- doble listado intencional (artista/sonidista Y proveedor de audio),
-- confirmado por el PO 2026-09-18, cruzado en sus propias notas.

-- Pendientes de confirmar con el PO (mismo telefono, pero nombres/
-- contexto distintos -- no se tocan sin su palabra):
--   - Biologicol Dad / Hijos Papito Torre
--   - Liam Enier / Liam Monzon
--   - Toreros Brasilian Restaurant / Rio Grande Churrascaria (antes La Cueva del Pirata)
--   - MIAMI DJ BEAT LLC / MIAMIDJBEATLLC Valle (autoregistros del PO, ya dejados así a propósito)

NOTIFY pgrst, 'reload schema';

-- 2026-09-19 (continuación, confirmado por el PO en el chat): "Liam
-- Enier" y "Liam Monzon" SÍ son la misma persona (mismo teléfono);
-- "Enier" es su nombre real. Se fusiona conservando "Liam Enier",
-- se agrega la empresa "Flujo Tv" de la fila duplicada, y se borra esa
-- fila duplicada.
UPDATE public.network_referencia_contactos
   SET empresa = 'Flujo Tv',
       notas = 'Nombre real: Enier. "Monzon" y "Liam Monzon" eran variantes del mismo contacto, fusionadas.'
 WHERE id = 'e562d362-3d30-468f-a094-54791546e044';

DELETE FROM public.network_list_members WHERE fuente='referencia' AND contacto_id='396d7255-2593-4b83-8f88-fe3fdc1936df';
DELETE FROM public.network_referencia_contactos WHERE id='396d7255-2593-4b83-8f88-fe3fdc1936df';

-- 2026-09-19 (continuación, confirmado por el PO): "Toreros Brasilian
-- Restaurant" es el mismo local que "Rio Grande Churrascaria" bajo un
-- nombre viejo -- ya no se llama Toreros. Se fusiona conservando Rio
-- Grande (nombre actual, ya documentado) y se amplía su nota con el
-- historial completo del local.
UPDATE public.network_referencia_contactos
   SET notas = 'Venue real — 1255 W 46th St Ste 27, Hialeah FL 33012. Antes fue "La Cueva del Pirata" y también "Toreros Brasilian Restaurant" -- ya no es ninguno de los dos, ahora es Rio Grande Churrascaria (a veces mantienen "La Cueva del Pirata" como noche temática los sábados). Sitio: riograndechurrascaria.com'
 WHERE id = 'a53ba0ba-74a9-4bcb-aaa8-c1dd4dec8a3d';

DELETE FROM public.network_list_members WHERE fuente='referencia' AND contacto_id='fb92fd2a-ddd3-4f91-8519-2d5a809fa364';
DELETE FROM public.network_referencia_contactos WHERE id='fb92fd2a-ddd3-4f91-8519-2d5a809fa364';
