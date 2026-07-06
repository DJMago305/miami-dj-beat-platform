# MIAMI DJ BEAT

# ARQUITECTURA VIVA

## MEMORIA PERMANENTE DEL PROYECTO

**Versión:** 1.0  
**Ticket:** TICKET-V2-ARCHITECTURE-LIVING-MEMORY-001  
**Audiencia:** Arquitectos, desarrolladores, IA, colaboradores  
**Estado del documento:** Permanente — no se elimina; solo se modifica vía ADR aprobada por Product Owner  
**Lectura obligatoria:** antes de diseñar cualquier módulo de Portal Architecture V2

---

## SECCIÓN 1 — HISTORIA DEL PROYECTO

### Cómo nació Miami DJ Beat

Miami DJ Beat nació como plataforma digital para conectar la marca con clientes, artistas (DJs) y operación interna: reservas, roster, formación, herramientas profesionales y gestión de eventos en el mercado de Miami y alrededores.

### Cómo evolucionó V1

V1 se construyó como sitio estático en `web/`: HTML, CSS y JavaScript compartidos, Supabase como backend, y crecimiento página a página según demanda del negocio. Cada nueva función se integró en el árbol existente.

### Qué permitió crecer rápidamente

- Entrega directa sin capa de build compleja al inicio
- Backend unificado en Supabase (auth, datos, RLS)
- Reutilización inmediata de scripts globales (`auth.js`, header compartido, i18n)
- Iteración rápida visible en localhost y deploy en Vercel

### Qué limitaciones aparecieron con el tiempo

- Acoplamiento entre portales (cliente, artista, staff) en los mismos archivos
- Contratos de inicialización implícitos (polling, timers) en navegación
- Archivos monolíticos difíciles de probar y aislar
- Regresiones cruzadas: un cambio en header afectaba perfil, admin o checkout
- Working tree con múltiples dominios mezclados (header, invoice, portal, docs)

### Por qué nace la Migración V2

V2 no nace por fallo del negocio. Nace porque la **arquitectura de V1 dejó de escalar** con la complejidad del producto. La migración reconstruye la estructura — Shared Core, tres portales, Operations Core, migración por módulos — **sin interrumpir producción**.

---

## SECCIÓN 2 — FILOSOFÍA DE ARQUITECTURA

Principios **permanentes** del proyecto V2:

| Principio | Significado |
|-----------|-------------|
| **Una sola fuente de verdad** | Datos y órdenes viven una vez; cada rol ve una proyección |
| **Una responsabilidad por módulo** | Cada módulo tiene un propósito acotado y testeable |
| **Separación completa entre portales** | Cliente, Artista y Staff no comparten nav ni layouts internos |
| **Componentes reutilizables** | UI y servicios transversales viven en Shared Core |
| **Sin duplicación de lógica** | Una implementación; no copiar comportamiento entre portales |
| **Eventos explícitos** | Contratos emit/listen; no inferir estado por polling |
| **Contratos claros entre módulos** | Interfaces documentadas; rotura de contrato = ADR + revisión |
| **Arquitectura de largo plazo** | Diseñada para crecer años sin reescribir el monolito |

---

## SECCIÓN 3 — ERRORES HISTÓRICOS DE V1

Lecciones **técnicas** verificadas. Sin personas. Sin culpables.

| Error histórico | Consecuencia |
|-----------------|--------------|
| **Monolito demasiado grande** | Archivos de miles de líneas; revisión y prueba costosas |
| **Acumulación de responsabilidades** | Un script resolvía auth, nav, permisos y UI |
| **Múltiples sistemas de navegación** | `#mainNav`, `#owner-tabs`, strips inyectados, reglas distintas por página |
| **Dependencia de polling** | Reorden y parches dependían de ventanas temporales que expiraban |
| **Headers con múltiples contratos** | Un mismo header servía buyer journey, artist strip y staff con drift |
| **Working tree mezclado** | Header + invoice + nav en un solo diff |
| **Tickets mezclados** | Alcance difuso; rollbacks amplios |
| **Regresiones difíciles de localizar** | Sin límites de módulo, la causa raíz tardaba en demostrarse |
| **Arquitectura por parches** | Fixes locales sin contrato global |
| **Falta de límites entre módulos** | Import implícito vía globals (`window.__mdj*`) |

V2 existe para **no repetir** estos patrones.

---

