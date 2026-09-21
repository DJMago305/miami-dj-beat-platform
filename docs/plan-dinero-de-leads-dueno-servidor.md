# Plan: el servidor es dueño del dinero de `leads`

**Estado (2026-09-21):** Capa A **APLICADA en producción** y verificada. B1 **APLICADA en producción (solo base de datos)**; el código que la usa (`create-event-payment`, portal) está escrito en la rama `feature/cupones-fase2-servidor-calcula` y NO desplegado. B2 diseñada, sin construir.
**Origen:** al construir "el servidor calcula siempre el monto" (cupones fase 2) se comprobó que el cobro lee `leads.total_amount`, y esa columna (y otras de dinero) la puede escribir el propio cliente.

## 1. El hueco (verificado en producción)

- Política `leads_update_client_email` (UPDATE, `authenticated`): el cliente puede actualizar su propio lead, **cualquier columna**. Concesiones de columna abiertas a `authenticated` y `anon`. **Ningún disparador** protege dinero (los únicos son de aviso de lead nuevo y de lección de cabina).
- Consecuencias posibles: ponerse `payment_status='PAID'` o `balance_paid` sin pagar; bajar `total_amount`; fijar `deposit_required_usd`; y —por `leads_insert_anon`/`leads_insert_authenticated` con `with_check true`— insertar un lead ya "pagado".
- El portal reescribe el lead completo desde el navegador en cada cambio (`syncLead`, `client-portal.js`) y **calcula el total en el navegador** (`computePortalCartTotals`, precios en `notes.selected_services`, también editables). No existe catálogo de precios en la base de datos (única tabla con precio: `venue_ticket_types`).
- Estado real hoy: 7 leads, 0 pagos registrados, 2 con cliente (misma cuenta, de la esposa del PO). No hay evidencia de abuso.

## 2. Quién escribe legítimamente cada columna (inventario)

| Columna | Escritores legítimos | ¿Necesita el cliente? |
|---|---|---|
| `balance_paid`, `payment_status` | `stripe-webhook` (service_role); staff (staff-admin, staff-order); RPC `client_mark_event_zelle_sent` (definer, marca `PENDING_ZELLE`) | **No** |
| `deposit_required_usd` | staff (`production-module.js`) | **No** |
| `stripe_session_id`, `stripe_customer_id` | `create-event-payment`, webhook (service_role) | **No** |
| `coupon_discount_cents` (nueva) | `discount_confirm_y_ajustar_total` (definer) | **No** |
| `total_amount` | staff; **portal del cliente** (carrito → `syncLead`); `mdj-event-builder.js`; `shop.html`; inserciones de lead | **Sí, hoy** |

## 3. Diseño en capas

### Capa A — dinero cobrado: el cliente no lo toca (APLICADA 2026-09-21)
Disparador `BEFORE INSERT OR UPDATE` (`supabase/scripts/20260921_leads_proteger_columnas_de_dinero.sql`). Solo actúa si `current_user` es `authenticated`/`anon` y quien escribe **no** es staff:
- UPDATE: `balance_paid`, `payment_status`, `deposit_required_usd`, `coupon_discount_cents`, `stripe_*` se quedan como estaban. **Revert silencioso** (no error) porque el portal reescribe el lead entero y un error rompería todas sus guardadas.
- INSERT: se fuerzan `balance_paid=0`, `payment_status='UNPAID'`, sin depósito/cupón/stripe.
- No afecta a staff, `service_role` (webhook, edge functions) ni a funciones `SECURITY DEFINER` (dentro, `current_user` es su dueño): el Zelle por RPC sigue funcionando.
- Cada intento real deja un WARNING `LEADS_DINERO_BLOQUEADO` en los logs de Postgres (visible con `query_logs`). No hay tabla de auditoría: el disparador corre con el rol del cliente, que no puede escribir en ella.
- **Prueba en producción (transacción deshecha, 7 casos, cliente real simulado con JWT):** cliente intenta PAID+balance+depósito+cupón+stripe → se revierten, y un campo normal (`location`) sí se guarda ✓; staff (owner) escribe dinero ✓; servidor (postgres) ✓; RPC Zelle → `PENDING_ZELLE` ✓; INSERT de cliente con `PAID`/balance → `UNPAID`/0 ✓; INSERT anon ✓; **`total_amount` sigue editable (total=1) → Capa B** ✓. Verificado después: sin rastro.
- Riesgo de la capa: bajo. Efecto visible: ninguno para un cliente honesto. El DJ asignado tampoco podrá tocar dinero (no debe).

