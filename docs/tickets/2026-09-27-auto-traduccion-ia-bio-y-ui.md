# TICKET — Auto-traducción con IA (2 piezas): biografías de DJ + texto de interfaz
Creado 2026-09-27 a pedido del PO, tras encontrar que `dj_profiles.auto_translate` (columna agregada en el pasado, ver `docs/archivo-historico/ACTUALIZAR_ESTO_EN_SUPABASE.sql`) y el interruptor «traducción automática» de `jobs.html` **nunca tuvieron código detrás**: son un interruptor fantasma. Hoy, todo el texto bilingüe del sitio (diccionario de interfaz + biografías de DJ) se traduce a mano. Este ticket construye las dos piezas que faltan. Estado: **PROPUESTO, sin empezar**.

## Regla de diseño que aplica a las dos piezas (obligatoria)
Mismo patrón que ya rige a ELIXIS: **el modelo de IA propone, nunca publica directo**. Ninguna de las dos piezas escribe en producción sin que una persona confirme. Justificación: una traducción mala publicada sin revisión daña la voz de un DJ real o rompe un texto legal/técnico; el costo de revisar es bajo, el costo de un error público no lo es.

---

## Pieza 1 — Traducción automática de biografías de DJ (`dj_profiles.bio_en`)

**Qué resuelve:** el DJ escribe su biografía en un idioma; hoy el otro campo (`bio_en` o el original) se queda vacío salvo que alguien lo traduzca a mano (así se hizo hoy con DJSolitario).

**Diseño:**
1. Edge Function nueva (p. ej. `dj-bio-translate`), invocada cuando el DJ guarda su perfil en `account-settings.html`/`jobs.html` con el interruptor `auto_translate` activado (la columna ya existe; el checkbox de `jobs.html` ya existe — solo falta el código que los lea).
2. La función llama a un modelo de lenguaje con la biografía original y devuelve la traducción — **no la escribe directo en `dj_profiles`**. La guarda en un campo de borrador (p. ej. `bio_en_draft` / `bio_draft`, según el sentido de la traducción) o la devuelve a la pantalla para que el DJ la vea y confirme antes de guardar.
3. El DJ (o el owner, para perfiles como DJMago305/DJSolitario que administra el hilo maestro) aprueba o edita antes de que pase a `bio_en`/`bio` real.
4. Nunca se ejecuta sola en segundo plano sobre biografías ya existentes: solo se dispara cuando alguien guarda con el interruptor activado. Backfill de biografías viejas (como la de DJSolitario, resuelta hoy a mano) es una acción aparte, con lista explícita de a quién se le ofrece.

**Fuera de alcance de esta pieza:** traducir automáticamente reseñas de clientes, notas internas de staff o cualquier campo que no sea la biografía pública.

---

## Pieza 2 — Auto-traducción del diccionario de interfaz (`web/translations.js`)

**Qué resuelve:** cada vez que se agrega una página o un texto nuevo, alguien tiene que escribir a mano la llave `data-i18n` en los dos idiomas (así se hizo en las últimas ~10 páginas de esta sesión).

**Diseño:**
1. Script (`web/scripts/check-i18n.mjs` ya detecta llaves usadas sin definir — ver el propio archivo) que, en vez de solo reportar el faltante, puede opcionalmente completarlo: llama a un modelo de lenguaje con el texto en el idioma que sí existe y genera el otro, y **lo escribe en un archivo de propuesta aparte** (p. ej. `web/translations.pending.json`), nunca directo en `translations.js`.
2. Un humano (o un hilo de Claude en una tarea de revisión) mueve las líneas aprobadas de `translations.pending.json` a `translations.js`. Puede correr como paso opcional del workflow `site-hygiene.yml`, pero **sin permiso para comitear por su cuenta** (regla #1 de `CLAUDE.md`: cero PRs automáticos).
3. Debe respetar lo ya aprendido a mano en esta sesión: nombres propios no se traducen (DJMago305, ELIXIS, Serato…), HTML interno con comillas simples (ver memoria `feedback_translations_js_quote_escaping_gotcha`), y el criterio de «nunca inventar nombres de producto» para vocabulario como «Event Mode» o «Bridge Engine» del cockpit de Music Intelligence.

---

## Costo estimado (orden de magnitud, no cotización)
- **Construcción:** cada pieza es un ticket de tamaño mediano — una Edge Function + cambios de frontend para la Pieza 1; un script + cambio de workflow para la Pieza 2. Ninguna requiere infraestructura nueva: el proyecto ya tiene Edge Functions en producción y ya paga por llamadas a modelos de lenguaje en otros flujos (ELIXIS).
- **Operación:** el volumen actual (pocos DJs nuevos por semana, páginas nuevas ocasionales) implica un costo de API de pocos dólares al mes, no una partida presupuestaria relevante.
- **El riesgo real no es el dinero, es la calidad** — de ahí la regla de «propone, no publica» de arriba.

## Pendiente de decidir (el PO, antes de empezar a construir)
- ¿Qué modelo/proveedor de IA se usa (mismo que ELIXIS, u otro)?
- ¿Quién aprueba las traducciones de biografías cuando el DJ no es quien la pide (perfiles administrados por el hilo maestro)?
- Dueño/jurisdicción de este ticket: no está asignado en `docs/JURISDICCIONES.md` — ¿lo toma el hilo maestro o se abre un dominio nuevo?
- Prioridad: no se ha pedido que se construya ya; este documento es solo el ticket, a la espera de orden de arranque.
