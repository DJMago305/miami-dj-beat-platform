-- ============================================================
-- ENTORNO: PRODUCCIÓN (ref hkuvuqupbxwkiykxvqdr)
-- Fecha: 2026-09-19
-- Autor: Hilo Maestro (Claude), a pedido explícito del PO: "importa los
--   47 candidatos de negocio pero obviamente sin cuentas en Miami DJ
--   Beat solo como contactos" -- confirmando que van a
--   network_referencia_contactos, igual que el resto del lote de esta
--   noche, hasta que la persona real se suscriba.
-- ============================================================
--
-- Contexto: al auditar si TODOS los archivos de la carpeta de contactos
-- ya estaban importados, se encontró que 6 archivos nunca pasaron por
-- el proceso de categorización FORM1-5 (contactos_personal.csv,
-- contactos_negocio.csv, iphone_contacts_parsed.csv,
-- miamidjbeat_import_negocio.csv, MASTER_miamidjbeat_base_datos.csv,
-- categoria_*.csv). De las 378 personas únicas que aparecían ahí y en
-- ningún otro lado, 47 tenían señal clara de ser contacto de negocio
-- real (otros DJs, clientes, promotores, músicos, cantantes,
-- fotógrafo, técnico de audio) -- el resto es ruido real (bancos,
-- apps, familiares directos) y se deja fuera.
--
-- De esos 47 candidatos, 12 se excluyeron de este insert tras
-- verificar contra la base real:
--   - Chase Business Banking: línea de soporte de un banco, no una
--     persona/proveedor real.
--   - Richard Montalvan / "Richard Montalvo (DJ Richard)" / "Dj Richad
--     Montalvan": mismo correo/teléfono que el "Richard Montalvo" que
--     YA existe en la base (duplicado, no se reinserta).
--   - "Jamie Vargas (Dj Panky)": mismo correo que el "Jamie Vargas" que
--     YA existe (duplicado).
--   - "Jorge Manager": las notas del CSV original dicen que es el
--     manager del EDIFICIO donde vive el PO -- contacto personal, no
--     de negocio de Miami DJ Beat.
--   - "Manoloto Musico": mismo teléfono Y empresa que el "Manoloto" que
--     YA existe -- se enriquece esa fila en vez de duplicar.
--   - "Marichal cantante": mismo nombre+rol ("Cantante") que el
--     "Marichal" que YA existe, sin teléfono propio -- se enriquece esa
--     fila con el correo en vez de duplicar.
--   - "Yoel Casana Cliente" / "Rolando Costumer": sin teléfono ni
--     correo propio, y ya existe un "Yoel"/"Rolando" distinto en la
--     base -- sin dato para diferenciarlos ni para contactarlos, se
--     deja fuera en vez de arriesgar una fusión equivocada.

-- Enriquecer los 2 que YA existían con el dato nuevo que sí traían.
UPDATE public.network_referencia_contactos
   SET email = COALESCE(email, 'marichal.318@hotmail.com')
 WHERE id = '75f904b7-1138-439c-af98-edb709573095'; -- Marichal (Cantante)

UPDATE public.network_referencia_contactos
   SET notas = COALESCE(notas, '') || CASE WHEN notas IS NULL OR notas = '' THEN '' ELSE ' -- ' END || 'Rol: Músico (Mojitos Calle 8).'
 WHERE id = 'b34c1f7d-f350-4b3f-847b-aa75904667b6' AND notas NOT ILIKE '%Rol: Músico%'; -- Manoloto

INSERT INTO public.network_referencia_contactos
  (nombre, telefono, email, empresa, notas, origen_csv, created_by, origen_persona_id, origen_persona_nombre)
VALUES
  ('Alex Chef', '305 469 3356', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Andres Romero Fotografo', '+13058429025', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Antonio  Nogueira Cliente', NULL, NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Bernan Promotor', '9549999033', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Candy Promotora', '(786) 372-5148', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Claudia Cliente', '+17862225197', NULL, 'Doral Hyundai', NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Cubanflow Lestel', NULL, 'cubanflowmusic@gmail.com', NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Daniela  Cliente', NULL, NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('DIzcar DJ Drops', '+584124788203', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Andres', '7863703080', 'andresfy10@yahoo.es', NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Cuba', '(347) 841-2330', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Dario', '7864939655', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Erick', '+17864846980', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Frend', '3058342369', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Melao', '+17862889920', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Papiro', '7863022623', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Reflex', NULL, 'xoverloadentx@aol.com', NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('DJ Roger  Amigo De Dj Manialvarez', NULL, NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Romeo', '(305) 487-0437', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('DJ Yery Cruz', '+1 (305) 339-4028', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Dj Zona', '(786) 510-0423', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Eddy Cliente', '7029083799', NULL, 'Hyundai', NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Gerardo Tecnologi Proo Audio', '3055398863', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Gladys  Marrero Costumer', NULL, NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('henry cuesta', NULL, 'mwproduction1@gmail.com', NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Isidro Musico', '3053008075', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Jorge Felix Animador', '(954) 325-3404', NULL, NULL, NULL, 'iphone_contacts_parsed.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Josue El Galan  Ex Cantante De La Charanga', NULL, NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Juan Carlos Linares', NULL, 'djlinares63@hotmail.com', NULL, 'Correo normalizado -- el CSV original traía el prefijo "www." pegado (www.djlinares63@hotmail.com).', 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Music Productions', NULL, 'info@school-music-productions.com', NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Riko Cantante', '3053609693', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Sandra  Cliente', NULL, NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Toreros Brasilian Restaurant', '+13055498202', NULL, NULL, NULL, 'iphone_contacts_parsed.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Yasmany Manager', '7867079958', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)'),
  ('Yurima Cantante', '(786) 651-7383', NULL, NULL, NULL, 'contactos_personal.csv', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4', 'Gerardo A Valle (DJMago305)');

NOTIFY pgrst, 'reload schema';
