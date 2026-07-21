# TICKET-V2-LEGAL-DATA-CONTRACTS-DISCOVERY-001

## Estado

**DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Modo | Discovery + documentación — **contratos conceptuales únicamente** |
| Fecha | 2026-07-20 |
| Prerequisitos | Governance · Template Engine · Drafting · Signing Workflow · Legal Center · UX Mockups |
| Prohibido | Tablas físicas · SQL · Supabase · TypeScript · API · runtime · commit · deploy |
| Alcance | Entidades · IDs · relaciones · eventos · permisos — **no** implementación |

### Disclaimer

Este documento define el **modelo de datos conceptual** y contratos internos entre capas del dominio legal MDJB. **No** prescribe esquema Postgres, RLS, ni tipos TypeScript. DC-1 traducirá a interfaces formales tras aprobación PO.

---

## Problema

UX (LGX) y funcional (LGC/LGS) están documentados. Antes de LC-2 / DC-4 implementación, arquitectura necesita **vocabulario de datos unificado**: entidades, IDs canónicos, relaciones, eventos y permisos — conectando Staff, Artist, Client, Template Engine, Signing Workflow, Compliance e Introduction Registry.

---

## Capas y responsabilidades

```
┌─────────────────────────────────────────────────────────────────┐
│  PORTALS (Staff / Artist / Client / External)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ read/write via contracts
┌────────────────────────────▼────────────────────────────────────┐
│  LEGAL CENTER (LGC) — projections: dashboard, library, status    │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  SIGNING WORKFLOW (LGS) — packages, sessions, capture            │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  DATA CONTRACTS (LDC) — THIS TICKET — source of truth model       │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  TEMPLATE ENGINE — LegalTemplate · TemplateVersion · render      │
└─────────────────────────────────────────────────────────────────┘
```

**Regla DC-01:** UI nunca inventa estado legal; consume **LegalProfile** snapshot + entidades relacionadas.

**Regla DC-02:** **TaxProfile** (LDC-010) almacenado conceptualmente separado — no embebido en LegalDocument público.

---

# ENTREGABLE 1 — Arquitectura de datos

## 1.1 Aggregate roots

| Aggregate | Root entity | Consistency boundary |
|-----------|-------------|----------------------|
| **Legal identity** | LegalProfile | One per subject (user/email/mdjb) |
| **Template catalog** | LegalTemplate | Published versions immutable |
| **Issuance** | SignaturePackage | Send/sign lifecycle |
| **Signing** | SigningSession | Wizard progress per signer+package |
| **Document instance** | LegalDocument | Single issued doc |
| **Fiscal** | TaxProfile | W-9 and tax artifacts |
| **Compliance** | ComplianceProfile | Event-type readiness |
| **Introduction** | IntroductionRecord | Anti-bypass protection |
| **Audit** | AuditEvent | Append-only log |

## 1.2 Read models (projections — not separate aggregates)

| Projection | Built from | Consumer |
|------------|------------|----------|
| `LegalStatusSnapshot` | LegalProfile + ComplianceProfile + TaxProfile | Gates, LGC-002 |
| `DocumentsLibraryView` | LegalDocument[] filtered | LGC-003 |
| `SignatureHistoryView` | SignatureRecord[] + AcceptanceRecord[] | LGC-004 |
| `PackageProgressView` | SignaturePackage | LGX package card |
| `AuditTimelineView` | AuditEvent[] | LGC-009 / Staff |

## 1.3 Storage tiers (conceptual)

| Tier | Entities | Sensitivity |
|------|----------|-------------|
| **Public legal** | LegalDocument (non-tax), SignaturePackage, FinalArtifact refs | Standard encryption |
| **Fiscal** | TaxProfile, W-9 FinalArtifact | FISCAL_CRITICAL |
| **Audit** | AuditEvent, SignatureRecord metadata | Append-only, no raw TIN |

---

# ENTREGABLE 2 — Entidades (LDC-001 … LDC-014)

## LDC-001 — LegalProfile

**Purpose:** Expediente legal oficial de un sujeto en la plataforma.

| Field | Type (conceptual) | Required | Notes |
|-------|-------------------|----------|-------|
| `legal_profile_id` | ID | ✓ | `LEGAL-PROFILE-{seq}` |
| `subject_type` | enum | ✓ | `staff` \| `artist` \| `client` \| `vendor` \| `venue` \| `external` |
| `user_id` | UUID | ○ | Null pre-account |
| `mdjb_id` | string | ○ | MDJB-C/A/S/… |
| `legal_name` | string | ✓ | Formal name |
| `primary_email` | string | ✓ | Verified for linking |
| `aggregate_status` | enum | ✓ | `GREEN` \| `YELLOW` \| `RED` |
| `status_computed_at` | timestamp | ✓ | Server-side |
| `status_items[]` | embedded[] | ✓ | Per-requirement badges |
| `restrictions[]` | enum[] | ✓ | `no_matching` \| `no_payout` \| `no_booking_accept` \| `no_corporate` |
| `document_ids[]` | ID[] | ○ | Refs LDC-002 |
| `tax_profile_id` | ID | ○ | Ref LDC-010 — artist/vendor only |
| `compliance_profile_id` | ID | ○ | Ref LDC-011 |
| `introduction_ids[]` | ID[] | ○ | Ref LDC-012 |
| `active_package_ids[]` | ID[] | ○ | In-flight packages |
| `created_at` | timestamp | ✓ | |
| `updated_at` | timestamp | ✓ | |