## SECCIÓN 4 — DECISIONES PERMANENTES

Estas decisiones **solo cambian mediante ADR** aprobada por Product Owner.

| # | Decisión |
|---|----------|
| D-01 | **Shared Core único** — auth, permisos, design system, servicios, i18n |
| D-02 | **Tres portales independientes** — Client, Artist, Staff |
| D-03 | **Una sola orden** para toda la plataforma — proyección por rol (Operations Core) |
| D-04 | **Migración por módulos completos** — nunca archivos sueltos |
| D-05 | **Sin Big Bang Migration** — cutover por olas con rollback |
| D-06 | **V1 protegida** — lab V2 no modifica `web/` durante desarrollo |
| D-07 | **Producción protegida** — deploy solo con autorización explícita |
| D-08 | **Validación obligatoria del Product Owner** — visual y funcional antes de cierre |

---

## SECCIÓN 5 — ARQUITECTURA OBJETIVO

### Diagrama de referencia

```
                    SUPABASE
                   Auth · RLS
                   RPC · Edge
                        │
                        ▼
                 SHARED CORE
        ┌───────────────┼───────────────┐
        │               │               │
      Auth         Permissions      Services
        │               │               │
   Components        Theme          Events
        │               │               │
        └───────────────┼───────────────┘
                        │
           ┌────────────┼────────────┐
           │            │            │
           ▼            ▼            ▼
        CLIENT       ARTIST        STAFF
       (buyer)    (performer)    (operations)
```

### Rol de cada capa

| Capa | Rol |
|------|-----|
| **Supabase** | Identidad, datos, reglas de acceso (RLS), funciones server-side |
| **Shared Core — Auth** | Sesión, sign-in/out, gates; snapshot de acceso |
| **Shared Core — Permissions** | Matriz de roles; guards; no UI de portal |
| **Shared Core — Services** | Cliente API, Edge, módulos de datos tipados |
| **Shared Core — Components** | Primitivas UI reutilizables sin lógica de negocio de portal |
| **Shared Core — Theme** | Tokens, tipografía, identidad visual |
| **Shared Core — Events** | Bus de contratos (`SURFACE_READY`, etc.) |
| **Shared Core — API** | Capa de abstracción sobre Supabase/Edge |
| **Portal Client** | Experiencia comprador / VIP |
| **Portal Artist** | Experiencia DJ: perfil, agenda, Cash Flow, SFT, herramientas |
| **Portal Staff** | Experiencia operación: CRM, leads, facturación, producción |

**Regla:** Shared Core **nunca** contiene páginas ni navegación específica de un portal.

---

## SECCIÓN 6 — REGLAS DE ARQUITECTURA

| # | Regla |
|---|-------|
| R-01 | **Nunca** compartir navegación entre portales |
| R-02 | **Nunca** compartir layouts internos entre portales |
| R-03 | **Nunca** duplicar lógica — extraer a Shared Core o servicio |
| R-04 | **Nunca** romper contratos publicados sin ADR |
| R-05 | **Nunca** crear deuda técnica deliberadamente |
| R-06 | **Nunca** modificar un portal desde otro |
| R-07 | **Nunca** mezclar responsabilidades en un mismo módulo |

Violación de R-04 a R-07 bloquea merge hasta ADR o corrección de alcance.

---

## SECCIÓN 7 — ADR (Architecture Decision Records)

Tabla **permanente**. Toda decisión arquitectónica futura se registra aquí o en `MiamiDJBeat-MigracionV2/docs/adr/` (ruta canónica lab; registro maestro: `docs/DECISIONS.md`) con referencia cruzada.

| ID | Fecha | Ticket | Título | Motivo | Alternativas | Riesgos | Estado | PO |
|----|-------|--------|--------|--------|--------------|---------|--------|-----|
| ADR-001 | 2026-07-05 | V2-LAB-FOUNDATION | Shared Core + 3 portales | Separar responsabilidades V1 | Monolito V2 único | Complejidad inicial | **Aprobada** | Pendiente firma |
| ADR-002 | 2026-07-05 | V2-LAB-FOUNDATION | Migración por módulos | Rollback granular | Big bang | Coexistencia larga V1/V2 | **Aprobada** | Pendiente firma |
| ADR-003 | 2026-07-05 | CONTRATO-V2 | Eventos explícitos vs polling | Eliminar drift lifecycle nav | Poll/MO | Orden emit/listen | **Propuesta** | Pendiente |
| — | — | — | *Próximas ADRs* | — | — | — | — | — |

