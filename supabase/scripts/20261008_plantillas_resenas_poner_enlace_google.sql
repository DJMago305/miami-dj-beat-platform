-- ENTORNO: PRODUCCION (hkuvuqupbxwkiykxvqdr)
-- Pone el enlace oficial de reseñas de Google de «Miami DJ Beat» en las 5 plantillas «Campaña reseñas».
-- El enlace sale del propio Perfil de Empresa de Google del PO (botón «Solicita opiniones») y se comprobó que abre
-- la ficha «Miami DJ Beat» (5.0, 23 opiniones). Solo escribe en public.system_messages_templates, solo ocasion «Campaña reseñas».
-- Idempotente: si ya no queda el marcador, no cambia nada de texto.
UPDATE public.system_messages_templates
   SET cuerpo   = replace(cuerpo, '[PEGAR ENLACE DE RESEÑAS DE GOOGLE]', 'https://g.page/r/CZ8sj92dk8PPEBM/review'),
       link_url = 'https://g.page/r/CZ8sj92dk8PPEBM/review'
 WHERE ocasion = 'Campaña reseñas';

-- Verificación (corre aparte): con_marcador debe dar 0 y con_enlace 5.
-- select count(*) filter (where cuerpo like '%[PEGAR%') as con_marcador, count(*) filter (where cuerpo like '%g.page/r/CZ8sj92dk8PPEBM/review%') as con_enlace from public.system_messages_templates where ocasion = 'Campaña reseñas';