---

## LDC-002 — LegalDocument

**Purpose:** Instancia emitida de un template firmada o aceptada.

| Field | Type | Required | Notes |
|-------|-------------------|----------|-------|
| `document_id` | ID | ✓ | `DOC-{year}-{seq}` |
| `template_code` | string | ✓ | LGL-001, CTR-006, SPC-002… |
| `category` | enum | ✓ | `LGL` \| `CTR` \| `SPC` |
| `template_version_id` | ID | ✓ | Ref LDC-004 |
| `version_label` | string | ✓ | e.g. `1.0` |
| `owner_profile_id` | ID | ✓ | LegalProfile owner |
| `signer_profile_ids[]` | ID[] | ✓ | All parties |
| `package_id` | ID | ○ | Originating package |
| `order_id` | UUID | ○ | MOD-409 link |
| `field_values` | map | ○ | Dynamic fields at issuance |
| `lifecycle_status` | enum | ✓ | Governance states: draft…completed, voided, superseded, expired |
| `signed_at` | timestamp | ○ | |
| `expires_at` | timestamp | ○ | |
| `superseded_by_document_id` | ID | ○ | |
| `final_artifact_id` | ID | ○ | Ref LDC-009 |
| `permissions` | ACL | ✓ | See §14 |
| `locale` | en \| es | ✓ | |
| `created_at` | timestamp | ✓ | |

**Permissions object (embedded):**

| Key | Values |
|-----|--------|
| `read[]` | roles/subjects allowed view |
| `download[]` | PDF download |
| `sign[]` | active signers |

---

## LDC-003 — LegalTemplate

**Purpose:** Catálogo master de plantilla (logical document type).

| Field | Type | Required |
|-------|------|----------|
| `template_id` | ID | ✓ `TPL-{category}-{code}` e.g. `TPL-LGL-001` |
| `template_code` | string | ✓ LGL-001 |
| `category` | LGL\|CTR\|SPC | ✓ |
| `official_name` | string | ✓ |
| `current_published_version_id` | ID | ○ |
| `signature_plan_default` | object | ✓ |
| `field_schema_default` | object | ✓ |
| `is_policy` | boolean | ✓ LGL acceptance vs contract sign |
| `requires_countersign` | boolean | ✓ |
| `counsel_review_required` | boolean | ✓ |
| `status` | enum | draft \| published \| retired |

---

## LDC-004 — TemplateVersion

**Purpose:** Versión inmutable publicada.

| Field | Type | Required |
|-------|------|----------|
| `template_version_id` | ID | ✓ `TPLVER-{template_code}-{semver}` |
| `template_id` | ID | ✓ |
| `semver` | string | ✓ |
| `content_hash` | string | ✓ SHA-256 body |
| `published_at` | timestamp | ✓ |
| `published_by_staff_id` | UUID | ✓ |
| `locale_bodies` | map | ✓ en required; es optional |
| `effective_from` | date | ✓ |
| `retired_at` | date | ○ |

---

## LDC-005 — SignaturePackage

**Purpose:** Bundle multi-documento para firma/aceptación.

| Field | Type | Required |
|-------|------|----------|
| `package_id` | ID | ✓ `PACKAGE-{year}-{seq}` |
| `package_code` | string | ✓ Human display |
| `recipient_profile_id` | ID | ○ |
| `recipient_email` | string | ✓ |
| `recipient_legal_name` | string | ✓ |
| `recipient_role` | enum | ✓ |
| `created_by_staff_id` | UUID | ✓ |
| `preset_id` | string | ○ PKG-DJ-ROSTER… |
| `signing_status` | enum | ✓ CREATED…COMPLETED, EXPIRED, VOIDED, SUPERSEDED |
| `document_count` | int | ✓ |
| `completed_count` | int | ✓ |
| `progress_ratio` | string | ✓ e.g. `3/5` |
| `items[]` | PackageItem[] | ✓ ordered |
| `signers[]` | SignerAssignment[] | ✓ |
| `dependencies[]` | rule[] | ○ e.g. LGL before CTR |
| `priority` | enum | normal \| urgent |
| `expires_at` | timestamp | ✓ |
| `supersedes_package_id` | ID | ○ |
| `order_id` | UUID | ○ |
| `delivered_at` | timestamp | ○ |
| `completed_at` | timestamp | ○ |

