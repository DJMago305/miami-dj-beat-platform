# Inventario de fuentes de precio (B2, paso 1) — 2026-09-21

**Solo lectura.** No se cambió ningún precio ni ningún código. Objetivo: saber de dónde sale cada precio antes de construir el catálogo único
(requisito del PO: *si se cambia un precio en la fuente, el carrito y el pago se actualizan*). Método: extracción con script de cada archivo
(id/sku + precio), lectura de las funciones y consulta a producción. Los precios del catálogo web se compararon por id y, cuando los ids
difieren, por nombre de producto.

## 1. Hallazgo principal
**Ya existe un mecanismo de precio único, pero nadie lo usa completo y su valor en producción está vacío.**
`platform_settings.rentals_catalog_prices` (JSON `{sku: precio}`) es un *overlay* por SKU que ya leen tres consumidores: el editor de precios del staff
(`staff-admin.html`, `saveAllPrices`, escribe TODO el JSON), `web/js/rentals.js` (lo aplica sobre `MDJ_RENTALS_DATA`, las listas de efectos, etc.) y ELIXIS
(`elixis-chat` con `parseCatalogOverlay`, y la función `platform_catalog_price_set`, que solo ejecuta service_role). **En producción esa clave NO existe**
(solo hay `pro_price_*` y `app_price_*`, que son suscripciones): jamás se ha cambiado un precio por esa vía, así que hoy TODOS los precios son los que están escritos en el código.
Lo que falta no es inventar el mecanismo sino: (a) unificar los ids, (b) que TODOS los consumidores lean el overlay, (c) que el servidor calcule el total con él.

## 2. Las fuentes (13)
| # | Fuente | Qué contiene | ¿Lee el overlay? | Quién la usa |
|---|---|---|---|---|
| S1 | `supabase/functions/_shared/event-quote-catalog.ts` | 47 SKU (DJ, live, MC, hora loca, staff, payasos, visuales, FX, luces, tarimas, truss, PA). `CATALOG_FALLBACK`; total = 7 % impuesto, depósito 30 % | **Sí** (`mergeCatalog`) | ELIXIS: cotizaciones (`event_quote_record`) |
| S2 | `web/data/rentalsData.js` (**LOCKED**) | Hora Loca (5 paquetes + extras) y `talent` (mus_sax/timbal/singer, vis_photo/video) | Sí (rentals.js lo pisa) | Página de rentas, builder |
| S3 | `web/data/rentals.json` | Copia **idéntica** de S2 (verificado). Nadie lo lee (solo se cita en docs) | — | Nadie (huérfano) |
| S4 | `web/data/services-catalog.json` | 3 ítems (Samba 950, Robot LED 450, Sax 450) | No | `web/js/services-catalog.js` |
| S5 | `web/js/rentals.js` | ~46 precios en línea: FX, luces, mobiliario, decoración por paquete, carpas, inflables, tarimas/truss, audio | **Sí** (`updateItemPrice`) | Rentas, carrito |
| S6 | Páginas de categoría (`special-effects-dj`, `lighting-dj`, `pro-audio-dj`, `tents-dj`, `stages-dj`, `inflatables-dj`, `furniture-dj`…) | `data-price="N"` en el HTML **y** el texto "$N" en `translations.js` (~90 cadenas con precio) y en FAQ/JSON-LD | **No** | Botón "añadir al carrito" de cada página |
| S7 | `web/staff-order.html` (`SECTION_CATALOG`) | ~55 ítems **por nombre, sin id/sku** | **No** | Panel de órdenes del staff → `event_builder_orders` → lead |
| S8 | `web/js/mdj-event-builder-adapter.js` | 5 ítems de **prueba** (hl_premium_pack 1200, mc_club_host 450…) | No | Solo pruebas del builder |
| S9 | `dj_profiles.hourly_rate_usd` | Tarifa por DJ. **0 de 12 DJs la tienen**; hoy el precio del DJ es el de la categoría + el nombre del DJ elegido | — | Nadie para cobrar |
| S10 | `event_quotes` / `event_quote_record` | Guarda el `unit_usd` que le pasa el llamador (tope $99,999); no lo valida contra un catálogo | — | ELIXIS |
| S11 | `platform_settings.rentals_catalog_prices` | El overlay (vacío en producción) | — | staff-admin, rentals.js, ELIXIS |
| S12 | `web/shop.html`, `create-merch-checkout` | Merch/tienda (producto aparte) | — | **Fuera de alcance de B2** |
| S13 | `platform_settings.pro_price_*` / `app_price_*` + `STRIPE_PRICE_*` | Suscripciones MDJ PRO | — | **Fuera de alcance de B2** |

