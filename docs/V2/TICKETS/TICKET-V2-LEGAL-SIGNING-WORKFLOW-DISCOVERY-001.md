# TICKET-V2-LEGAL-SIGNING-WORKFLOW-DISCOVERY-001

## Estado

**DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Modo | Discovery + documentación — **sin implementación** |
| Fecha | 2026-07-20 |
| Prerequisitos | Generation 1 legal library (`docs/V2/LEGAL/**`) · Governance Foundation · Contract Drafting |
| Jurisdicción diseño | Florida, USA — Miami DJ Beat LLC |
| Integración externa | **NO** — flujo nativo MDJB únicamente (sin DocuSign/Adobe/etc. en esta fase) |
| Autorización | Sin TS, HTML, CSS, SQL, API, Edge, runtime, commit, push, merge, PR, deploy |

### Disclaimer

Este discovery describe **experiencia de producto y arquitectura conceptual**. No constituye implementación ni asesoría legal. ESIGN/UETA disclosures y retención de evidencia requieren validación counsel antes de runtime.

---

## Problema

Generation 1 definió **qué** documentos existen y **qué** campos contienen. Falta diseñar **cómo** clientes, DJs, artistas, vendors, venues y empresas los reciben, revisan, aceptan y firman — en desktop y móvil — con expediente, Legal Status, PDF final y auditoría, comparable en claridad a flujos de concesionarios, bancos, aseguradoras y onboarding empresarial, **sin** depender aún de proveedores externos.

---

## Relación con artefactos existentes

| Artefacto | Relación con Signing Workflow |
|-----------|------------------------------|
| `docs/V2/LEGAL/**` (LGL/CTR/SPC) | Contenido renderizado por Template Engine |
| Legal Template Engine (`LEGAL/README.md`) | `template_id`, `field_schema`, `signature_plan` |
| Introduction Registry | Trigger post-CTR-006 / package completion |
| Legal Status (Governance §8.4) | Actualizado por LGS-004 + LGS-006 |
| Document lifecycle (Governance) | `DRAFT`→`READY_TO_SEND` = staff prep; **Signing lifecycle** (este ticket) = post-send |
| MOD-410 / MOD-319 (propuestos) | Hosting futuro de servicios LGS-* |

### Dos capas de ciclo de vida (no confundir)

| Capa | Ámbito | Estados clave |
|------|--------|---------------|
| **Document Instance** (Governance) | Un documento LGL/CTR/SPC emitido | DRAFT … COMPLETED · VOIDED |
| **Signature Package** (este ticket) | Bundle multi-documento para un signatario | CREATED … COMPLETED · EXPIRED |

Un **Signature Package** agrupa N document instances con progreso unificado (`3/5`).

---

# ENTREGABLE 1 — Arquitectura Signing Workflow

## 1.1 Vista de sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         STAFF — LEGAL → SIGNING CENTER                   │
│  Draft Packages · Send · Monitor · Void · Resend · Audit               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                    LGS-003 Signature Package Engine
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 LGS-001 Signing          LGS-002 Secure           LGS-004 Acceptance
 Session Manager          Link Delivery            Workflow
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                    Signing Assistant (10 screens)
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
     FLUJO A — authenticated              FLUJO B — token /sign/{token}
     Legal Center (portal)                 Minimal signing shell
              │                                   │
              └─────────────────┬─────────────────┘
                                ▼
              LGS-005 Final Artifact Generator → PDF
                                ▼
              LGS-006 Legal Archive + Legal Status update
                                ▼
              Introduction Registry · Audit Ledger · Expediente
