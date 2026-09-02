# PROTOCOLO DE JERARQUÍA, COMUNICACIÓN Y LIMPIEZA MULTIAGENTE — MDJB

> Este documento formaliza una práctica que ya venía aplicándose de facto en el proyecto (ver `docs/JURISDICCIONES.md` y `CLAUDE.md`). No reemplaza a ninguno de los dos — los complementa. Ante cualquier conflicto de texto, `CLAUDE.md` manda primero, luego `docs/JURISDICCIONES.md`, luego este documento.

## 1. Jerarquía

**Agente Orquestador (Hilo Maestro)**
- Gobierna el Registro Único de Verdad (`docs/ESTADO_MAESTRO.md`) y la arquitectura global.
- Ningún agente especialista altera esquemas de base de datos, APIs centrales o módulos compartidos (`mdjb-shared-header.js`, `translations.js`) sin su validación previa.
- Registra incidentes o mutaciones estructurales relevantes en `company_incident_log` para que toda la red de agentes comparta la misma línea base de memoria.

**Agentes Especialistas (dominio acotado, ver `docs/JURISDICCIONES.md`)**
- Operan estrictamente dentro de su frontera técnica.
- **Auditoría previa obligatoria**: antes de generar código, migraciones o funciones, inspeccionan la base de datos y los archivos en vivo — nunca asumen el estado, lo verifican (patrón ya aplicado toda esta sesión: `merch_orders` resultó ya existir con otro esquema real antes de escribir su migración).
- **Reporte ascendente inmediato**: cada ejecución concluida entrega diff exacto, hash de commit y estado funcional verificado — nunca un resumen sin evidencia.

## 2. Sincronización bidireccional de contexto

- **Propagación en cascada**: si el Orquestador cambia una directriz global (identidad de marca, saneamiento de nombres, etc.), los agentes especializados alinean sus herramientas locales a esa directriz en su próxima intervención sobre el artefacto correspondiente.
- **Bloqueo de artefactos en conflicto**: prohibida la modificación concurrente del mismo archivo crítico por dos agentes; uno cierra y sincroniza antes de que el otro intervenga. Ver `feedback_parallel_session_collision_protocol` (memoria): 8+ incidentes reales de colisión entre sesiones paralelas.

## 3. Política de Cero Desperdicio (Zero Waste)

Aplica al trabajo propio de cada agente dentro de su sprint activo:

1. **Destrucción inmediata de fallos propios**: si un mock, función o migración falla en pruebas, se revierte al instante. No quedan `.bak`, tablas `_test`, ni consolas de depuración del propio agente en el repo.
2. **Saneamiento pre-diff**: antes de presentar cualquier diff para aprobación, el agente confirma ausencia de marcadores de conflicto de merge, archivos huérfanos propios y artefactos de sesiones de prueba.
3. **Higiene de commit**: solo código funcional y validado bidireccionalmente entra al repositorio.

**Límite explícito — no se modifica por esta política**: la Regla #2 de `CLAUDE.md` ("Prohibido borrar o alterar sin permiso") sigue vigente sin excepción. Esta política de Zero Waste autoriza a cada agente a limpiar **lo que él mismo generó y no funcionó** en el sprint en curso — no autoriza borrar código preexistente de otros sprints, archivos huérfanos históricos, o cualquier cosa no tocada por esa tarea. Ese tipo de hallazgo se **reporta** (papelera estructural propuesta, p. ej. `archive/legacy_dump/`) y espera autorización explícita del PO antes de moverse o eliminarse — igual que ya se hizo con `elixis-console.html`.

---
*Creado: 2026-09-01, a pedido del PO, formalizando el protocolo multiagente y la política Zero Waste ya comunicados en el hilo de desarrollo.*
