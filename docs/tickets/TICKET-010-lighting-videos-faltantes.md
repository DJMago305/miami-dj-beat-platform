# TICKET-010 — Lighting Catalog: Videos — Clarificacion de Estado

**Fecha de apertura:** 2026-06-16
**Abierto por:** Agente (auditoria automatica)
**Estado:** CERRADO — ACLARACION CEO 2026-06-16 01:01 UTC-4
**Prioridad:** BAJA — pendiente solo 1 item en proximo deploy

---

## ACLARACION DEL CEO (2026-06-16 01:01 UTC-4)

> "Los videos estan subidos a Supabase. Solo en localhost estaban desvinculados. El unico video pendiente es el de Banda en Vivo (recien creado) — se agrega en el proximo deploy a produccion."

**En produccion (Supabase CDN): todos los 15 videos de Lighting EXISTEN y estan enlazados correctamente.**
**En localhost: las rutas locales `assets/lighting/*.mp4` no tienen los archivos fisicos — es un estado normal de dev, no un bug.**

## Problema original (ya aclarado)

La carpeta local `assets/lighting/` existe con 15 imagenes `.jpg` pero sin `.mp4`. La auditoria de localhost detecto esto como error. Confirmado por CEO: los `.mp4` estan en Supabase Storage / CDN y se sirven correctamente en produccion.

El sistema de fallback de `rentals.js` (linea ~2335) intenta usar `catalog.bgVideo || catalog.items[0].video` cuando no encuentra video — pero como todos los items de Lighting tienen video roto, el hero de ese modal quedara en negro o sin video.

## Items afectados

| ID | Nombre | Video roto |
|---|---|---|
| `led_panel_small` | LED Panel Screen (Small) | `assets/lighting/led-small.mp4` |
| `led_panel_large` | LED Panel Screen (Large) | `assets/lighting/led-large.mp4` |
| `moving_heads` | Moving Head Lights (Pair) | `assets/lighting/moving-heads.mp4` |
| `uplighting_pack` | Uplighting Pack (10 Units) | `assets/lighting/uplighting.mp4` |
| `laser_show` | Laser Show System | `assets/lighting/laser.mp4` |
| `fog_machine` | Fog Machine (Smoke) | `assets/lighting/fog.mp4` |
| `low_fog_machine` | Low-Lying Fog (Dry Ice) | `assets/lighting/low-fog.mp4` |
| `bubble_machine` | Pro Bubble Machine | `assets/lighting/bubble-machine.mp4` |
| `spark_machine` | Cold Spark Machines (Pair) | `assets/lighting/spark-machine.mp4` |
| `led_video_small` | LED Video Wall (Small) | `assets/lighting/led-video-small.mp4` |
| `led_video_medium` | LED Video Wall (Medium) | `assets/lighting/led-video-medium.mp4` |
| `led_video_large` | LED Video Wall (Large) | `assets/lighting/led-video-large.mp4` |
| `indoor_led_screen` | Indoor LED Screen | `assets/lighting/indoor-led-screen.mp4` |
| `outdoor_led_screen` | Outdoor LED Screen | `assets/lighting/outdoor-led-screen.mp4` |
| `led_tv_stand` | LED TV Display Stand | `assets/lighting/led-tv-stand.mp4` |

## Opciones de solucion

### Opcion A — Videos reales (solucion definitiva)
El CEO sube los 15 archivos `.mp4` reales a `assets/lighting/`. No hay cambio en el codigo.

### Opcion B — Fallback provisional con Special_Effects (solucion inmediata)
Se edita `web/js/rentals.js` en los items del catalogo de Lighting para apuntar a videos ya existentes en `assets/Special_Effects/`:

| Item | Video fallback |
|---|---|
| Moving Head Lights | `./assets/Special_Effects/Moving_Head_Lights.mp4` |
| LED Panel / Video Wall / LED Screen | `./assets/Special_Effects/pantalla_LED.mp4` |
| Fog Machine | `./assets/Special_Effects/Smoke_Machine.mp4` |
| Low-Lying Fog | `./assets/Special_Effects/Dancin_Cloud.mp4` |
| Bubble Machine | `./assets/Special_Effects/Bubble_Haze.mp4` |
| Cold Spark Machines | `./assets/Special_Effects/SPARKULAR.mp4` |
| Laser Show | `./assets/Special_Effects/Stadium_Confetti_Blowers.mp4` |
| Uplighting Pack | `./assets/Special_Effects/Iluminación.mp4` |
| LED Dance Floor / TV Stand | `./assets/Special_Effects/Led_Dance_Floor.mp4` |

**Cambio de alcance:** solo lineas `video:` dentro del bloque `lighting` del catalogo dinamico en `rentals.js` (~lineas 1842-1856). Sin tocar CSS ni HTML.

## UNICO PENDIENTE — Video Banda en Vivo

| Campo | Detalle |
|---|---|
| Item | Live Bandas & Orquestas |
| Video | Recien creado — pendiente subida a Supabase Storage |
| Ruta actual en codigo | `./assets/live-music/Live_Bandas_&_Orquestas .mp4` |
| Accion requerida | Subir el nuevo .mp4 a Supabase en el proximo deploy a produccion |
| Quien ejecuta | CEO en el proximo `APROBADO DEPLOY PRODUCCION` |

**NOTA PARA DEPLOY:** al momento de hacer `APROBADO DEPLOY PRODUCCION`, verificar que el video de Banda en Vivo este subido al bucket de Supabase Storage con la ruta correcta antes de publicar.

## Criterio de aceptacion (solo Banda en Vivo)

- [ ] Video `Live_Bandas_&_Orquestas.mp4` subido a Supabase Storage
- [ ] Video reproducible en produccion en el modal Live Music
- [ ] Sin regresion en los demas 14 videos de Lighting ya operativos en prod

## Tickets relacionados

- TICKET-009 (cerrado) — cart wiring conectado
- SESSION-LOG-2026-06-15 — auditoria completa de videos