```

## 1.2 Módulos LGS (Signing Layer)

| ID | Nombre | Responsabilidad |
|----|--------|-----------------|
| **LGS-001** | Signing Session Manager | Sesión única por paquete/signatario; estado wizard; idempotencia; resume |
| **LGS-002** | Secure Link Delivery | Token opaco, TTL, delivery email/SMS stub, reenvío, revocación |
| **LGS-003** | Signature Package Engine | Composición paquete, orden documentos, progreso N/M, dependencias |
| **LGS-004** | Acceptance Workflow | Políticas LGL-* · checkbox · initials · ESIGN disclosure |
| **LGS-005** | Final Artifact Generator | PDF merged + per-doc · hash · print layout A4 |
| **LGS-006** | Legal Archive | Expediente persistente · Legal Center feed · retention |

**Ubicación futura propuesta:** `shared/services/legal/signing/` (LGS-001–006) · UI Staff `staff/legal/signing/` · UI User `*/legal-center/` por portal.

## 1.3 Principios UX (paridad industria)

| Principio | Referencia industria | MDJB |
|-----------|---------------------|------|
| Guided wizard | Banco / concesionario | 10 pantallas fijas, progreso visible |
| Package progress | Onboarding empresarial | `3/5 documentos` |
| Review before sign | Aseguradora | Vista previa completa scroll + jump to section |
| Identity step | Dealer F&I | Email match · OTP fase 2 opcional |
| Completion certificate | E-sign platforms | Pantalla final + PDF + email copy |
| Mobile-first touch | Universal | Canvas signature ≥44px targets |
| No dead-ends | Enterprise | Resume session · expiry warning |

## 1.4 Canales

| Canal | Flujo | Shell UI |
|-------|-------|----------|
| Client Portal | A | Full Legal Center + signing assistant |
| Artist Portal | A | Full Legal Center + W-9 secure subflow |
| Staff (counter-sign) | A | Signing Center pending queue |
| Public `/sign/{token}` | B | Minimal MDJB branded shell — no full portal nav |
| Email deep link | B | Opens Flujo B |

---

# ENTREGABLE 2 — Signing Session

## 2.1 Definición

Una **Signing Session** es la unidad runtime (conceptual) que vincula **un signatario** + **un Signature Package** + **un dispositivo/navegador** durante el wizard de firma.

## 2.2 Schema conceptual

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | UUID | Primary |
| `package_id` | UUID | FK Signature Package |
| `signer_id` | UUID | Assigned party |
| `auth_mode` | enum | `account` \| `token` |
| `user_id` | UUID nullable | Set when authenticated |
| `token_id` | UUID nullable | Set when Flujo B |
| `wizard_step` | 1–10 | Last completed screen |
| `status` | enum | `active` \| `paused` \| `completed` \| `expired` \| `voided` |
| `device_fingerprint_hash` | string | Non-PII device class |
| `ip_hash` | string | Hashed IP |
| `user_agent` | string | Truncated |
| `locale` | en \| es | Active language |
| `started_at` | timestamp | OPENED→STARTED |
| `completed_at` | timestamp nullable | COMPLETED |
| `resume_secret_hash` | string nullable | Optional resume on same device |

## 2.3 Reglas LGS-001

| # | Regla |
|---|-------|
| SS-01 | Una sesión **activa** por signer+package; nueva sesión invalida resume anterior salvo staff reset. |
| SS-02 | Wizard no salta pasos obligatorios (identity, disclosure, summary). |
| SS-03 | Autosave progreso por documento dentro del paquete. |
| SS-04 | Session `completed` solo cuando package → COMPLETED para ese signer. |
| SS-05 | Token sessions no crean cuenta; opcional link post-completion. |

## 2.4 Mapeo wizard → session

| Step | Screen | Session mutation |
|------|--------|------------------|
| 1 | Welcome | `DELIVERED`→`OPENED` on first paint |
| 2 | Identity | Verify email / account match |
| 3 | Document list | Load package manifest |
| 4–7 | Preview / sign / initials / checkbox | Per-doc `IN_PROGRESS` |
| 8 | Summary | Read-only review |
| 9 | Confirm | Explicit confirm tap |
| 10 | Done | `COMPLETED` + trigger LGS-005 |

---

# ENTREGABLE 3 — Signature Package

## 3.1 Definición

Un **Signature Package** es un bundle versionado de documentos legales enviados juntos a un destinatario con progreso unificado.

## 3.2 Schema conceptual

| Field | Type | Description |
|-------|------|-------------|
| `package_id` | UUID | Primary |
| `package_code` | string | Human: `PACKAGE-2026-001` |
| `recipient_email` | string | Delivery target |
| `recipient_legal_name` | string | Display + validation |
| `recipient_role` | enum | client · dj · artist · vendor · venue · corporate |
| `recipient_user_id` | UUID nullable | Pre-linked account |
| `recipient_mdjb_id` | string nullable | MDJB-C/A/… |
| `created_by_staff_id` | UUID | Issuer |
| `order_id` | UUID nullable | CTR-006 context |
| `lead_id` | UUID nullable | CRM context |
| `status` | enum | Signing lifecycle (§7) |
| `document_count` | number | Total docs |
| `completed_count` | number | Signed/accepted docs |
| `expires_at` | timestamp | Package TTL |
| `supersedes_package_id` | UUID nullable | Prior version |
| `items[]` | array | Ordered manifest |

## 3.3 Package item

| Field | Description |
|-------|-------------|
| `item_order` | 1..N sequence |
| `template_code` | LGL-003, CTR-001, SPC-001, etc. |
| `instance_id` | Rendered document instance |
| `item_status` | pending · viewed · accepted · signed · skipped_denied |
| `signature_plan` | From Template Engine |
| `requires_staff_countersign` | boolean |

## 3.4 Ejemplo PO

```
PACKAGE-2026-001
Recipient: DJ Marco Reyes · marco@example.com
Documents: 5
  1. LGL-002 Privacy Policy        ✓ accepted
  2. LGL-001 Terms of Service    ✓ accepted
  3. LGL-003 Anti-Bypass Policy    ✓ accepted + initials
  4. CTR-001 DJ Partner Agreement  ✓ signed
  5. SPC-001 W-9 Package           ○ pending
