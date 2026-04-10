---
description: [Reglas Inquebrantables del Motor de Catálogo / Rentals UI]
---
# 🛡️ RENTALS UI / CATALOG — INQUEBRANTABLE RULES

**Aplicar estas reglas inmediatamente como protocolo estricto permanente del módulo Rentals UI / Catalog. Cualquier cambio futuro debe obedecerlas sin reinterpretación.**

### 1. VISUAL LOCK
- Toda decisión visual aprobada en pantalla por el CEO queda bloqueada.
- Ningún agente puede reinterpretar estética, contraste, opacidad, bordes, glow, tamaño o layout sin autorización explícita.
- Si algo ya fue validado visualmente, se considera LOCKED.

### 2. PRODUCT CARD SIZE LOCK
- No cambiar tamaño, proporción, altura, ancho, padding, borde, radio, tipografía ni estructura de `.product-card`.
- No escalar tarjetas para “hacer caber más”.
- No rediseñar botones ni bloque inferior de precio / cantidad / add.

### 3. OPACITY RULE
- No aplicar opacidad global a imágenes, videos, fondos ni assets fuera del scope indicado.
- La opacidad de las fotos dentro de las tarjetas debe mantenerse exactamente como la aprobó el CEO.
- No introducir nuevos estados idle/hover para opacidad si no fueron pedidos explícitamente.
- Fondos / hero / exteriores no pueden contaminarse con reglas destinadas a tarjetas.

### 4. CATEGORY ISOLATION RULE
- Nunca mezclar datasets entre categorías.
- Cada pestaña renderiza únicamente sus propios items.
- No construir carruseles globales mezclados.
- Tents solo muestra Tents, Furniture solo Furniture, Audio solo Audio, etc.

### 5. REUSABLE ENGINE RULE
- Se permite reutilizar el mismo motor/carrusel, pero cada instancia debe ser independiente por pestaña.
- Solo una pestaña activa anima a la vez.
- Las demás quedan detenidas/inactivas.
- No rehacer arquitectura si el motor actual ya resuelve el caso.

### 6. DATA SOURCE RULE
- La fuente única de verdad es el dataset/catálogo aprobado (`window.rentalCatalogs`).
- Nuevos assets, fotos, videos, nombres y precios solo se agregan por dataset.
- No hardcodear nuevos elementos en HTML/CSS/JS fuera del catálogo.
- No explorar `.agents`, workflows u otra infraestructura interna para cargar contenido visual.

### 7. RENDER LIMIT RULE
- No usar slice, top-N, límites fijos ni filtros artificiales que recorten productos.
- El sistema debe renderizar todos los items disponibles en la categoría activa.
- La lógica debe quedar escalable para futuros assets sin reescritura manual.

### 8. BACKGROUND VIDEO RULE
- El hero/background de cada pestaña debe autoload al entrar, sin depender de hover.
- Si no existe hero master, usar automáticamente el primer video válido de la categoría.
- No permitir pantalla negra por race conditions, timeouts locales o rutas nulas.

### 9. CHANGE SCOPE RULE
- No tocar módulos fuera del scope actual.
- Si la tarea es Rentals UI, no tocar navegación global, branding global, workflows internos, otros HTML o infraestructura no relacionada.
- No introducir librerías nuevas sin autorización explícita.

### 10. APPROVAL RULE
- Cambios visuales: siempre requieren validación en pantalla antes de aceptarse.
- Cambios técnicos no visuales pequeños pueden proponerse, pero no se aceptan por fe.
- Ningún cambio se considera final hasta que el CEO lo vea funcionando.

### 11. ROLLBACK PRIORITY
- Si una optimización rompe identidad visual, manda la identidad visual.
- Si una mejora técnica altera la estética aprobada, se revierte.
- Si hay conflicto entre “más inteligente” y “más fiel al diseño aprobado”, gana el diseño aprobado.

### 12. CEO OVERRIDE
- El CEO tiene prioridad absoluta sobre cualquier criterio automático de UX, performance, refactor o “best practice”.
- Ningún agente puede sobreescribir una decisión estética o estructural ya aprobada por el CEO.