## 3. Conflictos de precio (mismo producto, precio distinto)
Los verificados por script con el mismo id: `fx_co2`, `fx_confetti`, `fx_fog`, `fx_sparks`. Por nombre de producto aparecen muchos más. **El PO debe decir cuál es el correcto** (o si son productos distintos).

| Producto | Servidor S1 | Web S5/S6 | Staff S7 | Otros |
|---|---|---|---|---|
| CO2 jets | 300 | 400 | 400 | |
| Cold sparks | 250 | 300 | 300 | |
| Confeti | 120 | 450 | 200 | |
| Humo/fog | 60 (`fx_fog`) | 300 (`fx_fog`, "Humo bajo") · 150 (`fx_smoke`) | 150 | |
| Burbujas | — | 150 | 100 | |
| Moving heads | 150 | 350 (`light_moving_heads`, `fx_moving_heads`) | 400 | 3 ids para el mismo producto |
| Uplighting | 200 (`uplighting_pack`) | 350 (`light_uplighting`, `fx_uplighting`) | 350 | 3 ids |
| Pantalla LED | 500 | sin precio (consultar) | 800 | |
| PA grande | 750 | 750 | **600** | |
| Micrófono inalámbrico | 65 | 65 | 75 | |
| Monitor DJ | 95 | 95 | 100 | |
| Saxofón en vivo | 400 (`live_sax`) | 450 (`mus_sax`) | 600 | S4 también 450 |
| Cantante en vivo | 500 (`live_singer`) | 600 (`mus_singer`) | — | |
| Percusión/timbal | 300 (`live_percussion`) | 350 (`mus_timbal`) | — | |
| Fotografía | 350 (`visuals_photo`) | **700** (`vis_photo`) | 800 (foto+video juntos) | |
| Video | 500 (`visuals_video`) | **950** (`vis_video`) | (incluido arriba) | |
| Hora Loca | 550–850 en 5 paquetes | 550–850 (igual) | **Premium 1200 / Basic 800** (paquetes que no existen en S2) | S8: `hl_premium_pack` 1200 |
| MC | 450 (`mc_maestro`) · 350 (`mc_host`) | — | 450 | S8: `mc_club_host` 450 (vs `mc_host` 350) |
| Payasos | 250/350/450/300 | — | 300 (uno solo) | |
| Personal de evento | 200–400 según rol | — | 150 "por persona" | |
| Water slide | — | 700 | 350 | |
| Linens | — | 12 | 200 ("Custom Linen Package") | quizá productos distintos |
| Carpas | — | clear 800, white 600 | 20×20 500, 20×40 800, 40×40 1200 | productos distintos |
| **Coinciden en todas** | DJ Weddings 1500, Private 500, Clubs 500, Family 350 · PA pequeño 150 y mediano 350 · tarima chica 300 / mediana 600 · truss full box 1800 · A/C 250 · sillas 6 · mesas cocktail 20 | | | |

**Consecuencia real:** el evento de $5,082.50 se armó con el catálogo de `staff-order.html` (CO2 a 400, uplighting 350). Si el mismo cliente lo hubiera pedido por ELIXIS,
habría pagado CO2 a 300 y uplighting a 200. Dos clientes, mismo servicio, precio distinto según el canal.

## 4. Ids distintos para el mismo producto (hay que unificar)
`light_moving_heads` = `fx_moving_heads` = `moving_heads` · `light_uplighting` = `fx_uplighting` = `uplighting_pack` · `fx_smoke` ≈ `fx_fog` (¿mismo producto?) · `mus_sax` = `live_sax` · `mus_singer` = `live_singer` · `mus_timbal` ≈ `live_percussion` · `vis_photo` = `visuals_photo` · `vis_video` = `visuals_video` · `mc_club_host` = `mc_host` · `light_led_wall` = `fx_led_wall` ≈ `led_video_small`. `staff-order.html` no usa ids.

