# Agenda personal del artista — Miami DJ Beat LLC

**Estado:** `public.artist_agenda` en producción. El portal del artista la consume en vivo.

## Consumo

`web/dj-dashboard.html` (sección **Mi calendario**) hace `SELECT` con el cliente de sesión. RLS limita a `dj_user_id = auth.uid()`. Lista próximos (`starts_at >= now`): fecha, horario, título y notas. Empty state si no hay filas.

## Escritura

El navegador no inserta. Las filas entran por:

- `artist_agenda_record` (ELIXIS, `registrar_evento_agenda`)
- `artist_agenda_record_from_assignment` (`notify-dj-assignment`, source `assignment`)

## Relación con leads

Las cards **Mis Eventos Asignados** siguen leyendo `leads` (CRM: WhatsApp, portal, completar). Son otra superficie, no un reemplazo de `artist_agenda`.
