# Incidente · Salto y acordeón en la estación de trabajo del artista

| | |
|---|---|
| **Fecha** | 2026-08-19 |
| **Ámbito** | Cuentas de artista · modo MI PERFIL (estación de trabajo) |
| **Gravedad** | Máxima — inestabilidad visual del menú |
| **Ley aplicable** | `.cursorrules` · **Ley de Estabilidad Visual (Anti-Brinco)**: «El menú de navegación es un bloque de piedra. PROHIBIDO cualquier Layout Shift» |
| **Estado** | Resuelto y medido. Pendiente de los dos anillos de aprobación |

---

## 1 · Síntoma reportado

En palabras del PO: al cambiar de pestaña se siente un **«disparo hacia abajo»** —un salto— y además una **sensación de acordeón**: el contenido se encoge y se estira antes de acomodarse. No era una pestaña concreta, sino la experiencia general de moverse entre ellas.

## 2 · Metodología

No se corrigió nada antes de medir. Se instrumentó la página en el navegador y se muestreó:

- alto del documento (`documentElement.scrollHeight`)
- posición de desplazamiento (`scrollY`)
- alto del panel visible
- alto de la cabecera y estado de `.header-top`

Muestreo cada 15–40 ms durante 1.5 s tras cada acción, registrando **solo los instantes en que algo cambia**, para distinguir un reflujo único de un crecimiento escalonado por contenido tardío.

## 3 · Hallazgos: eran DOS defectos distintos

### 3.1 · Acordeón de arranque (al entrar a cualquier vista de la estación)

**Mecanismo.** `mdj-shared-header.js` se carga con `defer` y está declarado en la **línea 14301**, al final del documento. Cuando decide que la vista es una estación de trabajo, **la página ya se pintó** con la cabecera de dos filas. Al retirar `.header-top`:

| | antes de decidir | después |
|---|---|---|
| alto de cabecera | **157 px** | **84 px** |

Los 73 px de diferencia arrastran toda la página hacia arriba, y en el mismo instante se aplican los desplazamientos de agenda (84 px) y configuración (104 px), que dependen de la misma clase.

**Descartado por medición:** no era contenido cargando tarde ni transición CSS.

### 3.2 · Salto al cambiar de pestaña

**Mecanismo.** `switchProfileTab` **no desplaza a propósito** — se revisó su código: solo alterna la clase `.active`. El salto lo provoca **el navegador**.

Medición con la vista desplazada a `y = 300`, conmutando al panel corto:

| | antes | en el instante del cambio |
|---|---|---|
| alto del documento | 1561 px | **1000 px** (−561) |
| `scrollY` | 300 | **0** |

El panel entrante es más corto, el documento encoge, y **el scroll máximo pasa a ser 0**: el navegador *clampa* la posición y arrastra la vista. Ese tirón involuntario es el «disparo».

Se comprobó que ocurre en **un único paso instantáneo** (ms = 0, sin escalones) en ambos sentidos — confirmando que no hay reflujo por contenido tardío.

## 4 · Correcciones

### 4.1 · Geometría decidida antes del primer pintado

Semilla en el `<head>` de las cinco vistas de la estación que recuerda la última decisión conocida y la aplica **antes de que el navegador dibuje**. La hoja declara para `html.mdj-estacion-previa` la misma geometría que para `body.mdj-perfil-estacion`, al milímetro, para que no exista un segundo reacomodo cuando el guion confirma.

Dos trampas propias, encontradas al verificar y corregidas:

1. La limpieza de la semilla corría en las primeras pasadas, con la sesión sin resolver, y borraba la marca en cada carga: **el arreglo se anulaba solo**.
2. El **rol** llega después del `uid`. Exigiendo solo `uid` quedaba una ventana con `data-mdj-nav-role` vacío en la que la limpieza volvía a llevársela por delante.

Ahora se exige sesión **y** rol resueltos.

### 4.2 · Anclaje previo al conmutar

