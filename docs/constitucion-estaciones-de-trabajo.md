# Constitución de las Estaciones de Trabajo y Barras de Menú

**Artículo firmado y notariado por:** Gerardo A. Valle Rodríguez — Capitán y Owner del equipo de trabajo, tanto humano como agéntico.
**Fecha de asiento:** 2026-08-19.
**Estado:** LEY INVIOLABLE. No negociable bajo ninguna orden de trabajo, ticket, o decisión de ningún agente.

---

## El artículo, en las palabras del Capitán

> Esto debe estar tatuado en la Constitución y estéticamente sellado como regla inviolable desde el inicio cero: entras a Mi Perfil → login → estación de trabajo. En ambos casos (staff y artista), cada login lleva a su propia estación de trabajo. Esta es la razón por la que separamos las cuentas de staff de las cuentas de artista: para evitar filtraciones entre estaciones de trabajo. Esta regla no es negociable bajo ninguna orden de trabajo — ninguna orden debe entrar a hacer cambios como el incidente que sucedió. Ningún agente, ni una orden fuera de alcance, ni una confusión en la ordenanza, pueden cambiar esta decisión. Si por error se da una orden que contradiga este bloqueo, es un accidente de ordenanza y debe comprobarse explícitamente antes de poder tocar este sistema. Ninguna IA o agente debe tomar decisiones por sí misma para romper la constitución de las barras de menú y las estaciones de trabajo. Ningún trabajo en otra parte del sitio debe afectar la estructura de las barras de menú — y si por necesidad operativa esto debe suceder, se debe exponer punto por punto y pasar controles de permiso verificables y explícitamente explicados antes de cualquier movimiento.

---

## La regla, en términos operativos

1. **MI PERFIL es la tubería, no el destino.** Al entrar (login) a MI PERFIL, tanto staff/owner como artista aterrizan en **su propia estación de trabajo** — nunca en la barra pública de marketing (`#mainNav`: Inicio/Servicios/Eventos/Shop/Trabajos/Contacto).
2. **Cada rol tiene SU estación, aislada de la otra.** Staff tiene la suya (Agenda, Cash Flow, DJ Tools, Config, Academia — ya construida). Artista tiene la suya propia, separada, con sus propias herramientas (SoundForTips entre ellas). Ninguna se filtra a la otra — esa es la razón arquitectónica original de separar cuentas staff de cuentas artista.
3. **La única salida de una estación de trabajo es Log Out o la pestaña Inicio.** Ningún otro puesto de la barra pública debe aparecer dentro de una estación de trabajo.
4. **Ningún agente decide esto por su cuenta.** ChatGPT, Claude, MRM, Elixis, Cajero Central, Water Design, BFI, o cualquier agente futuro — ninguno tiene autoridad para alterar esta estructura sin autorización explícita, verificable y punto por punto del Capitán.
5. **Blast radius cero por defecto.** Ningún trabajo en cualquier otra parte del sitio (nav, auth, hero, lo que sea) puede tocar la estructura de las barras de menú como efecto secundario. Si operacionalmente hace falta, se expone explícitamente antes de tocar nada — nunca como consecuencia no declarada de otro ticket.
6. **Una violación accidental de esta regla se trata como "accidente de ordenanza"** — se detiene, se declara explícitamente, y se corrige con verificación antes de continuar. No se repara en silencio ni se asume que "ya se arregló solo".

## Por qué existe este artículo

El incidente del 2026-08-19: al arreglar un bug real (la barra desaparecía por completo para sesiones de artista), la corrección hizo que el artista viera la **barra pública de marketing** (`#mainNav`) en su propio perfil, en vez de su estación de trabajo. La corrección técnica fue válida contra el bug que resolvía, pero **violó esta regla constitucional sin que nadie la hubiera expuesto explícitamente antes de aplicarla** — exactamente el escenario que este artículo prohíbe hacia adelante.

## Anillos de seguridad para cualquier PR que toque nav/estaciones de trabajo

Ningún PR que toque barras de menú o estaciones de trabajo se autoriza a fusionar sin pasar por **dos anillos, en orden**:

1. **Anillo 1 — Coordinador (esta sesión, MDJB/Elixis).** Verifico explícitamente, en el chat, que el cambio cumple este artículo — no solo que el bug técnico reportado se resolvió. Confirmo puesto por puesto qué toca la estructura de barras y qué no. Sin esta verificación explícita, no relevo ninguna orden de commit/push/PR al agente que hizo el trabajo.
2. **Anillo 2 — Capitán (PO).** Revisión final y personal, después del Anillo 1, antes de dar la palabra de aprobación.

Ninguno de los dos anillos por sí solo autoriza un PR. Ambos son requisito.

## Vínculo con gobernanza existente

- Complementa [[feedback_menu_bar_constitution]] (regla previa: prohibido tocar/renombrar/reordenar cualquier menú sin autorización explícita).
- La separación staff/artista ya estaba registrada en [[project_identity_model_owner_vs_dj]] y [[project_staff_matrix_architecture]] — este artículo formaliza la razón de esa separación en términos de aislamiento de estaciones de trabajo.
- El "juego interno del sistema" (decisión PO 2026-08-19, ya presente en `mdj-shared-header.js:54-77` para `academia.html`/`dj-tools.html`) es la implementación técnica parcial de este principio — falta extenderlo a `dj-profile.html` para artistas y confirmarlo para staff/owner.
