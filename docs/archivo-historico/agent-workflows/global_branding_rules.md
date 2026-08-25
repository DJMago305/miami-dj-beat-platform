---
description: Reglas de consistencia global para el header de la plataforma MDJPRO
---
# Regla Global de Branding (NO NEGOCIABLE)

Al modificar o crear nuevos headers/topbars en la plataforma MDJPRO, es obligatorio seguir este patrón visual estricto para el "brand lockup".

1. **Está PROHIBIDO** usar texto HTML para el nombre de la marca.
2. **Está PROHIBIDO** crear clases como `.brand-name` o `.brand-tagline`.
3. **Solo se permite** el uso de los siguientes assets de imagen:
   - `logo-transparent.png` (El icono/isotipo principal)
   - `logo-transparent Letras.png` (El texto de la marca premium renderizado en PNG)

### Patrón HTML Exacto Obligatorio:
El bloque de branding debe ser EXACTAMENTE el siguiente (sin inventar HTML nuevo ni añadir texto o `<p>`):

```html
<div class="brand">
  <img src="./assets/logo-transparent.png" class="logo-img">
  <div class="brand-letters-wrapper">
    <img src="./assets/logo-transparent Letras.png" class="brand-letters-img">
  </div>
</div>
```

*(Nota: La ruta `./assets/` o `./assets/branding/` puede variar según la profundidad del archivo, ajustar en consecuencia, pero la estructura DOM debe ser idéntica).*

### Instrucción Operativa:
- Si detectas que un archivo no cumple esta regla (ej. tiene logos en texto puro): **REEMPLÁZALO** por la estructura arriba mencionada, no intentes adaptarlo o retocarle el CSS.
- Modificar el HTML del logo **no debe** alterar para nada el CSS global (`styles.css` o `profile.css`), el padding del navbar, ni la estructura base.
- Si hay dudas o el header es distinto (ej. usa `<a class="brand">`), respeta el wrapper `<a>` pero inyecta el interior tal cual.
- *Confirmar siempre* con el usuario visualizando un diff antes de hacer reemplazos masivos.
