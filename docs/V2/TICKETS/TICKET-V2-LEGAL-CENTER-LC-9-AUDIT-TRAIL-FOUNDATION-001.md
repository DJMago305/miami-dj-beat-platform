# TICKET-V2-LEGAL-CENTER-LC-9-AUDIT-TRAIL-FOUNDATION-001

## Estado

**IMPLEMENTADO — APROBADO VISUAL Y TÉCNICAMENTE POR EL PRODUCT OWNER**

Commit local LC-9 · sin push · sin merge · sin PR · sin deploy · LC-10 no iniciado.

| Campo | Valor |
|-------|-------|
| Rama | `plan/v2-phase-4-api-client` |
| HEAD anterior | `a30effcce649e675c91cd5705c572c03e90479de` |
| Commit LC-9 | `feat(v2-legal): add legal audit trail foundation` |
| Baseline tests | 935 PASS |
| Post-LC-9 tests | **958 PASS** (+23 LC-9) |
| LC-9 tests | **23 PASS** (11 trail + 12 integration) |
| typecheck | exit 0 |
| HTTP QA | 5/5 HTTP 200 |
| Fecha QA técnica | 2026-07-21 |
| Fecha aprobación PO | 2026-07-21 |

---

## 1. Objetivo

Fundación tipada e in-memory del historial de auditoría del Legal Center (`LegalAuditEvent`, `LAE-######`), append-only, inmutable, coordinada con LC-6 (instancias), LC-7 (W-9 workflow) y LC-8 (submissions). Sin persistencia real.

---

## 2. Baseline de arranque

| Check | Resultado |
|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` ✓ |
| HEAD | `a30effc` ✓ |
| Working tree inicial | limpio ✓ |
| `npm run typecheck` | exit 0 ✓ |
| Suite baseline | 935 PASS ✓ |

---

## 3. Arquitectura

```
LC-6 instance service ──┐
LC-7 W-9 workflow  ─────┼──► LegalAuditRecorder (optional)
LC-8 storage/submit  ───┘           │
                                    ▼
                         LegalAuditTrailPort
                                    │
                                    ▼
                    InMemoryLegalAuditTrail (append-only)
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
         legal-audit-public-view          legal-audit-shell-mapper
         (staff / artist projection)      (Legal Activity UI stub)
```

**Principios:** append-only · profundamente inmutable · sin Supabase · sin datos fiscales sensibles · rollback in-memory si falla el append tras mutación de dominio.

---

## 4. Modelo `LegalAuditEvent`

Campos: `id` (`LAE-######`), `sequence`, `occurredAt`, `actor`, `action`, `entityType`, `entityId`, `relatedEntityIds`, `previousState`, `nextState`, `outcome`, `reasonCode?`, `correlationId?`, `requestId?`, `metadata`.

Estados anterior/posterior sanitizados (`sanitizeAuditState`) — bloquea `storageKey`, `checksum`, `filename`, `contentReference`, SSN/EIN/TIN.

---

## 5. Modelo `LegalAuditActor`

`actorType`: `staff` | `artist` | `client` | `system` | `external`

`role`: `owner` | `manager` | `seller` | `artist` | `client` | `system`

Sin email completo, teléfono, IP, tokens ni headers.

---

## 6. Entity types

`legal_document_instance` · `w9_request` · `legal_document_submission` · `legal_template` · `legal_template_asset`

---

## 7. Acciones implementadas

Todas definidas en `legal-audit-action.ts`. Integradas en dominio:

| Área | Acciones registradas |
|------|---------------------|
| LC-6 | `instance_created`, `instance_status_changed`, `instance_cancelled`, `instance_expired`, `instance_viewed`, `instance_status_changed` (failed) |
| LC-7 | `w9_requested`, `w9_made_available`, `w9_viewed`, `w9_awaiting_upload`, `w9_submitted`, `w9_marked_under_review`, `w9_accepted`, `w9_rejected`, `w9_cancelled`, `w9_expired`, `legal_access_denied` |
| LC-8 | `submission_uploaded`, `submission_review_started`, `submission_accepted`, `submission_rejected`, `submission_deleted`, `legal_sensitive_record_viewed`, `legal_access_denied` |