Status: IN_PROGRESS
Progress: 4 / 5
Expires: 2026-08-03
```

## 3.5 Plantillas de paquete (Staff presets)

| Preset ID | Audience | Typical contents |
|-----------|----------|------------------|
| `PKG-DJ-ROSTER` | New DJ | LGL-001,002,003,006 + CTR-001 + SPC-001 |
| `PKG-CLIENT-BOOKING` | Client deposit | LGL-001,004,005 + CTR-006 |
| `PKG-VENDOR-EVENT` | Vendor | CTR-003 + SPC-002 + SPC-003 |
| `PKG-VENUE` | Venue | CTR-004 + LGL-003 acknowledgment |
| `PKG-CORPORATE` | B2B | LGL-* + CTR-005 + CTR-006 |
| `PKG-CUSTOM` | Staff-built | Free selection from published templates |

## 3.6 Reglas LGS-003

| # | Regla |
|---|-------|
| PK-01 | Orden fijo: políticas LGL antes de CTR principal antes de SPC fiscal. |
| PK-02 | W-9 nunca en mismo PDF merge que contratos públicos — artifact separado. |
| PK-03 | Void package → void all pending instances; completed instances remain archived. |
| PK-04 | Supersede creates new package; old → SUPERSEDED read-only. |

---

# ENTREGABLE 4 — Flujo usuario con cuenta (Flujo A)

## 4.1 Secuencia

```
Staff Signing Center
  → New Package (preset or custom)
  → Fill dynamic fields / link order
  → Review manifest
  → Send (DELIVERED)
       ├─ In-app notification (MOD-011 future)
       └─ Email stub with portal deep link

User
  → Login (MOD-001)
  → Legal Center badge "⚠ 1 package pending"
  → Open PACKAGE-2026-001
  → Signing Assistant (10 screens)
  → Complete all items
  → Package COMPLETED

System
  → LGS-005 generates PDF(s)
  → LGS-006 archives to expediente
  → Legal Status items → ✓
  → Introduction Registry if CTR-006 included
  → Audit events appended
  → Staff queue: counter-sign if WAITING_SIGNATURE
