-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Plantillas de la campaña «Campaña reseñas»: pedir una reseña de Google a clientes reales después de su evento
-- (SMS y correo, español e inglés). Van en la tabla que ya usa «Mensajes del Sistema → Tools»; la sección
-- «Campañas» del Network lee las filas con ocasion «Campaña …» y la agrupa sola. Idempotente: no duplica.
-- Solo escribe en public.system_messages_templates.
--
-- ⚠ ANTES DE ENVIAR NADA: el enlace de reseñas de Google NO está puesto. Cada plantilla trae el marcador
--   [PEGAR ENLACE DE RESEÑAS DE GOOGLE]. Copia el enlace desde el Perfil de Empresa de Google
--   («Pedir reseñas»), compruébalo (debe abrir Miami DJ Beat 5.0) y corre el UPDATE del final de este archivo.
-- Reglas de Google: pedirlo a TODOS los clientes (sin filtrar), sin regalos ni descuentos, sin dictar el texto.
INSERT INTO public.system_messages_templates (nombre, cuerpo, ocasion, link_url, creado_por)
SELECT v.nombre, v.cuerpo, v.ocasion, v.link_url, '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'::uuid
FROM (VALUES
 ('Reseñas Google — después del evento (SMS, español)',
  'Hola, soy Gerardo de Miami DJ Beat. Gracias por confiarnos su evento. Si tiene 1 minuto, una reseña sincera en Google nos ayuda a que otras familias nos encuentren: [PEGAR ENLACE DE RESEÑAS DE GOOGLE] . Responda STOP para no recibir más mensajes.',
  'Campaña reseñas', NULL),
 ('Reseñas Google — después del evento (SMS, English)',
  'Hi, this is Gerardo from Miami DJ Beat. Thank you for trusting us with your event. If you have 1 minute, an honest Google review helps other families find us: [PEGAR ENLACE DE RESEÑAS DE GOOGLE] . Reply STOP to opt out.',
  'Campaña reseñas', NULL),
 ('Reseñas Google — después del evento (CORREO, español)',
  E'Asunto: Gracias por su evento\n\nHola {nombre},\n\nFue un gusto ser parte de su evento. Esperamos que usted y sus invitados lo hayan disfrutado.\n\nSi tiene un minuto, nos ayudaría mucho una reseña sincera en Google. Así otras familias pueden conocer cómo es trabajar con nosotros:\n\n[PEGAR ENLACE DE RESEÑAS DE GOOGLE]\n\nSi algo no estuvo a la altura, también nos interesa saberlo: puede escribirme directamente a este correo o al (305) 607-1780 (llamadas en español; en inglés, por texto).\n\nGracias de nuevo.\n\nGerardo A. Valle\nMiami DJ Beat LLC · miamidjbeat.com',
  'Campaña reseñas', NULL),
 ('Reseñas Google — después del evento (CORREO, English)',
  E'Subject: Thank you for your event\n\nHi {nombre},\n\nIt was a pleasure being part of your event. We hope you and your guests had a great time.\n\nIf you have a minute, an honest Google review would help other families learn what it is like to work with us:\n\n[PEGAR ENLACE DE RESEÑAS DE GOOGLE]\n\nIf anything fell short, we want to know too: reply to this email or text us at (305) 607-1780.\n\nThank you again.\n\nGerardo A. Valle\nMiami DJ Beat LLC · miamidjbeat.com',
  'Campaña reseñas', NULL),
 ('Reseñas Google — recordatorio único (SMS, español)',
  'Hola, un recordatorio amable de Miami DJ Beat: si aún tiene 1 minuto, su reseña en Google nos ayuda muchísimo: [PEGAR ENLACE DE RESEÑAS DE GOOGLE] . ¡Gracias! Responda STOP para no recibir más mensajes.',
  'Campaña reseñas', NULL)
) AS v(nombre, cuerpo, ocasion, link_url)
WHERE NOT EXISTS (SELECT 1 FROM public.system_messages_templates t WHERE t.nombre = v.nombre);

-- ── PASO 2 (cuando tengas el enlace; córrelo aparte, pegando tu enlace entre las comillas) ──────────────────────
-- UPDATE public.system_messages_templates
--    SET cuerpo = replace(cuerpo, '[PEGAR ENLACE DE RESEÑAS DE GOOGLE]', 'PEGA-AQUI-TU-ENLACE'),
--        link_url = 'PEGA-AQUI-TU-ENLACE'
--  WHERE ocasion = 'Campaña reseñas';

-- Verificación (corre aparte):
-- select nombre, ocasion, left(cuerpo, 60) as inicio from public.system_messages_templates where ocasion = 'Campaña reseñas' order by nombre;
