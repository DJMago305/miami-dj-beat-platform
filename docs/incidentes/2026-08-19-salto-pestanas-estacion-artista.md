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
