# TICKET-INDEX-SYNTAX-001 — SyntaxError: Parser error en index.html

**Fecha de apertura:** 2026-06-16  
**Abierto por:** Agente (observado en sesión)  
**Estado:** ABIERTO — pendiente de ticket explícito del Capitán  
**Prioridad:** BAJA — no bloquea funcionalidad visible  
**Archivo afectado:** `web/index.html` (LOCKED)

---

## Síntoma

En la consola del navegador (Safari/WebKit) aparece:

```
SyntaxError: Parser error    index.html:1864
[Header] build 20280603-buyer-nav-html-only    mdj-shared-header.js:13
```

La página carga y funciona visualmente. El error aparece en las herramientas de desarrollo.

## Contexto de línea 1864

```javascript
// Líneas 1849–1865 de web/index.html
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (video) {
            if (entry.isIntersecting) {
                if (!document.hidden) {
                    video.play().catch(e => console.log("Autoplay blocked:", e));
                }
            } else {
                video.pause();
            }
        }
    });
}, { threshold: 0.1 });
if (heroSection) observer.observe(heroSection);
}   // ← línea 1864 — cierre de función externa
```

## Hipótesis

Safari reporta `SyntaxError: Parser error` en la línea donde termina el bloque, no necesariamente donde está el error real. El problema puede ser:

1. **Arrow function `=>` en contexto strict** — el bloque `(entries) => { entries.forEach(entry => {` usa arrow functions anidadas que algunos parsers de Safari reportan con offset.
2. **Bloque externo mal cerrado** — hay una función o bloque que envuelve este código y cuyo cierre en línea 1864 deja un `}` huérfano.
3. **`const` en scope incorrecto** — `const observer` declarado dentro de un bloque que no es función puede causar problemas en ciertos modos de parseo.

## Estado conocido

- Error **pre-existente** — no introducido por ningún cambio de la sesión 2026-06-16.
- `index.html` es archivo **LOCKED** — requiere alcance explícito del Capitán para modificar.
- El video hero de `index.html` y el resto de la página funcionan normalmente en producción.

## Alcance propuesto (pendiente de aprobación)

- Acceso de **solo lectura** al bloque `<script>` que contiene líneas 1800–1865 de `web/index.html`
- Diagnóstico del error sin modificar ninguna otra parte del archivo
- Fix mínimo limitado a ese bloque si se confirma la causa

## Aprobación requerida

El Capitán debe decir explícitamente: **"Autorizo investigar y corregir el SyntaxError en index.html, bloque IntersectionObserver video hero"**

---
ESTADO: DOCUMENTADO — ESPERANDO TICKET DEL CAPITÁN.
