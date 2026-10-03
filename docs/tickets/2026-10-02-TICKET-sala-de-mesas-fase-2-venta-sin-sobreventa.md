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

## 3f. Cada noche / evento tiene SU sala y vende por separado (PO, 2026-10-03)
Regla de lógica del PO: **al tocar la tarjeta de una noche se entra a la sala de ese evento; cada evento tiene su propia sala para comprar boletos y la venta de uno no afecta al otro** — la misma mesa o silla se puede vender cada día y se marca de forma independiente. «Cada día puede vender su mesa.»
- Encaja con el diseño de la sección 3: `venue_event_tables` ya es **una fila por mesa Y evento** (`unique(event_id, table_id)`): una mesa vendida el miércoles 7 sigue `available` el jueves 8. Nada que cambiar en el modelo; es la confirmación de que el inventario es **por evento, nunca por mesa a secas**.
- Las tarjetas semanales (`programacion.json`) son plantillas por día de la semana; cada **fecha** concreta es un `venue_events` con su propio inventario y sus propios boletos. Una tarjeta abre el próximo evento con fecha de ese día (o, si aún no hay, la sala del día como vista previa).
- Maqueta actual (`venue-room.html`): la **selección** de mesas ya se guarda por noche/evento y por mapa; el estado «reservada» sigue siendo dato de ejemplo igual para todos los días. El inventario real, las reservas temporales y el pago por mesa siguen en esta fase 2 (base de datos + Stripe), pendiente de las decisiones de la sección 4.