**PackageItem:**

| Field | Description |
|-------|-------------|
| `item_order` | 1..N |
| `template_code` | |
| `document_id` | populated when instance created |
| `item_status` | pending \| viewed \| in_progress \| signed \| accepted \| void |
| `requires_countersign` | boolean |

---

## LDC-006 — SigningSession

**Purpose:** Sesión wizard por signatario+paquete.

| Field | Type | Required |
|-------|------|----------|
| `session_id` | ID | ✓ `SESSION-{year}-{seq}` |
| `package_id` | ID | ✓ |
| `signer_profile_id` | ID | ○ |
| `auth_mode` | account \| token | ✓ |
| `token_id` | ID | ○ Flujo B |
| `status` | active \| paused \| completed \| expired \| voided | ✓ |
| `wizard_step` | 1–10 | ✓ |
| `started_at` | timestamp | ✓ |
| `paused_at` | timestamp | ○ |
| `resumed_at` | timestamp | ○ |
| `completed_at` | timestamp | ○ |
| `locale` | en \| es | ✓ |
| `device_class` | mobile \| tablet \| desktop | ✓ |
| `browser_family` | string | ✓ truncated |
| `ip_hash` | string | ✓ |
| `user_agent_trunc` | string | ✓ |

---

## LDC-007 — SignatureRecord

**Purpose:** Evidencia de firma o captura gráfica.

| Field | Type | Required |
|-------|------|----------|
| `signature_id` | ID | ✓ `SIGNATURE-{year}-{seq}` |
| `session_id` | ID | ✓ |
| `document_id` | ID | ✓ |
| `template_version_id` | ID | ✓ |
| `signer_profile_id` | ID | ✓ |
| `signature_type` | enum | ✓ `drawn` \| `typed` \| `initials` \| `checkbox` \| `explicit_confirm` |
| `signature_payload_hash` | string | ✓ hash of capture |
| `section_id` | string | ○ for initials |
| `clause_id` | string | ○ for checkbox |
| `typed_text` | string | ○ |
| `recorded_at` | timestamp | ✓ UTC |
| `locale` | en \| es | ✓ |

---

## LDC-008 — AcceptanceRecord

**Purpose:** Aceptación de política LGL (checkbox / click-wrap) — paralelo a SignatureRecord para policies.

| Field | Type | Required |
|-------|------|----------|
| `acceptance_id` | ID | ✓ `ACCEPT-{year}-{seq}` |
| `document_id` | ID | ✓ |
| `template_code` | string | ✓ |
| `template_version_id` | ID | ✓ |
| `acceptor_profile_id` | ID | ✓ |
| `acceptance_method` | checkbox \| explicit_confirm \| signature | ✓ |
| `session_id` | ID | ○ |
| `accepted_at` | timestamp | ✓ |
| `ip_hash` | string | ✓ |
| `related_order_id` | UUID | ○ |

---

## LDC-009 — FinalArtifact

**Purpose:** PDF (or bundle) final inmutable post-completion.

| Field | Type | Required |
|-------|------|----------|
| `artifact_id` | ID | ✓ `ARTIFACT-{year}-{seq}` |
| `document_id` | ID | ○ single-doc artifact |
| `package_id` | ID | ○ package completion bundle |
| `artifact_type` | single_pdf \| package_bundle \| w9_pdf | ✓ |
| `storage_ref` | string | ✓ opaque future |
| `sha256` | string | ✓ |
| `page_count` | int | ✓ |
| `generated_at` | timestamp | ✓ |
| `is_fiscal` | boolean | ✓ if W-9 — separate bucket tier |

---

## LDC-010 — TaxProfile

**Purpose:** Zona fiscal aislada — **not** merged with public LegalDocument list.

| Field | Type | Required |
|-------|------|----------|
| `tax_profile_id` | ID | ✓ `TAX-PROFILE-{seq}` |
| `owner_profile_id` | ID | ✓ LegalProfile artist/vendor |
| `w9_status` | enum | ✓ `missing` \| `pending_review` \| `approved` \| `rejected` \| `expired` |
| `w9_document_id` | ID | ○ ref SPC-001 LegalDocument |
| `w9_artifact_id` | ID | ○ FinalArtifact fiscal |
| `tin_last4` | string | ○ display only |
| `tax_classification` | string | ○ |
| `approved_at` | timestamp | ○ |
| `approved_by_staff_id` | UUID | ○ |
| `rejection_reason_code` | string | ○ |
| `verification_history[]` | event refs | ○ |
| `updated_at` | timestamp | ✓ |

**Rule TP-01:** No `tin_full` in LegalDocument.field_values — only in encrypted fiscal store (future).

---

## LDC-011 — ComplianceProfile

**Purpose:** Readiness per event-type matrix.

