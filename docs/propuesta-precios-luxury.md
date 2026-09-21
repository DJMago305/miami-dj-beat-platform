# Propuesta de precios al cliente — posicionamiento de lujo (borrador v1, 2026-09-21)

**Estado: PROPUESTA. Nada se cambió en el sistema.** Todo precio de aquí es una recomendación que el PO aprueba o corrige (el formulario de conflictos ya trae cada precio como opción «Propuesta lujo»).
Base: 4 investigaciones de mercado en paralelo (bodas/quinceañeras, corporativo y otros DJ, equipos y servicios, estrategia de precios de lujo). Miami / South Florida, datos de 2025–2026.

## 0. Cómo leer este documento
- **Pago al DJ** = lo que se le paga al DJ (las tarifas que dictó el PO: 1500, 850, 500, 350, 250, 100/h). **Precio al cliente** = lo que se cobra por el paquete completo. El catálogo (`service_catalog`) guardará ambos por separado (ver `docs/plan-dinero-de-leads-dueno-servidor.md` §10).
- **Confianza:** ALTA = varias fuentes publicadas coinciden; MEDIA = 1–2 fuentes o rango amplio; BAJA = casi sin dato público (criterio propio). Lo marcado BAJA debe validarse con cotizaciones reales o con los costos de MDJB antes de publicarse.
- Los rangos «de lujo» son **mi extrapolación** (percentil alto de lo publicado). Ninguna empresa publica esos precios.

## 1. Lo que dice el mercado (resumen)
1. **DJ/MC de boda, precio al cliente:** económico $747–$1,100; medio $1,000–$2,100; alta gama con producción (24 uplights, cabina, monograma) **$2,595–$3,495**; producción completa (moving heads, chispas, humo) **$3,995–$4,995** (Eddie B., el techo público más alto). Promedio Miami $2,350. Las productoras de gama alta (Power Parties, Sound Level) **no publican precio**.
2. **Hora extra al cliente:** $150–$300 en general; $400 en paquetes «Plus» (Eddie B.).
3. **Corporativo:** desde $650–$750 (3 h, básico) hasta $1,997–$2,997 (3 h con cabina LED y video wall); mínimo citado para un DJ de corporativo en Miami $2,500. Entretenimiento ≈ 8–12 % del gasto del evento corporativo.
4. **Quinceañeras:** DJ solo $800–$1,500; DJ+MC+luces $1,500–$2,500; vals sorpresa $1,500–$4,000; presupuesto total $10,000–$15,000 (rango $5,000–$25,000) → un paquete de $4,500 es alto para un quince típico y solo entra como nivel superior.
5. **Fiestas infantiles de día:** una sola cifra en Miami ($1,695 por 4 h); nacional $300–$500.
6. **Clubs/restaurantes:** casi solo datos de PAGO al DJ; precio al cliente publicado únicamente por Track Masters ($2,800, paquete «nightclub» 3–6 h).
7. **Presupuesto de entretenimiento en bodas de Miami:** 4.6–7 % del total (estimador, no encuesta).
8. **Estructura de lujo:** 3–4 niveles de paquete; depósito **50 %** (Miami DJs: 50 % + saldo 14 días antes); cancelación escalonada; publicar un «desde» y negociar por teléfono el contenido, no el precio.
9. **Comisión de agencias:** 5–20 % (agentes de talento), hasta 15–40 % en plataformas. **No** es comparable con el margen de un paquete de producción (aquí se vende equipo, logística y coordinación, no solo representación).

## 2. Regla de precio propuesta
`precio_cliente = pago_dj × múltiplo`, con múltiplo mayor cuando el pago al DJ es pequeño (los costos fijos de equipo, transporte, seguro y coordinación no bajan con el pago):
| Nivel | Múltiplo | Uso |
|---|---|---|
| Paquete 1 (esencial) | ≈ 2.0× | DJ/MC + audio + luces básicas |
| Paquete 2 (objetivo) | ≈ 3.0× | + luces arquitectónicas/inteligentes, monograma, efectos, cabina |
| Paquete 3 (exclusivo) | ≈ 4–5× | + segundo DJ/MC, efectos especiales, coordinador, pantallas, exclusividad de fecha |
| Fiestas pequeñas (pago ≤ $350) | ≈ 3.5–4× | costos fijos pesan más |
*Los nombres «Paquete 1/2/3» son provisionales: el PO define los nombres reales (no se inventan rótulos de producto).*
Margen objetivo sugerido por el estratega: 45–60 % bruto **después del pago al talento y antes de otros costos**; validar con costos reales de MDJB (no hay dato del PO todavía). La comisión de plataforma de 15 % a los DJ sigue aparte.

