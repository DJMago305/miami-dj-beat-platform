# MIAMI DJ BEAT

# MIGRACIÓN V2

## MEMORIA OFICIAL DEL PROYECTO

**Documento:** Memoria permanente — Portal Architecture V2  
**Ticket:** TICKET-V2-DOCUMENTATION-MEMORIA-001  
**Audiencia:** Product Owner, arquitectos, desarrolladores, IA  
**Lectura estimada:** menos de 5 minutos

---

## 1. ESTADO DEL PROYECTO

| | |
|---|---|
| **Estado** | **DOCUMENTACIÓN SHARED CORE COMPLETA — RUNTIME NO INICIADO** |
| **Shared Core documental** | **16/16 módulos · 100%** · Tickets spec **001–018** |
| **Shared Core runtime** | **0%** — sin código V2 |
| **V1** | Sigue siendo **Producción** |
| **V2** | Laboratorio **completamente independiente** |

V1 opera el negocio hoy. V2 existe solo como plan y documentación hasta que el Product Owner autorice el inicio formal. Nada de V2 reemplaza V1 hasta migración módulo por módulo, con aprobación explícita.

---

## 2. OBJETIVO

Construir una **nueva arquitectura moderna** sin afectar el funcionamiento de Miami DJ Beat V1.

La meta **no** es rehacer el negocio. El negocio ya funciona.  
La meta **sí** es **reconstruir la arquitectura**: separar responsabilidades, eliminar acoplamientos heredados y permitir crecer sin repetir los problemas estructurales de V1.

---

## 3. FILOSOFÍA

1. **Nunca destruir una obra funcionando.** V1 permanece estable mientras V2 se construye aparte.
2. **Nunca mezclar V1 con V2.** Sin código compartido, sin parches cruzados, sin “puentes” temporales en producción.
3. **Nunca desarrollar funcionalidades nuevas sobre arquitectura antigua** cuando exista una solución prevista para V2.
4. **Todo cambio estratégico nuevo** debe evaluarse primero: ¿pertenece a V1 (mantenimiento acotado) o a V2 (construcción futura)?

---

## 4. ARQUITECTURA GENERAL

**Un Shared Core.**  
**Tres portales completamente independientes.**

| Portal | Usuario |
|--------|---------|
| **Portal Cliente** | Compradores y clientes VIP |
| **Portal Artista** | DJs y performers |
| **Portal Staff** | Owner, Admin, Manager, Seller |

Los tres portales comparten **únicamente servicios comunes** (autenticación, permisos, diseño, APIs).

**Nunca compartirán:**

- Navegación específica de otro portal
- Lógica de negocio específica de otro portal
- Layouts internos de otro portal

Cada portal es una experiencia propia, con identidad y flujos claros.

---

## 5. SHARED CORE

El núcleo compartido **solo** contendrá lo transversal. Nada de páginas ni flujos de un portal concreto.

| Contenido permitido |
|---------------------|
| Autenticación |
| Roles y permisos |
| Componentes reutilizables (botones, modales, tablas…) |
| Design System |
| Theme (colores, tipografía, tokens) |
| Servicios API |
| Internacionalización (inglés canónico, español secundario) |
| Helpers y utilidades genéricas |

**Nada más.** Si algo es específico de Cliente, Artista o Staff, vive en su portal, no en el Core.

---

## 6. PORTAL CLIENTE

**Objetivo:** Cuenta, compras y relación con la marca para quien **contrata** servicios, no quien los ejecuta.

**Funciones y responsabilidades:**

- Perfil de cliente y preferencias
- Historial de eventos y pedidos
- Reservas y checkout
- Programa VIP (lealtad, descuentos)
- Comunicación post-compra

**Qué nunca debe contener:**

- Barra de gestión del artista (owner strip)
- Herramientas Staff (admin, CRM, facturación interna)
- Herramientas internas de producción
- Consola SoundForTips™ del artista
- Cash Flow del artista

