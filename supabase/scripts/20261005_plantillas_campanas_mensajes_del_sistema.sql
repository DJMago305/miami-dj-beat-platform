-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Plantillas de las campañas de invitación (artistas: suscripción gratis; clientes: «arma tu fiesta» por
-- cumpleaños, 3 semanas y 1 semana antes), en la tabla que ya usa «Mensajes del Sistema → Tools».
-- La sección «Campañas» del Network lee estas mismas filas (ocasion «Campaña …»). Idempotente: no duplica.
-- (Ya aplicado en producción por el PO el 2026-10-05; este archivo deja la constancia en Git.)
INSERT INTO public.system_messages_templates (nombre, cuerpo, ocasion, link_url, creado_por)
SELECT v.nombre, v.cuerpo, v.ocasion, v.link_url, '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'::uuid
FROM (VALUES
 ('Artistas — suscripción gratis (SMS)',
  'Hola, te invitamos a suscribirte gratis como artista en la plataforma de Miami DJ Beat: https://www.miamidjbeat.com/login.html?signup=free&redirect=jobs . Responde STOP para no recibir más mensajes.',
  'Campaña artistas', 'https://www.miamidjbeat.com/login.html?signup=free&redirect=jobs'),
 ('Artistas — suscripción gratis (CORREO)',
  E'Asunto: Te invitamos a Miami DJ Beat\n\nHola {nombre},\n\nSoy Gerardo, de Miami DJ Beat. Estamos abriendo la plataforma a artistas y queremos que estés dentro.\n\nSuscríbete gratis aquí: https://www.miamidjbeat.com/login.html?signup=free&redirect=jobs\n\nCualquier duda, respóndeme a este correo.\n\nGerardo A. Valle · Miami DJ Beat LLC',
  'Campaña artistas', 'https://www.miamidjbeat.com/login.html?signup=free&redirect=jobs'),
 ('Clientes — cumpleaños, 3 semanas antes (SMS)',
  'Hola, se acerca tu cumpleaños. Arma tu fiesta con Miami DJ Beat: crea tu cuenta gratis https://www.miamidjbeat.com/login.html?signup=free y escoge DJ, Hora Loca o cantantes en https://www.miamidjbeat.com/party-planner.html . Responde STOP para no recibir más mensajes.',
  'Campaña clientes', 'https://www.miamidjbeat.com/party-planner.html'),
 ('Clientes — cumpleaños, 3 semanas antes (CORREO)',
  E'Asunto: Se acerca tu cumpleaños: arma tu fiesta con Miami DJ Beat\n\nHola {nombre},\n\nSoy Gerardo, de Miami DJ Beat. Se acerca tu cumpleaños y queremos ayudarte a armar tu fiesta.\n\n1) Crea tu cuenta gratis: https://www.miamidjbeat.com/login.html?signup=free\n2) Arma tu fiesta (DJ, Hora Loca, cantantes): https://www.miamidjbeat.com/party-planner.html\n\nCualquier duda, respóndeme a este correo.\n\nGerardo A. Valle · Miami DJ Beat LLC',
  'Campaña clientes', 'https://www.miamidjbeat.com/party-planner.html'),
 ('Clientes — cumpleaños, 1 semana antes (SMS)',
  'Hola, en una semana es tu cumpleaños. Todavía estás a tiempo de armar tu fiesta con Miami DJ Beat: crea tu cuenta gratis https://www.miamidjbeat.com/login.html?signup=free y escoge DJ, Hora Loca o cantantes en https://www.miamidjbeat.com/party-planner.html . Responde STOP para no recibir más mensajes.',
  'Campaña clientes', 'https://www.miamidjbeat.com/party-planner.html'),
 ('Clientes — cumpleaños, 1 semana antes (CORREO)',
  E'Asunto: Falta una semana para tu cumpleaños: arma tu fiesta con Miami DJ Beat\n\nHola {nombre},\n\nSoy Gerardo, de Miami DJ Beat. En una semana es tu cumpleaños y todavía estás a tiempo de armar tu fiesta.\n\n1) Crea tu cuenta gratis: https://www.miamidjbeat.com/login.html?signup=free\n2) Arma tu fiesta (DJ, Hora Loca, cantantes): https://www.miamidjbeat.com/party-planner.html\n\nCualquier duda, respóndeme a este correo.\n\nGerardo A. Valle · Miami DJ Beat LLC',
  'Campaña clientes', 'https://www.miamidjbeat.com/party-planner.html')
) AS v(nombre, cuerpo, ocasion, link_url)
WHERE NOT EXISTS (SELECT 1 FROM public.system_messages_templates t WHERE t.nombre = v.nombre);