## 3. DJ — precio al cliente propuesto
| Evento | Pago al DJ (PO) | Precio al cliente propuesto | Horas | Confianza | Respaldo |
|---|---|---|---|---|---|
| **Boda / quinceañera — Paquete 1** | $1,500 | **$3,000** (DJ/MC, audio ceremonia y recepción, 12 uplights) | 5 | ALTA | Eddie B. $2,595 / $3,495 |
| **Boda / quinceañera — Paquete 2** | $1,500 | **$4,500** (+ 24 uplights, luces inteligentes, monograma, cabina) | 5 | ALTA | Showstopper $3,995–$4,995; ejemplo del PO $4,500 |
| **Boda / quinceañera — Paquete 3** | $1,500+ | **$6,500 y más** (+ 2.º DJ/MC, moving heads, chispas, humo bajo, coordinador; exclusividad **sin tope**, se cotiza) | 5–6 | MEDIA | extrapolación; techo publicado $4,995 |
| **Corporativo — lista** | $1,500 | **$3,000** (sonido, luces básicas, MC) | 5 | MEDIA | mínimo Miami $2,500; corporativo alto $2,000–$3,000 (3 h) |
| **Corporativo — piso negociable** *(solo staff, por teléfono)* | $850 | **$1,700** | 5 | MEDIA | medio $1,247–$1,900 (Miami DJs/Track Masters) |
| **Corporativo con LED/escenario** | — | **Call para cotización** (desde $4,500) | — | BAJA | Miami DJs $2,997/3 h solo LED |
| **Holidays y fiestas especiales** | $850 | **$2,200** (incluye prima de feriado ≈ +25 %) | 5 *(horas base pendiente)* | MEDIA | feriados: recargo de 25–50 % (fuentes débiles) |
| **Club / underground — noche** | $500 | **$1,100** | según venue | BAJA | solo Track Masters $2,800 (paquete privado) |
| **Club — entre semana (no cierra tarde)** | $350 | **$750** | según venue | BAJA | sin dato de Miami |
| **Restaurante — ambientación con show (DJ en intermedios)** | $350 | **$750** | *(pendiente)* | BAJA | sin datos de precio al cliente |
| **Restaurante — DJ completo** | $500 | **$1,100** | *(pendiente)* | BAJA | sin datos de precio al cliente |
| **Fiesta privada de noche** | *(pendiente)* | **Call para cotización** (referencia: $1,400–$2,000 mercado; $2,000–$3,500 lujo, 4 h) | 4 | BAJA | falta el pago al DJ |
| **Infantil de día — gender reveal** | $250 | **$995** | 4 | BAJA | único dato Miami $1,695/4 h |
| **Infantil de día — baby shower** | $350 | **$1,395** | 4 | BAJA | idem |
| **Hora extra** | $100/h | **$350/h** | — | MEDIA | Eddie B. Plus $400; mercado $150–$300 |

## 4. Recargos, depósito y políticas (a definir por el PO)
| Concepto | Propuesta | Confianza | Nota |
|---|---|---|---|
| **Depósito** | **50 %** para reservar la fecha, saldo 14–30 días antes | MEDIA | **Hoy el sistema cobra 30 % (mínimo $150).** Cambiarlo toca `create-event-payment` y el portal |
| Cancelación | Escalonada: ≥90 días devuelve el depósito menos tarifa admin; 60–89 días 50 %; 30–59 días 25 %; <30 días se pierde | BAJA | patrón de venues; revisar con abogado de Florida |
| Temporada alta (nov–abr) | +10–15 % sobre la lista | BAJA | venues cobran 20–50 %; un DJ tiene menos costo fijo estacional |
| Feriados (Nochebuena, Año Nuevo, Halloween…) | +25 % | BAJA | ya incluido en el precio de holidays |
| Exclusividad de fecha/DJ | **sin tope, se cotiza** (regla del PO) | — | ninguna fuente publica precio |
| Overtime | $350 por hora extra | MEDIA | ver §3 |
| Viáticos | al costo + pequeño margen fuera del área base (más de 30–50 millas) | MEDIA | regla común del mercado |
| Negociación | por teléfono, solo staff; el precio de lista siempre publicado; se negocia el contenido | — | principio del PO (§11 del plan) |