| Field | Type | Required |
|-------|------|----------|
| `compliance_profile_id` | ID | ✓ `COMPLIANCE-{seq}` |
| `owner_profile_id` | ID | ✓ |
| `matrices` | object | ✓ keyed by event type |
| `aggregate_compliance` | enum | ✓ `allowed` \| `warning` \| `blocked` |
| `evaluated_at` | timestamp | ✓ |

**Matrix cell (per requirement):**

| Field | Values |
|-------|--------|
| `requirement_code` | e.g. `CTR-006`, `SPC-001` |
| `state` | ✓ fulfilled \| ⚠ pending \| ✗ blocking |
| `source_document_id` | ID | ○ |
| `expires_at` | date | ○ |

**Event types:** `private_event` \| `restaurant` \| `corporate_event` \| `festival`

---

## LDC-012 — IntroductionRecord

**Purpose:** Anti-bypass introduction registry entry.

| Field | Type | Required |
|-------|------|----------|
| `introduction_id` | ID | ✓ `INTRO-{year}-{seq}` |
| `platform_party` | const | ✓ Miami DJ Beat LLC |
| `performer_profile_id` | ID | ✓ |
| `performer_display_name` | string | ✓ stage + legal |
| `counterparty_type` | enum | ✓ client \| venue \| restaurant \| club \| hotel \| corporate \| vendor |
| `counterparty_profile_id` | ID | ○ |
| `counterparty_name` | string | ✓ e.g. Mojitos Calle 8 |
| `introduction_date` | date | ✓ |
| `introduction_source` | enum | ✓ platform_match \| staff_intro \| event_booking \| inquiry |
| `introduction_evidence` | string | ✓ ORDER-8842 |
| `protection_status` | enum | ✓ active \| expired \| waived \| disputed |
| `protection_expires_at` | date | ✓ default +24mo |
| `waiver_document_id` | ID | ○ |
| `order_id` | UUID | ○ |
| `created_by` | system \| staff_id | ✓ |

---

## LDC-013 — AuditEvent

**Purpose:** Append-only audit log entry.

| Field | Type | Required |
|-------|------|----------|
| `audit_id` | ID | ✓ `AUDIT-{year}-{seq}` |
| `event_type` | string | ✓ see §15 |
| `occurred_at` | timestamp | ✓ UTC |
| `actor_type` | system \| staff \| user \| token_signer | ✓ |
| `actor_id_hash` | string | ✓ |
| `legal_profile_id` | ID | ○ |
| `package_id` | ID | ○ |
| `session_id` | ID | ○ |
| `document_id` | ID | ○ |
| `introduction_id` | ID | ○ |
| `ip_hash` | string | ○ |
| `payload` | object | ○ no PII raw / no TIN |
| `correlation_id` | string | ○ trace package flow |

---

## LDC-014 — LegalNotification

**Purpose:** Actionable alert to user or staff.

| Field | Type | Required |
|-------|------|----------|
| `notification_id` | ID | ✓ `LEGAL-NOTIF-{seq}` |
| `notification_type` | enum | ✓ see below |
| `recipient_profile_id` | ID | ✓ |
| `recipient_channel` | in_app \| email_stub | ✓ |
| `severity` | info \| warning \| critical | ✓ |
| `title_key` | i18n key | ✓ |
| `body_key` | i18n key | ✓ |
| `action_url` | string | ○ deep link Legal Center / package |
| `related_entity_type` | string | ○ package \| document \| tax \| introduction |
| `related_entity_id` | ID | ○ |
| `read_at` | timestamp | ○ |
| `dismissed_at` | timestamp | ○ |
| `created_at` | timestamp | ✓ |

**notification_type examples:**

| Type | Trigger |
|------|---------|
| `w9_pending` | W-9 submitted, awaiting review |
| `w9_required` | Missing W-9 blocks payout |
| `insurance_expiring` | COI ≤30 days |
| `insurance_expired` | COI past expiry |
| `contract_expiring` | Document expires |
| `signature_required` | Package DELIVERED |
| `compliance_blocked` | RED compliance tier |
| `introduction_expiring_soon` | Protection ≤60 days |
| `policy_version_bump` | Re-accept LGL required |
| `package_expiring` | TTL ≤48h |

---

# ENTREGABLE 3 — Identificadores canónicos

## 3.1 Format rules