Antes de cambiar de panel, si la vista está desplazada se coloca en el ancla **de forma instantánea, nunca suave**. Una animación de scroll corriendo a la vez que el panel cambia de alto es precisamente la carrera que produce el acordeón.

El movimiento pasa a ser **deliberado y previo**; en el instante del cambio no queda desplazamiento pendiente.

## 5 · Verificación · antes y después

### Arranque

Geometría correcta ya en la **primera muestra**, sin variación durante 2.6 s:

| vista | antes | después |
|---|---|---|
| `dj-profile` | cabecera 157 → 84 | **84 desde el instante 0** |
| `dj-dashboard` | tarjeta reubicada tras pintar | **y = 184, margen 84 desde el inicio** |
| `account-settings` | relleno aplicado tras pintar | **104 px y lateral en 188 desde el inicio** |

### Cambio de pestaña · desplazamiento involuntario

| desde `scrollY` | destino | antes | después |
|---|---|---|---|
| 300 | SoundForTips | **300 px de tirón** | **0** |
| 0 | público | — | **0** |
| 485 | SoundForTips | (clampeo a 0) | **0** |
| 200 | público | — | **0** |

**Desplazamiento involuntario máximo: 0 px** (antes: 300).

## 6 · Lo que NO se hizo, y por qué

- **No se cambió el tamaño de ningún contenedor.** Un intento previo de reservar altura con `min-height` alteró los contenedores de **Opiniones** y **Bio** en escritorio, portátil y tableta. El PO señaló que **eso no se pidió en ninguna orden**: se revirtió por completo (−13 líneas) y se verificó que los paneles vuelven a `min-height: 0`.
- **No se igualaron los paneles al más alto.** La diferencia de altura entre pestañas es contenido real; forzarlos dejaría huecos vacíos en los cortos.

## 7 · Riesgo residual

El alto del documento sigue cambiando al conmutar, porque el contenido de cada pestaña es de largo distinto. Lo que se elimina es el **movimiento involuntario de la vista**, que es lo que se percibe como salto. Si se quisiera además un alto de página constante, exigiría igualar los paneles — con el coste visual descrito en el punto 6, y requeriría orden expresa.

---

## 8 · Addendum · Tamaño oficial de Opiniones y Bio, y modelo único de contenedor

**Orden del PO.** Los contenedores de **Opiniones** y **Bio** no pueden cambiar de forma según lo largo o corto que alguien escriba; solo deben cambiar cuando cambia la resolución. Debe existir un límite de caracteres. Además, la tarjeta de reseña tenía un borde interior agresivo: se retira y se adopta **el modelo de la Bio**, para que no convivan dos diseños de caja distintos.

### Medición previa

| caracteres | alto del contenedor de Opiniones |
|---|---|
| 40 | 164 px |
| 174 | 223 px |
| 300 | 252 px |
| 900 | 458 px |

**294 px de variación** provocada solo por el texto.

### Solución

El tamaño oficial **no se inventó**: es el que ya tenía el diseño.

- **reseña** — 118 px = 4 líneas de 29.45 → se fija en **4 líneas**
- **bio** — 257 px = 9 líneas de 28.5 → se fija en **9 líneas**

Se declara en **líneas, no en píxeles**, de modo que la caja acompaña a la tipografía de cada punto de ruptura: cambia con la resolución y nunca con el contenido. Se añade respaldo para motores sin la unidad `lh`.

Un matiz que apareció al verificar: el recorte por líneas pone **techo pero no suelo**. Con solo recortar, un comentario de 40 caracteres seguía encogiendo la caja a 164 px — **88 px de variación residual**. Hizo falta fijar también la altura.

La Bio usa **desplazamiento interno** en lugar de recorte: una biografía larga se sigue leyendo entera sin deformar la tarjeta.

### Límite de caracteres

El campo de reseña tenía `maxlength="500"`, que da 341 px frente a los 252 de 300 caracteres: el límite existía y aun así permitía crecer. Se ajusta a **300**, que es exactamente lo que cabe en las 4 líneas oficiales.

