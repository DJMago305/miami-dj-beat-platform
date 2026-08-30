# Constitución de SmartCrate IA

**Registrado por:** Hilo Especialista — Elixis Core & Backend (Miami DJ Beat LLC), a pedido explícito del PO.
**Fecha de asiento:** 2026-08-30.
**Estado:** LEY INVIOLABLE para todo código que se construya bajo el nombre "SmartCrate IA" — no negociable bajo ningún ticket futuro, propio o de otro hilo.

---

## Los principios, en términos operativos

1. **Solo lectura (Read-Only).** SmartCrate IA nunca escribe, mueve, renombra ni borra un archivo de audio, ni toca `_Serato_` de ninguna otra forma que no sea leerlo. El motor de indexación que ya existe para esto (`tools/serato-parser/`, Dominio #6 — Inteligencia Musical) ya fue **verificado por grep, no solo por lectura del código**: cero `fs.write*`/`unlink`/`rm` en todo el módulo. Cualquier pieza nueva de SmartCrate IA que se construya de aquí en adelante hereda esa misma obligación, verificable de la misma forma antes de darse por cumplida.
2. **Solo metadatos, nunca audio.** Lo que se indexa, sincroniza o guarda es ruta de archivo, título, artista, álbum, género, BPM, tonalidad, duración y demás metadata ligera — nunca el archivo de audio en sí. Esto aplica tanto al Indexador Serato (lee del disco) como al Cazador Acústico (procesa una muestra de 6s en memoria contra ACRCloud y descarta el audio, nunca lo persiste).
   - **Nota de honestidad técnica**: no todos los campos listados en el ticket original (BPM, Key, ISRC, Tags) están confirmados hoy en las dos fuentes reales. El Cazador Acústico (ACRCloud, ver `supabase/functions/music-fingerprint/index.ts`) sí devuelve `isrc` cuando el catálogo lo tiene. El Indexador Serato, validado hoy contra archivos reales del PO, devuelve BPM/tonalidad/género/etc. — **no se confirmó que también traiga ISRC**; no se asume que existe hasta verificarlo contra el catálogo real de tags de `database V2` (spec del Dominio #6, `docs/inteligencia-musical/serato-parser-spec.md`).
3. **Los 4 motores — estado real, no aspiracional:**
   - **Cazador Acústico** (identificación en vivo vía ACRCloud + micrófono ambiente) — **CONSTRUIDO Y VERIFICADO EN VIVO** contra producción real. Vive en `elixis-realtime-session`/`music-fingerprint` (identidad `djmago`), con `create_response:false` y piso de confianza 0.50 tras la corrección del 2026-08-30.
   - **Indexador Serato** (lectura de `.crate`/`database V2` del disco) — **CONSTRUIDO Y VALIDADO**, pero en el Dominio #6 (`feature/music-intel-serato-parser`), no en este hilo. Validado independientemente hoy: 369 tracks, 5 crates, 81/81 referencias resueltas contra archivos reales del PO.
   - **Criterio Contextual por Evento** (recomendar repertorio según el tipo de evento — boda, quinceañera, club) — **NO CONSTRUIDO. Visión únicamente.** Ningún código existe todavía para esto.
   - **Recomendador Armónico Camelot** (compatibilidad de tonalidades + curvas de BPM) — **NO CONSTRUIDO. Diseño pendiente.** Brecha real identificada: el Indexador Serato devuelve tonalidad en notación tradicional ("Dm", "Abm"), no en notación Camelot ("8A") — hace falta una tabla de conversión de las 24 claves antes de que este motor pueda calcular nada.
4. **Módulo exclusivo de cuentas de pago.** SmartCrate IA vive detrás de un candado de plan (PRO/ELITE), nunca abierto a cuentas gratuitas. La interfaz vive en el entorno autenticado (`staff.html?vista=smartcrate`), **no en la página pública de marketing** (`dj-tools.html`) — esa página solo puede llevar a la herramienta real vía un enlace, nunca contener la herramienta funcional en sí. El candado reutiliza `window.MDB_SUBSCRIPTION.isPremiumTier()` (ya establecido en el sitio, `web/subscription.js`) más un bypass explícito para roles de staff (`owner`/`admin`/`manager`/`seller`) — nunca un candado inventado aparte que duplique esa lógica.

## Por qué existe este documento

El 2026-08-30 se estuvo a punto de reimplementar, en el hilo equivocado, un parser binario de Serato que **ya existía, validado, en el Dominio #6** — una duplicación real que este documento ayuda a prevenir hacia adelante: cualquier hilo que toque SmartCrate IA debe primero verificar contra este documento y contra `docs/ESTADO_MAESTRO.md` qué de los 4 motores ya existe y en qué rama, antes de escribir una sola línea.

## Jurisdicción y frontera con el Dominio #6

- El **motor de indexación de Serato** (parsing binario de `.crate`/`database V2`) es propiedad del Dominio #6 — Inteligencia Musical (`docs/JURISDICCIONES.md`, pendiente de fusionar la entrada formal desde `feature/music-intel-serato-parser`). Ningún otro hilo reimplementa ese parser; lo consume una vez que el Dominio #6 entregue el sincronizador hacia Supabase (su propio spec, §9, documenta las opciones — decisión aún sin cerrar formalmente en ese hilo).
- El **Cazador Acústico**, la **interfaz de SmartCrate IA** y el **candado de plan** son de este hilo (Elixis Core & Backend/Voice), ya construidos y comiteados localmente.
- El **Criterio Contextual por Evento** y el **Recomendador Armónico Camelot** no tienen dueño asignado todavía — no empezar a construir ninguno de los dos sin que el PO lo asigne explícitamente a un hilo.

## Vínculo con gobernanza existente

- Complementa [[project_estacion_agentica_mdj]] (visión de agentes por oficio — SmartCrate IA es una instancia concreta de esa visión, no una excepción a ella).
- La colisión de hilos evitada el 2026-08-30 está documentada en detalle en `docs/ESTADO_MAESTRO.md`, entrada "⚠️ Colisión de hilos evitada — SmartCrate IA vs. Dominio #6".
- El candado de plan sigue [[feedback_founder_scope_vs_owner_permissions]] (el plan "founder" del owner es un concepto de artista, nunca un permiso de owner — de ahí el bypass explícito de staff, no un cambio a `isPremiumTier()`).
