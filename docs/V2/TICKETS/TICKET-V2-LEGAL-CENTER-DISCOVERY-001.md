# TICKET-V2-LEGAL-CENTER-DISCOVERY-001

## Estado

**DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Modo | Discovery + documentación — **sin implementación** |
| Fecha | 2026-07-20 |
| Prerequisitos | Governance · Template Engine · Generation 1 Drafting · Signing Workflow · Introduction Registry |
| Portales | `/staff/` · `/artist/` · `/client/` |
| Autorización | Sin TS, HTML, CSS, SQL, API, Edge, runtime, commit, push, merge, PR, deploy |

### Disclaimer

Discovery de producto y arquitectura documental. **No** implementación. Legal Status gates afectan matching/payout — requieren MOD-003 + counsel antes de runtime en producción.

---

## Problema

Signing Workflow (LGS-*) define **cómo se firma**. Falta el **expediente legal unificado** donde cada usuario y staff consulta documentos, estados, cumplimiento, W-9, introducciones anti-bypass e historial — el **Legal Center** como fuente única de verdad visible post-firma.

---

## Relación con capas existentes

```
Generation 1 (LGL/CTR/SPC content)
        ↓
Legal Template Engine (render + field_schema)
        ↓
Signing Workflow (LGS-001…006) — send · sign · PDF
        ↓
Legal Archive (LGS-006) — persistent expediente
        ↓
LEGAL CENTER (LGC-001…007) — read + act UI per portal  ← ESTE TICKET
        ↓
Gates: matching · payout · roster · corporate events (MOD-003 future)
```

| Capa | Ticket | Rol |
|------|--------|-----|
| Content | CONTRACT-DRAFTING-001 | Texto borrador |
| Sign | SIGNING-WORKFLOW-001 | Paquetes y firma |
| **Expediente UI** | **LEGAL-CENTER-001** | Dashboard, library, status |
| Staff ops | SIGNING-WORKFLOW §7 + este ticket §9 | Signing Center + Legal Center staff |

---

# ENTREGABLE 1 — Arquitectura Legal Center

## 1.1 Principio

**Un expediente por identidad legal** (`user_id` + `mdjb_id` + verified `email`), proyectado en tres shells de portal con permisos distintos. Misma data model; distintas vistas y acciones.

## 1.2 Módulos LGC

| ID | Módulo | Responsabilidad | Data source |
|----|--------|-----------------|-------------|
| **LGC-001** | Legal Dashboard | Home legal: status aggregate, action items, expiries | Legal Status + packages pending |
| **LGC-002** | Legal Status | GREEN / YELLOW / RED + item-level badges | Compliance rules engine (conceptual) |
| **LGC-003** | Documents Library | All archived docs per user | LGS-006 Legal Archive |
| **LGC-004** | Signature History | Immutable sign events per document | Audit ledger (signing events) |
| **LGC-005** | Tax & W-9 Center | Fiscal tier isolated UI | SPC-001 instances · FISCAL_CRITICAL |
| **LGC-006** | Compliance Center | Event-type requirement matrix + gaps | LGC-002 + event context |
| **LGC-007** | Introduction Registry Viewer | Anti-bypass introductions (role-filtered) | Introduction Registry |

## 1.3 Ubicación futura por portal

| Portal | Route (propuesto) | Módulos visibles |
|--------|-------------------|------------------|
| **Staff** | `/staff/legal/` | LGC-001–007 full + Signing Center link + roster-wide views |
| **Artist** | `/artist/legal/` | LGC-001–006 (own) · LGC-007 (own introductions) |
| **Client** | `/client/legal/` | LGC-001, 003, 004, 006 (client scope) — **no** W-9 center |

**Vendor / venue (futuro):** token or dedicated portal — subset of Artist legal shell.

## 1.4 Encaje catálogo V2

| MOD propuesto | Legal Center surface |
|---------------|---------------------|
| MOD-319 Staff Legal | Staff Legal Center shell |
| MOD-216 Artist Documents | Artist Legal Center |
| MOD-114 Client Documents | Client Legal Center |
| MOD-410 Legal Documents Service | Backend read models for LGC-* |