---

## 7. PORTAL ARTISTA

**Objetivo:** Todo lo que un DJ necesita para **operar su carrera** en la plataforma.

**Funciones:**

| Área | Propósito |
|------|-----------|
| **Perfil** | Presencia pública, marca artística, promoción |
| **Agenda** | Eventos, disponibilidad, calendario operativo |
| **Cash Flow** | Panel económico del artista |
| **SoundForTips™** | Función premium PRO (no acceso genérico) |
| **Academia** | Formación y contenido formativo del artista |
| **Herramientas DJ** | Utilidades profesionales del roster |

**Qué nunca debe contener:**

- Panel Staff completo (leads, facturación interna, blueprints de producción)
- Flujos de compra del cliente como navegación principal
- Permisos de escritura de gestión (`owner`/`manager`) mezclados sin gate explícito

---

## 8. PORTAL STAFF

**Objetivo:** Operación interna de Miami DJ Beat — **producción, ventas y administración**.

**Roles (mismo portal, distintos permisos):**

| Rol | Alcance |
|-----|---------|
| **Owner** | Control total |
| **Admin** | Gestión plena |
| **Manager** | Gestión operativa plena |
| **Seller** | Staff limitado (sin escritura en módulos sensibles de producción) |

**Funciones:**

- **Producción** — coordinación de eventos y recursos
- **CRM** — relación comercial interna
- **Facturación** — documentos y cobros
- **Leads** — pipeline comercial
- **Órdenes** — seguimiento operativo
- **Blueprints** — plantillas y flujos de producción
- **Reportes** — visibilidad gerencial

**Qué nunca debe contener:**

- Editor de perfil artístico como pantalla principal
- Tienda del cliente como home
- Herramientas creativas del DJ mezcladas con facturación sin separación de permisos

---

## 9. OPERATIONS CORE

Principio central del negocio en V2:

> **Toda orden nace una sola vez.**  
> Después se **proyecta** según el rol que la consume.

```
        ┌─────────────┐
        │   ORDEN     │  ← una sola fuente de verdad
        └──────┬──────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
 Cliente   Artista    Staff
  (ve lo    (ve lo     (ve lo
  suyo)      suyo)      suyo)
```

Cliente, Artista y Staff **trabajan sobre la misma orden**. Cada uno ve la información relevante para su rol.

**Nunca existirán órdenes duplicadas** para el mismo evento o contrato. Duplicar datos generó inconsistencias en V1; V2 lo prohíbe por diseño.

---

## 10. MIGRACIÓN

**No se migran archivos. Se migran módulos completos.**

Cada módulo sigue este orden — **nunca al revés**:

1. **Diseñarse** — alcance, permisos, UX acordados
2. **Construirse** — en el laboratorio V2, aislado de V1
3. **Validarse** — QA técnico, visual, funcional y PO
4. **Aprobarse** — Product Owner firma el módulo
5. **Migrarse** — cutover a producción con plan de rollback

Un módulo terminado incluye su navegación, lógica, pruebas y documentación. No se arrastran trozos sueltos de `web/` a V2.

---

## 11. REGLAS PERMANENTES

Reglas **inmutables** para todo el proyecto V2:

| # | Regla |
|---|-------|
| 1 | **Nunca tocar V1** durante el desarrollo de V2 |
| 2 | **Nunca romper producción** |
| 3 | **Nunca Big Bang Migration** — solo módulos, ondas controladas |
| 4 | **Nunca copiar código** de V1 sin ADR aprobado por PO y Arquitecto |
| 5 | **Nunca improvisar arquitectura** — decisiones documentadas |
| 6 | **Nunca crear deuda técnica** a cambio de velocidad aparente |
| 7 | **Nunca mezclar tickets** — un alcance, un propósito |
| 8 | **Nunca cerrar tickets** sin validación del Product Owner |

Frases de autorización para producción (exactas):