### Modelo único de contenedor

| | Bio | Reseña (antes) | Reseña (ahora) |
|---|---|---|---|
| borde | `rgba(255,255,255,.08)` | `rgba(197,160,89,.28)` | `rgba(255,255,255,.08)` |
| fondo | `rgba(255,255,255,.03)` | `rgba(0,0,0,.42)` | `rgba(255,255,255,.03)` |
| radio | 16 px | 14 px | 16 px |
| relleno | 28 px | 26/28/22 | 28 px |

### Verificación

| | antes | tras el recorte | final |
|---|---|---|---|
| variación de Opiniones | 294 px | 88 px | **0 px** |
| variación de Bio | — | — | **0 px** (375 px con 200, 600, 1092 y 3000 caracteres) |
| modelos de caja coincidentes | no | no | **sí** |

Opiniones queda en 260 px constantes con 40, 120, 174, 300, 500 y 900 caracteres.

---

## 9 · Addendum · Temblor lateral del menú (auditoría del primer pintado)

**Precisión del PO.** El escalón Inicio↔MI PERFIL es lógico y no se discute. Lo intolerable son los **brincos laterales, jalones y temblores de milisegundos al cambiar de pestaña**, y el **encogimiento y estirado al restaurar**.

### Por qué la auditoría anterior no lo vio

Midió el estado **asentado**. Ahí todo salía idéntico —las cinco vistas de la estación en `x=257`, las dos públicas en `x=305`, cero movimiento tardío— y el defecto vive **antes de asentarse**.

### Causa raíz

Se auditó el marcado **estático** de cada página, que es lo que el navegador pinta antes de que el guion normalice:

| página | puestos estáticos | rótulos |
|---|---|---|
| `dj-profile` · `dj-dashboard` · `account-settings` | **12** | SCHEDULE, Cash Flow, MI PORTAL, **STAFF** |
| `academia` | **10** | **en inglés**: Home, Services, Jobs, MY PORTAL, STAFF |
| `dj-tools` | **8** | — |
| `index` · `jobs` | **8** | MI PORTAL |
| **estado final, todas** | **9** | — |

La barra nacía con **8, 10 o 12** rótulos —algunos en otro idioma, y con **STAFF dentro del DOM de un artista**— y el guion la reescribía a 9. Como el riel va **centrado**, cualquier cambio de ancho desplaza **todos** los rótulos a la vez: ese es el jalón lateral, y al restaurar, el encogimiento y estirado.

Es exactamente lo que el propio archivo ya advertía: *«#mainNav se declara a mano en 44 páginas y había derivado a 5 variantes»*.

### Solución

No se reescribe el marcado de siete páginas —cirugía mayor, riesgo alto—: **se impide que el estado intermedio llegue a verse**.

- Se ocultan los **hijos** del riel, nunca la caja: la cabecera conserva alto y fondo, y no se mueve nada.
- El guion revela la barra **solo cuando la sesión ya resolvió**, porque la tabla depende de ella. Revelar antes mostraría la pública y acto seguido la de estación — el mismo jalón por otra puerta.
- **Vigilante en CSS puro:** a los 700 ms la barra aparece sí o sí, aunque el guion falle o no llegue a ejecutarse. **Nunca puede quedarse invisible.**

### Verificación

| comprobación | resultado |
|---|---|
| con `mdj-nav-lista` | `visibility: visible`, animación `none` — revelado instantáneo |
| sin la clase | vigilante armado: `mdj-revelar-riel 0.7s` |
| caja del riel | alto 72, `y=0` — **no se mueve** |
| estado asentado | 9 puestos, rótulos correctos, sin STAFF |

### Límite honesto de esta verificación

Las herramientas de medición corren **después** del evento `load`: puedo demostrar que el estado intermedio **no puede pintarse** (los hijos nacen ocultos y solo se revelan ya asentados), y que el vigilante impide el peor caso, pero **no puedo filmar los primeros 100 ms** para mostrarlo. La confirmación final es la auditoría física del PO.