## 1.5 Reglas arquitectónicas

| # | Regla |
|---|-------|
| LC-01 | Legal Center es **read-primary**; firma activa delega a Signing Assistant (LGS). |
| LC-02 | W-9 **nunca** en misma lista UI que contratos — LGC-005 separado. |
| LC-03 | Legal Status calculado server-side (future); UI no auto-declara GREEN. |
| LC-04 | Staff ve datos agregados roster; no W-9 full TIN except owner/tax role. |
| LC-05 | Client no ve Introduction Registry performer-side details beyond own agreements. |
| LC-06 | PDF download auditado siempre. |

---

# ENTREGABLE 2 — Legal Dashboard (LGC-001)

## 2.1 Propósito

Primera pantalla al entrar a Legal Center en cualquier portal. Responde: **¿estoy compliant?** **¿qué debo hacer ahora?**

## 2.2 Widgets comunes

| Widget | Contenido |
|--------|-----------|
| **Status banner** | GREEN / YELLOW / RED + one-line explanation |
| **Action required** | Pending signature packages · docs to renew |
| **Expiring soon** | Insurance, licenses, policy version bumps (30/14/7 day) |
| **Recent activity** | Last 5 audit events (sign, download) |
| **Quick links** | Documents · W-9 · Compliance · History |

## 2.3 Variante Staff Dashboard

Adds: org-wide KPIs — pending signatures count · missing W-9 roster · compliance alerts · link Signing Center.

## 2.4 Variante Artist

**MY LEGAL PROFILE** header · roster gate message if RED · link to complete pending package.

## 2.5 Variante Client

**MY DOCUMENTS** header · active event contracts · payment-related legal docs.

## 2.6 Empty states

| State | Message |
|-------|---------|
| New user, no docs | "No legal documents yet — complete onboarding when assigned." |
| All GREEN | "Your legal profile is complete." |
| RED | "Action required before you can {accept bookings|book events|receive payout}." |

---

# ENTREGABLE 3 — Legal Status (LGC-002)

## 3.1 Agregados

| Status | Significado | Platform capabilities (performer-centric; client analog below) |
|--------|-------------|------------------------------------------------------------------|
| **GREEN** | All blocking requirements satisfied | Accept jobs · search/matching visible · payout enabled · corporate events eligible |
| **YELLOW** | Operational with warnings | May operate; banners shown; some corporate tiers blocked |
| **RED** | Blocking deficiency | **No** new job accept · **no** payout · **no** matching · **no** corporate events |

**Precedence:** RED > YELLOW > GREEN (worst wins).

## 3.2 Item-level badges (performer example)

| Item | GREEN | YELLOW | RED |
|------|-------|--------|-----|
| LGL-001 Terms | ✓ current version | ⚠ new version to accept | ✗ not accepted |
| LGL-002 Privacy | ✓ | ⚠ version bump | ✗ missing |
| LGL-003 Anti-Bypass | ✓ | ⚠ re-accept | ✗ not accepted |
| CTR-001 DJ Partner | ✓ signed valid | ⚠ expiring / superseded soon | ✗ missing / void |
| SPC-001 W-9 | ✓ approved | ⚠ pending review | ✗ missing / rejected |
| SPC-002 Insurance | ✓ valid COI | ⚠ expires ≤30 days | ✗ expired / missing when required |
| SPC-003 License | ✓ verified | ⚠ expires ≤30 days | ✗ missing when required |

## 3.3 GREEN — capacidades habilitadas

- Recibir trabajos / aceptar bookings  
- Aparecer en búsquedas y matching (MOD-307)  
- Cobrar / payout release (MOD-209 + LGL-004)  
- Participar en eventos corporativos (when Compliance Center satisfied)

## 3.4 YELLOW — restricciones

- Operación base permitida salvo flags específicos  
- Corporate / festival tiers may require GREEN  
- UI: persistent banner until resolved  
- Examples: insurance expiring in 21 days · one optional doc pending · license renewal window

## 3.5 RED — bloqueos