## 5. Equipos y servicios — precio al cliente propuesto (con operador, entrega y montaje cuando aplica)
Comparación con los tres canales actuales: ELIXIS (E) / web (W) / vendedores (V). Precio propuesto = punto alto-medio del rango de lujo del investigador.
| Producto | Hoy | **Propuesta lujo** | Rango investigado | Confianza | Solo / paquete |
|---|---|---|---|---|---|
| CO2 jets | E300 · W400 · V400 | **$450** | $375–$550 (equipo publicado $195–$239 + entrega $120) | MEDIA | solo o paquete de pista |
| Cold sparks | E250 · W300 · V300 | **$400** por máquina | $350–$450 (equipo $149–$250) | MEDIA | paquete «entrada de novios» |
| Confeti | E120 · W450 · V200 | **$425** | $350–$500 (equipo $75–$395) | MEDIA | con CO2 |
| Humo bajo (Dancing on Clouds) | E60 · W300 | **$450** | $400–$600 (publicado $300–$595) | MEDIA | solo (primer baile) |
| Burbujas | W150 · V100 | **$250** | $200–$350 | BAJA | paquete infantil |
| Moving heads | E150 · W350 · V400 | **$300** por unidad instalada | $200–$400 (equipo $60–$320) | ALTA | dentro de paquete de iluminación |
| Uplighting | E200 · W350 · V350 | **$45 por luz** (12 luces = $540) | $40–$55 por luz (equipo $19–$65) | ALTA | paquete |
| Pantalla LED | E500 · V800 | **Call para cotización** | paquetes publicados $1,585–$6,950 + montaje | ALTA (no se vende a $500–$800) | solo, con técnico |
| PA pequeño / mediano / grande | E150/350/750 · V150/350/600 | **$300 / $525 / $950** | $250–$350 / $450–$600 / $800–$1,200 (equipo $95–$340) | MEDIA | dentro del paquete de DJ |
| Micrófono inalámbrico | E65 · V75 | **$85** (solo dentro de paquete) | mercado $15–$85 | MEDIA | paquete |
| Monitor de DJ | E95 · V100 | **$110** | sin dato directo (bocina $75–$145) | BAJA | paquete |
| Tarima chica / mediana / grande | E300/600/1200 | **$400 / $800 / $1,700** | $350–$450 / $700–$900 / $1,400–$2,200 | MEDIA | solo |
| Truss arco / caja completa / ultra | E350/1800/3500 | **$700 / $2,400 / Call para cotización** | $600–$900 / $2,000–$3,500 | BAJA | solo, con diseño |
| Cabina 360 | E450 | **$850** (3 h) | $700–$1,000 (promedio Miami 3 h $775) | ALTA | solo o con foto |
| Magic Mirror | E350 | **$625** (3 h) + $160/h extra | $550–$700 (mercado $499–$540) | MEDIA | solo |
| Fotografía (evento) | E350 · W700 (4 h) | **$1,500** (4 h) | medio día $1,200–$1,800; $300–$450/h | MEDIA | con video |
| Videografía (highlight) | E500 · W950 | **$1,800** | evento $900–$1,800; boda $4,500+ | MEDIA | con foto |
| Dron | E250 | **$700** | $500–$900 (mercado $300–$800) | MEDIA | add-on de foto/video |
| Álbum / libro de fotos | — | **Call para cotización** (extra aparte) | referencias generales $150–$3,000; ninguno publicado en Miami | BAJA | extra |
| Saxofonista | E400 · W450 · V600 | **$650** | $500–$800 (dato débil; mercado $200–$300) | BAJA | solo |
| Cantante | E500 · W600 | **$750** | $600–$900 (promedio Miami $325) | BAJA | solo |
| Percusión / timbalero | E300 · W350 | **$550** (2 h) | $450–$650 (promedio Miami $612) | MEDIA | con DJ |
| MC | E450 (mc_maestro) | **$650** | $500–$800 (promedio $448) | MEDIA | paquete DJ/MC |
| Hora Loca — robot LED | E650 | **$725** | $650–$800 (publicado $490 + CO2 $150) | MEDIA | solo o con bailarinas |
| Hora Loca — brasil / cubana / character / hadas | $850 / $800 / $550 / $750 (los 3 canales coinciden) | **se mantienen** | sin precio público en el mercado | BAJA | cotización si cambia |
| Payasos / shows infantiles | E250–450 · V300 | **$425** | $350–$500 (mercado $150–$300/h) | MEDIA | paquete infantil |
| Bartender / mesero | E250 / E200 · V150 «por persona» | **$70 / $65 por hora**, mínimo 4 h | $60–$80 / $60–$75 | MEDIA | paquete de barra/staff |
| Chef | E400 | **$195 por persona** (cena) | $150–$250 por persona | BAJA | solo |
| Water slide / inflables | W700 · V350 | **$450** (water slide); estándar $300 | $300–$500 (inflables con entrega) | MEDIA | infantil |
| Carpas, mobiliario lounge | — | **Call para cotización** | sin precio público | BAJA | cotización |

