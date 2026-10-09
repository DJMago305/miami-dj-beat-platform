# TICKET — Reseñas de Google en el sitio (estrella real + tarjetas de reseñas)
Creado 2026-10-09 a pedido del PO, tras ver la sección de testimonios de bailaconmicho.com. Estado: **PENDIENTE (diferido, sin construir)**. Dueño: hilo GEO·SEO·IA con el hilo maestro.

## Qué se quiere
Mostrar en el sitio las **reseñas reales de Google** de Miami DJ Beat (estrella promedio, total de reseñas y tarjetas con las reseñas), como hace Baila Con Micho.

## Referencia (lo que hace bailaconmicho.com, medido 2026-10-09)
- Bloque «Testimonials / What Do Our Students Say?» con el sello **Google Rating** y «Average: 4.69 rating out of 133 reviews».
- Carrusel de tarjetas de reseña (foto, nombre, «hace 8 años», 5 estrellas, texto con «Read More»), flechas a los lados, puntos abajo y un botón hacia su ficha.
- Está hecho con un carrusel Swiper y datos de Google traídos por su plataforma (Duda); son 123 reseñas cargadas. No se copia su código ni sus textos: se construye con nuestros datos.

## Cómo se haría (ya documentado en memoria, nota del 2026-08-15)
- **Una Edge Function** llama a Google con la llave del lado del servidor. La llave nunca va en la página.
- **Camino A, Places API:** estrella promedio, total de reseñas y hasta 5 reseñas destacadas. Esfuerzo bajo. Necesita el Place ID de la ficha y una API key.
- **Camino B, Business Profile API:** todas las reseñas y poder responderlas. Requiere el OAuth del dueño de la ficha y la aprobación de Google. Esfuerzo medio.
- **Caché:** las llamadas cuestan centavos; se guarda el resultado (por ejemplo, una vez al día).

## Reglas
- Google exige mostrar su rating con **su sello, atribución y enlace**; no se puede mezclar en un solo número con las estrellas nativas. Va en un **bloque de Google aparte**, y las opiniones propias (MI PERFIL) aparte.
- Cambios solo en la página que el PO nombre; nunca en la home ni en páginas indexadas sin su orden.
- Texto de las tarjetas en el idioma original de cada reseña; el resto del bloque con `data-i18n` ES/EN.

## Contexto de hoy
- La ficha de Google Business Profile está activa. Las plantillas «Campaña reseñas» (SMS y correo, ES/EN) ya piden reseñas con el enlace real; el borrador para pedir reseña a Ruddy (evento con Porsche) sigue sin enviar.
- Timing del PO en agosto: «se ancla cuando entre la monetización a la web». Aquí queda **abierto**; el PO decide cuándo.

## Decisiones que faltan (PO)
1. ¿Camino A (5 reseñas, rápido) o B (todas y responder, con aprobación de Google)?
2. ¿En qué página va primero el bloque?
3. ¿Se muestra el total de reseñas aunque sea chico al principio?

## No hacer todavía
Nada de código, SQL ni llaves hasta que el PO responda lo de arriba.
