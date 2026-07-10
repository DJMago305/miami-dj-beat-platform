# client/

Portal **Cliente** — compradores y clientes VIP.

## Propósito

Experiencia independiente para quien contrata servicios: cuenta, pedidos, reservas, checkout y lealtad VIP.

## Contiene (futuro)

- Rutas y layouts del portal cliente
- Features: account, bookings, shop buyer, VIP

## No debe contener

- Herramientas Staff (admin, CRM, facturación)
- Owner strip ni navegación de artista
- Herramientas internas de producción

## Dependencias permitidas

- Importa únicamente desde `shared/`
- **Prohibido** importar desde `artist/` o `staff/`

## Estado

Scaffold físico — **sin funcionalidad** (TICKET-V2-SCAFFOLD-001).