## 3g. Cómo funciona de verdad el sistema de Ticketmaster (PO, 2026-10-03: «el sistema debe ser el que usan en los conciertos Ticketmaster»; «investiga primero») — INVESTIGADO
Fuentes: [Ayuda de Ticketmaster — mapa interactivo](https://help.ticketmaster.co.uk/hc/en-us/articles/35293924709905-What-is-the-interactive-seat-map-and-how-do-I-use-it) (leída completa), [Ayuda — límite de tiempo al pagar](https://help.ticketmaster.com.au/hc/en-au/articles/360008668033-Why-is-there-a-time-limit-for-checking-out) (solo el extracto del buscador: la página dio 403), [Ticketmaster — cómo funciona la cola](https://blog.ticketmaster.com/?p=40420), [API de estado de inventario](https://developer.ticketmaster.com/explore) y explicaciones de diseño del sistema (10 min, actualización condicional, vencimiento «perezoso»: [ejemplo](https://www.techinterview.org/post/3233474396/system-design-design-ticketmaster-event-ticketing-seat-selection-virtual-queue-flash-sale-inventory-dynamic-pricing/?format=md)). Estas últimas son de terceros, no de Ticketmaster.
**Lo que hace Ticketmaster:**
1. **Elegir en el mapa NO reserva.** Textual de su ayuda: los asientos elegidos «aún no están reservados (otros fans pueden comprarlos) hasta que pulsas *Get Tickets*». La reserva y su **reloj** arrancan al pasar a pagar, no al tocar el asiento.
2. **Reloj visible en cada paso del pago.** Al vencer: «Sorry… time's up», los boletos salen del carrito y se vuelve a empezar. La duración la fija la demanda (típico ~10 min; varía por evento y hora). Quienes usan lectores de pantalla reportan que necesitan ~30 min.
3. **Mapa:** disponibles en un color (azul), no disponibles en gris, elegidos con marca verde; filtros por rango de precio; zoom por sección; «mejores asientos disponibles»; tope de boletos por pedido.
4. **Por dentro (patrón estándar):** una fila por asiento y evento con estado y vencimiento; la reserva es un `UPDATE … WHERE disponible` atómico (si actualiza 1 fila, ganaste); una reserva vencida cuenta como libre en la misma consulta que la reclama; un barredor opcional libera las vencidas; el estado de inventario se publica por separado y solo lectura.
5. **Colas y «Verified Fan»** solo para ventas masivas (sala de espera virtual, lotería de códigos).
**Qué ya coincide en lo nuestro:** reserva al pasar a pagar, todo o nada, atómica en la base, vencimiento perezoso, inventario por mesa y evento, lectura pública solo de disponibilidad, tope de mesas por pedido (12).
**Corrección mía:** el 2026-10-03 se escribió (y se revirtió el mismo día) un «apartar al elegir»; era lo contrario de Ticketmaster.
**Se agrega por esta investigación:** (a) ~~reloj visible~~ **NO construido**: con el pago de Stripe en su propia página el cliente sale de nuestra pantalla y no hay dónde mostrarlo; lo que sí hay es el aviso fijo «tus mesas se apartan 35 minutos mientras pagas» en el formulario, y al volver por «cancelar» se liberan (un reloj real exigiría el pago incrustado, la alternativa descartada por ahora); (b) aviso claro si alguien tomó la mesa entre que la elegiste y pulsaste «Comprar» («mesa_no_disponible» → vuelves al plano); (c) la disponibilidad del plano se **refresca sola** cada ~15 s; (d) al cancelar el pago se libera la reserva y se expira la sesión de Stripe; (e) tope de 12 mesas apartadas por IP.
**Decisiones del PO (con recomendación):**
1. **Duración de la reserva — RESUELTA por el PO (2026-10-03): 35 minutos.** Ticketmaster usa ~10 min. Con el pago de Stripe en su propia página (redirección) el mínimo permitido de la sesión es 30 min, por eso hoy es **35 min** (constante `HOLD_MINUTES` y `p_minutes`). Alternativa: pago *incrustado* en nuestra página (Stripe Embedded Checkout) con nuestro propio reloj de 10–15 min: más parecido a Ticketmaster, pero más trabajo. *Recomiendo empezar con 35 min y pasar a incrustado si las mesas se acaparan.*
2. **Mesas elegidas vs. «mejores mesas disponibles»** (pedir «una mesa para 6» y que el sistema proponga): opcional, fase posterior.
3. **Filtro por precio / zona** en el plano: opcional, fase posterior.
4. **Sala de espera virtual (cola):** no hace falta salvo que un evento se vuelva masivo; se puede agregar después.
Nota: el arena actual de Miami es el Kaseya Center; el antiguo «Miami Arena» ya no existe; se tomó como referencia el sistema de Ticketmaster en general.

## 3h. Estado de la fase 2 al 2026-10-03 — PREPARADA Y PROBADA; NADA APLICADO NI DESPLEGADO
**Hecho en el repo (rama `feature/config-cuenta-comercial`, sin commit):**
- `supabase/scripts/20261003_sala_mesas_inventario_por_evento.sql` — inventario por mesa Y evento, reserva todo-o-nada con vencimiento perezoso, tope de 12 mesas apartadas por IP, confirmación tras el pago, acciones del staff (apartar / vender a mano / liberar) con los roles del local. **65 pruebas pasadas** en un Postgres real embebido (`supabase/tests/sala_mesas_inventario.test.mjs`): permisos por rol, anónimo bloqueado, todo o nada, vencimiento, regla del PO (misma mesa vendida el miércoles y el jueves, por separado), mapa de ejemplo válido.
- `supabase/scripts/20261003_OPCIONAL_mapa_de_ejemplo_mojitos.sql` — mapa de EJEMPLO (los 3 mapas y precios de la maqueta) para probar de punta a punta; no son los planos reales.
- `supabase/functions/create-venue-table-checkout/` — función de pago: reserva (todo o nada), precios leídos de la base, sesión de Stripe que vence a los ~31 min, acción `release` (cancelar: expira la sesión y libera). Validación probada (`supabase/tests/create_venue_table_checkout.validar.test.mjs`, 13 pruebas); sintaxis verificada; **no probada contra Stripe**.
- `supabase/functions/stripe-webhook/index.ts` — rama `venue_table` (registra el pedido y vende las mesas; si se pagó una mesa que otra persona alcanzó a tomar, marca el pedido `tables_conflict_refund_needed` para reembolso manual) y liberación en `checkout.session.expired`. Correo con variante «mesas». **Sin desplegar.**
- `web/venue-room.html` — el plano lee el inventario real cuando existe (precios, sillas y disponibilidad de la base; geometría de `venue_events.layout.maps` o la de muestra), formulario de compra (**solo el nombre de quien renta es obligatorio**; reserva y correo opcionales), «Comprar N mesas · $total», errores claros, refresco automático cada ~15 s (una mesa que compra otra persona sale de tu selección con aviso), retorno de Stripe (gracias / cancelado: libera). **Sin inventario real queda la maqueta de siempre** (verificado: sin cambios). Probado con inventario y función simulados.
**Para activarla (lo hace el PO, en este orden):**
1. SQL Editor → ejecutar `20261003_sala_mesas_inventario_por_evento.sql` (es aditivo e idempotente).
2. (Opcional, para probar) ejecutar `20261003_OPCIONAL_mapa_de_ejemplo_mojitos.sql`.
3. Crear un evento con fecha futura y estado «anunciado» en la sala (staff-admin → local → «Ver eventos»).
4. Abrir la venta de mesas de ese evento. **Aún no hay botón para esto**; por ahora en el SQL Editor: `select set_config('request.jwt.claim.sub', '<TU user_id de owner>', true); select public.venue_event_open_tables('<id del evento>');` (en la misma ejecución).
5. Desplegar desde el repo principal (NO desde un worktree): `supabase functions deploy create-venue-table-checkout` y `supabase functions deploy stripe-webhook`.
6. Probar con la tarjeta de prueba de Stripe (clave de PRUEBA): comprar 2 mesas; en otro navegador intentar las mismas (debe decir que ya no están); cancelar un pago (las mesas se liberan); comprar la misma mesa en OTRO evento (debe dejarte).
**Con dinero real:** la clave de la taquilla (`STRIPE_SECRET_KEY_VENUE`) sigue en PRUEBA; cambiarla es decisión expresa del PO.
**Construido después (2026-10-03): pantalla «Mesas» del staff** — ver §3i. **Falta construir (no pedido todavía):** botón para que el dueño/manager fije el mapa de la sala (hoy es SQL; abrir la venta de un evento ya se hace desde «Mesas»); guardado real del Editor de salas; lista de puerta por mesa/grupo (buscar por nombre de reserva y ver «Mesa M4 · Zona 1»); flujo de reembolso para `tables_conflict_refund_needed`; cobro a la cuenta de Stripe del negocio (Connect no existe); creación de eventos por el dueño (hoy solo staff de la plataforma puede escribir `venue_events`).

## 3i. Pantalla «Mesas» del staff (2026-10-03) — construida y probada; depende del SQL (sin aplicar)
Dónde: cuenta comercial → menú lateral → **Mesas** (`web/js/commercial-tables.js`, integrado en `commercial-portal.html`). **Quién la ve:** cualquier persona con un rol en un local (dueño, manager y equipo); quien no tiene local vinculado no la ve.
Qué hace: elegir local (si tiene varios) y evento (los programados de hoy en adelante); ver el **plano en vivo** (se actualiza solo cada 10 s mientras se mira) con cada mesa en su estado —**libre** (verde), **en pago** (ámbar: el cliente está pagando; se libera sola si no termina), **apartada** por el staff (rojo punteado), **vendida en línea** o **vendida a mano** (rojo)—; resumen con conteos y dinero vendido (en línea / a mano); **búsqueda** por nombre de quien renta, de la reserva, nota o mesa (para la puerta: «¿dónde está Alicia?»; atenúa las demás mesas); lista de mesas apartadas y vendidas. Al tocar una mesa: **Apartar** (nombre y nota opcionales), **Vender a mano** (exige el nombre de quien renta), **Liberar** (con confirmación). Una mesa **vendida en línea no se libera** desde aquí: pide reembolsar el pago (la base lo exige igual: `vendida_en_linea_requiere_reembolso`). **Dueño y manager** además ven **«Abrir la venta de mesas»** cuando el evento aún no tiene inventario (crea una fila por mesa con el mapa de la sala); el equipo ve «pídele al dueño o a un manager». El plano usa la geometría guardada en el evento (`layout.maps`) o, si no la trae, una cuadrícula automática.
Seguridad: la pantalla solo llama a la base (RLS de lectura `can_sell_venue` y funciones `venue_staff_set_table` / `venue_event_open_tables`); aunque se manipulara la página, la base rechaza lo que el rol no puede. Sin el SQL aplicado la pantalla explica «la venta de mesas todavía no está activada» (verificado con los datos reales de hoy).
Pruebas: 17 de la lógica pura (`supabase/tests/commercial_tables.test.mjs`) + prueba de la pantalla en el navegador contra una base simulada en memoria con las mismas reglas que el SQL (ver, apartar, vender sin nombre → error, vender, liberar, venta en línea sin botón de liberar, en pago informativo, búsqueda, abrir venta por manager, equipo sin botón, dinero vendido). **No probada contra la base real** (el SQL no está aplicado) **ni con una persona de rol real de equipo/manager**.
Defectos míos encontrados y corregidos en la prueba: un candado de carga que descartaba recargas simultáneas (la pantalla podía quedarse con datos viejos tras vender) → ahora cada carga lleva un número y se descartan solo las respuestas viejas; y `init` no reiniciaba el estado.
Pendiente: ícono de «Mesas» (línea tipo Lucide «table-2»; el menú no tenía precedente para ese significado); vista de puerta con «ya entró» por persona; compartir el plano a pantalla completa.
