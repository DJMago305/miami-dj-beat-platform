# Acta del Motor de Voz ELIXIS/DJMago — Anti-eco, catálogo y entrega — 2026-09-02

| | |
|---|---|
| **Ámbito** | Dominio #2 · `elixis-realtime-session/index.ts` + `web/js/elixis-voice-session.js` |
| **Ejecutor** | Hilo Especialista — Elixis Voice Agent Blueprint |
| **Aprobación** | PO — explícita: despliegues, commits y PR aprobados uno a uno, probando **hablando** |
| **Resultado** | 12 arreglos + 5 regresiones propias corregidas. PRs #294 y #295 fusionados; #296 abierto |
| **Método** | Cada cambio nace de un síntoma que el PO reportó en voz y de logs reales de su consola. Ninguno de teoría. |

## 1 · Origen

El PO reportó que DJMago **se contestaba a sí mismo**: arrancaba a contar historias
sin que nadie hablara, se cortaba solo a media frase, y en una ocasión abrió
conversación nueva pocos segundos después de despedirse. En paralelo, no podía
interrumpirlo por voz, y el agente recomendaba **artistas** en vez de temas
diciendo que "no estaba conectado a una base de datos real".

Condición física que manda sobre todo lo demás: **bocinas abiertas, micrófono
abierto y cancelación de eco del navegador APAGADA a propósito** — encenderla
reconfigura CoreAudio y corta a Serato DJ en vivo.

## 2 · Arreglos, con el síntoma que los originó

| # | Síntoma reportado | Causa real | PR |
|---|---|---|---|
| 1 | "arranca a contar una historia solo" | el mic se reabría por un cálculo (35 ms/carácter) en vez de esperar `output_audio_buffer.stopped` | #294 |
| 2 | "se quedó callado en la segunda pregunta" | una línea vieja muteaba con `.enabled=false` saltándose el transporte nuevo; un candado de agosto (`e5e973a`) leía ese estado como "mic deshabilitado" y descartaba sus preguntas reales | #294 |
| 3 | "intenté interrumpirlo y no me escuchó" | half-duplex: sin AEC no se pueden tener las dos cosas. Barge-in por nivel + barra espaciadora como red | #294 |
| 4 | una notificación de macOS cortó la conversación | el nivel solo no distingue un "ding" de una voz → se añaden duración y timbre | #294 |
| 5 | "volvió a saludar tras despedirse" | Whisper **inventa** ante silencio ("Gracias.", puntos suspensivos) y eso disparaba turno | #294 |
| 6 | "me da artistas, no canciones" | `mdj-music` + `consultar_musica` existían… solo en el cerebro de TEXTO | #294 |
| 7 | "déjame un PDF con la lista" | no había herramienta de entrega → `entregar_pdf` con jsPDF en el navegador | #294 |
| 8 | "me llama Yerardo" | sí puede corregirse en vivo, pero no recuerda entre llamadas → vive en el prompt | #294 |
| 9 | respondía en inglés | `transcription` sin `language`: Whisper adivinaba en cada turno | #294 |
| 10 | *(invisible para el usuario)* reservas de voz sin liberar | `ADMIN.rpc(...).catch()` — el builder de supabase-js es *thenable* pero **no** es Promise. **25 sesiones colgadas, 22 500 s (6 h 15 min) retenidos** contra el tope del PO | #294 |
| 11 | banner `Conversation already has an active response` | dos disparadores de turno solapados → una sola puerta, `pedirRespuesta()` | #295 |
| 12 | `ENTREGAR_PDF` duplicado en el panel | doble `emit('onTool')` | #295 |

## 3 · REGRESIONES PROPIAS — anotadas como prueba de trabajo

Cinco fallos introducidos por este hilo durante la sesión, detectados y corregidos
dentro de la misma noche. Se dejan escritos porque el PO lo pidió expresamente:
un acta que solo cuenta los aciertos no sirve para auditar a nadie.

| # | Qué rompí | Cómo se detectó | Corregido en |
|---|---|---|---|
| R1 | La red de seguridad heredó el cálculo viejo (35 ms/carácter, techo 4 s) y saltaba a los **4 400 ms** — metí por la puerta de atrás la misma adivinanza que venía a eliminar | captura del PO: el aviso de red de seguridad y, dos líneas después, el `output_audio_buffer.stopped` real llegando | #294 |
| R2 | Monté el transporte por `replaceTrack` pero **dejé una línea vieja muteando a mano**; eso dejó sordo a mi propio detector y activó un candado ajeno que descartaba las preguntas del PO | el PO: "se quedó callado en la segunda pregunta" | #294 |
| R3 | Escribí la pronunciación como **"Je-RAR-do"**: un modelo que lee eso con fonética inglesa dice "Ye" — la instrucción **causaba** el error que venía a corregir | el PO: "estás pronunciando mal tú también" | #295 |
| R4 | Al corregir R3 di la referencia **opuesta** ("la G de gente/girar", que es la G suave) y listé la pronunciación real del PO entre las formas **mal** dichas | el PO: "corrige, G de gato" | #295 |
| R5 | Puse el piso del barge-in en **0.16**, por encima de la única medida real de su voz (**0.110**) — la función quedaba muerta por construcción | el PO no conseguía cortarlo hablando | #296 |
| R6 | `entregarPdf()` emitía `onTool` por su cuenta además del genérico → herramienta duplicada en el panel | captura del PO | #295 |