### Capa B — `total_amount`: el servidor es el dueño (decisión del PO, 2026-09-21: "el servidor debe ser el dueño de total_amount")
**Lo que hay hoy (verificado):** conviven DOS orígenes del total. (1) Cotización del staff/ELIXIS: `event_quote_record` → `event_quote_convert_to_order` (definer, precios que pone el staff, 7 % y 30 % calculados en SQL) → `event_builder_orders`. (2) Carrito del cliente (`mdj-event-builder.js` / `client-portal.js`): los precios (`unit_price_usd`, `price`) se ponen en el navegador y se copian a `leads.notes` y `leads.total_amount`. Los 2 leads de cliente actuales vienen de (2) ($5,082.50 y $1,605.00). No existe catálogo de precios en la base.

Como no se puede confiar en un precio que viene del navegador, "dueño el servidor" se construye en dos pasos; el primero ya cierra el hueco:

**B1 — Compuerta de aprobación (APLICADA en la base de datos; `supabase/scripts/20260921_leads_total_aprobado_b1.sql`).**
- Columnas `leads.total_aprobado_usd`, `total_aprobado_at`, `total_aprobado_por`. La aprobación está **atada al monto**: solo se cobra si `total_aprobado_usd = total_amount`. Si alguien cambia el total después, deja de coincidir y el cobro se rechaza solo (sin lógica de "resetear" que se pueda olvidar).
- Quién aprueba: **staff** que escribe un total (queda aprobado con ese monto); **servidor** (webhook/service_role) en INSERT, y acompaña con la aprobación los ajustes de un lead que ya estaba aprobado (p. ej. el cupón cobrado); el **cliente y las funciones definer que actúan por un cliente nunca aprueban**. Sus `total_aprobado_*` se revierten como el resto del dinero (Capa A).
- RPC `lead_aprobar_total(lead, total_visto)`: solo staff, y solo aprueba si el total actual es el que el staff vio en pantalla (si el cliente lo cambió entre tanto → `el_total_cambio`).
- `create-event-payment` responde 409 `total_pendiente_aprobacion` si no coincide (el `quote` devuelve `total_approved`).
- Portal: el cliente ve "Total pending team approval" y no se le ofrece pagar con tarjeta; el gerente (`?mode=manager`) ve el botón "Approve total" con el total que está revisando.
- Backfill: los 5 eventos de origen staff → aprobados; los 2 de cliente (`a81679dc` $5,082.50 y `932fe157` $1,605.00) → **pendientes de aprobación del staff**.
- **Probada en producción con transacción deshecha (8 casos, JWT simulados):** cliente cambia total y `total_aprobado_usd` → aprobación intacta y RPC rechazada (`no_autorizado`); staff escribe total → aprobado; cliente baja el total → deja de coincidir; staff aprueba por RPC; servidor ajusta cupón → aprobación acompaña; total de lead sin aprobar cambiado por servidor → sigue sin aprobar; función definer por un cliente → no aprueba; INSERT del servidor → aprobado.
- Advertencia: el staff que edita el carrito en modo gerente aprueba con ello (escribió el total). Aprobar es mirar los precios; el botón muestra el monto exacto.

**B2 — Catálogo y recálculo automático (grande; quita la fricción de B1). REQUISITO NUEVO DEL PO (2026-09-21): "si se cambian los precios en las fuentes, todo el precio, también en el carrito y el pago, deben actualizarse".** Eso obliga a que el carrito guarde referencias al catálogo (no precios copiados) y a que el total se derive siempre del catálogo vigente.
1. `service_catalog` (id, tipo, nombre, precio, activo, DJ opcional) sembrado desde `web/data/rentalsData.js` (LOCKED, solo lectura) y `dj_profiles.hourly_rate_usd`; cada ítem del carrito guarda `catalog_id`.
2. `mdj_lead_recalcular_total(lead_id)` (definer): subtotal por catálogo × cantidad − crédito de referido ($30 según `client_profiles`) − 5 % lealtad (`total_events_booked`) − bono de reserva − `coupon_discount_cents`, × 1.07, con **test de paridad** contra `computePortalCartTotals`.
3. Si el total que manda el navegador coincide con el del servidor → se aprueba solo; si no → queda pendiente (B1). El navegador solo muestra.
4. Ítems a medida (`addServicePrompt`, precio tecleado): solo staff; confirmar que hoy un cliente no puede usarlo.
- Riesgo: alto de regresión (toca la cotización). Requiere el catálogo completo validado por el PO.