| Block | Trigger examples |
|-------|------------------|
| No accept new jobs | Anti-Bypass not accepted · CTR-001 void · package incomplete |
| No payout | W-9 missing/rejected · RED tax status |
| No matching visibility | RED aggregate or explicit roster suspend |
| No corporate events | Compliance matrix fail for corporate tier |

## 3.6 Client Legal Status (analog)

| Item | Notes |
|------|-------|
| Client Terms + Privacy | Required for booking |
| Anti-Bypass (client-side) | Required at deposit |
| CTR-006 Event Agreement | Per active order |
| No W-9 center | Clients not payees |

Client RED: cannot pay deposit / access contract portal for new bookings.

## 3.7 Snapshot API (conceptual)

```
legal_status_snapshot(subject_id) → {
  aggregate: GREEN|YELLOW|RED,
  items: [{ code, label, state, expires_at?, blocks[] }],
  capabilities: { matching, payout, corporate, ... },
  computed_at
}
```

Consumed by: Legal Dashboard · roster column · matching gate · payout gate.

---

# ENTREGABLE 4 — Documents Library (LGC-003)

## 4.1 Propósito

Inventario oficial de **todos** los documentos archivados del usuario (post-signature / post-acceptance).

## 4.2 Row schema (UI)

| Column | Source |
|--------|--------|
| Document name | Template title (EN canonical) |
| Internal code | LGL-001, CTR-006, etc. |
| Version | template_version |
| Signed / accepted date | completed_at |
| Status | active · superseded · void · expired |
| Expiration | expires_at if applicable |
| History | link → Signature History filtered |
| Actions | Open · Download PDF |

## 4.3 Filters

Type (Policy / Contract / Special) · Status · Date range · Event/order link · Search by code

## 4.4 Document detail view

- Rendered HTML read-only (mobile/desktop)  
- Metadata panel: instance_id, package_id, audit_id  
- Related Signature History  
- Superseded banner with link to newer version  
- Download PDF (triggers audit)

## 4.5 Exclusions

**W-9 documents listed only in LGC-005**, not in main library list (LC-02). Main library may show badge "Tax docs available in Tax Center."

## 4.6 Staff view

Search any roster member's library (masked W-9) · bulk export for counsel · void/supersede actions via Signing Center (not inline delete).

---

# ENTREGABLE 5 — Signature History (LGC-004)

## 5.1 Propósito

Trail inmutable de **cómo** se firmó cada documento — transparencia estilo banca/seguros.

## 5.2 Record fields (display)

| Field | Shown to user | Notes |
|-------|---------------|-------|
| Date / time | ✓ | UTC + local |
| IP | Hashed partial | e.g. `192.168.*.*` or region only for user view |
| Device | ✓ | Mobile / Desktop / Tablet |
| Browser | ✓ | Truncated UA |
| Language | ✓ | en / es |
| Signed version | ✓ | LGL-003 v1.0 |
| User | ✓ | legal name + email |
| Signature type | ✓ | drawn · typed · checkbox · initials · explicit_confirm |
| Staff counter-sign | ✓ if applicable | MDJB representative |

## 5.3 Views

- Per document (from Library detail)  
- Global chronological (Legal Center → History tab)  
- Export PDF "Certificate of Completion" (future LGS-005 exhibit)

## 5.4 Staff

Full audit fields in Staff Audit Log; Signature History user view is **subset** (privacy).

---

# ENTREGABLE 6 — Tax & W-9 Center (LGC-005)

## 6.1 Propósito

**Isolated fiscal zone** — FISCAL_CRITICAL. Separated navigation, storage projection, and UI from LGC-003.

## 6.2 States

| Badge | Meaning | User action |
|-------|---------|-------------|
| ✓ **W-9 approved** | Staff verified; payout eligible | View masked summary · download own W-9 PDF |
| ⚠ **W-9 pending** | Submitted, Awaiting review | Wait · contact support |
| ⚠ **Review required** | Rejected or expired | Resubmit via Signing package |
| ✗ **Missing** | No W-9 on file | Complete PKG-DJ-ROSTER or tax package |

## 6.3 UI structure

