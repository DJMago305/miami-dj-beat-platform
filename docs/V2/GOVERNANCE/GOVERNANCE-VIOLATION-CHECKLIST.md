# MIAMI DJ BEAT

# GOVERNANCE VIOLATION CHECKLIST

**Ticket:** TICKET-V2-GOVERNANCE-AGENT-ONBOARDING-GATE-001  
**Autoridad normativa:** [MIAMIDJBEAT GOVERNANCE BASELINE v3.1](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md)  
**Uso:** Autoauditoría durante y después del trabajo · detección de posibles violaciones

> Marcar `[x]` solo si el hecho **ocurrió** o **casi ocurrió**. Usar con [Baseline §39](../MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md#39-respuesta-oficial-del-agente) y abrir **INCIDENTE DE GOBERNANZA** antes de ticket técnico cuando aplique (Baseline §68).

---

## Checklist de violaciones

**Ticket evaluado:** ___________________________  
**Fecha:** ___________________________  
**Agente:** ___________________________

### Alcance y archivos

- [ ] **Cambió archivo fuera de alcance.**  
  → GV-003 · Baseline §50 · §52 · §58

- [ ] **Mezcló tickets.**  
  → Baseline §50 · §68

- [ ] **No declaró riesgo** (local / compartido / global).  
  → Baseline §62 · §65

- [ ] **No se detuvo ante dependencia inesperada.**  
  → Baseline §53 · §70 · §69

### Navegación y componentes compartidos

- [ ] **Tocó menú / header / nav sin autorización.**  
  → Baseline §63 · §58 · §64

- [ ] **Tocó componente FROZEN** sin UNFREEZE PO.  
  → GV-009 · Baseline §22 · §23 · §67

### Aprobación y Git

- [ ] **Declaró aprobación sin Product Owner.**  
  → GV-001 · Baseline §35 · §42

- [ ] **Recomendó commit sin autorización** (**AUTORIZADO COMMIT**).  
  → GV-005 · Baseline §28

- [ ] **Recomendó push sin autorización** (**APROBADO PUSH**).  
  → GV-006 · Baseline §28

- [ ] **Recomendó deploy sin autorización** (**APROBADO DEPLOY PRODUCCIÓN**).  
  → GV-007 · Baseline §28 · §77

### Expansión y evidencia

- [ ] **Usó «aproveché para»** (o equivalente: «también corregí», «ya que estaba», «optimicé», «refactoricé»).  
  → Baseline §66

- [ ] **No presentó evidencia antes / después** (ANTES · DESPUÉS · DIFERENCIA).  
  → Baseline §60 · §61 · §78

---

## Si alguna casilla está marcada

| Paso | Acción |
|------|--------|
| 1 | **Detener** trabajo adicional sobre la zona afectada |
| 2 | **Documentar** hechos observables — sin culpas ni intenciones (Baseline §41) |
| 3 | **Reportar** con plantilla Baseline §39 |
| 4 | Abrir **INCIDENTE DE GOBERNANZA** **antes** de ticket técnico de fix (Baseline §68) |
| 5 | **Esperar** decisión Product Owner |

### Plantilla rápida (Baseline §39)

```markdown
## Respuesta oficial — Violación de gobernanza

Tipo: Violación detectada
Código: GV-xxx
Severidad: [CRÍTICA | ALTA | MEDIA | BAJA]
Descripción: [hechos observables]
Regla infringida: [§x Baseline / ítem de este checklist]
Estado correcto: [estado que debía mantenerse]
Acción requerida: [Detener | Escalar PO | UNFREEZE | Nuevo ticket]
Observaciones: [limitaciones de la auditoría]
```

---

## Si ninguna casilla está marcada

El trabajo **puede** continuar **solo** dentro del alcance declarado — **sin** implicar aprobación PO.

Cierre de informe: Baseline §36 — **EVIDENCIA PRESENTADA** — pendiente validación PO.

---

## Referencia catálogo GV (Baseline §37)

| Código | Tema |
|--------|------|
| GV-001 | Aprobación sin PO |
| GV-002 | Interpretación de evidencia |
| GV-003 | Cambio ilegal de alcance |
| GV-004 | Promoción ilegal de estados |
| GV-005 | Commit sin autorización |
| GV-006 | Push sin autorización |
| GV-007 | Deploy sin autorización |
| GV-008 | Ausencia validación visual |
| GV-009 | Modificar FROZEN |
| GV-010 | Cerrar ticket sin PO |

---

## Estado

| Campo | Valor |
|-------|-------|
| **Documentado** | Sí |
| **Evidencia presentada** | Sí |
| **Pendiente** | Validación Product Owner |

*No constituye aprobación. La decisión final corresponde exclusivamente al Product Owner.*

---

*TICKET-V2-GOVERNANCE-AGENT-ONBOARDING-GATE-001 — 2026-07-05*
