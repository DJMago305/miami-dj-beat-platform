-- ============================================================================
-- ENTORNO: PRODUCCIÓN  (proyecto hkuvuqupbxwkiykxvqdr)
-- Network → lista "Proveedores": Alfredo Machado como proveedor de AUDIO para CUALQUIER tipo de evento (orden del PO 2026-10-08).
-- Alfredo Machado YA está en Network: contacto bf86e670-6c60-4c26-a285-2eca25e4a400 («Renta equipo de audio»), en la lista «Proveedores» (y otro registro suyo, 1716be7d…, en «Sonidista»).
-- Por eso NO se crea contacto ni membresía nueva (evita duplicados): solo se agrega a sus notas el ALCANCE de lo que provee. No cambia nombre, empresa, teléfono, correo ni listas.
-- Es información interna para el staff. NO incluye costos del proveedor ni el margen de MDJB, y NO afirma que sea el proveedor del paquete de sonido al aire libre (400 a 1,000 personas): eso no está confirmado; si lo es, se agrega en otra línea.
-- Idempotente: si la nota ya tiene el alcance, no la repite.
-- ============================================================================

update public.network_referencia_contactos
   set notas = coalesce(nullif(btrim(notas), ''), '') || case when coalesce(nullif(btrim(notas), ''), '') = '' then '' else E'\n\n' end ||
$alcance$ALCANCE DE SERVICIO (2026-10-08, orden del PO): PROVEEDOR DE AUDIO PARA CUALQUIER TIPO DE EVENTO: bodas, fiestas privadas, corporativos, conciertos y eventos al aire libre.
Equipo de audio de alto poder (line array, subwoofers, micrófonos y mezcladora), con operador de sonido, montaje y desmontaje.
REGLA MDJB: los clientes son de Miami DJ Beat; toda comunicación con el cliente pasa por MDJB. No se le da al proveedor el precio al cliente ni nuestro margen.$alcance$
 where id = 'bf86e670-6c60-4c26-a285-2eca25e4a400'::uuid
   and coalesce(notas, '') not like '%ALCANCE DE SERVICIO (2026-10-08%';

-- Verificación (solo lectura): debe salir 1 fila con la nota que termina en el alcance, y la lista «Proveedores».
select c.nombre, c.empresa, l.name as lista, (c.notas like '%ALCANCE DE SERVICIO (2026-10-08%') as tiene_alcance, length(c.notas) as largo_notas
  from public.network_referencia_contactos c
  join public.network_list_members m on m.contacto_id = c.id
  join public.network_lists l on l.id = m.list_id
 where c.id = 'bf86e670-6c60-4c26-a285-2eca25e4a400'::uuid;
