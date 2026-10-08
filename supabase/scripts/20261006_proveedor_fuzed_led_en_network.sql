-- ============================================================================
-- ENTORNO: PRODUCCIÓN  (proyecto hkuvuqupbxwkiykxvqdr)
-- Alta del proveedor FUZED Productions (pantallas LED, truss, iluminación) en
-- Network → lista "Proveedores", con precios y condiciones para todo el staff.
-- Idempotente: si el correo ya existe no duplica el contacto ni la membresía.
-- Solo escribe en network_referencia_contactos y network_list_members.
-- ============================================================================

with nuevo as (
  insert into public.network_referencia_contactos
    (nombre, empresa, email, notas, origen_csv, created_by)
  select
    'Chris Caprice',
    'FUZED Productions',
    'info@fuzedproductions.com',
    $notas$PROVEEDOR PANTALLAS LED / TRUSS / ILUMINACIÓN — FUZED Productions
Contacto: Chris Caprice (Sales Team, firmó los precios) y Cassidy Brooks (Business Development, escribió primero). Correo: info@fuzedproductions.com. Web: https://www.fuzedproductions.com. Sin teléfono todavía.
Zona: Miami-Dade, Broward y Palm Beach (otros mercados por cotización).
Servicios: paredes LED con técnico y reproducción de contenido, truss (arcos, marcos de escenario, cabinas de DJ), escenarios e iluminación. Hacen moda, conciertos, corporativos y activaciones de marca.

PRECIOS (respuesta del 2026-10-05):
- Hasta 10'x8': $2,500
- Hasta 10'x10': $3,000
- Hasta 10'x15': $3,500
- Más grande o a medida: se cotiza por evento.
Incluye: paneles LED, procesador, montaje y desmontaje, reproducción básica, entrega estándar en Miami-Dade y un técnico.
Se cotiza aparte: rigging especial, programación compleja, horas extra, viajes fuera de su zona.

CONDICIONES DEL PROVEEDOR:
- 50% de anticipo NO reembolsable para reservar fecha y equipo; saldo 7 días antes del evento.
- Reserva con menos de 7 días: pago completo.
- Cancelación a más de 14 días: el pago se puede transferir una vez a otra fecha. El resto se define en el contrato.
- Aceptan confidencialidad, no solicitación y no elusión de los clientes que MDJB les presente. No aplica a sus clientes anteriores ni a los que consigan por su cuenta.

REGLA MDJB: los clientes son de Miami DJ Beat; toda comunicación con el cliente pasa por MDJB. No se le da al proveedor el precio al cliente ni nuestro margen.

ESTADO (2026-10-05): primer contacto y precios recibidos. NO hay contrato firmado. Pendiente: contrato de proveedor adicional (en revisión legal, no enviar antes), certificado de seguro (COI), referencias y fotos de eventos, calendario de disponibilidad.$notas$,
    'Alta manual 2026-10-05 (correo de FUZED)',
    '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4'::uuid
  where not exists (
    select 1 from public.network_referencia_contactos
    where lower(email) = 'info@fuzedproductions.com'
  )
  returning id
),
existente as (
  select id from public.network_referencia_contactos
  where lower(email) = 'info@fuzedproductions.com'
),
c as (
  select id from nuevo
  union all
  select id from existente
  limit 1
)
insert into public.network_list_members (list_id, fuente, contacto_id)
select '0127d15b-6597-4990-b89b-27e1b532e89d'::uuid, 'referencia', c.id
from c
where not exists (
  select 1 from public.network_list_members m
  where m.list_id = '0127d15b-6597-4990-b89b-27e1b532e89d'::uuid
    and m.contacto_id = c.id
);

-- Verificación (corre aparte):
-- select c.nombre, c.empresa, c.email, l.name as lista
-- from public.network_referencia_contactos c
-- join public.network_list_members m on m.contacto_id = c.id
-- join public.network_lists l on l.id = m.list_id
-- where lower(c.email) = 'info@fuzedproductions.com';