| Entity | Pattern | Example |
|--------|---------|---------|
| LegalProfile | `LEGAL-PROFILE-{6-digit-seq}` | LEGAL-PROFILE-000001 |
| LegalDocument | `DOC-{YYYY}-{6-digit-seq}` | DOC-2026-000042 |
| LegalTemplate | `TPL-{CAT}-{CODE}` | TPL-LGL-001 |
| TemplateVersion | `TPLVER-{CODE}-v{semver}` | TPLVER-LGL-001-v1.0 |
| SignaturePackage | `PACKAGE-{YYYY}-{6-digit-seq}` | PACKAGE-2026-000001 |
| SigningSession | `SESSION-{YYYY}-{6-digit-seq}` | SESSION-2026-000088 |
| SignatureRecord | `SIGNATURE-{YYYY}-{6-digit-seq}` | SIGNATURE-2026-000201 |
| AcceptanceRecord | `ACCEPT-{YYYY}-{6-digit-seq}` | ACCEPT-2026-000015 |
| FinalArtifact | `ARTIFACT-{YYYY}-{6-digit-seq}` | ARTIFACT-2026-000033 |
| TaxProfile | `TAX-PROFILE-{6-digit-seq}` | TAX-PROFILE-000007 |
| ComplianceProfile | `COMPLIANCE-{6-digit-seq}` | COMPLIANCE-000012 |
| IntroductionRecord | `INTRO-{YYYY}-{6-digit-seq}` | INTRO-2026-000421 |
| AuditEvent | `AUDIT-{YYYY}-{6-digit-seq}` | AUDIT-2026-001904 |
| LegalNotification | `LEGAL-NOTIF-{6-digit-seq}` | LEGAL-NOTIF-000055 |

## 3.2 External correlation

| External ID | Maps to |
|-------------|---------|
| `user_id` (auth) | LegalProfile.user_id |
| `mdjb_id` | LegalProfile.mdjb_id |
| `order_id` (MOD-409) | LegalDocument, SignaturePackage, IntroductionRecord |

## 3.3 Rules

| # | Rule |
|---|------|
| ID-01 | IDs **never** reused after void — new entity new ID |
| ID-02 | Supersede links via `superseded_by_*` — not ID recycle |
| ID-03 | Human `package_code` may equal ID suffix for display |

---

# ENTREGABLE 4 — Relaciones

## 4.1 Entity-relationship (conceptual)

```
LegalProfile (1) ──────────< (N) LegalDocument
     │                              │
     │                              ├──> TemplateVersion ──> LegalTemplate
     │                              │
     ├── (1) TaxProfile [0..1]      ├──> SignatureRecord
     │         └──> LegalDocument   ├──> AcceptanceRecord
     │              (SPC-001 only)  └──> FinalArtifact
     │
     ├── (1) ComplianceProfile [0..1]
     │
     ├──< (N) IntroductionRecord
     │
     ├──< (N) SignaturePackage ──< (N) SigningSession
     │              │                      │
     │              └── PackageItem ───────┴──> SignatureRecord
     │                     └──> LegalDocument
     │
     ├──< (N) AuditEvent
     │
     └──< (N) LegalNotification
```

## 4.2 Flow chain (PO diagram)

```
LegalProfile
    ↓ owns
LegalDocument(s)  ← rendered from TemplateVersion
    ↓ grouped by
SignaturePackage
    ↓ opened via
SigningSession
    ↓ produces
SignatureRecord / AcceptanceRecord
    ↓ completes into
FinalArtifact
    ↓ every step emits
AuditEvent
    ↓ may trigger
LegalNotification
    ↓ updates
LegalProfile.status + ComplianceProfile + TaxProfile
```

## 4.3 Cardinality table

| From | To | Cardinality |
|------|-----|-------------|
| LegalProfile | LegalDocument | 1:N |
| LegalProfile | TaxProfile | 1:0..1 |
| LegalProfile | ComplianceProfile | 1:0..1 |
| LegalTemplate | TemplateVersion | 1:N |
| TemplateVersion | LegalDocument | 1:N |
| SignaturePackage | LegalDocument | 1:N (via items) |
| SignaturePackage | SigningSession | 1:N (re-send/resume) |
| SigningSession | SignatureRecord | 1:N |
| LegalDocument | FinalArtifact | 1:0..1 |
| SignaturePackage | FinalArtifact | 1:0..1 bundle |
| IntroductionRecord | LegalDocument | 0..1 waiver doc |

---

# ENTREGABLE 5 — Legal Profile (aggregate detail)

## 5.1 status_items[] schema

| Field | Description |
|-------|-------------|
| `item_code` | LGL-001, SPC-002… |
| `item_state` | green \| yellow \| red |
| `label_key` | i18n |
| `expires_at` | optional |
| `blocks[]` | restriction enums if red |

## 5.2 GREEN / YELLOW / RED computation (conceptual)

```
IF any status_item.state == red OR compliance.blocked OR tax.w9_status in (missing, rejected) AND w9_required
  THEN aggregate_status = RED
ELSE IF any status_item.state == yellow OR compliance.warning OR tax.w9_status == pending_review
  THEN aggregate_status = YELLOW
ELSE aggregate_status = GREEN
```

## 5.3 restrictions[] derivation

| RED condition | restriction |
|---------------|-------------|
| Anti-bypass not accepted | `no_booking_accept` (performer) |
| W-9 missing/rejected | `no_payout` |
| Contract void | `no_matching` |
| Corporate matrix fail | `no_corporate` |

---

