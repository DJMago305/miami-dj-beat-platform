# weather-experience — HERO atmosférico 3D (insertado, localhost)

Página nueva **autónoma** insertada en la app. Motor WebGL modular (ES modules) que
consume el contrato `AtmosphericState` del Edge Function `atmosphere` (astronomía real
determinista + clima real por proveedor server-side). **Cero keys en el frontend.**

Ruta: `/weather-experience/index.html`

## Estado de esta inserción
- **Aditiva y reversible:** carpeta nueva, sin tocar ningún archivo existente. Sin commit, sin deploy.
- `PREVIEW = false` en `js/hero.js` → comportamiento de producción (sin controles de debug;
  el botón **🛰️ En vivo** permanece). Para revisar estado por estado, ponlo en `true`.
- Astronomía = **mismos módulos** que el backend (`js/astro.js`, `js/celestial.js` son copias
  byte-idénticas de `supabase/functions/atmosphere/*.mjs`). Fuente única de verdad.

## Probar en localhost
```
# 1) endpoint (opcional, para "En vivo"): ver scratchpad/weather-backend/README-LOCAL.md
# 2) servir la app:
cd web && python3 -m http.server 8080
# abrir http://127.0.0.1:8080/weather-experience/index.html
```
Conectar clima real (opcional): en consola, antes de "En vivo":
```js
window.MDJB_ATMO_ENDPOINT = 'http://127.0.0.1:8300/atmosphere';   // o la URL del Edge Function desplegado
```

## Relación con el build de clima anterior (REPORTE — decisión del Capitán)
El clima actual de la app vive como **widget** dentro de `weather-lab.html` (la "Agenda y
Control"), cargando `weather-api.js?v=…openweather-key-window` — que **expone la key de
OpenWeather en el frontend** (la "deuda actual" de Candidate C). Clasificación Candidate C:

| Pieza vieja | Clasif. | Nota |
|---|---|---|
| `weather-api.js` (key en `window`) | **REPLACE** | La sustituye el Edge Function `atmosphere` (key en `Deno.env`). |
| `weather-astral.js` | **REVISAR** | Ver si su astronomía la cubre ya `celestial.js`/`astro.js` (probables REPLACE). |
| `weather-effects.css` | **REVISAR** | Efectos CSS del widget viejo; el HERO nuevo los hace en shader. |
| widget en `weather-lab.html` | **DECISIÓN** | Embeber/enlazar el HERO nuevo o mantener ambos. |

**Nada de lo viejo se ha removido ni modificado.** La sustitución del widget y el cableado en
la navegación requieren tu visto bueno (y, por gobernanza, un reporte técnico+visual antes de
remover cualquier pieza viva). Opciones de integración cuando lo autorices:
1. **Enlace/entrada nueva** a `/weather-experience/` (aditivo, no toca el widget viejo).
2. **Embeber el HERO** como fondo del panel de clima en `weather-lab.html` (REPLACE del widget).
3. **Página de reemplazo** completa del laboratorio de clima.

Pendiente al integrar: header/nav de la app + `role-guard.js` (auth) si la página no debe ser
pública; conectar el bloque **Evento/Logística** a datos reales del gig (gobernanza financiera).