### Capa C — defensa en profundidad en el cobro
`create-event-payment` ya recalcula depósito/saldo desde la base. Añadir, cuando exista `event_builder_orders.total_usd` para ese lead, rechazar el cobro si difiere de `total_amount` en más de $0.01.

## 4. Decisiones que necesita el PO
1. ¿Aplicamos la Capa A (antes de las pruebas de pago del 2026-09-22 o después)? Recomendación: **sí, antes**, para probar los pagos sobre la base ya protegida.
2. Capa B1 (compuerta de aprobación, recomendada como primer paso de B): ¿aceptas que un total armado por el cliente necesite "Aprobar total" del staff antes de poder pagar? B2 (catálogo, sin fricción) después, con la lista de precios validada por el PO.
3. Revert silencioso (recomendado) vs error explícito.

## 5. Orden si se aprueba
A (SQL) → verificar con `query_logs` que el portal sigue guardando → pruebas de pago con cupones (Stripe modo pruebas) → B1 → B2 → C.

## 6. Requisito del PO para B2: los precios cambian en la fuente y todo se actualiza
- Una sola fuente de precios (`service_catalog`). El carrito guarda `catalog_id` + cantidad; el precio que se muestra y se cobra se lee del catálogo vigente.
- **Decisión pendiente del PO:** ¿un cambio de precio debe alcanzar a carritos aún **sin pagar y sin aprobar** (sí, evidente), a los **ya aprobados pero sin pagos** (recomendado: sí, y se vuelven a aprobar solos si el total nuevo lo calcula el servidor), y a los que **ya tienen un pago o contrato firmado** (recomendado: **no** — se congela el total pactado con una copia del precio al momento del primer pago, salvo que el staff lo reabra)?
- Las fuentes hoy están dispersas: `web/data/rentalsData.js` (LOCKED), `dj_profiles.hourly_rate_usd`, precios tecleados por el staff en cotizaciones (`event_quotes`) y lo que arma `mdj-event-builder.js`. B2 empieza por inventariarlas y decidir cuál manda.

## 7. Errores existentes descubiertos en el camino
- `mdj_client_create_event_lead(text,text,numeric)` está rota en producción: inserta `notes` (jsonb) desde un parámetro `text` y falla siempre con "column notes is of type jsonb but expression is of type text". Nadie puede crear un lead por ese RPC hoy.

## 8. Regla de congelado — DECIDIDA y APLICADA (2026-09-21)
- **Decisión del PO: "congela el total desde el primer pago".** En producción, el disparador `leads_proteger_columnas_de_dinero` ahora hace que, cuando un evento ya tiene un pago (`balance_paid > 0`), un cambio de `total_amount` hecho por un cliente (o cualquier no-staff por la API) se **revierta** y deje el aviso `LEADS_DINERO_BLOQUEADO` (`total_amount_congelado`) en los logs. Los campos normales del evento siguen guardándose.
- **Quién puede reabrirlo:** solo el staff (escribe un total nuevo; queda aprobado con ese monto, B1). El servidor (webhook: ajuste de cupón) también puede.
- **Probado en producción con transacción deshecha (5 casos):** sin pago el cliente sí edita; con pago el total queda congelado y `location` sí se guarda; staff reabre a 1800 y queda aprobado 1800; el ajuste del servidor por un cupón en un evento con pago se aplica y acompaña la aprobación. Verificado después: 0 eventos con pago, función activa, `authenticated` sin ejecución directa.
- **Pendiente para B2:** cuando el carrito pase a referencias por SKU, el primer pago debe guardar además una **foto de los precios** (`precios_congelados`) para que un cambio en el catálogo no reescriba un evento con pago. Hoy el carrito ya guarda los precios copiados, así que un evento pagado conserva los suyos.
- **Pendiente de interfaz (cambio visible, requiere visto bueno):** después del primer pago el portal del cliente debería bloquear "agregar/quitar servicios" (hoy el cliente podría alterar el carrito mientras el total permanece congelado; el servidor ya ignora el cambio de total, pero el carrito mostraría servicios que no cuestan). Nota: `notes.selected_services` NO está congelado en la base de datos todavía.

