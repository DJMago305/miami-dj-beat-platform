# TICKET GRANDE — Experiencia real por tipo de venue → calificación pública inteligente
Creado 2026-09-27 a pedido del PO, tras una conversación larga de diseño. **PROPUESTO, sin construir** — sigue bajo la misma regla de gobernanza del "Owner Financial Matrix Blueprint" (`project_cashflow_financial_intelligence_vision.md`): *"Toda evolución derivada requerirá su propio ticket, reconciliación arquitectónica y aprobación explícita del Product Owner."* Este documento consolida esa conversación completa — no es autorización de arranque, es la base para cuando el PO decida arrancar.

## El problema que lo originó
El PO preguntó por qué `find-dj.html`/`dj/directorio.html` muestran tarjetas pequeñas en cuadrícula en vez de un formato tipo "hero" (el mismo diseño grande que ya tiene cada perfil individual), ordenado por estrellas y disponibilidad. Se verificó con datos reales: hoy solo 1 de 3 DJs públicos tiene calificación real (DJMago305, 5.0/2 reseñas); los otros dos tienen el valor por defecto falso (1.0/0). `dj_events` (la tabla de eventos agendados) sigue en cero filas. No hay con qué ordenar honestamente todavía — esto abrió la conversación de fondo.

## No es una idea nueva — ya estaba registrada, desconectada
La visión "Reusable Artist Financial Matrix" del PO (5 de agosto, en `project_cashflow_financial_intelligence_vision.md`) ya preveía trackear por artista: flujo de caja, contratos, **días de trabajo**, venues, ingreso recurrente vs. ocasional. Esa visión avanzó bastante en su rama financiera (motor T009, 13 tablas `financial_*`, Fases 1-6 en gran parte hechas) pero **nunca se conectó al buscador público**. Ese último paso es lo que se define en este ticket.

**Dato real que ya conecta ambos mundos:** `residency_schedule` (venue, turno, dj_name, pagos) ya se importó una vez a `financial_venues`/`financial_venue_agreements` — 6 residencias reales → 3 venues + 6 agreements en producción, y **"Sundowner"** fue uno de los venues reales usados en las pruebas de ese motor.

## El modelo de datos, tal como lo definió el PO

### 1. La experiencia se mide por categoría de venue/evento, no como un número único
Cada venue/evento tiene su propia **especificación comercial reconocida** — ejemplos reales dados por el PO:
- **Mojitos Calle 8**: restaurante cubano, música para bailar + comer + beber.
- **Bar de playa / sundowner**: cliente típico es comercial (un negocio frente al mar).
- **Fiesta temática en parque público**: ejemplo real, la fiesta de los jueves del propio PO — tema "Haunted House", evento grande, "mucho impacto y relevancia" aunque sea un evento único, no repetido.

La experiencia de un DJ en "sundowners" no es la misma que en "clubes" ni en "fiestas privadas" — son pistas separadas, no un promedio.

### 2. Interno (rico) vs. externo (simple) — nunca mezclar
- **Interno**: conteos, categorías, historial detallado — información de sistema.
- **Externo (lo que ve el cliente)**: cualitativo y simple — "Buen DJ, ha hecho bodas, buenas calificaciones." Nunca un número crudo de eventos.
- Regla ya aplicada toda esta sesión (`hasRealRating`, DJ PRO TEST, etc.): **si no hay dato real detrás, no se muestra nada** — nunca fabricar una insignia vacía o un "0".

### 3. El venue comercial decide a quién se prioriza, no un ranking fijo
Cuando alguien busca (ej. un bar de playa buscando DJ para sundowner), el sistema debe cruzar la especificación del venue con la experiencia real del DJ en esa categoría específica — de forma invisible para el cliente, que solo ve el resultado ya filtrado/priorizado. Conecta con el `?specialty=` que ya existe en el buscador.

### 4. Fuentes de datos — más que lo transaccional interno
El PO fue explícito: esto no es "terreno muerto o por explorar" — hay datos reales de sobra:
- Transaccional interno (`financial_venue_agreements`, cuando se conecte de verdad).
- **Calificación pública real del propio venue** (ej. estrellas de Mojitos Calle 8 en Google/redes) — información pública, no inventada.
- **La biografía que el propio DJ ya escribió** (`dj_profiles.bio`), que dice en qué se especializa — dato ya existente, sin explotar para esto.
- **Trayectoria / años de carrera del DJ** — también auto-declarado, sin usar todavía.

**Expectativa explícita del PO sobre el rol del agente, hacia adelante, no solo hoy:** *"tú estarás trabajando con nosotros... es por eso [que] estás, para buscar información de cada dato, cada cosa que se ingrese aquí."* — investigar activamente información pública real cada vez que se agregue un venue/DJ/evento nuevo, no una tarea de una sola vez.