# ENTREGABLE 6 — Signature Package (contract)

## 6.1 State machine

`CREATED` → `DELIVERED` → `OPENED` → `STARTED` → `IN_PROGRESS` → `WAITING_SIGNATURE`? → `SIGNED` → `COMPLETED`  
Terminals: `EXPIRED` | `VOIDED` | `SUPERSEDED`

## 6.2 Progress computation

```
completed_count = count(items where item_status in (signed, accepted))
document_count = len(items)
progress_ratio = "{completed_count} / {document_count}"
signing_status = IN_PROGRESS when 0 < completed_count < document_count
```

## 6.3 Dependencies (conceptual)

| Rule | Description |
|------|-------------|
| DEP-01 | All LGL items must complete before first CTR sign |
| DEP-02 | SPC-001 last in PKG-DJ-ROSTER preset |
| DEP-03 | CTR-006 may require LGL-003 same session |

## 6.4 Example instance

```yaml
package_id: PACKAGE-2026-000001
package_code: PACKAGE-2026-001
signing_status: IN_PROGRESS
document_count: 5
completed_count: 3
progress_ratio: "3/5"
items:
  - { order: 1, template_code: LGL-001, item_status: accepted }
  - { order: 2, template_code: LGL-002, item_status: accepted }
  - { order: 3, template_code: LGL-003, item_status: accepted }
  - { order: 4, template_code: CTR-001, item_status: in_progress }
  - { order: 5, template_code: SPC-001, item_status: pending }
expires_at: 2026-08-03T23:59:59Z
```

---

# ENTREGABLE 7 — Signing Session (contract)

## 7.1 Lifecycle events

| Transition | Trigger |
|------------|---------|
| created | First open package |
| paused | Save & exit |
| resumed | Return with valid token/session |
| completed | Wizard step 10 |
| expired | Package TTL |
| voided | Staff void |

## 7.2 Pause/resume contract

| Field on pause | Stored |
|----------------|--------|
| wizard_step | yes |
| current_document_id | yes |
| partial signatures | yes (draft — not legal until confirm) |

## 7.3 Multi-session policy

One **active** session per signer+package; new open archives prior `paused` session audit.

---

# ENTREGABLE 8 — Signature Record (contract)

## 8.1 Type matrix

| signature_type | Legal use | Maps to UI step |
|----------------|-----------|-----------------|
| `drawn` | CTR counter-sign | Wizard 6 canvas |
| `typed` | Alternative ESIGN | Wizard 6 type tab |
| `initials` | Anti-bypass sections | Wizard 7 |
| `checkbox` | LGL clause | Wizard 8 |
| `explicit_confirm` | Final intent | Wizard 9 |

## 8.2 Immutability

After `recorded_at`, SignatureRecord **immutable** — corrections require void + new package version.

## 8.3 Linkage

Every SignatureRecord MUST reference: `session_id`, `document_id`, `template_version_id`, `signer_profile_id`.

---

# ENTREGABLE 9 — Tax Profile (contract)

## 9.1 Isolation rules

| Rule | Description |
|------|-------------|
| TX-01 | TaxProfile references W-9 LegalDocument by ID — not inline in profile |
| TX-02 | DocumentsLibraryView **excludes** SPC-001; TaxCenterView includes |
| TX-03 | FinalArtifact with `is_fiscal=true` not in public download-all |
| TX-04 | Audit events for TIN: boolean flags only |

## 9.2 w9_status transitions

```
missing → pending_review (submit)
pending_review → approved | rejected (staff)
approved → expired (policy/counsel)
rejected → pending_review (resubmit)
```

---

# ENTREGABLE 10 — Compliance Profile (contract)

## 10.1 Matrices (from Legal Center)

| Event type | Blocking requirements (✗) |
|------------|---------------------------|
| private_event | LGL-002, LGL-003, active CTR-006 |
| restaurant | + SPC-001 approved |
| corporate_event | + SPC-002 valid, SPC-003 if required |
| festival | + enhanced SPC-002, SPC-005 optional |

## 10.2 States

| aggregate_compliance | Meaning |
|----------------------|---------|
| `allowed` | ✓ all blocking fulfilled |
| `warning` | ⚠ non-blocking gaps |
| `blocked` | ✗ any blocking gap |

## 10.3 Evaluation trigger

Recompute on: document signed · W-9 approved · insurance expiry date change · policy version bump.

---

# ENTREGABLE 11 — Introduction Record (contract)

## 11.1 Creation triggers

| Event | Creates INTRO |
|-------|---------------|
| PACKAGE completed with CTR-006 | ✓ |
| Deposit paid + performer assigned | ✓ |
| Staff CRM manual intro | ✓ |

## 11.2 Display contract (Introduction Registry Viewer)

