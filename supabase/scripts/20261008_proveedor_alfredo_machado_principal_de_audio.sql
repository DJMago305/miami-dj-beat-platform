-- ============================================================================
-- ENTORNO: PRODUCCIÓN  (proyecto hkuvuqupbxwkiykxvqdr)
-- Network: Alfredo Machado como PROVEEDOR PRINCIPAL DE AUDIO (pedido del PO 2026-10-08: «cuando se busque un proveedor de audio en Network, que aparezca Alfredo Machado como proveedor principal»).
-- Qué hace: en su contacto de la lista «Proveedores» (bf86e670-6c60-4c26-a285-2eca25e4a400) la empresa pasa de «Renta equipo de audio» a «Proveedor principal de audio para eventos» y se agrega una línea a sus notas.
-- Por qué en «empresa»: es el texto que Network muestra junto al nombre, que ya entiende ELIXIS al buscar, y (con el cambio de código de este mismo trabajo) lo que hace que Network lo ponga PRIMERO y lo encuentre al buscar «audio».
-- NO toca: nombre, teléfono, correo, listas ni el otro registro suyo (Sonidista). Sin costos ni margen. Idempotente.
-- ============================================================================

update public.network_referencia_contactos
   set empresa = 'Proveedor principal de audio para eventos',
       notas = coalesce(nullif(btrim(notas), ''), '') || case when coalesce(nullif(btrim(notas), ''), '') = '' then '' else E'\n\n' end ||
$principal$PROVEEDOR PRINCIPAL DE AUDIO PARA EVENTOS (2026-10-08, orden del PO): cuando se busque un proveedor de audio, Alfredo Machado es la primera opción. Antes figuraba como «Renta equipo de audio».$principal$
 where id = 'bf86e670-6c60-4c26-a285-2eca25e4a400'::uuid
   and (empresa is distinct from 'Proveedor principal de audio para eventos' or coalesce(notas, '') not like '%PROVEEDOR PRINCIPAL DE AUDIO PARA EVENTOS (2026-10-08%');

-- Verificación (solo lectura): empresa nueva, lista «Proveedores», nota con la línea y el alcance anterior intacto.
select c.nombre, c.empresa, l.name as lista, (c.notas like '%PROVEEDOR PRINCIPAL DE AUDIO PARA EVENTOS (2026-10-08%') as tiene_principal, (c.notas like '%ALCANCE DE SERVICIO (2026-10-08%') as conserva_alcance
  from public.network_referencia_contactos c
  join public.network_list_members m on m.contacto_id = c.id
  join public.network_lists l on l.id = m.list_id
 where c.id = 'bf86e670-6c60-4c26-a285-2eca25e4a400'::uuid;
