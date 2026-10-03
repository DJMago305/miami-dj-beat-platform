# TICKET — Sala de mesas, Fase 2: venta real sin sobreventa, con Cliente Comercial

**Fecha:** 2026-10-02 · **Origen:** el PO, al ver la maqueta (fase 1, `venue-room.html`, EN DESARROLLO).
**Estado:** proyecto grande, **a medias y en desarrollo por decisión del PO**: la maqueta (fase 1) queda lista y esta fase 2 se construye aparte. Requisitos documentados, NO construido. Depende de decisiones del PO (sección 4).

## 1. Lo que pidió el PO
1. El plano se **enlaza con la cuenta de Cliente Comercial** (dueño/manager del local).
2. **Nunca se puede sobrevender una mesa.**
3. Los managers deben **ver en vivo qué mesa ya se vendió en línea**.
4. Los managers deben poder **vender mesas por aquí** y **marcarlas como reservadas** desde la plataforma.
5. **Cualquier miembro del staff de la cuenta de Cliente Comercial** puede poner una mesa en espera (hold) o reservada, y también **vender una entrada desde ahí** si hace falta.
6. **Cualquier cliente, incluso sin sesión iniciada,** puede comprar una entrada y reservar una mesa **solo con el nombre de la persona que renta**. Puede poner **un nombre a la reserva** (ej. «Alicia» o «Team Alicia») y **los invitados se identifican en la puerta por ese nombre**. Todo lo demás es OPCIONAL (nombres de invitados, sillas); personalizar sillas NO es obligatorio.
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

- **Nombre de la reserva (PO, 2026-10-02: «tin Alicia» = el nombre que el cliente pone a su reserva para que los invitados se identifiquen por quien reservó):** un solo campo, `reservation_name` (por defecto el nombre de quien renta; editable, ej. «Team Alicia»). Es lo que se busca en recepción. Los nombres de los invitados son **opcionales** (`venue_table_guests`). El checkout acepta compra **sin cuenta**. Estos datos los ve **solo el staff**, nunca el público.
- **Compartir la reserva:** v1 sin sistema nuevo: el cliente avisa a su gente con el nombre de la reserva. Opcional barato: botón «Compartir» que abre el SMS/WhatsApp del propio teléfono con el texto y el enlace (mismo patrón `sms:?body=` / `wa.me` que ya tiene la página de la sala), sin enviar SMS desde el servidor. Un boleto individual por invitado queda fuera: es un proceso doble y los SMS del servidor tienen antecedente de no entrega.
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

## 3c. Principio de producto (PO, 2026-10-02): rápido y fácil, sin procesos de más
- **Armar el plano debe ser rápido y fácil para el staff del local**; es lo que vendemos. Nada cansón ni difícil de entender.
- **Comprar debe ser simple:** elegir mesa, poner el nombre de quien renta, pagar. Sin pasos dobles «por gusto». Todo lo demás (grupo, nombres, sillas) es opcional.
- Ya aplicado en el editor: «Llenar rápido» (una cuadrícula de mesas de un clic), objetos listos en la biblioteca, precio por cercanía de un clic; se quitó el selector de «estado (simulación)» por confuso. Cualquier pantalla nueva se mide contra esto: ¿se entiende sin explicación y en pocos clics?

## 3d. Cómo se ve una mesa tomada (PO, 2026-10-02)
Toda mesa que ya no está disponible (vendida en línea, vendida por el staff o apartada por el staff) se ve en **otro color** (rojo del sitio, `#ff6060`) con el cartel **«reservada»**. El público no distingue entre vendida y apartada; el staff sí ve el detalle (quién la compró o la apartó).

## 3e. Roles del local (PO, 2026-10-03) — decididos; las funciones de permiso ya existen en la base
| Rol | Quién es | Edita plantilla de mesas y sillas | Ve disponibilidad, vende entradas y reserva | Agrega / quita equipo |
|---|---|---|---|---|
| **Dueño** | la PRIMERA cuenta vinculada al local (una sola por local) | sí | sí | **sí (el único)** |
| **Manager** | lo agrega el dueño | sí | sí | no |
| **Equipo** | lo agrega el dueño | no | sí | no |
- El **equipo vende y reserva con el método de pago de la empresa** (la cuenta de Stripe del local, `venues.payout_stripe_account_id`, camino abierto descrito en el punto 1 de las decisiones); Stripe Connect NO existe todavía: va con la fase de dinero, con aprobación del PO.
- En la base: `venue_staff.role` (`owner`/`manager`/`team`), `venue_role()`, `is_venue_owner()`, `can_manage_venue_layout()` (dueño y manager) y `can_sell_venue()` (los tres); las pantallas de la fase 2 deben usarlas. El alta del equipo la hace la función `venue-team-invite` (solo el dueño; tope de 20; nunca convierte cuentas de otra categoría).

## 4. Decisiones del PO antes de construir
1. **¿De quién es el dinero de las mesas? — RESPONDIDA por el PO (2026-10-02):** por ahora entra a la cuenta de Stripe de **Miami DJ Beat**, pero **el camino debe quedar abierto** para poner una cuenta de Stripe del negocio (o una tarjeta/cuenta bancaria) donde se deposite lo vendido. Diseño: cada local lleva un destino de cobro opcional (`venues.payout_stripe_account_id`, vacío = cuenta de Miami DJ Beat). Cuando se llene, el checkout manda el cobro a esa cuenta con Stripe Connect (cobro con destino + comisión de Miami DJ Beat si la hay). Stripe Connect NO existe hoy y mover dinero es dominio financiero: se construye en su propia fase, con aprobación del PO; mientras tanto el campo no se usa.
2. **Staff del local:** el PO pidió que cualquier miembro pueda operar; propongo la tabla `venue_staff` (varios usuarios por local, mismo permiso) sin esperar la multi-cuenta general del ticket del Cliente Comercial. ¿Quién agrega a los miembros: el Owner o el dueño del local?
3. **Primero probar el camino existente** de `commercial_client` con una cuenta de prueba real (hoy hay 0).
4. Duración de la reserva temporal (propuesta: 10 min).
5. «Tin Alicia» — RESUELTA por el PO: es el nombre que el cliente pone a su reserva; los invitados se identifican por ese nombre.

## 5. Fuera de alcance mientras no se decida lo anterior
Cobrar mesas con dinero real. Las claves de Stripe de taquilla siguen en PRUEBA.
