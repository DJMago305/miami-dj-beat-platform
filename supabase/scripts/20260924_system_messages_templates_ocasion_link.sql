-- ENTORNO: PRODUCCIÓN (hkuvuqupbxwkiykxvqdr) -- aplicado directo, aditivo,
-- system_messages_templates tenía 0 filas al momento de aplicar esto.
--
-- Banco de tarjetas de invitación por ocasión (pedido del PO, 2026-09-23,
-- pospuesto a esta sesión). Extiende la tabla de plantillas que ya existe
-- (system_messages_templates, Tools en Mensajes del Sistema) en vez de
-- inventar una tabla nueva -- ocasion/link_url quedan opcionales para no
-- romper las plantillas simples de solo texto que ya soportaba.

alter table public.system_messages_templates
  add column if not exists ocasion text,
  add column if not exists link_url text;

-- Copy real dado por el PO, tal cual, sin reescribir (feedback_never_invent_product_names).
insert into public.system_messages_templates (nombre, ocasion, cuerpo, link_url)
values
  ('Cumpleaños — invitación 1', 'Cumpleaños',
   'Hola Mildred, creemos que muy pronto es tu cumpleaños y creemos que te interesaría chequear una lista de propuestas que tenemos diseñadas para que hagas de tu cumpleaños una fiesta inolvidable.',
   './private-family-dj.html'),
  ('Cumpleaños — invitación 2', 'Cumpleaños',
   'Hola Mildred, ya se acerca tu cumpleaños y seguramente que estarás festejándolo con tus amistades y seres queridos. ¿Qué tal si le echas un vistazo a los paquetes de entretenimiento que tenemos diseñados para fiestas de cumpleaños?',
   './private-family-dj.html');
