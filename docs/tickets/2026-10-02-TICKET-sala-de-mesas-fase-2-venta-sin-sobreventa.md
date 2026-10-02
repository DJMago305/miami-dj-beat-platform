# TICKET — Sala de mesas, Fase 2: venta real sin sobreventa, con Cliente Comercial

**Fecha:** 2026-10-02 · **Origen:** el PO, al ver la maqueta (fase 1, `venue-room.html`, EN DESARROLLO).
**Estado:** proyecto grande, **a medias y en desarrollo por decisión del PO**: la maqueta (fase 1) queda lista y esta fase 2 se construye aparte. Requisitos documentados, NO construido. Depende de decisiones del PO (sección 4).

## 1. Lo que pidió el PO
1. El plano se **enlaza con la cuenta de Cliente Comercial** (dueño/manager del local).
2. **Nunca se puede sobrevender una mesa.**
3. Los managers deben **ver en vivo qué mesa ya se vendió en línea**.
4. Los managers deben poder **vender mesas por aquí** y **marcarlas como reservadas** desde la plataforma.
5. **Cualquier miembro del staff de la cuenta de Cliente Comercial** puede poner una mesa en espera (hold) o reservada, y también **vender una entrada desde ahí** si hace falta.
6. **Cualquier cliente, incluso sin sesión iniciada,** puede comprar una entrada y reservar una mesa a nombre de una persona o de un grupo (ej. «Team Alicia» — interpretación mía de «tin alicia»; confirmar), **poniendo los nombres de quienes estarán en esa mesa**.
7. **En recepción** se debe saber quiénes son de ese grupo y **dónde están ubicados** (mesa y zona).
8. Precio según cercanía al escenario; varios mapas por evento (sala, recepción, cena, sala de estar…); mapa propio para quinceañeras/bodas si el cliente lo pide; los planos reales de Mojitos los consigue el PO.

## 2. Lo que ya existe y lo que no
- Ya existe (fase 1): maqueta con 3 mapas de muestra, zonas de precio por distancia, servicios marcados, pantalla completa. **Datos y precios de ejemplo.**
- Ya existe en la plataforma: `client_profiles.is_commercial` / `company_name` / `venue_type` y la rama `commercial_client` de `create-platform-account` (ver `2026-10-02-TICKET-cliente-comercial-facturacion-multiusuario.md`). **Cero cuentas comerciales reales**: el camino nunca se ha ejercido.
- NO existe: inventario por mesa. Hoy la taquilla vende por cantidad (`venue_ticket_types.quantity_sold`).

## 3. Diseño propuesto (la regla anti-sobreventa vive en la base, no en la página)
- **`venue_layouts`** (mapa por sala: etiqueta, punto focal, zonas fijas, servicios) y **`venue_tables`** (por mapa: etiqueta, forma, posición, sillas, zona, precio en centavos). El precio sale de aquí; el navegador nunca lo manda.
- **`venue_event_tables`**: una fila por mesa y evento, `unique(event_id, table_id)`, con `status` ∈ `available | held | reserved | sold`, `held_until`, `sold_via` (`online`/`manager`), `buyer_name`, `note`, `order_id`.
- **Cambios de estado solo por funciones SQL** (`UPDATE … WHERE status='available'` atómico): si dos personas tocan la misma mesa, solo una gana; la otra recibe "ya no está disponible". Reserva temporal (`held`, ~10 min) mientras se paga; vence sola.
- **Pago:** nueva función de checkout que recibe ids de mesa, toma la reserva temporal y abre Stripe con el mismo vencimiento; el webhook marca `sold` (y `checkout.session.expired` la libera).
- **Staff del local:** tabla `venue_staff(venue_id, user_id)` con **todos los miembros con el mismo permiso** (varias filas por local; no obliga a rediseñar el RLS de toda la plataforma) + función `is_venue_staff(venue_id)`. Mismo plano en modo manager: ve compradores en vivo (Supabase Realtime sobre `venue_event_tables`), y con un toque marca **Reservada** (con nombre y nota), **Vendida** (efectivo/otro) o **Liberar**. El público solo lee el estado de la mesa, nunca datos del comprador.
- La maqueta pasa de datos de ejemplo a leer estos mapas y estados.

- **Invitados y grupo:** `venue_table_guests(event_id, table_id, group_name, guest_name)`. El checkout acepta compra **sin cuenta** (nombre del grupo + nombres de las personas, máximo las sillas de la mesa, texto limpiado). Esos nombres los ve **solo el staff**, nunca el público.
- **Recepción:** la lista de puerta que ya existe (Pedidos → Entradas) se extiende: buscar por nombre de persona o de grupo y ver «Mesa M4 · Zona 1», con la mesa resaltada en el plano y marca de «ya entró» por persona.
- **Venta del staff:** el staff puede registrar una entrada vendida a mano (efectivo/otro) con `sold_via='manager'`.

## 3b. Editor visual del mapa (requisito aportado por el hilo GEO·SEO·IA, pegado por el PO)
Flujo funcional: **plantilla del local → mapa del evento → precios → disponibilidad/reserva**.
- **Plantilla del local vs. mapa del evento:** la plantilla es la distribución habitual (`venue_layouts`); al crear un evento se genera una **copia editable** (mapa del evento). Así una noche especial se modifica sin destruir el plano original.
- **Editor desde la página del Cliente Comercial** (cualquier miembro del staff del local): arrastrar mesas, agregar/quitar mesas, agregar/quitar sillas, cambiar sillas por mesa, forma y tamaño, reordenar, y fijar el precio por mesa o por zona. El plano se guarda ligado al local/evento y reaparece idéntico al volver.
- **Biblioteca de objetos:** mesa redonda, rectangular, VIP, high-top, silla, barra/área no vendible y, después, escenario/DJ booth.
- **Identidad de mesa:** id tipo `T01` (etiqueta), capacidad, precio, estado y coordenadas. **El número no depende de la posición**: mover T08 no lo vuelve T03.
- **Regla de seguridad con ventas:** si una mesa tiene reserva o venta activa, **no se puede eliminar en silencio ni bajar su capacidad por debajo de lo vendido/nombrado**; la operación se bloquea (o exige resolver antes la reserva). Se aplica en la función SQL, no solo en la página.
- La maqueta actual (fase 1) ya usa mapas como datos, con zonas de precio por distancia al punto focal; el editor reemplazaría esos datos de ejemplo.
- Construcción: va con el módulo comercial/Booking; no mezclar con SEO.

## 4. Decisiones del PO antes de construir
1. **¿De quién es el dinero de las mesas?** Si Miami DJ Beat cobra con su Stripe y luego liquida al local, o si el local cobra por su cuenta. Stripe Connect NO existe hoy (ver `project_stripe_connect_ssot_audit`); esto es del dominio financiero.
2. **Staff del local:** el PO pidió que cualquier miembro pueda operar; propongo la tabla `venue_staff` (varios usuarios por local, mismo permiso) sin esperar la multi-cuenta general del ticket del Cliente Comercial. ¿Quién agrega a los miembros: el Owner o el dueño del local?
3. **Primero probar el camino existente** de `commercial_client` con una cuenta de prueba real (hoy hay 0).
4. Duración de la reserva temporal (propuesta: 10 min).
5. Confirmar qué es «tin»/«Team Alicia»: ¿grupo de amigos, equipo de trabajo? (define el nombre del campo).

## 5. Fuera de alcance mientras no se decida lo anterior
Cobrar mesas con dinero real. Las claves de Stripe de taquilla siguen en PRUEBA.