```
TAX & W-9 CENTER
─────────────────
Status: ✓ Approved (last reviewed Jul 10, 2026)

[Download my W-9 PDF]  [Update W-9] (if allowed)

── Separate from public contracts ──
This area contains tax identification information
protected under enhanced security policies.

1099 notice (informational): ...
```

## 6.4 Access matrix

| Role | View | Submit | Approve |
|------|------|--------|---------|
| Artist/DJ own | masked + own PDF | ✓ | — |
| Client | **hidden** | — | — |
| Staff seller | **denied** | — | — |
| Staff manager | masked | — | approve/reject |
| Staff owner | full TIN (audited) | — | approve |

## 6.5 Rules

| # | Rule |
|---|------|
| W9-01 | W-9 PDF never merged into CTR library download-all zip. |
| W9-02 | Update W-9 creates new instance; prior superseded. |
| W9-03 | Legal Status RED if W-9 required and missing. |

---

# ENTREGABLE 7 — Compliance Center (LGC-006)

## 7.1 Propósito

Explain **what is required for which event type** and show gaps vs user's expediente.

## 7.2 Matrices (minimum requirements)

### EVENTOS PRIVADOS (private client events)

| Requirement | Document |
|-------------|----------|
| Contract | CTR-006 or active event agreement |
| Privacy | LGL-002 accepted |
| Anti-Bypass | LGL-003 accepted |

### RESTAURANTES

| Requirement | Document |
|-------------|----------|
| Contract | CTR-004 and/or CTR-006 |
| W-9 | SPC-001 approved (performer/vendor payee) |

### EVENTOS CORPORATIVOS

| Requirement | Document |
|-------------|----------|
| Contract | CTR-005 master and/or CTR-006 |
| W-9 | SPC-001 approved |
| Insurance | SPC-002 valid COI |
| License | SPC-003 if category requires |

### FESTIVALES

| Requirement | Document |
|-------------|----------|
| Contract | CTR-006 + venue/festival addendum |
| W-9 | SPC-001 approved |
| Insurance | SPC-002 enhanced limits (TBD PO) |
| Additional | SPC-005 media release · rider exhibits · SPC-004 if exclusive stage |

## 7.3 UI

- Selector: event type I'm targeting  
- Checklist with ✓ / ⚠ / ✗ per requirement  
- CTA: "Complete pending items" → Signing package or Legal Center action  
- Corporate/festival may show **YELLOW** allowed but item flagged until GREEN for tier

## 7.4 Staff Compliance Center

Roster filter: who fails corporate matrix · bulk send reminder packages

---

# ENTREGABLE 8 — Introduction Registry Viewer (LGC-007)

## 8.1 Propósito

Human-readable view of anti-bypass **Introduction** records — who was introduced to whom, when, protection status.

## 8.2 Display card (example PO)

```
┌────────────────────────────────────────────────────────────┐
│ INTRODUCTION #INT-2026-00421                               │
├────────────────────────────────────────────────────────────┤
│  Miami DJ Beat LLC                                         │
│       ↓ presenta                                           │
│  Cliente: Mojitos Calle 8 (restaurant)                     │
│       ↔                                                    │
│  Artista: DJMago305 (Gerardo A Valle)                      │
├────────────────────────────────────────────────────────────┤
│  Fecha introducción:  2026-07-21                           │
│  Origen:              Miami DJ Beat — event booking        │
│  Evidencia:           ORDER-8842 · CTR-006                 │
│  Protección:          ● Activa                             │
│  Expiración:          2028-07-21 (24 meses)                │
│  Estado:              active                               │
└────────────────────────────────────────────────────────────┘
```

## 8.3 Role visibility

| Viewer | Sees |
|--------|------|
| Performer | Introductions where they are performer |
| Client | Introductions where they are counterparty (limited) |
| Staff | Full registry · filters · waiver action link |
| Client | No other performers' introductions |

## 8.4 Actions (staff only)

Issue waiver · mark disputed · link to package · export for counsel

## 8.5 Performer read-only

Educational copy: "These relationships are protected under Anti-Bypass Policy (LGL-003)."