### 5. Confiar en la palabra del DJ, pero el sistema lo corrige con datos reales
El PO resolvió esto directamente: **sí se confía en lo que el DJ declara de sí mismo** (porque muchos datos no están registrados todavía) — pero el sistema lo va midiendo con el tiempo, vía calificaciones reales por tipo de evento:
- Si a un DJ se le asigna una boda y el cliente da una calificación baja, eso baja su visibilidad específicamente en búsquedas de bodas — no en general.
- **Principio de balance, textual del PO**: "si el DJ hace 10 bodas con buenas calificaciones y una que no fue favorable, hay un balance, es 10 contra 1, no se puede juzgar por un cliente." Una sola mala experiencia no debe hundir la categoría completa.
- Un evento único pero grande/de alto impacto (como el "Haunted House" de los jueves) también debe pesar, no solo la repetición — el modelo no puede ser solo "cuántas veces se repitió."

### 6. Explícitamente FUERA de este ticket
Verificación de antecedentes penales / historial de seguridad de las personas (ej. no recomendar a alguien con récord de abuso infantil para una fiesta infantil) — el PO lo planteó en la misma conversación, pero **es un dominio legal separado**, no de datos de negocio: requiere un proveedor certificado de verificación de antecedentes (Checkr, Sterling, etc.), consentimiento firmado, y revisión de un abogado — nunca una "IA de investigación" scrapeando información. No se documenta como parte de este modelo de experiencia/calificación.

## Relacionado, pero es un ticket separado y más chico
`docs/tickets/2026-09-27-recomendacion-excluye-dj-mal-calificado.md` — conectar `dj_public_reviews` (ya existe, 3 reseñas reales) con `get_recommended_djs()` (ya existe, pero solo se usa en la herramienta interna de staff) para que un cliente nunca vuelva a ver recomendado a un DJ que él mismo calificó mal. Misma familia de idea, pieza más chica y accionable, con la infraestructura ya construida — puede avanzar independiente de este ticket grande.

**Regla que conecta ambos tickets (confirmada por el PO, aplica a cualquier categoría de evento, no solo bodas):** toda reseña/calificación que alimente este modelo — ya sea la exclusión de recomendación del ticket chico, o la experiencia por categoría de venue de este ticket grande — **debe venir de un cliente que realmente contrató a ese DJ**, nunca de una cuenta cualquiera. Protege al artista de reseñas falsas o maliciosas. Verificado hoy que `dj_public_reviews` no exige esto todavía a nivel de base de datos — es un prerrequisito técnico compartido por los dos tickets, no algo que se resuelve dos veces por separado.

**⚠️ Matiz importante (2026-09-27, mismo día) — esa regla no aplica a TODA reseña.** El PO aclaró que si el DJ toca en un venue público o una residencia (exactamente el tipo de experiencia que este ticket mide — sundowner, Mojitos Calle 8), **cualquiera de los cientos de asistentes puede dejar una reseña/comentario legítimo**, sin haber contratado al DJ directamente (el venue sí lo contrató, no el asistente individual). Esto es especialmente relevante para ESTE ticket específicamente, porque el modelo de "experiencia por categoría de venue" depende en buena parte de reseñas de público de venues abiertos, no solo de clientes que reservaron un evento privado. **Hay dos orígenes de reseña distintos, con reglas de verificación distintas:**
- Cliente directo (reservó al DJ para su evento privado) → sí debe verificarse contratación confirmada.
- Público de venue (asistió a un lugar abierto donde el DJ tocaba) → no hay contratación individual que verificar, la opinión es legítima igual.

Sin resolver todavía cómo el sistema distingue ambos orígenes en la práctica — queda como pregunta abierta nueva, sumada a las 4 de la sección anterior.

## Preguntas abiertas para cuando el PO autorice arrancar
1. ¿Quién define/etiqueta la categoría comercial de cada venue — el staff al darlo de alta, o el sistema la infiere de información pública (categoría de Google, descripción del sitio del venue)?
2. ¿Cuál es el vocabulario exacto de insignias/etiquetas cualitativas que verá el cliente? (ej. "Especialista en fiestas temáticas", "Experiencia comprobada en restaurantes con música en vivo"...)
3. ¿Cómo se pondera un evento único de alto impacto vs. experiencia repetida en el mismo venue — hace falta una regla concreta, no solo el principio.
4. ¿De dónde sale el "umbral" de calificación baja que dispara la corrección por categoría (mismo tipo de pregunta que el ticket chico de recomendaciones)?

## Cómo aplicar
Sin autorización de construir. Cuando el PO esté listo, esto se convierte en una reconciliación de arquitectura propia (mismo patrón usado para el resto del Owner Financial Matrix) — no se empieza a escribir código desde esta nota.
