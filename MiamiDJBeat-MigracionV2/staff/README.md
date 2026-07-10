# staff/

Portal **Staff** — Owner, Admin, Manager, Seller.

## Propósito

Experiencia independiente de operación interna: producción, CRM, leads, facturación, órdenes, blueprints y reportes.

## Contiene (futuro)

- Shell con auth gate primero
- Features diferenciadas por rol (`is_staff` / `is_staff_management`)

## No debe contener

- Editor de perfil artístico como landing por defecto
- Tienda del cliente como home
- Herramientas creativas del DJ mezcladas sin separación de permisos

## Dependencias permitidas

- Importa únicamente desde `shared/`
- **Prohibido** importar desde `client/` o `artist/`

## Estado

Scaffold físico — **sin funcionalidad** (TICKET-V2-SCAFFOLD-001).
