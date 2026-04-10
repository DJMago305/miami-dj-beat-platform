---
description: Reglas operativas estrictas para modificaciones de código, auditoría y control de alcance
---
# Protocolos de Blindaje (NO NEGOCIABLES)

Estas 3 reglas rigen cualquier intervención en la base de código del proyecto para asegurar consistencia, evitar regresiones y limitar el radio de acción.

### 1) Regla de Rollback Inteligente
Nunca hagas rollback (ej. `git checkout <file>`) de un archivo completo sin revisar qué progreso ya estaba corregido.
- **Siempre** debes aislar el diff antes de actuar.
- **Identifica** qué código reparado previamente se perdería con un borrado total.
- **Aplica** rollback parcial mediante correcciones o sustituciones de código específicas (`replace_file_content`), jamás un borrado ciego.

### 2) Auditoría Obligatoria Antes de Cierre
Antes de dar por concluido un ticket o tarea de eliminación/cambio, es obligatorio ejecutar una verificación de referencias (ej. usando `grep_search`).
- **Buscar en todo el proyecto** la cadena recién eliminada (ej. `DJ Event Checklist` o `DJ-Event-Checklist-Free.pdf`).
- Si existe **cualquier coincidencia**, la tarea NO se da por cerrada.
- Solo se considera finalizada cuando el motor de búsqueda arroje cero referencias huérfanas y el usuario apruebe la validación visual en navegador. No asumas un alcance terminado sin auditar el repositorio entero.

### 3) Alcance Controlado (Scope Lock)
El alcance de cada intervención se constriñe estrictamente a:
- **1 Solo problema a la vez.**
- **1 Solo archivo a la vez** (O máximo 2 si comparten una relación directa de dependencia).
- **Quedan terminantemente prohibidos** los cambios masivos paralelos o el "aprovechar el viaje" para modificar áreas que no fueron solicitadas por el usuario.
- Si se detectan múltiples archivos con el problema en el scope inicial, el protocolo dicta que **se procesan de a 1 por 1**, con diff y aprobación individual para continuar al siguiente.

### 4) Regla de Congelamiento (Visual Lock)
Todo elemento (HTML, CSS, Asset o Componente) que ya haya sido aprobado y validado visualmente queda **LOCKED**.
- **Queda estrictamente prohibido** que un desarrollador de AI modifique, refactorice, reintroduzca o reinterprete unilateralmente partes visuales ya aceptadas.
- Si un nuevo ticket o intervención "choca" o afecta colateralmente un componente ya cerrado, la intervención **DEBE SER RECHAZADA** en su forma actual, protegiendo el componente Locked.
- Queda totalmente vetado hacer "mejoras de oportunidad" o "limpieza de código" fuera de la petición puntual del usuario.

### 5) Regla de Erradicación (Death Rule)
Cualquier elemento eliminado bajo la autorización explícita del usuario representa una **decisión de producto final**.
- **Prohibido reinsertar elementos eliminados previamente** (ej: botones retirados, imágenes obsoletas).
- Todo `diff` propuesto para cualquier futuro cambio está obligado a cumplir el siguiente formato sin excepción:
  - HTML afectado incluido.
  - CSS afectado incluido.
  - Líneas exactas indicadas.
  - **Regla Suprema: Sin diff = No se ejecuta ningún comando.**

### 6) Arquitectura Inviolable (Golden Layout Rule)
El axioma central de la plataforma es: **Lo que está bien no se toca, ni se modifica, ni se mueve a ningún lugar**.
- Si un bloque de código (ej. Layout de un Header, Flexbox o un Sistema de Grillas) está funcionando a la perfección, cualquier requerimiento posterior que afecte es área debe inyectarse cuidando no alterar ni un píxel de la arquitectura original.
- Antes de insertar componentes complejos en contenedores existentes (especialmente `divs` que usan `flex` o `grid` o dependencias posicionales), examina el impacto estructural global. Jamás arriesgues la integridad de un componente verificado solo por cumplir un requerimiento adyacente.