## 9. Regla para lo que no se sabe: precio en blanco + «Call para cotización» (decisión del PO, 2026-09-21)
- Un producto cuyo precio no está decidido se guarda en `service_catalog` con **precio NULL** y la nota **«Call para cotización»**. La web ya trabaja así con la pantalla LED ("consultar", `price: null` en `rentals.js`); se extiende a todos los canales.
- **Efecto en el cobro:** una línea sin precio NO entra en el cálculo automático del total. Un carrito con una o más líneas «Call para cotización» queda **pendiente de aprobación del staff** (B1) hasta que el staff fije el precio; `create-event-payment` no cobra un total sin aprobar. ELIXIS no puede cotizar automáticamente un SKU sin precio: debe pasarlo al staff.
- El formulario de conflictos (artifact) ya sigue esta regla: lo que se deje sin marcar, o se marque «Call para cotización», sale en la respuesta como «SIN MARCAR — se publican en blanco con la nota «Call para cotización»». En las tarjetas «Qué incluye» (foto/video), lo no llenado sale como «lo demás: call para cotización».

## 10. Reglas de tarifa del DJ (dictadas por el PO, 2026-09-21) — **son lo que se le PAGA al DJ, no lo que se cobra al cliente**

> **CORRECCIÓN DEL PO (2026-09-21):** las tarifas de esta sección (1500, 850, 500, 350, 250…) son el **pago al DJ**. El **precio al cliente** es otro y suele ser un **paquete completo** (DJ + audio + luces + MC/efectos/cabina…; el PO mencionó un ejemplo de $4,500). Hay que investigarlo. Lo que dice el resto de esta sección debe leerse como «pago al DJ».
> - **El sistema ya separa ambas cosas:** `leads.dj_agreed_payout_usd` (monto acordado al DJ, fijado por staff, liberado con `staff_release_event_dj_payout`; 1 de 7 eventos lo tiene) y `dj_profiles.commission_rate` (15 % en los 12 DJ). Pero **el catálogo de ELIXIS y la web usan los mismos números como precio al cliente** (p. ej. `dj_weddings` $1,500 se le cobra al cliente): si esos números son pago al DJ, el cliente está pagando el pago del DJ sin margen ni paquete.
> - **Consecuencia para `service_catalog`:** cada SKU/paquete lleva **`pago_dj_usd`** y **`precio_cliente_usd`** por separado (y opcionalmente `incluye`). El cobro (B1/B2) usa `precio_cliente_usd`; `dj_agreed_payout_usd` se llena con `pago_dj_usd`.
> - **Referencia de mercado (precio al cliente, no pago al DJ):** DJ/MC 4 h desde $1,495 (Power Parties); paquete DJ/MC + sonido + 24 uplights + luces de pista + gobo + cabina 4 h: $2,595 (1 DJ, hasta 6 h) / $3,495 (2 DJ); corporativo 30–100 personas $2,400 por 3–5 h + $100 la hora extra; Miami $200–$300 por hora. **No se encontró ningún paquete publicado de $4,500**; los completos con Hora Loca/robots/pantallas se cotizan por llamada. Comisión típica de agencias/plataformas: 15–40 %.
> - **Corrección a mis comparaciones anteriores:** al decir que «$1,500 en boda está en el rango de Miami» o que «$850 está en línea» comparé el pago al DJ con precios al cliente: no eran comparables.
> - **Pendiente del PO:** precio al cliente del paquete completo por tipo de evento (fila nueva en el formulario) y qué incluye.

(Lo que sigue son las reglas de **pago al DJ**.)
- El DJ arranca en **$100 por hora**. Los eventos duran **4 a 5 horas como mínimo**; la **hora extra cuesta $100**.
- El precio depende del **tipo de evento** (no es el mismo DJ ni el mismo equipo):
  - **Boda y quinceañera:** **$1,500**, **5 horas**, con **el DJ, el audio y unas luces**. Si piden **exclusividad no hay límite de precio** (se cotiza; «Call para cotización» + aprobación del staff).
  - **Corporativo:** **$1,500 de lista, 5 horas**, **negociable desde $850** si el evento es sencillo y no implica mucha movilidad.
  - **Fiestas infantiles de día (sin luces):** **gender reveal $250** y **baby shower $350**, ambas de **4 horas**.
  - **Restaurantes (ambientación):** **$350** cuando hay show y el DJ solo cubre los intermedios; **$500** si es restaurante con DJ completo. Horas base: **pendiente** (pregunta en el formulario). No existen hoy como producto en ningún canal: son 2 SKU nuevos (`dj_restaurante_intermedios`, `dj_restaurante_completo`).
  - **Clubs de géneros o underground:** **$500 la noche**; **entre semana desde $350 como mínimo** si no cierra tarde. El **horario lo pone el venue**.
  - **Holidays y fiestas especiales:** **$850** (hoy ELIXIS: `dj_holiday` $1,500). Horas base: pendiente.
  - **Fiesta privada, otras fiestas infantiles, temporada (Halloween, Santa):** el PO no dio precio en esta ronda; van como filas del formulario (hoy ELIXIS: privada $500, temporada $900).