---

# ENTREGABLE 9 — Staff Legal Center

## 9.1 Navigation

**Staff → LEGAL** (parent)  
├── **Legal Center** (this ticket — expediente & compliance)  
└── **Signing Center** (SIGNING-WORKFLOW — send & monitor packages)

## 9.2 Sections

| Section | LGC module | Content |
|---------|------------|---------|
| **Overview** | LGC-001 | KPIs · alerts · quick actions |
| **Pending Signatures** | link LGS | Packages WAITING_SIGNATURE + user pending |
| **Missing W-9** | LGC-005 | Roster filter RED/W-9 missing |
| **Expired Insurance** | LGC-006 | SPC-002 expiry ≤0 |
| **Corporate Restrictions** | LGC-006 | Fail corporate matrix |
| **Compliance Alerts** | LGC-002 | YELLOW/RED roster counts |
| **Introduction Registry** | LGC-007 | Full table + filters |
| **Audit Log** | LGC-004 + signing audit | Export · search |

## 9.3 Roster legal column

Quick badge GREEN/YELLOW/RED · click → staff view of user's Legal Center (read-only impersonation audit).

## 9.4 Permissions

Align SIGNING-WORKFLOW staff matrix · seller: Overview (limited), Pending (read), Compliance Alerts (read) · no W-9 full · no waiver

---

# ENTREGABLE 10 — Artist Legal Center

## 10.1 Branding

**MY LEGAL PROFILE** — `/artist/legal/`

## 10.2 Tabs

| Tab | Module |
|-----|--------|
| Dashboard | LGC-001 |
| Documents | LGC-003 |
| Tax & W-9 | LGC-005 |
| Compliance | LGC-006 |
| Introductions | LGC-007 |
| History | LGC-004 |

## 10.3 Primary actions

- **Firmar** pending package (→ Signing Assistant)  
- **Descargar** PDF  
- **Actualizar** expired insurance / license / W-9  
- **Ver historial** per document  

## 10.4 Mobile

Bottom nav: Status · Docs · Tax · More  
Sticky RED banner with CTA to resolve

## 10.5 Gate messages

| Status | Banner |
|--------|--------|
| RED | "Complete legal requirements to accept bookings." |
| YELLOW | "Insurance expires in 14 days — update now." |
| GREEN | Hidden or subtle checkmark |

---

# ENTREGABLE 11 — Client Legal Center

## 11.1 Branding

**MY DOCUMENTS** — `/client/legal/`

## 11.2 Tabs

| Tab | Module |
|-----|--------|
| Dashboard | LGC-001 |
| My Contracts | LGC-003 filtered CTR + auths |
| Authorizations | SPC-005 releases signed |
| History | LGC-004 |

**Excluded:** LGC-005 W-9 · LGC-007 (performer introductions) — client sees own anti-bypass acceptance in Policies subsection only.

## 11.3 Content focus

- CTR-006 Event Service Agreements per order  
- LGL policies accepted (Terms, Privacy, Payment, Cancellation)  
- Signed authorizations (photo/video)  
- Download receipts / contract PDFs  

## 11.4 Client actions

Open document · Download · Sign pending (deposit gate) · Request copy via support

---

# ENTREGABLE 12 — Auditoría

## 12.1 Events (Legal Center scope)

Extends Signing Workflow audit with **read/download** events:

| Event | Trigger |
|-------|---------|
| `legal_center.viewed` | Enter Legal Center |
| `document.opened` | Open in library |
| `document.downloaded` | PDF download |
| `w9_center.viewed` | Enter LGC-005 |
| `w9.downloaded` | W-9 PDF download |
| `compliance.checked` | User views compliance matrix |
| `introduction.viewed` | View introduction card |
| `status.queried` | Gate checks snapshot (system) |
| `staff.roster_legal_view` | Staff views user expediente |

Plus inherited: creation · sign · reject · expire · supersede · resend · revoke (from LGS).

## 12.2 Retention

7+ years · W-9 events without TIN payload · staff full TIN view = distinct audited event

## 12.3 User-facing History

