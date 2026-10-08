-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Plantillas de la campaña «Campaña reencuentro»: saludar a clientes de años pasados (eventos anteriores) para
-- retomar el contacto y contarles que Miami DJ Beat ha crecido y mejorado. SMS/texto y correo, español e inglés.
-- NO llevan enlace de reseñas: la reseña se pide después, con «Campaña reseñas», a quien responda.
-- Van en la tabla que ya usa «Mensajes del Sistema → Tools»; la sección «Campañas» del Network lee las filas con
-- ocasion «Campaña …» y la agrupa sola. Idempotente: no duplica. Solo escribe en public.system_messages_templates.
-- Se envían de uno en uno, desde el teléfono o el correo del dueño, con el nombre de cada cliente en {nombre}.
INSERT INTO public.system_messages_templates (nombre, cuerpo, ocasion, link_url, creado_por)
SELECT v.nombre, v.cuerpo, v.ocasion, v.link_url, '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'::uuid
FROM (VALUES
 ('Reencuentro — clientes de años pasados (SMS, español)',
  'Hola {nombre}, soy Gerardo de Miami DJ Beat. Hace unos años hicimos eventos juntos y quería saludarte. Desde entonces hemos crecido y mejorado mucho nuestros servicios: DJs, sonido, iluminación y producción completa. Ahora tenemos página web, por si quieres echar un vistazo a nuestros productos: https://www.miamidjbeat.com Quedamos a tus órdenes para cualquier evento que tengas. ¡Un abrazo! Responde STOP para no recibir más mensajes.',
  'Campaña reencuentro', NULL),
 ('Reencuentro — clientes de años pasados (SMS, English)',
  'Hi {nombre}, this is Gerardo from Miami DJ Beat. We worked together on your events a few years ago and I wanted to say hello. We have grown and improved a lot since then: DJs, sound, lighting and full production. We now have a website, in case you want to take a look at our products: https://www.miamidjbeat.com We are at your service for any event you have coming up. Reply STOP to opt out.',
  'Campaña reencuentro', NULL),
 ('Reencuentro — clientes de años pasados (CORREO, español)',
  E'Asunto: Un saludo de Miami DJ Beat\n\nHola {nombre},\n\nSoy Gerardo, de Miami DJ Beat. Hace unos años tuvimos el gusto de trabajar contigo en tus eventos y no olvidamos esa confianza.\n\nQuería contarte que hemos crecido y mejorado mucho desde entonces: hoy ofrecemos DJs, sonido, iluminación y producción completa para bodas, quinceañeras, cumpleaños y eventos corporativos.\n\nSi tienes un evento en mente, o conoces a alguien que lo necesite, estamos a tus órdenes. Ahora tenemos página web (antes no la teníamos); si quieres echar un vistazo a nuestros productos, entra aquí: https://www.miamidjbeat.com. Escríbenos o llámanos al (305) 607-1780 (llamadas en español; en inglés, por texto).\n\nUn abrazo,\n\nGerardo A. Valle\nMiami DJ Beat LLC · miamidjbeat.com',
  'Campaña reencuentro', NULL),
 ('Reencuentro — clientes de años pasados (CORREO, English)',
  E'Subject: A hello from Miami DJ Beat\n\nHi {nombre},\n\nThis is Gerardo from Miami DJ Beat. A few years ago we had the pleasure of working with you on your events, and we have not forgotten your trust.\n\nI wanted to let you know that we have grown and improved a lot since then: today we offer DJs, sound, lighting and full production for weddings, quinceañeras, birthdays and corporate events.\n\nIf you have an event coming up, or know someone who does, we are at your service. We now have a website (we did not have one before); if you would like to take a look at our products, visit https://www.miamidjbeat.com. Reply to this email or text us at (305) 607-1780.\n\nWarm regards,\n\nGerardo A. Valle\nMiami DJ Beat LLC · miamidjbeat.com',
  'Campaña reencuentro', NULL)
) AS v(nombre, cuerpo, ocasion, link_url)
WHERE NOT EXISTS (SELECT 1 FROM public.system_messages_templates t WHERE t.nombre = v.nombre);

-- Verificación (corre aparte):
-- select nombre, ocasion, left(cuerpo, 60) as inicio from public.system_messages_templates where ocasion = 'Campaña reencuentro' order by nombre;

-- Si las 4 plantillas ya se cargaron con el texto anterior (sin la frase de la página web), este UPDATE las pone al día (córrelo aparte; es idempotente):
-- UPDATE public.system_messages_templates SET cuerpo = replace(replace(replace(replace(cuerpo,
--  'Quedamos a tus órdenes para cualquier evento que tengas: https://www.miamidjbeat.com ¡Un abrazo!',
--  'Ahora tenemos página web, por si quieres echar un vistazo a nuestros productos: https://www.miamidjbeat.com Quedamos a tus órdenes para cualquier evento que tengas. ¡Un abrazo!'),
--  'We are at your service for any event you have coming up: https://www.miamidjbeat.com Reply',
--  'We now have a website, in case you want to take a look at our products: https://www.miamidjbeat.com We are at your service for any event you have coming up. Reply'),
--  'estamos a tus órdenes. Conoce todo lo que hacemos en https://www.miamidjbeat.com. Escríbenos',
--  'estamos a tus órdenes. Ahora tenemos página web (antes no la teníamos); si quieres echar un vistazo a nuestros productos, entra aquí: https://www.miamidjbeat.com. Escríbenos'),
--  'we are at your service. See everything we do at https://www.miamidjbeat.com. Reply',
--  'we are at your service. We now have a website (we did not have one before); if you would like to take a look at our products, visit https://www.miamidjbeat.com. Reply')
--  WHERE ocasion = 'Campaña reencuentro';
