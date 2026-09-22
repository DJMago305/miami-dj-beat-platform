# TICKET — Bartender de flair (show): precio de mercado en Miami + página informativa indexable
Creado 2026-09-21 a pedido del PO. **ACTUALIZADO 2026-09-21: el PO fijó el precio estándar del bartender de flair en $1,200 por evento** (ya está como SKU `staff_bartender_flair` en el fallback del catálogo, en el panel de precios del owner y en `artist_rate_effective`; falta desplegar `elixis-chat`). La página informativa AÚN NO está creada.

## 1. Qué es (definiciones para clientes y ELIXIS)
- **Bartender de flair / de show / acrobático** (en inglés *flair bartender*, *flairtender*): mezcla la bebida mientras hace malabares con botellas y cocteleras, lanza y atrapa, a veces con fuego o humo. Es espectáculo además de servicio.
- **No es lo mismo que un mixólogo** (coctelería de autor, sin acrobacia) ni que un bartender clásico. En la plataforma ya son 3 subcategorías separadas de la categoría Bartender: *Bartender clásico*, *Bartender de flair (show)* y *Mixólogo*.
- **Idioma (bilingüe = muy importante para el PO):** dato aparte del perfil (`dj_profiles.idiomas`: es / en / bilingue). Debe poder filtrarse y mostrarse al cliente.

## 2. Precio de mercado en Miami (búsqueda web 2026-09-21) — solo referencia, sin decidir
| Dato | Valor | Fuente | Confianza |
|---|---|---|---|
| Flair bartender: tarifa por hora | $50 – $300 /h | Fash, «2026 Bartender Cost To Hire» | media: cifra genérica de EE. UU., rango muy amplio |
| Flair bartender: costo típico por evento | $500 – $1,200 | Fash (misma fuente) | media |
| Bartender en Miami (clásico), por hora | $40 – $80 /h; paquetes $250 – $1,200; mínimo 3–4 h | PlatesFull, «How Much Does a Bartender for a Party Cost in Miami? (2026)» | media |
| Bartender clásico Miami, ejemplo real con precios | $300 (3 h, Signature Bar) · $375 (efectos de humo) · $525 (Luxe) · hora extra $75 · 2.º bartender $100/h · depósito $100 · **show de fuego: cotización aparte** | bartender.miami/pricing | alta, pero es un solo proveedor y NO es flair puro |
| Costos fijos extra (traslado, montaje) | $50 – $300 | Fash | media |
| Demanda | Miami es la ciudad con más solicitudes de flair en Florida | GigSalad | informativa |

Límites honestos: GigSalad (directorio con perfiles y precios de flair en Miami) devolvió 403 al leerlo desde aquí, así que **no hay una cifra confirmada de un proveedor de flair puro en Miami**. Recomendación: antes de fijar la base, pedir 3 cotizaciones reales a flairtenders de Miami (GigSalad / The Bash) o preguntar a los artistas suscritos.
Lectura para decidir: un flair suele cobrar **2× a 4× un bartender clásico** por evento. Con el bartender clásico de la plataforma en $250, un rango razonable a validar sería $500 – $1,200 por evento (3–4 h), coherente con el dato de Fash. **Cifra final = decisión del PO: $1,200 por evento** (extremo alto del rango de mercado; sigue siendo negociable).

### Ya aplicado
- SKU `staff_bartender_flair` = $1,200 en `supabase/functions/_shared/event-quote-catalog.ts` (fallback) y editable en el panel de precios del owner (`staff-admin.html`); `artist_rate_effective` lo devuelve como base del flair. `platform_settings.rentals_catalog_prices` no existe todavía en la base (se usa el fallback): se crea cuando el owner guarde precios desde su panel.
- Debe decir siempre: **precio base negociable; varía según requisitos del evento y la política de cada artista.**

## 3. Página informativa para clientes (indexable en Google) — **CREADA 2026-09-21 en local (sin commit)**: `web/flair-bartender-miami.html`
Objetivo: explicar qué es el bartender de flair, contar su historia, mostrar una imagen y llevar a cotizar/contratar. Página propia, mismo esqueleto que las páginas de servicio (`weddings.html`, y `hora-loca.html` del plan del hub).

### Contenido mínimo
1. **Qué es y en qué se diferencia** de bartender clásico y mixólogo (sección 1).
2. **Historia (verificada contra Wikipedia «Flair bartending» el 2026-09-21; se corrigieron 2 datos del borrador):**
   - Finales del siglo XIX: **Jerry «The Professor» Thomas**, el primer bartender de flair del que hay registro; servía chorros de whisky en llamas y creó el **Blue Blazer**.
   - Años 80: **T.G.I. Friday's** ayudó a convertir el flair en oficio. **A fines de 1986** organizó el primer concurso nacional de flair (no 1987) y en **1991** lanzó el mundial, el *World Bartender Championship*. (John Mescall figura entre los bartenders enviados a la oficina corporativa en 1986; NO se afirma Marina del Rey ni 1985.)
   - **1988, «Cocktail»**: **John «J. B.» Bandy**, campeón de flair, entrenó a Tom Cruise y Bryan Brown. (NO se afirma que ganara en 1987.)
   - Se descartó el dato del «premio de $100,000 en los 90»: no aparece en la fuente.
   - Hoy: según GigSalad, Miami es la ciudad de Florida con más solicitudes de flair (cumpleaños, corporativos, fiestas en casa).
