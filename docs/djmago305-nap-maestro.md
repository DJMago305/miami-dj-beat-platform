# DJMago305 — NAP artístico maestro (fuente de verdad)

Ticket: P0 del `Informe Maestro SEO/GEO/AEO` (23 sept 2026), sección 7 — "NAP artístico maestro".
Uso: al editar o crear cualquier perfil externo de DJMago305 (Beatport, SoundBetter, Spotify for Artists,
Apple Music for Artists, Yelp, GBP artístico, etc.), copiar los datos de aquí. No inventar ni aproximar
ningún campo — si un dato no está confirmado, se marca como **NO CONFIRMADO** y se pregunta al PO.

Regla central (viene del informe): DJMago305 y Miami DJ Beat LLC son dos entidades públicas distintas.
Conectarlas de forma factual (DJMago305 → "vinculado a Miami DJ Beat LLC"), nunca fusionarlas ni compartir
el mismo NAP como si fueran el mismo negocio.

---

## NAP (Name / Address / Phone)

| Campo | Valor | Fuente |
|---|---|---|
| Nombre artístico | **DJMago305** | `web/dj/djmago305.html`, schema.org Person, `alternateName` |
| Nombre real | Gerardo A. Valle | mismo schema, `name` |
| Teléfono artístico | **(305) 423-5814** | Confirmado por el PO 2026-09-22 — ligado a su propio GBP "DJMago305", distinto del (305) 607-1780 corporativo de Miami DJ Beat. **Nunca mezclar los dos números.** |
| Perfil/website canónico | `https://www.miamidjbeat.com/dj/djmago305.html` | Página oficial dentro del sitio de Miami DJ Beat — es el `@id` schema.org (`#gerardo-a-valle`), fuente única del nodo `Person` completo. Cualquier otra página del sitio que lo mencione debe usar un stub con `@id`, nunca duplicar el nodo. |
| Ciudad / área (redacción pública) | **Miami / South Florida** | Decidido por el PO 2026-09-23. |

### Ciudad / área de servicio — decidido
El informe (hallazgo C) señaló que SoundBetter muestra "Hialeah" mientras el texto dice "Miami-based"
— la misma inconsistencia existe hoy en nuestro propio schema: el campo `address.addressLocality` de
`djmago305.html` dice **"Hialeah"**, pero la bio narrativa dice *"consolidar su nombre en Miami"*.

El PO decidió la redacción pública a usar de aquí en adelante en todo perfil artístico nuevo o
editado (Beatport, SoundBetter, Spotify for Artists, GBP artístico, etc.): **"Miami / South Florida"**.
Esto es solo sobre cómo se *nombra* la zona hacia afuera — Hialeah sigue siendo la ciudad legal
registrada para todo lo corporativo, y este documento no cambia ningún dato de esa entidad.

**Pendiente aparte, no incluido en esta aprobación**: si el propio campo `address.addressLocality`
del schema.org de `djmago305.html` debe actualizarse de "Hialeah" a esta misma redacción, es una
edición de código en producción (no solo documentación) — se deja para un ticket separado, con su
propia confirmación explícita antes de tocar el schema real.

---

## Bio corta (para plataformas con límite de caracteres)

Recortada directamente de la bio real ya publicada en `djmago305.html` — ninguna frase nueva, solo
resumen. No usar una bio distinta o "mejorada" sin que venga de este mismo texto fuente.

**Español (≈420 caracteres):**
> DJMago305 es DJ y productor musical con más de tres décadas de experiencia, fusionando ritmos
> clásicos con house, tech house y afro house. Desde sus inicios en clubes de Cuba y Europa hasta
> consolidar su nombre en Miami, mantiene viva la magia de las bandejas con un sonido que combina
> herencia afro-latina y visión electrónica contemporánea. Vinculado a Miami DJ Beat LLC.

**English (≈400 characters):**
> DJMago305 is a DJ and music producer with three decades of experience, blending classic rhythms
> with house, tech house and afro house. From club stages in Cuba and Europe to building his name in
> Miami, he keeps the art of the decks alive with a sound rooted in Afro-Latin heritage and a
> contemporary electronic vision. Affiliated with Miami DJ Beat LLC.

Fuente completa (bio larga, sin recortar): `web/dj/djmago305.html`, schema.org Person → `description`.

---

## Enlaces oficiales (sameAs) — ya declarados en nuestro propio schema

Estos son los reales, verificados, ya en `djmago305.html`. Usarlos como la lista canónica al llenar
"website/enlaces" en cualquier plataforma nueva:

- https://www.instagram.com/djmago305/
- https://www.facebook.com/DJMago305MI/
- https://www.tiktok.com/@djmago305
- https://www.youtube.com/@DJMago305
- https://soundcloud.com/djmago305
- https://music.apple.com/us/artist/djmago305/1741346950
- https://open.spotify.com/artist/5oOaUttBsSfgALBiKREGe6
- https://www.beatport.com/artist/djmago305/1413996

### Gap encontrado: falta SoundBetter en nuestro propio `sameAs`
El informe confirma que `https://soundbetter.com/profiles/637512-djmago305` es un perfil real y
público de DJMago305, pero **no está** en el `sameAs` de `djmago305.html` todavía. Es una adición
segura (perfil ya existente, verificado, no se crea nada nuevo) — pendiente de aprobación del PO
para agregarlo al schema, por rama + PR, como el resto de estos cambios.

---

## Hallazgos del informe que afectan a estos perfiles externos (no corregidos todavía)

1. **Metadata musical mal escrita** — "Spirit Of The Drom" / "Spiit Of The Drum" en Apple Music y
   Beatport. Corregir en el distribuidor de origen (DistroKid u otro), no parchear plataforma por
   plataforma. Necesita el login real del PO.
2. **Bio vieja con "SoundCaribe Record Corp"** — todavía visible en Beatport y SoundBetter. Actualizar
   usando la bio corta de este documento, distinguiendo "histórico" de "actual". Necesita el login
   real del PO.
3. **Ubicación inconsistente** — ver sección "Ciudad / área" arriba.

## Estado de este documento
Creado 2026-09-23 a partir de datos ya verificados (schema.org real + memoria confirmada por el PO).
Ningún campo fue inventado o aproximado. Actualizar esta tabla si el PO decide la redacción de
ciudad/área o confirma cualquier otro dato nuevo.