LGC-004 shows user-appropriate subset; Staff Audit Log shows full chain.

---

# ENTREGABLE 13 — Roadmap futuro

| Phase | ID | Entregable | Gate |
|-------|-----|------------|------|
| Discovery | **LC-0** | This ticket | PO approve |
| UX Mockups | **LC-1** | Figma/wireframes Staff + Artist + Client Legal Center | PO visual |
| Data Contracts | **LC-2** | TypeScript interfaces read-only · `LegalExpedienteSnapshot` · MOD-410 spec | Architect |
| Runtime | **LC-3** | Portal routes mock data · Legal Status computer mock | Lab QA |
| PDF Engine | **LC-4** | LGS-005 integration · download in LGC-003 | Hash tests |
| Production | **LC-5** | Postgres RLS · gates MOD-003 · cutover | Counsel + APROBADO DEPLOY |

**Dependencies:** LC-2 after SIGNING-WORKFLOW SW-1; LC-3 parallel Staff Phase 11+; LC-5 red zone.

---

# ENTREGABLE 14 — Riesgos pendientes

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| RC-01 | Legal Status false GREEN client-side | Crítica | Server snapshot only |
| RC-02 | W-9 visible in contract list leak | Crítica | LGC-005 separation enforced |
| RC-03 | Staff seller sees fiscal data | Alta | Permission matrix |
| RC-04 | Introduction viewer educates bypass | Media | Copy approved by counsel |
| RC-05 | Compliance matrix wrong for event type | Alta | PO sign-off per tier |
| RC-06 | Download audit volume | Baja | Async log · retention policy |
| RC-07 | Client/performer status confusion | Media | Separate item catalogs |
| RC-08 | Stale superseded docs shown active | Alta | Status sync from archive |
| RC-09 | i18n labels in Legal Center | Media | EN canonical keys MOD-015 |
| RC-10 | Impersonation by staff unlogged | Alta | `staff.roster_legal_view` audit |

---

## Mapa entregables → módulos LGC

| Entregable | LGC |
|------------|-----|
| 2 Dashboard | LGC-001 |
| 3 Legal Status | LGC-002 |
| 4 Documents Library | LGC-003 |
| 5 Signature History | LGC-004 |
| 6 Tax & W-9 | LGC-005 |
| 7 Compliance | LGC-006 |
| 8 Introduction Viewer | LGC-007 |
| 9–11 Portal shells | LGC-001–007 composed per role |

---

## Wireframe ASCII — Artist Legal Center (desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│ MY LEGAL PROFILE          Legal Status: ● GREEN                  │
├────────────┬─────────────────────────────────────────────────────┤
│ Dashboard  │  ⚠ ACTION: PACKAGE-2026-002 · 2/5 · [Continue]    │
│ Documents  │  ─────────────────────────────────────────────    │
│ Tax & W-9  │  ✓ CTR-001 DJ Partner v1.0 · Jul 1 · [Download]    │
│ Compliance │  ✓ LGL-003 Anti-Bypass · Jul 1                     │
│ Introduct. │  ✓ W-9 Approved · see Tax Center                   │
│ History    │                                                    │
└────────────┴─────────────────────────────────────────────────────┘
```

---

## Fuera de alcance

Implementación · código · DB · API · runtime · commit · deploy.

---

## Referencias

| Documento |
|-----------|
| `TICKET-V2-LEGAL-SIGNING-WORKFLOW-DISCOVERY-001` |
| `TICKET-V2-LEGAL-GOVERNANCE-FOUNDATION-001` |
| `TICKET-V2-LEGAL-CONTRACT-DRAFTING-001` |
| `docs/V2/LEGAL/README.md` |

---

## Criterio de cierre

| Criterio | Estado |
|----------|--------|
| 14 entregables | ✅ |
| 7 módulos LGC-001–007 | ✅ |
| GREEN / YELLOW / RED | ✅ |
| Staff / Artist / Client centers | ✅ |
| Roadmap LC-0–LC-5 | ✅ |
| Implementación | ❌ no autorizada |

**ESTADO FINAL: DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER.**

**DETENERSE.**