```

## 4.2 Legal Center entry points

| Portal | Path (futuro) | Gates unblocked |
|--------|---------------|-----------------|
| Client | `/client/legal` | Deposit, contract view |
| Artist | `/artist/legal` | Roster, booking accept, payout |
| Vendor | token or future vendor portal | Event access |

## 4.3 Counter-signature (MDJB)

When `requires_staff_countersign`:

1. User signer → `SIGNED` (user portion complete)  
2. Package → `WAITING_SIGNATURE`  
3. Staff Signing Center → Pending Signature queue  
4. Management signs → `COMPLETED`  

---

# ENTREGABLE 5 — Flujo usuario sin cuenta (Flujo B)

## 5.1 Secuencia

```
Staff → Create package with email only (no user_id)
  → LGS-002 generates token + delivery URL
  → Email: "Complete your Miami DJ Beat documents"
  → Link: https://{root}/sign/{opaque_token}

Recipient
  → Opens link (mobile or desktop)
  → Welcome + email confirmation (type email or OTP phase 2)
  → Signing Assistant (same 10 screens, minimal chrome)
  → Complete → PDF download link + email copy

System
  → Expediente keyed by email + package_id
  → Optional: "Create account to access anytime"
  → On future signup with verified same email:
        legal_link_pending_packages(email, user_id)
  → Introduction Registry if applicable