**Pendiente de cableado (deuda LC-9):** `submission_replaced`, `submission_viewed`, `template_asset_*` — tipos definidos, hooks no conectados aún.

---

## 8. Outcomes y reason codes

Outcomes: `success` | `denied` | `failed`

`reasonCode` obligatorio para `denied`/`failed`. Mapeo desde códigos de dominio vía `mapDomainReasonCode()`:

`actor_not_authorized` · `invalid_transition` · `recipient_mismatch` · `submission_not_found` · `request_not_found` · `instance_not_found` · `duplicate_active_request` · `asset_access_forbidden`

---

## 9. Append-only policy

`LegalAuditTrailPort`: `appendEvent`, `getEventById`, `listEvents`, `listEventsByEntity`, `listEventsByActor`, `listEventsByAction`, `listEventsByCorrelationId`, `listEventsByTimeRange`.

**Prohibido:** `updateEvent`, `replaceEvent`, `deleteEvent`.

Sin TTL · sin purge · retención persistente fuera de alcance.

---

## 10. ID y sequence

- Event IDs: `LAE-######` (secuencia monotónica independiente)
- Correlation IDs: `LAC-######` vía `LegalAuditRecorder.nextCorrelationId()`
- `bumpAuditEventSequenceFloor` sincroniza piso de secuencia con IDs explícitos
- Error tipado: `duplicate_audit_event_id`

---

## 11. Clock

`InMemoryLegalAuditTrail` usa `LegalDocumentInstanceClock` inyectable (`createFixedLegalDocumentInstanceClock` en tests). `LegalAuditRecorder` recibe clock por contrato; timestamps los emite el trail en `appendEvent`.

---

## 12. Correlation strategy

Operaciones coordinadas (submit, accept, reject, under review) generan `LAC-######` compartido entre eventos W-9 + submission + instance cuando aplica. No se expone en UI pública.

---

## 13. Integración LC-6

`InMemoryLegalDocumentInstanceService` acepta `auditRecorder?` opcional:

- `instance_created` tras create válido
- `instance_status_changed` / `instance_cancelled` / `instance_expired` / `instance_viewed`
- `instance_status_changed` (failed) en transición inválida
- Rollback de instancia si falla append post-create/post-transition

---

## 14. Integración LC-7

`InMemoryLegalW9WorkflowService` registra:

- Owner/Manager → `w9_requested` success
- Seller/Client/Artist → denied con `legal_access_denied` o `w9_requested` denied
- Transiciones workflow + duplicate active request denied
- `listW9Requests` seller → `legal_access_denied`

---

## 15. Integración LC-8

- Submit: `w9_submitted` + `submission_uploaded` (correlacionados)
- Review: `w9_marked_under_review` + `submission_review_started`
- Accept/Reject: submission + w9 + `instance_status_changed` correlacionados
- Delete: `submission_deleted`
- Sensitive read: `legal_sensitive_record_viewed` / `legal_access_denied`

Auditoría de upload centralizada en workflow (no duplicada en storage layer).

---

## 16. Atomicidad / rollback

Patrón: validar → mutar dominio → append audit → si append falla, rollback in-memory.

Implementado en LC-6 create/transition, LC-7 coordinated events, LC-8 accept/reject/submit/delete.

`InMemoryLegalAuditTrail.setForceAppendFailure(true)` para pruebas de rollback.

---

## 17. Autorización

- `canActorQueryLegalAuditTrail`: staff owner/manager + artist; **no** seller/client
- `filterAuditEventsForArtist`: solo eventos del propio `artistActorId`
- Seller: sin sección Legal Activity en shell
- Client: sin audit trail fiscal

---

## 18. Proyección pública

`toStaffLegalAuditPublicView` / `toArtistLegalAuditPublicView`:

- Labels legibles, fecha, outcome, actor genérico
- Artist: sin IDs internos de staff, sin reason codes internos, sin metadata técnica
- Sin `correlationId`, `storageKey`, `checksum`

---

## 19. UI mínima

`legal-audit-shell-mapper.ts`:

- Staff Owner/Manager: sección **Legal Activity** (máx. 4 filas demo o eventos reales del lab store)
- Artist: **Document Activity** (opcional, eventos propios)
- Seller/Client: sin sección

**Nota PO:** cambio visible en shell staff/artist — requiere aprobación visual antes de commit.

