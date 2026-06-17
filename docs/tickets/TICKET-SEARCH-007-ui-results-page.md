# TICKET-SEARCH-007 — Buscador (Search): UI de resultados fea e incompleta

**Fecha de apertura:** 2026-06-16  
**Reportado por:** DJMago305 (CEO) — observado en móvil cuenta DJYuyo  
**Tipo:** UX / UI — mejora visual y funcional  
**Estado:** ABIERTO — ticket independiente, no urgente  
**Prioridad:** 🟡 MEDIA — funciona pero necesita pulido  

---

## DESCRIPCIÓN

El buscador (ícono de lupa) funciona mecánicamente pero la experiencia visual es pobre:

1. Al buscar "dj" aparece la opción "ir a todos los DJs"
2. Al hacer clic abre una **página fea** (sin diseño alineado a la marca)
3. Los resultados de DJs aparecen en la parte de abajo **muy pequeños**

**Comportamiento esperado:** página de resultados con diseño de marca, tarjetas de DJs bien dimensionadas y legibles desde móvil.

---

## BUG ADICIONAL — Filtro de resultados incorrecto

Al buscar "dj" aparece **Jean Poul** que es **bartender**, no DJ. El filtro no está filtrando por `artist_specialty` o `role` correctamente — mezcla artistas de diferentes categorías en los resultados.

**Causa probable:** la búsqueda hace un query por nombre/texto sin filtrar por especialidad del artista.

**Fix necesario:** asegurar que al buscar "dj" solo aparezcan perfiles con `artist_specialty = 'dj'` o `role` de DJ.

---

## ALCANCE DEL TRABAJO (cuando se autorice)

- Rediseñar la página/vista de resultados del buscador
- Tarjetas de artistas con tamaño adecuado para móvil
- Alinear con la identidad visual de Miami DJ Beat
- Mejorar la relevancia / orden de resultados si aplica

**Este es un ticket de UX/UI independiente — no bloquea ningún flujo crítico.**

**Para autorizar:** `Autorizo TICKET-SEARCH-007`

---
ESTADO: DOCUMENTADO — BAJA PRIORIDAD RELATIVA — TRABAJAR EN SESIÓN DEDICADA