```

## 5.2 Flujo B constraints

| # | Constraint |
|---|------------|
| B-01 | No portal navigation — signing shell only. |
| B-02 | Token bound to `recipient_email` — mismatch blocks step 2. |
| B-03 | W-9 allowed Flujo B with enhanced step 2 (identity). |
| B-04 | Completed PDF available 72h via token; then account or staff resend. |

---

# ENTREGABLE 6 — Legal Center (panel usuario)

## 6.1 Layout conceptual

```
┌─────────────────────────────────────────────────────────────┐
│  LEGAL CENTER                                    [EN | ES]  │
├─────────────────────────────────────────────────────────────┤
│  Legal Status:  ● GREEN  (or YELLOW / RED aggregate)        │
├─────────────────────────────────────────────────────────────┤
│  ⚠ ACTION REQUIRED                                          │
│  PACKAGE-2026-001 · 3/5 complete · Expires Aug 3  [Firmar] │
├─────────────────────────────────────────────────────────────┤
│  ✓ COMPLETED                                                │
│  CTR-006 Event #ORD-4421 · Signed Jul 1  [Download]         │
│  LGL-003 Anti-Bypass v1.0 · Accepted Jun 15                 │
├─────────────────────────────────────────────────────────────┤
│  POLICIES ACCEPTED                                          │
│  Privacy ✓ · Terms ✓ · Payment ✓ · Cancellation ✓           │
├─────────────────────────────────────────────────────────────┤
│  COMPLIANCE                                                 │
│  W-9 ✓ Approved · Insurance ⚠ Expires Sep 1 [Update]        │
├─────────────────────────────────────────────────────────────┤
│  [View History]  [Download All]  [Contact Support]          │
└─────────────────────────────────────────────────────────────┘
```

## 6.2 Acciones por fila

| Estado | Botones |
|--------|---------|
| Pending package | **Firmar** · Ver detalle |
| In progress | **Continuar** |
| Completed | **Abrir** · **Descargar PDF** |
| Expired | **Solicitar reenvío** (→ staff) |
| Policy version bump | **Actualizar** (re-accept) |

## 6.3 Mobile

- Single column · sticky CTA "Firmar" · canvas signature full-width  
- Document preview: scroll with section jump menu  
- Progress bar `3/5` pinned below header  

## 6.4 Desktop

- Split view optional: document left · sign panel right (dealer-style)  
- Print preview before confirm step  

---

# ENTREGABLE 7 — Staff Signing Center

## 7.1 Navegación

**Staff → LEGAL → SIGNING CENTER**

| Section | Filter status | Actions |
|---------|---------------|---------|
| **Draft Packages** | CREATED | Edit · Send · Delete draft |
| **Sent** | DELIVERED | Resend · Void |
| **Viewed** | OPENED | Remind |
| **In Progress** | STARTED, IN_PROGRESS | View progress · Nudge |
| **Pending Signature** | WAITING_SIGNATURE | **Counter-sign** · Reassign |
| **Completed** | COMPLETED | Download PDF · View audit |
| **Expired** | EXPIRED | Resend (new token) · Extend TTL |
| **Voided** | VOIDED | View reason |
| **Audit Log** | all | Export · Filter by package/signer |

## 7.2 Send wizard (Staff)

1. Select recipient (CRM / roster / email)  
2. Choose preset or custom documents  
3. Pre-fill fields from order/profile  
4. Set expiry (default 14 days)  
5. Preview manifest  
6. Confirm send → DELIVERED  

## 7.3 Permissions

| Action | seller | manager | owner |
|--------|--------|---------|-------|
| View queues | limited | ✓ | ✓ |
| Create/send package | ❌ | ✓ | ✓ |
| Void | ❌ | ✓ | ✓ |
| Counter-sign | ❌ | ✓ | ✓ |
| Resend / extend TTL | ❌ | ✓ | ✓ |
| Audit export | ❌ | ✓ | ✓ |

## 7.4 Dashboard widgets

- Packages expiring in 48h  
- Counter-sign backlog  
- Avg time to complete  
- Drop-off by wizard step (analytics future)  

---

# ENTREGABLE 8 — Seguridad (tokens y enlaces)

## 8.1 Token design (conceptual — NO implementación)

| Property | Specification |
|----------|---------------|
| Format | Opaque URL-safe string ≥ 256 bits entropy |
| Storage | Only **hash** stored server-side |
| URL | `/sign/{token}` — token never in query string |
| TTL default | 14 days (configurable 1–30) |
| Binding | `recipient_email` + `package_id` |
| Single-active | New resend rotates token; prior invalidated |
| Rate limit | 5 failed opens / hour / IP |
| HTTPS | Required |
| Referrer-Policy | `no-referrer` |
| Indexing | `noindex, nofollow` on signing pages |

## 8.2 Expiración y recuperación

| Scenario | Behavior |
|----------|----------|
| TTL reached | Package → EXPIRED; no signing; staff resend |
| User lost email | Staff resend from Sent/Expired |
| Wrong email on package | Void + recreate |
| Partial complete | Resume while token valid |
| Suspected leak | Staff void + invalidate token immediately |

## 8.3 Acceso único vs resume

- **Not** single-use open — user may resume until complete or expiry  
- **Single completing signer** — one completed signature set per role per package version  
- Token rotation on resend prevents old link use  

## 8.4 Identity verification tiers

| Tier | Flujo | Method |
|------|-------|--------|
| T0 | Flujo A logged-in | Session auth |
| T1 | Flujo B default | Email re-type match |
| T2 | Flujo B high-risk (W-9, corp) | Email OTP (future) |
| T3 | Staff override | Manual verify + audit note |

## 8.5 ESIGN disclosure (LGS-004)

Screen 2 or 9 must include: consent to electronic records, right to paper copy, withdrawal consequences, hardware/software requirements, how to update contact info.

---

# ENTREGABLE 9 — Auditoría

## 9.1 Event catalog

| Event | Trigger | Actor | Key fields |
|-------|---------|-------|------------|
| `package.created` | Staff saves draft | staff_id | package_code, doc list |
| `package.sent` | Send click | staff_id | delivery_channel |
| `package.delivered` | Email/link generated | system | token_id hash |
| `package.opened` | Step 1 load | signer/token | ip_hash, ua, device |
| `package.started` | Identity passed | signer | auth_mode |
| `package.progress` | Doc completed | signer | item_order, template_code |
| `document.viewed` | Preview opened | signer | instance_id, page_time |
| `acceptance.recorded` | Checkbox LGL | signer | clause_ids, version |
| `initial.applied` | Initials canvas | signer | section_id |
| `signature.applied` | Full signature | signer | method draw/type, sig_hash |
| `signer.rejected` | Decline to sign | signer | reason optional |
| `package.waiting_countersign` | User done | system | — |
| `platform.signed` | Staff counter | staff_id | — |
| `package.completed` | All done | system | pdf_hash |
| `package.expired` | TTL job | system | — |
| `package.voided` | Staff void | staff_id | reason_code |
| `package.superseded` | New package | staff_id | new_package_id |
| `artifact.generated` | LGS-005 | system | sha256, page_count |
| `artifact.downloaded` | User download | actor | instance_id |
| `link.resent` | Staff resend | staff_id | old_token_revoked |
| `session.resumed` | Return visit | signer | session_id |

## 9.2 Audit record shape

```
audit_id, event_type, timestamp_utc, package_id, session_id,
actor_type, actor_id_hash, ip_hash, user_agent_trunc,
document_code, document_version, locale, payload_json (no PII raw)
```

## 9.3 Retention

Align LGL-002 and Governance: 7+ years agreements; W-9 events without TIN in payload.

## 9.4 Staff Audit Log UI

Filterable table in Signing Center · export CSV for counsel · integrate MOD-316 read model.

---

# ENTREGABLE 10 — Roadmap técnico futuro

| Phase | ID | Scope | Depends on | Gate |
|-------|-----|-------|------------|------|
| **SW-0** | Discovery | This ticket | Generation 1 legal | PO approve |
| **SW-1** | Spec | `LEGAL-SIGNING-SPEC.md` + LGS module specs | SW-0 | Counsel ESIGN |
| **SW-2** | Mock package engine | In-memory packages, no DB | MOD-410 spec | Unit tests |
| **SW-3** | Signing Assistant UI mock | 10 screens static | MOD-009 components | PO visual |
| **SW-4** | Flujo A wiring | Legal Center + session resume | MOD-001, MOD-114/216 | QA |
| **SW-5** | Flujo B shell | `/sign/{token}` page | LGS-002 spec | Security review |
| **SW-6** | Signature capture | Canvas, typed, initials, checkbox | SW-3 | Device QA |
| **SW-7** | PDF artifacts | LGS-005 merge rules | Template Engine | Hash validation |
| **SW-8** | Archive + Legal Status | LGS-006 expediente | Governance Legal Status | Integration |
| **SW-9** | Staff Signing Center | MOD-319 extension | MOD-003 permissions | Staff PO |
| **SW-10** | Email delivery | LGS-002 production | Edge ticket (separate) | **Not in SW scope now** |
| **SW-11** | Postgres + RLS | Persistent packages/sessions | Red zone ADR | Counsel |
| **SW-12** | OTP identity T2 | High-risk packages | SW-5 | Security |
| **SW-13** | External provider eval | DocuSign etc. | SW-7 stable | PO decision |

**Explicitly out of scope until separate ticket:** Supabase, Edge, API, Stripe, external e-sign SaaS.

---

# ENTREGABLE 11 — Riesgos pendientes

| ID | Riesgo | Sev. | Mitigación diseño |
|----|--------|------|-------------------|
| RS-01 | ESIGN consent inadequate | Alta | Counsel-reviewed disclosure screens (LGS-004) |
| RS-02 | Token leak / forwarding | Alta | TTL, rotate, email bind, void |
| RS-03 | Signature repudiation | Alta | Audit trail + intent screens + summary confirm |
| RS-04 | Mobile canvas unusable | Media | Typed signature fallback always available |
| RS-05 | Package drop-off mid-flow | Media | Resume + reminders + progress save |
| RS-06 | W-9 in Flujo B | Alta | T2 OTP + FISCAL_CRITICAL path |
| RS-07 | Dual lifecycle confusion | Media | Document vs Package status docs |
| RS-08 | Counter-sign bottleneck | Media | Staff alerts · delegate owner |
| RS-09 | i18n ES parity | Media | EN canonical; ES after counsel |
| RS-10 | PDF merge W-9 leakage | Crítica | Separate artifact rule PK-02 |
| RS-11 | Account linking wrong person | Alta | Verified email only |
| RS-12 | Accessibility (a11y) | Media | Keyboard path for checkbox/typed sign |

---

## Signing Assistant — 10 pantallas (detalle)

| # | Screen | Purpose | Required elements |
|---|--------|---------|-------------------|
| 1 | **Welcome** | Orient user | Package code, doc count, expiry, MDJB branding, Continue |
| 2 | **Identity** | Verify signer | Email confirm / logged-in display, ESIGN disclosure intro |
| 3 | **Document list** | Manifest | Ordered list, status icons, progress N/M |
| 4 | **Preview** | Read document | Scroll full doc, jump links, time-on-doc audit |
| 5 | **Signature** | Full sign | Draw / type toggle, legal name prefill |
| 6 | **Initials** | Section initials | Per signature_plan sections (e.g. Anti-Bypass §6) |
| 7 | **Checkboxes** | Mandatory accepts | Per-clause checkboxes, none pre-checked |
| 8 | **Summary** | Review all actions | List signatures, initials, checks — edit links |
| 9 | **Confirm** | Intent | "I agree to sign all documents listed" + Confirm button |
| 10 | **Complete** | Done | Success, download PDF, portal link, support |

**Navigation:** Back allowed until Confirm; Confirm irreversible for that document item.

---

## Elementos de firma — registro

| Element | Capture | Audit fields |
|---------|---------|--------------|
| Drawn signature | Canvas PNG/SVG vector | `sig_hash`, dimensions, stroke count |
| Typed signature | Font render of legal name | `typed_text`, font_id |
| Initials | 2–4 chars or mini canvas | `section_id`, `initial_hash` |
| Checkbox | Clause ID + checked state | `clause_id`, `template_version` |
| Explicit confirm | Button tap | `confirm_text`, timestamp |

**Common metadata (all):** `utc_timestamp`, `ip_hash`, `user_agent`, `device_class`, `document_version`, `locale`, `user_id|email`, `session_id`, `package_id`.

---

## Ciclo de vida — Signature Package

```
CREATED (staff draft)
  → DELIVERED (send)
  → OPENED (link/portal first view)
  → STARTED (identity OK)
  → IN_PROGRESS (≥1 doc touched)
  → WAITING_SIGNATURE (user done; MDJB counter pending) [optional]
  → SIGNED (all signers; pre-PDF)
  → COMPLETED (PDF archived)
  