```yaml
introduction_id: INTRO-2026-000421
platform_party: Miami DJ Beat LLC
counterparty_name: Mojitos Calle 8
counterparty_type: restaurant
performer_display_name: DJMago305
introduction_date: 2026-07-21
introduction_source: event_booking
protection_status: active
protection_expires_at: 2028-07-21
```

## 11.3 Exception

`protection_status: waived` requires `waiver_document_id` + staff actor audit.

---

# ENTREGABLE 12 — Audit Event (contract)

## 12.1 Required event types

| event_type | Category |
|------------|----------|
| `legal_profile.created` | lifecycle |
| `package.created` | package |
| `package.sent` | package |
| `package.delivered` | package |
| `package.opened` | package |
| `package.started` | session |
| `package.completed` | package |
| `package.expired` | package |
| `package.voided` | package |
| `package.superseded` | package |
| `document.viewed` | document |
| `document.signed` | signature |
| `document.accepted` | acceptance |
| `document.rejected` | signature |
| `document.downloaded` | document |
| `artifact.generated` | artifact |
| `link.resent` | delivery |
| `link.revoked` | delivery |
| `w9.submitted` | tax |
| `w9.approved` | tax |
| `w9.rejected` | tax |
| `introduction.created` | intro |
| `introduction.expired` | intro |
| `introduction.waived` | intro |
| `compliance.blocked` | compliance |
| `legal_profile.status_changed` | profile |

## 12.2 Payload prohibitions

No raw TIN · no full IP in user export · no signature bitmap in audit payload (hash only).

---

# ENTREGABLE 13 — Legal Notifications (contract)

## 13.1 Delivery contract

| Channel | Future module |
|---------|---------------|
| `in_app` | MOD-011 + Legal Center badge |
| `email_stub` | Edge separate ticket |

## 13.2 Idempotency

Same `notification_type` + `related_entity_id` + recipient within 24h → dedupe unless severity escalates.

## 13.3 Staff notifications

Staff queue alerts for: counter-sign pending · W-9 review queue · compliance RED roster spikes.

---

# ENTREGABLE 14 — Permisos (conceptual ACL)

## 14.1 Role matrix — LegalDocument

| Action | owner | staff.owner | staff.manager | staff.seller | artist/client own | external token |
|--------|-------|-------------|---------------|--------------|-----------------|----------------|
| read | ✓ | ✓ | ✓ | ○ limited | ✓ own | ✓ package scope |
| download PDF | ✓ | ✓ | ✓ | ○ | ✓ own | ✓ post-complete |
| sign | ✓ if signer | — | counter-sign | — | ✓ own | ✓ token |
| edit draft | — | ✓ | ✓ | — | — | — |
| void | — | ✓ | ✓ | — | — | — |
| audit export | — | ✓ | ✓ | ○ | ○ own history | — |

## 14.2 TaxProfile

| Action | owner | staff.manager | staff.owner | seller | client |
|--------|-------|---------------|-------------|--------|--------|
| read masked | ✓ | ✓ | ✓ masked | ✗ | ✗ |
| read full TIN | — | ✗ | ✓ audited | ✗ | ✗ |
| submit W-9 | ✓ | — | — | — | ✗ |
| approve W-9 | — | ✓ | ✓ | ✗ | ✗ |

## 14.3 IntroductionRecord

| Action | performer | client | staff.manager+ | seller |
|--------|-----------|--------|----------------|--------|
| read own | ✓ | ✓ limited | ✓ all | ○ read |
| waive | — | — | ✓ | ✗ |

## 14.4 SignaturePackage

| Action | staff.manager+ | recipient | seller |
|--------|----------------|-----------|--------|
| create/send | ✓ | — | ✗ |
| view progress | ✓ | ✓ own | ○ |
| void/resend | ✓ | — | ✗ |

**Authority note:** Production gates still require Postgres `is_staff` / `is_staff_management` — this matrix is product-level contract only.

---

# ENTREGABLE 15 — Eventos internos del sistema

## 15.1 Domain events (bus — MOD-004 future)

| Event name | Payload keys | Emits |
|------------|--------------|-------|
| `LEGAL_PROFILE_CREATED` | legal_profile_id, subject_type | profile create |
| `LEGAL_STATUS_CHANGED` | legal_profile_id, old, new, restrictions[] | status recompute |
| `PACKAGE_SENT` | package_id, recipient_email | send |
| `PACKAGE_OPENED` | package_id, session_id | first view |
| `PACKAGE_COMPLETED` | package_id, artifact_ids[] | all docs done |
| `DOCUMENT_SIGNED` | document_id, signature_id | sign capture |
| `DOCUMENT_ACCEPTED` | document_id, acceptance_id | LGL accept |
| `W9_SUBMITTED` | tax_profile_id | payee submit |
| `W9_APPROVED` | tax_profile_id, staff_id | staff approve |
| `W9_REJECTED` | tax_profile_id, reason | staff reject |
| `COMPLIANCE_BLOCKED` | compliance_profile_id, event_type | matrix fail |
| `COMPLIANCE_CLEARED` | compliance_profile_id | matrix pass |
| `INTRODUCTION_CREATED` | introduction_id, performer_id, counterparty | intro registry |
| `INTRODUCTION_EXPIRED` | introduction_id | TTL job |
| `INTRODUCTION_WAIVED` | introduction_id, waiver_document_id | staff waiver |
| `ARTIFACT_GENERATED` | artifact_id, sha256 | PDF ready |
| `LEGAL_NOTIFICATION_CREATED` | notification_id, type | alert |