---

## 20. Archivos creados

| Archivo |
|---------|
| `shared/services/legal/audit/*` (10 módulos) |
| `shared/services/legal/in-memory/in-memory-legal-audit-trail.ts` |
| `shared/services/legal/provider/legal-audit-shell-mapper.ts` |
| `tests/unit/legal-audit-trail.test.ts` |
| `tests/unit/legal-audit-integration.test.ts` |
| `docs/V2/TICKETS/TICKET-V2-LEGAL-CENTER-LC-9-AUDIT-TRAIL-FOUNDATION-001.md` |

---

## 21. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `in-memory-legal-document-instance-service.ts` | Audit hooks LC-6 + rollback |
| `in-memory-legal-w9-workflow-service.ts` | Audit hooks LC-7/8 + rollback |
| `in-memory-legal-document-storage.ts` | Removida auditoría duplicada en store |
| `legal-w9-workflow-lab-store.ts` | Wire audit trail compartido |
| `legal-center-shell-mapper.ts` | Append Legal Activity sections |
| `in-memory/index.ts` | Export audit trail |

---

## 22. Tests

| Suite | Tests |
|-------|-------|
| `legal-audit-trail.test.ts` | 11 |
| `legal-audit-integration.test.ts` | 12 |
| Suite completa | **958 PASS** |

Cubre: LAE IDs, sequence, append-only, inmutabilidad, filtros, outcomes, LC-6/7/8 integration, rollback, artist isolation, seller/client denial, public projection safety, shell sections.

---

## 23. QA HTTP

| URL | Resultado |
|-----|-----------|
| `/staff/` | HTTP 200 |
| `/staff/?previewRole=seller` | HTTP 200 |
| `/artist/` | HTTP 200 |
| `/client/` | HTTP 200 |
| W-9 PDF asset | HTTP 200 |

---

## 24. Riesgos y deuda

1. **UI visible** — Legal Activity / Document Activity requiere revisión visual PO.
2. **`submission_replaced`** — acción tipada, hook no conectado (replace path no expuesto en workflow público actual).
3. **`template_asset_*`** — acciones tipadas, sin integración LC-5 download gate aún.
4. **Persistencia** — solo in-memory; lab store compartido reseteable en tests.
5. **Retención/GDPR** — documentado como deuda; sin purge engine.
6. **`appendAfterMutation` en recorder** — helper disponible; paths de producción usan rollback explícito por servicio.

---

## 25. Fuera de alcance (confirmado)

Supabase · DB · migrations · RLS · Edge · Sentry · analytics · CSV export · Audit Center completo · LC-10 · persistencia real · certificación legal.

---

## 26. Confirmación operativa

- [x] Commit LC-9 local creado
- [x] Working tree limpio post-commit
- [ ] Sin push
- [ ] Sin merge
- [ ] Sin PR
- [ ] Sin deploy
- [x] LC-10 no iniciado
- [x] LC-5/6/7/8 regresión suite verde

---

## 28. Validación visual PO (aprobada)

Rutas validadas en localhost:

| Ruta | Resultado |
|------|-----------|
| `/staff/` | HTTP 200 · Legal Activity visible (Owner) |
| `/staff/?previewRole=seller` | HTTP 200 · sin audit trail legal |
| `/artist/` | HTTP 200 · Document Activity propia únicamente |
| `/client/` | HTTP 200 · sin audit trail fiscal |

Checklist PO:

- [x] Staff Owner muestra Legal Activity (máx. 4 filas, sin filtros/paginación/modal/export)
- [x] Staff Manager mantiene acceso operativo no sensible
- [x] Staff Seller no muestra audit trail legal
- [x] Artist muestra únicamente Document Activity propia
- [x] Client no muestra audit trail fiscal
- [x] No se exponen LAE, LAC, LDI, W9R, LDS, storageKey, checksum ni metadata técnica
- [x] Sin regresiones visibles en Legal Center, W-9 Center, tarjetas, layout o navegación

**Estado final:** LC-9 CERRADO — APROBADO VISUAL Y TÉCNICAMENTE POR EL PRODUCT OWNER

Sin persistencia real · sin producción · sin cumplimiento legal definitivo · LC-10 no iniciado.

---