Terminals: EXPIRED · VOIDED · SUPERSEDED
```

| State | Meaning |
|-------|---------|
| CREATED | Draft package, not sent |
| DELIVERED | Sent; no open yet |
| OPENED | First view |
| STARTED | Identity step passed |
| IN_PROGRESS | Partial completion |
| WAITING_SIGNATURE | Awaiting MDJB counter-sign |
| SIGNED | All signatures captured; PDF pending |
| COMPLETED | Artifacts in Legal Archive |
| EXPIRED | TTL exceeded |
| VOIDED | Staff invalidated |
| SUPERSEDED | Replaced by newer package |

---

## Compatibilidad Template Engine

| Engine concept | Signing Workflow use |
|----------------|---------------------|
| `template_id` | Package item manifest |
| `signature_plan` | Drives screens 5–7 per document |
| `field_schema` | Pre-filled before send; read-only in preview unless recipient fields |
| `render_profile` | Preview = mobile/desktop; PDF = a4_print |
| `clause_blocks` | Checkbox map in LGS-004 |

---

## Fuera de alcance

Implementación · código · SQL · API · Edge · Supabase · email runtime · proveedores e-sign externos · commit · deploy.

---

## Referencias

| Documento | Relación |
|-----------|----------|
| `docs/V2/LEGAL/README.md` | Template Engine · visual shell |
| `TICKET-V2-LEGAL-GOVERNANCE-FOUNDATION-001` | Legal Status · Staff Legal panel |
| `TICKET-V2-LEGAL-CONTRACT-DRAFTING-001` | LGL/CTR/SPC content |
| `TICKET-V2-LEGAL-CONTRACTS-DISCOVERY-001` | Instance model · Flujos A/B baseline |

---

## Criterio de cierre

| Criterio | Estado |
|----------|--------|
| 11 entregables | ✅ |
| 6 módulos LGS-001–006 | ✅ |
| Flujos A y B | ✅ |
| Signature Package concept | ✅ |
| 10-screen assistant | ✅ |
| Lifecycle 11 estados | ✅ |
| Token security (conceptual) | ✅ |
| Staff + User panels | ✅ |
| Implementación | ❌ no autorizada |

**ESTADO FINAL: DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER.**

**DETENERSE.**