## 15.2 Event consumers (future)

| Consumer | Events subscribed |
|----------|-------------------|
| Legal Status computer | DOCUMENT_*, W9_*, COMPLIANCE_* |
| Introduction Registry | PACKAGE_COMPLETED, INTRODUCTION_* |
| Matching gate (MOD-307) | LEGAL_STATUS_CHANGED |
| Payout gate (MOD-209) | W9_APPROVED, LEGAL_STATUS_CHANGED |
| MOD-011 Notifications | LEGAL_NOTIFICATION_CREATED |

---

# ENTREGABLE 16 — Roadmap técnico

| Phase | ID | Output | Gate |
|-------|-----|--------|------|
| Discovery | **DC-0** | This ticket | PO approve |
| Data Contracts | **DC-1** | TypeScript interfaces + JSON Schema (read models only) in `shared/services/legal/contracts/` | Architect + PO |
| Runtime Planning | **DC-2** | Map LDC → LGS/LGC modules · mock repositories | LC-2 alignment |
| Integration Planning | **DC-3** | MOD-410 service boundaries · event catalog registration MOD-004 | ADR |
| Implementation | **DC-4** | In-memory lab repos · portal wiring | SW-3 / LC-3 |
| Production | **DC-5** | Postgres DDL **separate red-zone ticket** · RLS · storage | Counsel + APROBADO DEPLOY |

**Explicit separation:** DC-1 may author `.ts` interfaces — **not in DC-0**. This ticket stays conceptual only.

---

# ENTREGABLE 17 — Riesgos pendientes

| ID | Riesgo | Sev. | Mitigación |
|----|--------|------|------------|
| RD-01 | Tax data in LegalDocument aggregate | Crítica | TaxProfile isolation TP-01–04 |
| RD-02 | Dual status fields (document vs package) | Alta | Document lifecycle vs signing_status docs |
| RD-03 | Profile fork pre/post account merge | Alta | Merge contract by verified email |
| RD-04 | Audit payload PII leak | Crítica | Payload prohibitions §12.2 |
| RD-05 | Seller ACL too broad | Alta | Matrix §14 enforcement |
| RD-06 | Event ordering race on status | Media | correlation_id + single writer |
| RD-07 | Supersede chain orphan docs | Media | superseded_by links mandatory |
| RD-08 | ID format collision cross-env | Baja | env prefix future ADR |
| RD-09 | Compliance matrix drift from LGL catalog | Alta | Version matrix with template catalog |
| RD-10 | External token signer no profile | Media | ephemeral profile stub + merge |

---

## Contratos API internos (conceptual — not HTTP)

| Port | Operations |
|------|------------|
| `LegalProfilePort` | getSnapshot(id) · recomputeStatus(id) |
| `DocumentPort` | get(id) · listByProfile · createFromTemplate |
| `PackagePort` | create · send · getProgress · void |
| `SessionPort` | start · pause · resume · complete |
| `SignaturePort` | record · listByDocument |
| `TaxPort` | getTaxProfile · submitW9 · approveW9 |
| `CompliancePort` | evaluate · getMatrix |
| `IntroductionPort` | list · create · waive |
| `AuditPort` | append · query |
| `NotificationPort` | emit · listUnread |

Runtime implements ports in DC-4+ — **not authorized here**.

---

## Fuera de alcance

SQL · Supabase · Edge · HTML · CSS · commit · deploy · TypeScript files in DC-0.

---

## Referencias

| Documento |
|-----------|
| `TICKET-V2-LEGAL-CENTER-DISCOVERY-001` |
| `TICKET-V2-LEGAL-SIGNING-WORKFLOW-DISCOVERY-001` |
| `TICKET-V2-LEGAL-UX-MOCKUPS-DISCOVERY-001` |
| `docs/V2/LEGAL/README.md` |
| `TICKET-V2-LEGAL-GOVERNANCE-FOUNDATION-001` |

---

## Criterio de cierre

| Criterio | Estado |
|----------|--------|
| 17 entregables | ✅ |
| 14 entidades LDC-001–014 | ✅ |
| IDs canónicos | ✅ |
| Relaciones + diagrama | ✅ |
| Permisos + eventos | ✅ |
| Roadmap DC-0–DC-5 | ✅ |
| SQL / runtime | ❌ explícitamente excluido |

**ESTADO FINAL: DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER.**

**DETENERSE.**