**Campos obligatorios por ADR:** Fecha · Ticket · Título · Motivo · Alternativas evaluadas · Riesgos · Estado · Aprobación Product Owner.

---

## SECCIÓN 8 — CRONOLOGÍA DE MIGRACIÓN

Evolución prevista del proyecto:

```
V1 (Producción)
      │
      ▼
Laboratorio V2 (aislado, sin tocar V1)
      │
      ▼
Primer módulo (ej. Artist Navigation)
      │
      ▼
Primer portal parcial (shell + módulos validados)
      │
      ▼
Primer cutover (una ola, rollback planificado)
      │
      ▼
Migración completa (módulos restantes, V1 retirado por fases)
```

Cada escalón requiere QA en cuatro capas y aprobación PO antes del siguiente.

**Estado hoy:** V1 en producción · Laboratorio V2 en **planificación/documentación** · primer módulo **no iniciado**.

---

## SECCIÓN 9 — LECCIONES APRENDIDAS

Sección **permanente**. Solo incidentes verificados. Sin culpables.

| ID | Qué ocurrió | Qué se aprendió | Cambio permanente | Cómo evitar repetir |
|----|-------------|-----------------|-------------------|---------------------|
| LA-01 | Owner strip STAFF ausente o desordenado tras auth async | Lifecycle por poll expira antes de que la página esté lista | Contrato V2: evento `OWNER_STRIP_READY` emitido por la página | Emit/listen explícito; prohibir poll para nav primario en V2 |
| LA-02 | Cambios en header rompieron logout o doble barra nav | Un dominio mezclado afectó otro | Dominios aislados en tickets y working tree | Sección 9 de Constitución Operativa |
| LA-03 | Informe “implementado” sin QA visual PO | Código correcto ≠ producto aprobado | Validación visual PO obligatoria para cierre | Cuatro capas QA antes de migrar |
| LA-04 | Copia desde `web/` arrastró deuda | Reutilización no autorizada perpetúa anti-patrones | Reimplementación desde spec; ADR para excepciones | Prohibición de copia sin ADR |
| LA-05 | Múltiples desarrollos en mismo tree | Regresiones cruzadas difíciles de atribuir | Un ticket, un dominio, diff acotado | Git status/diff antes de codificar |

*Ampliar esta tabla con cada incidente importante.*

---

## SECCIÓN 10 — VISIÓN A LARGO PLAZO

Cuando V2 esté terminado, Miami DJ Beat debe ser:

| Atributo | Descripción |
|----------|-------------|
| **Arquitectura limpia** | Capas y portales con límites visibles |
| **Escalable** | Nuevos módulos sin reescribir el núcleo |
| **Modular** | Cutover y rollback por unidad de producto |
| **Fácil de mantener** | Archivos acotados; responsabilidad clara |
| **Fácil de probar** | E2E por portal y rol; contratos unitarios |
| **Fácil de evolucionar** | ADR gobierna cambios estructurales |
| **Largo plazo** | Preparada para años de crecimiento sin monolito |

Tres portales desplegables, un Shared Core versionado, Operations Core con **una orden — tres proyecciones**, y V1 retirada por módulos sin big bang.

---

## SECCIÓN 11 — REGLA FINAL

> **Todo cambio de arquitectura debe estar respaldado por una ADR aprobada por el Product Owner.**

Si una decisión **no tiene ADR**:

**NO podrá implementarse.**

Excepciones: mantenimiento acotado en V1 bajo ticket explícito que **no** altere decisiones D-01 a D-08.

---

## REFERENCIAS CRUZADAS

| Documento | Propósito |
|-----------|-----------|
| `docs/V2/MiamiDJBeat-MigracionV2-MEMORIA.md` | Memoria ejecutiva migración |
| `docs/V2/NOTA-DIARIA-OPERACION-PERMANENTE.md` | Constitución operativa |
| `docs/V2-LAB/` | Fundación técnica del laboratorio |

---

*Arquitectura Viva v1.0 — 2026-07-05 — TICKET-V2-ARCHITECTURE-LIVING-MEMORY-001*

*Documento permanente. Modificaciones solo vía ADR + aprobación Product Owner.*

*Esperando aprobación del Product Owner.*