## 6. Lo que NO se pudo verificar (límites)
- Ninguna empresa de lujo publica sus precios (Power Parties, Sound Level Events, Extraordinary, Spark): los rangos de lujo son extrapolación.
- **No se halló ningún paquete completo publicado de $4,500** en Miami; el techo público más alto encontrado fue $4,995 (Eddie B. Showstopper). Paquetes con Hora Loca, robots y pantallas: solo por llamada.
- Sin datos de Miami para: restaurante (precio al cliente), club por noche entre semana/fin de semana, gender reveal y baby shower, recargos por feriado, exclusividad, viáticos en dólares, álbumes de fotos, saxofonista (bloqueos 403/404), monitor de DJ, truss grande.
- Varias cifras vienen de resúmenes de buscador o de blogs comerciales (WeddingPro, guías de precios), no de fichas originales. El margen 45–60 % y los multiplicadores son criterio, no dato.
- **Comparación con el PO:** las tarifas que dictó son **pago al DJ**; las comparaciones anteriores «DJ en rango del mercado» quedan retiradas (ver `docs/plan-dinero-de-leads-dueno-servidor.md` §10).

## 7. Decisiones que necesita el PO
1. ¿Aprueba la regla `pago × múltiplo` y los tres niveles (nombres reales)? ¿O prefiere fijar cada precio a mano?
2. ¿El depósito pasa de 30 % a 50 %?
3. Costos reales de MDJB (equipo, transporte, seguro, personal) para validar el margen y las filas BAJA.
4. Pago al DJ de la fiesta privada de noche (falta) y horas base de restaurantes y holidays.
5. ¿Los recargos (temporada alta +10–15 %, feriado +25 %) van a la lista pública o solo se cobran por teléfono?

## 8. Fuentes principales (todas las URL están en los informes de cada investigador)
Miami DJs (miamidjs.com/quote), Eddie B. (eddieb.com/weddings-dj), Classic Discjockeys (Florida 2026), Track Masters (trackmastersdj.com), Miami Party DJ (miamipartydj.com), Tropic DJs, E-Sharp, Vision DJs, SCJ Events, Miami Sound Rental (miamisoundrental.com: CO2, cold sparks, uplighting, moving heads, tarimas, truss, PA), Epic Events Booth y Miami 360 Photo Booth (360), House of Party Rentals y Special Memories FL (Magic Mirror, robot LED), Candid Studios / Lars Miller Media / Miami Photo & Video (fotografía), Rimas Films (video), Drone Permission (dron), The Bash y GigSalad (músicos, MC, payasos), Platesfull y Thumbtack (personal), The Barn 305 (quinceañeras, corporativo), Wedding.report y Gatherwith (presupuesto), WeddingPro y Tripleseat (estrategia de precios), JW DJ Agency (comisiones).