- Push: **`APROBADO PUSH`**
- Deploy producción: **`APROBADO DEPLOY PRODUCCIÓN`**

---

## 12. CALIDAD

Ningún módulo migra a producción sin pasar **cuatro capas de QA**:

| Capa | Qué valida |
|------|------------|
| **QA Técnico** | Estabilidad, permisos, errores, rendimiento |
| **QA Visual** | Identidad de marca, responsive, sin saltos de layout |
| **QA Funcional** | Flujos completos por rol |
| **QA Product Owner** | Alineación con producto y negocio |

Las cuatro deben aprobarse **antes** de migrar. Una sola capa en rojo bloquea el cutover.

---

## 13. CRITERIOS PARA INICIAR V2

V2 **no comienza** hasta cumplir **todos** estos criterios:

- [ ] V1 estable en producción
- [ ] Regresiones críticas corregidas
- [ ] Localhost aprobado por PO
- [ ] Invoice terminado (módulo acordado)
- [ ] Header estabilizado
- [ ] Navegación validada visualmente
- [ ] **Product Owner autoriza el inicio** por escrito

Hasta entonces, V2 permanece en **planificación y documentación**. V1 sigue siendo la única vía de entrega al cliente.

---

## 14. VISIÓN A LARGO PLAZO

El objetivo final es que Miami DJ Beat tenga una arquitectura capaz de **crecer durante muchos años** sin repetir los problemas estructurales acumulados en V1.

V2 debe permitir:

- Añadir portales o módulos sin reescribir el monolito
- Onboarding rápido de desarrolladores e IA con reglas claras
- Cambios de producto acotados por ticket, sin regresiones en cadena
- Operaciones (órdenes, facturación, producción) coherentes entre roles

La migración es un **maratón**, no un sprint. V1 y V2 pueden coexistir el tiempo necesario.

---

## 15. LECCIONES APRENDIDAS DE V1

Sección **permanente**. Debe ampliarse con cada incidente relevante, sin nombres ni atribuciones personales.

| Lección | Descripción |
|---------|-------------|
| **Crecimiento orgánico** | V1 creció sin arquitectura modular; cada página arrastró dependencias globales. |
| **Mezcla de portales** | Cliente, artista y staff compartieron scripts y navegación; un cambio en un rol afectó a otros. |
| **Archivos monolíticos** | Lógica acumulada en pocos archivos muy grandes dificultó revisión, prueba y aislamiento. |
| **Regresiones difíciles de aislar** | Sin límites claros, un fix en navegación rompió auth, checkout o admin sin detección temprana. |
| **Validación visual obligatoria** | Cambios “correctos en código” fallaron en producción porque no se validó el resultado visual antes de aprobar. |
| **Separación de capas** | Negocio, presentación y navegación deben vivir en contratos distintos; mezclarlos generó drift (p. ej. lifecycle por polling en lugar de eventos explícitos). |
| **Tickets acotados** | Alcance limitado y pactado reduce riesgo; tickets amplios o mezclados producen rollbacks costosos. |
| **Working tree compartido** | Varios desarrollos simultáneos en el mismo árbol sin congelar zonas generó conflictos y regresiones cruzadas. |

Estas lecciones **justifican V2**. No son crítica personal; son gobernanza de proyecto.

---

## 16. REGLA FINAL

> **Todo integrante del proyecto — humano o IA — debe leer este documento antes de comenzar cualquier desarrollo relacionado con Portal Architecture V2.**

Ante duda entre V1 y V2, entre alcances o entre portales: **detenerse**, consultar al Product Owner y al Arquitecto, y no improvisar.

---

**Referencias complementarias (técnicas, laboratorio):** `docs/V2-LAB/`  
**Este documento:** referencia ejecutiva y memoria oficial del proyecto.

*Última actualización: 2026-07-05 — TICKET-V2-DOCUMENTATION-MEMORIA-001*
