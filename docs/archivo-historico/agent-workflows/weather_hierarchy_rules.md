---
description: Reglas de prioridad y jerarquía visual para el motor meteorológico MDJPRO
---

# MDJPRO Weather Scene Hierarchy Rules

**LOCKED ARCHITECTURE RULE:**
Para evitar escenas visuales equivocadas, la resolución de la propiedad `main` provista por OpenWeatherMap dentro de la función `mapWeatherToScene(data)` (en `web/js/event-weather.js`) debe obedecer estrictamente el siguiente orden de jerarquía y evaluación. No simplificar ni refactorizar sin aprobación expresa del usuario.

## Orden de Prioridad Visual
1. **Thunderstorm** (Tormenta Eléctrica / Relámpagos)
2. **Rain / Drizzle** (Lluvia Severa o Llovizna)
3. **Mist / Fog / Haze / Smoke** (Condiciones pesadas o niebla)
4. **Clear** (Cielo Despejado)
5. **Clouds** (Ligero o pesado, diferenciable únicamente mediando el código id o la description)
6. **Sunset** (Atardecer astronómico como override controlado)

## Regla de Oro del Sunset (Atardecer)
El estado **Sunset** NO es un `main` devuelto por defecto en la API, sino un "estado de override" generado internamente en MDJPRO mediante cálculo astrométrico (`sys.sunset`). 
**Solo debe ganar (sobreescribir la escena) bajo tres condiciones absolutas:**
- No hay tormenta eléctrica.
- No hay lluvia real.
- El clima base (`main`) es estrictamente `Clear` o `Clouds`.

*(Actualmente implementado en lógica booleana: `if (isSunset && (main === "Clear" || main === "Clouds")) return "sunset";`)*