3. **Qué esperar en tu evento:** show mientras prepara el trago; opciones con fuego o humo (cotización aparte); duración mínima habitual 3–4 h; un bartender atiende ~50–60 invitados; 2.º bartender para 60+.
4. **Bilingüe:** explicar que trabajamos con bartenders en español, inglés o bilingües y que se puede pedir el idioma al cotizar.
5. **Precio:** «desde» + aviso «los precios pueden variar según los requisitos del evento y la política de cada artista». Sin cifra hasta que el PO la decida (sección 2).
6. **Llamado a la acción:** cotizar (mismo flujo que el resto de servicios).
7. **Preguntas frecuentes** (para el marcado FAQ): ¿qué es un bartender de flair?, ¿en qué se diferencia de un mixólogo?, ¿cuántas horas mínimo?, ¿incluye fuego?, ¿es bilingüe?

### Imagen
- **Necesaria:** al menos una foto de un bartender de flair en acción.
- **Fuente:** foto propia de un evento de Miami DJ Beat o de un artista suscrito con su permiso; si no, foto con licencia comercial clara. **No** copiar imágenes de otros sitios ni enlazarlas en caliente.
- Formato .webp optimizado, `alt` descriptivo en español e inglés (SEO y accesibilidad). Ruta según convención del repo: `web/assets/` (artistas: `web/assets/artists/<nombre>/`).

### SEO / indexación en Google
- Página nueva `web/flair-bartender-miami.html` (nombre a confirmar) con `<title>`, meta description, canonical, Open Graph, y JSON-LD `Service` + `FAQPage`.
- Todo texto visible con `data-i18n` en ES **y** EN en `translations.js` (si falta en un idioma la etiqueta queda en blanco: bug conocido).
- Añadir a `sitemap.xml`, enlazar desde el hub de servicios/talento y desde la propia categoría Bartender; enviar la URL a Google Search Console (lo hace el hilo GEO·SEO·IA, que tiene ese acceso).
- Nada de «Portal DJ»: la página no debe presentar la plataforma como solo de DJs.

## 4. Hecho ya en la plataforma (para contexto)
- Subcategorías Bartender (clásico / flair-show / mixólogo) en `jobs.html` y en Configuración de cuenta; idioma es/en/bilingüe en ambos; ELIXIS puede filtrar por idioma.
- Pendiente de despliegue por el PO: `elixis-chat`.

## 5. Decisiones que necesita el PO
1. ~~Cifra base del bartender de flair~~ → decidido: $1,200 por evento.
2. ¿La página lleva precio «desde» o solo «cotiza»?
3. Foto: ¿propia, de un artista suscrito, o con licencia?
4. Nombre y URL de la página.

## 6. Estado de la página (2026-09-21)
- Creada `web/flair-bartender-miami.html` (ES/EN, 43 claves `bflair-*` en translations.js), JSON-LD `Service` + `FAQPage`, canonical, Open Graph, entrada en `sitemap.xml`. Precio: «Desde $1,200 por evento», negociable. Probada en el navegador (encabezado real, ES y EN, sin errores).
- **Imagen: PENDIENTE de permiso.** La figura ya está cableada y se oculta sola mientras el archivo no exista. Candidata con licencia libre: Wikimedia Commons «Flair Bartending.jpg», **CC BY 2.0**, 4151×2965, 1.85 MB, autor «Thank You (25 Millions) views», requiere atribución (ya está en el pie de la figura). Alternativa con licencia CC BY-SA 3.0: «KATSU 5Bottle1Head.jpg» (autor KATSU NUMBERS, 132 KB, obliga a compartir igual).
- **No usar** los fotogramas del video propio `mdj-staff-videos/Bartender.mp4`: muestran a una persona identificable y el logo de un local, y ninguno muestra flair real.
- Pendiente: imagen, enlazar desde el hub de servicios y desde la categoría Bartender, enviar la URL a Search Console (hilo GEO·SEO·IA), imagen `og:image` y campo `image` del JSON-LD cuando exista.

## 7. Imagen — RESUELTA 2026-09-21 (permiso del PO)
- Descargada de Wikimedia Commons «Flair Bartending.jpg» (CC BY 2.0, autor «Thank You (25 Millions) views», 4151×2965, 1.94 MB) → convertida a `web/assets/bartender-flair/flair-bartending.webp` (1600×1143, 117 KB). Atribución visible en el pie de la figura; `og:image` y `image` del JSON-LD apuntan a ella (URL absoluta de producción: funcionará al desplegar).
- Muestra a un bartender vertiendo por una cadena de cocteleras hacia copas de martini ante público. En el fondo hay público reconocible (foto de un show en vivo); la licencia cubre la foto, no los derechos de imagen de los asistentes: si el PO prefiere, sustituir por foto propia o de un artista suscrito.
- Original en scratchpad (no versionado).

## 8. Imagen — DECISIÓN FINAL DEL PO (2026-09-21, reemplaza al §7)
- La página queda **SIN la foto de Commons** (el PO prefiere el hero con el video solo). Se eliminaron la figura, su atribución y el archivo `flair-bartending.webp`.
- **El bartender del video del hero (`mdj-staff-videos/Bartender.mp4`) es amigo del PO y va a trabajar en la plataforma**: su imagen está aprobada para esta página (corrige lo anotado en el §6 sobre ese video). El póster del hero es un fotograma de ese video (sin rostro); es también el `og:image` y el `image` del JSON-LD.
- El bartender de la foto de Commons es un desconocido: no se usa su imagen.

## 9. Enlaces (2026-09-21)
- ~~Fila «Flair Bartender» en el hub~~ — RETIRADA por decisión del PO: **Flair es una SUBcategoría dentro de Bartender, no una categoría**; el hub solo lista categorías. La página se llega desde el bloque Bartender de `staff-dj.html` (categoría Staff del hub).
- Categoría Bartender del lado del cliente = `staff-dj.html` (bloque «Bartender»): enlace «¿Quieres show? Conoce al flair bartender →».
- Pendiente: que el hilo GEO·SEO·IA envíe la URL a Search Console.
