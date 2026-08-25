---
name: Weather Widget Cloud Architecture
description: Documentación oficial sobre la arquitectura CSS y estructura HTML del carrusel infinito de nubes en el Weather Widget, configurada y asegurada para prevenir errores en el futuro (ej: bordes planos, recortes, oclusión irreal).
---

# Weather Widget Cloud Architecture: "The Flawless Cloud Setup"

Este documento preserva la configuración definitiva del carrusel de nubes en `dj-dashboard.html`, alcanzada tras rigurosos testeos para lograr oclusión física, loop infinito limpio sin código JS, cobertura completa del lienzo y la preservación de las transparencias naturales originales del PNG sin alteraciones.

## Core Directives

1. **Jerarquía Z-Index Estricta (Oclusión Física)**
   - El Sol, Rayos y Luna **DEBEN** estar obligatoriamente alojados en la capa `.sky-astral-front` con un `z-index: 20`.
   - Las Nubes (Carrusel y estáticas) **DEBEN** estar alojadas en `.sky-clouds` con un `z-index: 30`.
   - **Por qué:** Esta disposición garantiza que cuando las nubes interactúan con el sol o la luna en los estados del clima, las nubes pasan *físicamente por encima* de los astros, ocultándolos naturalmente de acuerdo con la información alpha (opacidad) incrustada en el arte PNG. Evita que el sol parezca "pegado" como una pegatina en el cielo falso.

2. **Supresión Absoluta de Transparencias Modificadoras**
   - **Nunca** aplicar `opacity`, `mix-blend-mode`, o `filter: brightness()` en los contenedores o elementos de nubes `.sky-clouds` para escenarios "nublados". 
   - Deben renderizarse a `opacity: 1 !important` (incluyendo noche, tormenta y atardecer).
   - **Por qué:** Los recursos PNG "Bellas Nubes" contienen transparencias de borde meticulosamente diseñadas. Imponer una opacidad general por CSS empata estas transiciones, causando manchas planas irreales.

3. **Carrusel Seamless "Clone Train" (Regla de Oro CSS)**
   - El loop infinito horizontal sin Javascript depende de empujar visualmente una tira el doble de ancha exactamente un 50% a la izquierda.
   - **HTML Required Structure:**
     ```html
     <div class="cloud-layer-front nubes-largas-fast-container" id="cloud-carousel-layer">
         <!-- Sequence A -->
         <img src="Bellas Nubes Seamless.png">
         <img src="Nubes Blancas.png">
         <img src="Nubes Bonitas decorativas .png">
         <!-- Sequence B (Clon) -->
         <img src="Bellas Nubes Seamless.png">
         <img src="Nubes Blancas.png">
         <img src="Nubes Bonitas decorativas .png">
     </div>
     ```
   - No rompas el arrary introduciendo un PNG a destiempo ("Nubes Largas" o "Hero Clouds") pues desajustará el empate en el `-50%`.

4. **Escalamiento Vertical Agresivo (Eliminación de Corte Cuadrado)**
   - `height: 100%` es mandatorio en los elementos `img` dentro del carrusel paralelo a un `object-fit: cover !important`.
   - Adicionalmente, `top: -10%` y `height: 110%` en ciertos selectores son aplicables.
   - **Por qué:** Si se permite `height: auto` o se estira la ventana en monitores ultrawide (1920x1080 o mayores), el PNG colapsa y muestra un "borde inferior recto". Forzar la dimensión en 100% empuja el borde de corte rígido *fuera* del marco de visualización visible (`overflow: hidden` del parent), asegurando el realismo completo en todo viewport.

## Keyframe Animation Blueprint

Nunca alterar el `-50%` de esta clase a menos que la macroestructura HTML del loop cambie drásticamente.

```css
@keyframes carouselLoopFast {
    0% {
        transform: translate3d(0, 0, 0);
    }
    100% {
        transform: translate3d(-50%, 0, 0);
    }
}
```

## Conclusión

Siguiendo esta santísima trinidad (Z-index Físico 30/20, Opacidad Nativa 1, y Altura Extendida 100%), el clima interactúa orgánicamente bajo un modelo visual coherente. Las nubes dominan la vista, bloquean las luces secundarias y rebotan ininterrumpidamente sin fisuras.