- **Diferencias con el sistema actual (`event-quote-catalog.ts`, `EVENT_TYPE_DEFAULTS`):**
  1. Boda, **corporativo y quinceañera comparten un solo SKU** `dj_weddings` ($1,500, 5 h): no existe quinceañera propia ni el piso negociable de $850 para corporativo.
  2. **Baby shower, gender reveal y familiar son un solo SKU** `dj_family` ($350, 4 h): el gender reveal debería ser $250.
  3. Ya coinciden: base de 4–5 h (`hours_base`) y hora extra de $100 (`EXTRA_HOUR_USD`).
- **Diseño para `service_catalog`:** cada SKU de DJ lleva `precio_base`, `horas_base` (4 o 5), `hora_extra_usd` (100) y, opcional, `piso_negociable_usd` (corporativo: 850). Un precio por debajo de la lista pero no menor al piso solo lo puede fijar el staff (queda «pendiente de aprobación», B1).
- **No confundir con decoración:** `rentals.js` tiene paquetes de decoración «Luxury Baby Shower» $1,450 y «Gender Reveal Deluxe» $1,550; son otro producto (decoración), no la tarifa del DJ.
- **Diferencias nuevas con el sistema:** (a) el club hoy tiene un solo precio ($500) y no distingue **entre semana (desde $350)**; (b) el catálogo cobra el **audio por separado** (`pa_medium` $350, `uplighting_pack`), pero para boda/quinceañera el PO dice que los $1,500 ya incluyen **DJ + audio + unas luces**: hay que fijar qué audio y cuántas luces entran (para no cobrarlos dos veces) y qué se cobra como extra si piden más; (c) la **exclusividad** no existe como concepto en ningún canal.

## 11. Principio: los precios de lista siempre están publicados; se negocia por teléfono (PO, 2026-09-21)
- «Se puede negociar por teléfono, pero los precios deben estar ahí; son los que son.» Todo producto con precio conocido lleva su **precio de lista publicado** en el catálogo (web, panel de vendedores y ELIXIS muestran el mismo). Lo negociado por teléfono es un ajuste del staff sobre ese precio (p. ej. corporativo, piso $850), nunca un precio distinto por canal, y queda **pendiente de aprobación (B1)** con el monto acordado. «Call para cotización» queda solo para lo que de verdad no tiene precio decidido.

## 12. Depósito de reserva: 30 % → 50 % (decisión del PO, 2026-09-21)
- **Decisión del PO: «cambia el depósito a 50%».** Depósito = **50 % del total, mínimo $150** (el mínimo no cambia). Recomendación de la investigación de mercado (`docs/propuesta-precios-luxury.md`): las marcas de lujo cobran 50 % para reservar la fecha.
- **Base de datos (APLICADO en producción, `supabase/scripts/20260921_deposito_50_por_ciento.sql`, probado antes en transacción deshecha):** `mdj_event_deposit_required_usd` (usada por los cobros Zelle/staff), `event_quote_record` y `event_quote_convert_to_order` calculan 50 %; `event_quotes.deposit_rate` por defecto 0.50. Permisos intactos.
- **Código (en la rama `feature/cupones-fase2-servidor-calcula`, SIN desplegar ni commitear):** `create-event-payment` (nueva constante `DEPOSIT_RATE`), `_shared/event-quote-catalog.ts` (`DEPOSIT_RATE`), `elixis-chat`, `create-quote-deposit`, `client-portal.js`, `production-module.js`, `staff-order.html`, `staff-admin.html`, `services.html`, `rentals.html`, `rentals.js`, `quote.html`, `mdj-event-builder.js`, `translations.js` (6 textos) y sus `?v=`. No queda ningún 30 % de depósito en el código revisado.
- **Lo que NO cambia:** los eventos y cotizaciones que ya existen conservan el depósito que ya tenían (`deposit_required_usd` fijado por staff, `event_quotes` ya guardadas). Si el PO quiere recalcular los pendientes de pago al 50 %, se hace aparte.
- **Inconsistencia temporal (hasta desplegar):** la base de datos ya calcula 50 % pero el código desplegado (portal, edge functions) sigue mostrando/cobrando 30 %. No hay pagos activos (0 eventos con pago), pero conviene desplegar pronto.
- Pendiente: los términos y contratos que mencionen el 30 % (no se encontró ninguno en las páginas de la web revisadas; revisar los documentos legales/contratos aparte).