**Patrón común de R3, R4 y R5:** los tres salen de **describir o estimar en vez de
medir o preguntar**. La lección operativa quedó escrita en el commit `4d01a43`:
para un sonido, la referencia debe ser una palabra que el PO reconozca ("gato"),
no una etiqueta lingüística; y para un umbral, una medición suya, no mi criterio.

## 4 · Hechos técnicos que costaron horas (no volver a descubrirlos)

- **`output_audio_buffer.stopped`** es el único evento fiable de fin de reproducción.
  `response.done` significa que terminó de **generarse**, no de **sonar**: el audio
  viaja por la pista WebRTC, un camino distinto del canal de datos.
- **Safari NO mide el stream remoto de WebRTC.** `createMediaStreamSource` sobre
  audio entrante devuelve silencio. Medido en vivo: `mic 0.110 vs bocina 0.000`.
  Cualquier comparación relativa mic-vs-bocina es inerte ahí.
- **Cortar el ENVÍO con `replaceTrack(null)`, nunca `.enabled=false`**: mutear la
  pista deja sordo también al analizador local, y sin oír el micrófono no hay
  barge-in posible.
- **No volver a llamar `getUserMedia`**: es lo que reconfigura CoreAudio y corta
  a Serato en vivo.
- **Whisper no devuelve vacío ante silencio: inventa.** Hay que filtrar por
  longitud y por muletilla antes de disparar cualquier turno.

## 5 · Higiene

- PRs creados desde `origin/main` limpio con *cherry-pick*, **no** desde
  `fix/mobile-ui-cleanup` — un PR de esa rama habría arrastrado 13 commits y 41
  ficheros de otras sesiones. Alcance final por PR: 3–4 ficheros.
- De `web/staff.html` se toca **una sola línea**: el `?v=` del script.
- Retirados el worktree y la rama `feat/elixis-cazador-silencioso` — trabajo
  duplicado del arranque de la sesión, superado por `fe9a248` y nunca fusionado.
- Falsa alarma registrada: se reportó un "guardia fantasma" como código aparecido
  durante la sesión. **Era falso** — `git log -S` lo sitúa en `e5e973a` (31-ago),
  anterior a esta sesión. Corregido ante el PO y ante los hilos avisados.

## 6 · Pendiente

El umbral del barge-in está en un **punto de partida informado por una sola
medición**, no en una calibración. Se mueve en vivo, sin redesplegar:

```
localStorage.setItem('elixis_bargein_debug','1')      // imprime el pico real de su voz
localStorage.setItem('elixis_bargein_piso_solo','0.12')
localStorage.setItem('elixis_guarda_ms','600')
localStorage.setItem('elixis_bargein','off')
```

## 7 · Reporte cruzado del hilo con jerarquía (`miami-dj-beat-platform-7c`)

Solicitado expresamente por el PO antes de cerrar el acta. Respuesta recibida
2026-09-02, transcrita con su matiz completo:

- **Sin cruce de ficheros.** No tocó `elixis-realtime-session/index.ts` ni
  `web/js/elixis-voice-session.js` en ningún momento de su sesión; lo confirmó
  revisando sus propios diffs y commits.
- **Sobre regresiones, su respuesta literal y honesta:** *"no hice una auditoría
  dedicada de tus commits buscando regresiones; solo puedo decirte que en todo lo
  que yo mismo revisé/probé esta noche (avatar, video, nav)"* no encontró nada.
  **Se anota como lo que es: ausencia de hallazgo, no verificación independiente.**
  Bajo la regla 7 de `CLAUDE.md`, la supervisión del Hilo Maestro es un paso
  distinto de la confirmación del PO — aquí no se ha ejecutado ese paso sobre
  este trabajo, y queda constancia.
- **Punto de contacto real, reportado por él mismo:** su commit `1c7172e`
  (avatar/vídeo) **incluye el `?v=` de `elixis-voice-session.js` dentro de
  `web/staff.html`** — de `20260831-candado-eco-duro` a `20260902-turno-unico`.
  Esa línea era mía y estaba sin comitear en el árbol de trabajo compartido
  cuando él comiteó su parte; entró porque los dos escribimos el mismo fichero,
  no porque él la escribiera. **Autoría: este hilo. Vehículo: su commit.**
  Queda anotado así para que una auditoría futura no atribuya mal el cambio.
  Es también la demostración práctica de por qué los PRs de esta línea salieron
  de `origin/main` limpio y no de la rama compartida.

**Cómo llegó este reporte, porque forma parte de la prueba de trabajo:** hicieron
falta **tres intentos**. Los dos primeros llegaron cortados por el glitch de
canal descrito abajo, y el segundo no alcanzó siquiera el punto 3 — justo el
único que contenía un hallazgo real. Sin insistir, el punto de contacto del
`?v=` se habría perdido.

**Incidencia de canal, registrada aparte:** los mensajes de esa sesión llegaron
dos veces con una racha larga de la palabra `until` repetida en mitad de la
frase, cortando el contenido. La sesión lo detectó por su cuenta y pidió
confirmación. No afecta a este trabajo, pero queda anotado por si vuelve a
aparecer en otro hilo.