## 5. Otros defectos que salieron
1. **`event_builder_orders.lines[].line_total_usd` = 0** en el evento de $5,082.50 (las 7 líneas): el total de la orden está bien pero cada línea guarda 0. Cualquier reporte por línea sale mal.
2. **El carrito guarda precios, no referencias**: `leads.notes.selected_services = [{name, price, qty}]`. Por eso un cambio de precio en la fuente no llega a un carrito ya armado. Además `notes` está guardado como texto JSON dentro de un `jsonb` (doble codificación).
3. **`event_quote_record` no valida el precio** contra el catálogo (confía en el llamador; el catálogo solo se aplica en `elixis-chat` antes de llamarlo).
4. **`saveAllPrices` (staff-admin) sobrescribe TODO el overlay** con los inputs de la pantalla: si un SKU no tiene input, se pierde su override.
5. **Lectura pública del overlay** (`platform_settings` es legible por anon): correcto para que la web lo pinte, pero también deja ver cualquier otra clave que se guarde ahí.
6. `rentals.json` es una copia muerta de `rentalsData.js`; `services-catalog.json` (3 ítems con fotos de Unsplash) parece un prototipo.
7. Los precios están escritos **a mano en al menos cuatro lugares por producto** (HTML `data-price`, `translations.js`, `rentals.js`, catálogo del servidor) más las FAQ/JSON-LD de SEO ("premium seating starts at $6"): aunque el overlay funcione, esos textos no se actualizan solos.

## 6. Arquitectura recomendada (construye sobre lo que ya existe)
1. **`service_catalog` (tabla)**: sku (PK), nombre, bucket, precio base, activo, alias. Reemplaza a `CATALOG_FALLBACK` como lista maestra y se siembra con los precios que el PO confirme (sección 3). `platform_settings.rentals_catalog_prices` sigue siendo el **overlay** de cambios de precio (ya cableado en 3 consumidores); precio efectivo = overlay ?? base.
2. **Vista pública `service_catalog_public`** (sku, nombre, precio efectivo, activo): la leen la web y el portal.
3. **Cada consumidor lee esa vista**: `rentals.js` (ya lee el overlay), las páginas de categoría (hoy `data-price` fijo → leer por SKU), `staff-order.html` (hoy sin ids → mapa nombre→sku), builder, portal. Los textos de precio de `translations.js`/SEO se generan desde el mismo dato.
4. **Carrito por referencia**: `selected_services = [{sku, qty}]` (+ precio solo como foto histórica). Total = función SQL `mdj_lead_recalcular_total` con el precio efectivo vigente, con **test de paridad** contra `computePortalCartTotals`.
5. **Regla de congelado** (decisión pendiente del PO): un cambio de precio alcanza a carritos sin pagar; los ya aprobados se recalculan y se vuelven a aprobar solos (B1); los que tienen pago o contrato se **congelan** con el precio del primer pago.
6. `event_quote_record` valida cada línea contra el catálogo.

## 7. Decisiones que necesita el PO
1. **Los conflictos de la sección 3**: para cada fila, ¿cuál es el precio correcto? (o ¿son productos distintos?). Sin esto el catálogo no se puede sembrar.
2. ¿El **Hora Loca Premium 1200 / Basic 800** del panel de staff existe como producto real? (no está en la página de rentas).
3. ¿La **tarifa por DJ** (`hourly_rate_usd`, vacía hoy) va a entrar al precio, o el precio del DJ sigue siendo el de la categoría?
4. ~~La regla de congelado~~ — **DECIDIDA 2026-09-21: se congela el total desde el primer pago** (aplicada; ver plan §8).
5. Orden de trabajo sugerido: (a) el PO resuelve conflictos → (b) tabla + vista + siembra → (c) el servidor calcula con ella (cierra B2 del dinero) → (d) migrar consumidores de a uno, empezando por `staff-order.html` (origen de los eventos reales) → (e) carrito por referencia.
