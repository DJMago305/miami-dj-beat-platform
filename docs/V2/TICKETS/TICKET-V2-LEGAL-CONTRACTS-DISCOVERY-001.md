# TICKET-V2-LEGAL-CONTRACTS-DISCOVERY-001

## Estado

**DISCOVERY PENDIENTE DE REVISIÓN DE DOCUMENTOS DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Modo | Solo documentación — **sin implementación** |
| Fecha discovery | 2026-07-20 |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD commit analizado | `7f93933b3b5a89754cec9e663e96cff51924834b` — `docs(v2-staff): close phases 10 and 11` |
| PDFs PO | **NO RECIBIDOS** en repo al cierre de este ticket |
| Autorización | Discovery únicamente — sin TS, HTML, CSS, DB, Supabase, Stripe, email runtime, e-sign runtime, commit, push, merge, PR ni deploy |

### Bloqueo de cierre

Este discovery **no puede pasar a “COMPLETADO / APROBADO PO”** hasta que el Product Owner entregue y revise los **PDF oficiales de plantillas** (contratos por rol, W-9, cláusulas anti-bypass, consentimientos). Los inventarios de campos marcados **TBD-PO-PDF** deben reconciliarse campo a campo contra esos PDF antes de cualquier ticket de implementación.

---

## Problema

Miami DJ Beat necesita un módulo V2 unificado de **Legal Documents & Contracts** que reemplace el enfoque V1 fragmentado (markdown estático en `legal.html`, aceptación implícita en signup/booking, posible tabla `public.contracts` sin flujo e-sign completo) y soporte emisión, firma, auditoría y PDF final para múltiples perfiles comerciales.

**Alcance funcional aprobado para diseño (no implementación):**

- Contratos DJs, artistas, proveedores, empresas/venues/clientes comerciales  
- IRS Form W-9  
- Privacidad y consentimiento  
- Cláusulas anti-bypass  
- Email, enlace seguro sin cuenta, firma electrónica, iniciales, checkboxes  
- Descarga, impresión, PDF final, historial, auditoría  
- Vinculación a perfiles existentes y a cuentas creadas posteriormente  

---

## Referencias V1 inventariadas (solo lectura)

| Artefacto | Ubicación | Relevancia |
|-----------|-----------|------------|
| Documentos legales estáticos | `web/legal.html` + `PRIVACY_POLICY.md`, `CLIENT_TERMS.md`, `DJ_AGREEMENT.md`, `PRO_PARTNER_POLICY.md` | Copy base; anti-bypass §4–7 DJ, §4 Client; e-acceptance §11 Client / §16 DJ |
| Nombre legal vs artístico | Constitución V2, `auth.js`, dashboards | Certificados/contratos usan **legal full name** |
| Client portal financiero | `web/client-portal.js` | “Total contract”, login para ver contrato — **sin** flujo firma |
| RLS condicional contracts | `supabase/migrations/20260415180000_data_shield_contracts_rls_if_exists.sql` | Tabla `public.contracts` **opcional** en prod; columnas `email` / `user_id` — esquema no canonizado en repo |
| Catálogo V2 | `MOD-114` Client Documents, `MOD-404` Files Service, `MOD-316` Staff Audit | Piezas relacionadas; **sin** módulo Legal dedicado aún |
| Taxonomía perfiles | `docs/V2/PROFILE-TAXONOMY.md` | `client.regular\|vip\|commercial`, `staff.*`, `artist.*` |

**PDFs PO:** búsqueda repo `**/*.{pdf,PDF}` → **0 archivos**. Inventario de campos por plantilla permanece **preliminar**.

---

## Propuesta de encaje en catálogo V2 (documental)

| ID propuesto | Nombre | Portal / capa | Rol |
|--------------|--------|---------------|-----|
| **MOD-410** | Legal Documents Service | `shared/services/legal/` | Dominio transversal: plantillas, instancias, firma, PDF, auditoría |
| **MOD-319** | Staff Legal Documents | `staff/legal/` | Emisión, seguimiento, void, reenvío — UI staff |
| **MOD-114** *(extend)* | Client Documents | `client/documents/` | Lectura + firma + descarga documentos propios |
| **MOD-216** *(nuevo)* | Artist Documents | `artist/documents/` | Acuerdos performer, W-9, riders firmados |

> **Nota:** IDs propuestos para ticket de catálogo futuro. Este discovery **no** modifica `MiamiDJBeat-V2-MODULE-CATALOG.md`.

**Red zone:** MOD-410 toca datos legales/fiscales sensibles — mismo nivel de gobernanza que leads/facturación/contratos/pagos V1. Implementación solo con ticket explícito + ADR + revisión legal.

---

# ENTREGABLE 1 — Catálogo de tipos de documentos

| Doc Type ID | Nombre oficial | Destinatario principal | Obligatoriedad | Fuente copy V1 / PO |
|-------------|----------------|------------------------|----------------|---------------------|
| `legal.privacy_policy` | Privacy Policy | Todos (browse + aceptación cuenta) | Alta — onboarding | `PRIVACY_POLICY.md` |
| `legal.client_terms` | Client Terms & Conditions | Buyer / lead | Alta — depósito/booking | `CLIENT_TERMS.md` |
| `legal.dj_service_agreement` | DJ Service Agreement | Performer (DJ) | Alta — roster / booking | `DJ_AGREEMENT.md` |
| `legal.pro_partner_policy` | Pro Partner Policy | Performer PRO | Alta — suscripción PRO | `PRO_PARTNER_POLICY.md` |
| `legal.artist_performance_agreement` | Artist Performance Agreement | Performer (no-DJ categories) | Alta — roster | **TBD-PO-PDF** |
| `legal.vendor_services_agreement` | Vendor / Supplier Agreement | Proveedor externo | Media | **TBD-PO-PDF** |
| `legal.commercial_client_agreement` | Commercial Client / B2B Agreement | `client.commercial` | Alta — contratos venue/corp | **TBD-PO-PDF** |
| `legal.venue_rental_addendum` | Venue / Property Addendum | Venue / property manager | Media | **TBD-PO-PDF** |
| `legal.event_services_order` | Event Services Order / SOW | Client + counterparty | Alta — por evento | Parcial V1 portal financiero |
| `legal.anti_bypass_acknowledgment` | Anti-Circumvention Acknowledgment | DJ / Client | Alta — standalone o anexo | Cláusulas DJ §6–7, Client §4 |
| `legal.data_consent` | Data Processing / Marketing Consent | Cualquier signatario | Media — granular | Privacy §2 marketing opt-in |
| `legal.photo_video_release` | Photo / Video Release | Client / guest | Baja — evento | **TBD-PO-PDF** |
| `tax.form_w9` | IRS Form W-9 | Performer / vendor US | Alta — payout 1099 | **TBD-PO-PDF** (IRS official) |
| `legal.certificate_attestation` | Training / Certificate Attestation | Artist (Academy) | Media | Paridad certificados — legal name |
| `legal.custom_staff_template` | Custom Staff-Authored Contract | Configurable | Baja — management only | Plantilla libre con bloques aprobados |

**Reglas de catálogo**

| # | Regla |
|---|-------|
| LD-01 | Cada tipo tiene **versión de plantilla** inmutable una vez publicada; cambios → nueva versión, no overwrite. |
| LD-02 | Documentos **regulatorios** (`tax.form_w9`) no comparten plantilla con contratos comerciales. |
| LD-03 | Anti-bypass puede ser **anexo reutilizable** embebido en múltiples acuerdos. |
| LD-04 | EN canónico; ES traducción PO — paridad i18n MOD-015. |

---

# ENTREGABLE 2 — Inventario de campos por plantilla

Convención: `{field_key}` · tipo · obligatorio · fuente · notas.

### 2.1 Metadatos comunes (todas las plantillas)

| Campo | Tipo | Oblig. | Fuente |
|-------|------|--------|--------|
| `{document_title}` | string | Sí | Plantilla |
| `{document_version}` | semver/date | Sí | Sistema |
| `{effective_date}` | date | Sí | Staff o sistema |
| `{governing_law}` | string | Sí | Default: Florida, USA |
| `{platform_legal_name}` | string | Sí | Miami DJ Beat LLC |
| `{platform_signatory_name}` | string | Cond. | Staff counter-sign |
| `{platform_signatory_title}` | string | Cond. | Staff |
| `{reference_order_id}` | uuid/string | Cond. | MOD-409 Orders |
| `{reference_event_id}` | uuid/string | Cond. | Events Ops |
| `{reference_lead_id}` | uuid/string | Cond. | MOD-312 |
| `{locale}` | en \| es | Sí | MOD-015 |

### 2.2 `legal.dj_service_agreement` (basado en V1 — pendiente PDF PO)

| Campo | Tipo | Oblig. | Fuente |
|-------|------|--------|--------|
| `{contractor_legal_name}` | string | Sí | `dj_profiles.full_name` |
| `{contractor_stage_name}` | string | No | `dj_profiles.dj_name` — display only |
| `{contractor_email}` | email | Sí | Auth / perfil |
| `{contractor_address}` | address | Sí | Account settings |
| `{commission_tier}` | enum | Cond. | PRO partner context |
| `{anti_bypass_term_months}` | number | Sí | Default 24 — DJ §6 |
| `{liquidated_damages_formula}` | text | Sí | DJ §7 — legal review |
| `{deposit_percent}` | number | Sí | Default 30 |
| `{final_payment_days_before}` | number | Sí | Default 3 |

### 2.3 `legal.client_terms` / `legal.event_services_order`

| Campo | Tipo | Oblig. | Fuente |
|-------|------|--------|--------|
| `{client_legal_name}` | string | Sí | `client_profiles` / lead |
| `{client_company_name}` | string | Cond. | `client.commercial` |
| `{client_email}` | email | Sí | Lead / auth |
| `{client_phone}` | phone | Sí | Lead |
| `{event_date}` | date | Cond. | Order |
| `{event_venue_name}` | string | Cond. | Order |
| `{event_venue_address}` | string | Cond. | Post-booking rules |
| `{services_description}` | text | Sí | Order line items |
| `{contract_gross_total}` | money | Sí | Portal financiero |
| `{deposit_amount}` | money | Sí | Calculado 30% |
| `{balance_amount}` | money | Sí | Calculado 70% |
| `{cancellation_policy_ref}` | string | Sí | Payment policy link |

### 2.4 `legal.commercial_client_agreement` / venue

| Campo | Tipo | Oblig. | Fuente |
|-------|------|--------|--------|
| `{company_legal_name}` | string | Sí | **TBD-PO-PDF** |
| `{company_ein}` | string | Cond. | **TBD-PO-PDF** |
| `{signer_title}` | string | Sí | Destinatario |
| `{venue_name}` | string | Cond. | Venue addendum |
| `{master_agreement_term}` | duration | Sí | **TBD-PO-PDF** |

### 2.5 `legal.vendor_services_agreement`

| Campo | Tipo | Oblig. | Fuente |
|-------|------|--------|--------|
| `{vendor_legal_name}` | string | Sí | **TBD-PO-PDF** |
| `{vendor_service_category}` | enum | Sí | Staff |
| `{insurance_required}` | boolean | Sí | **TBD-PO-PDF** |
| `{indemnity_clause}` | rich text | Sí | Plantilla |

### 2.6 `tax.form_w9` (IRS — pendiente PDF PO)

| Campo | Tipo | Oblig. | Fuente | Sensibilidad |
|-------|------|--------|--------|--------------|
| `{w9_name_line1}` | string | Sí | Legal name | PII |
| `{w9_business_name}` | string | No | DBA | PII |
| `{w9_tax_classification}` | IRS enum | Sí | Signatario | Fiscal |
| `{w9_exempt_payee}` | codes | Cond. | Signatario | Fiscal |
| `{w9_address}` | address | Sí | Signatario | PII |
| `{w9_tin_type}` | SSN \| EIN | Sí | Signatario | **CRÍTICO** |
| `{w9_tin_value}` | encrypted | Sí | Signatario | **CRÍTICO — ver Entregable 13** |
| `{w9_certification_checkbox}` | boolean | Sí | Signatario | Legal |
| `{w9_signature}` | signature | Sí | Signatario | Legal |
| `{w9_date}` | date | Sí | Sistema | Audit |

### 2.7 Consentimientos (`legal.data_consent`, `legal.privacy_policy`)

| Campo | Tipo | Oblig. | Fuente |
|-------|------|--------|--------|
| `{consent_marketing_email}` | checkbox | No | Opt-in |
| `{consent_sms}` | checkbox | No | Opt-in |
| `{consent_data_sharing}` | checkbox | Cond. | **TBD-PO-PDF** |
| `{privacy_version_accepted}` | string | Sí | Plantilla version |

---

# ENTREGABLE 3 — Campos completados por Staff

| Acción staff | Campos típicos | Roles |
|--------------|----------------|-------|
| Crear instancia desde plantilla | `{effective_date}`, `{reference_order_id}`, `{reference_lead_id}`, overrides comerciales | owner, manager |
| Completar contrato comercial | `{contract_gross_total}`, `{services_description}`, `{client_company_name}`, `{commission_tier}` | owner, manager |
| Asignar destinatarios | emails, orden de firma, rol signatario (client / artist / vendor / platform) | owner, manager |
| Counter-firma plataforma | `{platform_signatory_name}`, `{platform_signatory_title}`, signature block | owner, manager |
| Reenviar / revocar enlace | — (acción, no campo) | owner, manager |
| Void / supersede | `{void_reason}` (interno) | owner, manager |
| Solicitar W-9 | selección performer/vendor — **sin** ver TIN | owner, manager |
| Seller (limitado) | solo lectura estado; **sin** crear W-9 ni void | seller |

**Prefill automático (staff no reescribe):** `{contractor_legal_name}`, `{client_email}`, MDJB IDs, datos de order cuando exista enlace MOD-409.

---

# ENTREGABLE 4 — Campos completados por destinatario

| Tipo documento | Destinatario | Campos editables |
|----------------|--------------|------------------|
| DJ / Artist agreements | Performer | address, tax ID si no W-9 separado, checkboxes de lectura, firma |
| Client terms / event order | Client / commercial signer | billing address, company details, checkboxes, firma |
| Vendor agreement | Vendor contact | insurance cert refs, business details, firma |
| W-9 | Performer / vendor | **todos** los campos IRS — staff no completa por ellos |
| Consent / privacy | Cualquier usuario | opt-in checkboxes, firma o click-wrap según jurisdicción |
| Anti-bypass ack | DJ o Client | checkbox “he leído”, iniciales por sección si PO lo exige, firma |

**Validaciones destinatario:** email debe coincidir con destinatario asignado (cuenta o token); campos money read-only salvo addendum negociado vía staff.

---

# ENTREGABLE 5 — Campos de firma e iniciales

| Elemento | Descripción | Evidencia auditada |
|----------|-------------|-------------------|
| **Signature (full)** | Dibujo canvas, typed name, o imagen upload — política PO | hash imagen/texto, timestamp, IP, user-agent |
| **Initials** | Por sección (`§6`, `§7`, W-9 cert) — canvas o 2–4 chars typed | section_id, signer_id, timestamp |
| **Checkbox acceptance** | “I agree to…” binding clauses | clause_id, version, checked_at |
| **Click-wrap** | Botón único en docs estáticos onboarding | event_id, document_version |
| **Platform counter-sign** | Segunda firma staff | staff_user_id, role snapshot |
| **Witness / notary** | **Out of scope V1 module** — reservado PO | N/A fase inicial |

**Orden de firma (configurable por plantilla):**

1. Client → Platform  
2. Artist → Platform  
3. Platform → Client (counter)  
4. W-9: solo payee — **sin** counter-sign platform en formulario IRS

---

# ENTREGABLE 6 — Estados del ciclo de vida

```
                    ┌─────────┐
                    │  draft  │
                    └────┬────┘
                         │ staff submit
                    ┌────▼──────────┐
                    │ pending_review │ (opcional management)
                    └────┬──────────┘
                         │ approve
                    ┌────▼────┐
              ┌─────│ approved │
              │     └────┬────┘
              │          │ send (email/link)
              │     ┌────▼────┐
              │     │  sent   │
              │     └────┬────┘
              │          │ open link
              │     ┌────▼────┐
              │     │ viewed  │
              │     └────┬────┘
              │          │ first signature
              │     ┌────▼──────────────┐
              │     │ partially_signed  │◄── multi-signer
              │     └────┬──────────────┘
              │          │ all required signatures
              │     ┌────▼─────────┐
              │     │  completed   │ → PDF final locked
              │     └──────────────┘
              │
    void ─────┼──► voided
    expire ───┼──► expired
    new version ─► superseded (prior doc read-only)
```

| Estado | Significado | Transiciones permitidas |
|--------|-------------|-------------------------|
| `draft` | Staff compone; no enviado | → `pending_review`, `approved`, void |
| `pending_review` | QA legal interno | → `approved`, `draft`, void |
| `approved` | Listo para envío | → `sent`, `draft` |
| `sent` | Email/link generado | → `viewed`, `expired`, void |
| `viewed` | Al menos un open auditado | → `partially_signed`, void |
| `partially_signed` | Falta ≥1 firmante | → `completed`, void |
| `completed` | PDF final generado | → `superseded` (solo nuevo doc) |
| `voided` | Invalidado staff | terminal |
| `expired` | TTL enlace superado | → re-send desde `approved` |
| `superseded` | Reemplazado por versión nueva | terminal (archivo) |

---

# ENTREGABLE 7 — Roles y permisos

Matriz alineada `PROFILE-TAXONOMY` + `is_staff` / `is_staff_management` (Postgres futuro).

| Capability | guest (token) | client.* | artist.* | staff.seller | staff.manager | staff.owner |
|------------|---------------|----------|----------|--------------|---------------|-------------|
| `legal.view_own` | token scope | ✅ | ✅ | ✅ own queue | ✅ | ✅ |
| `legal.sign_own` | token scope | ✅ | ✅ | ❌ | ❌ | ❌ |
| `legal.create` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `legal.send` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `legal.void` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `legal.view_w9` | ❌ | ❌ | own only | ❌ | ✅ masked | ✅ masked |
| `legal.view_w9_full_tin` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅* |
| `legal.export_audit` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `legal.manage_templates` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

\* `view_w9_full_tin` sujeto a rol fiscal dedicado futuro + ADR; default owner-only.

**Zona roja:** permisos W-9 y void **no** se resuelven en cliente — RLS + RPC `is_staff_management`.

---

# ENTREGABLE 8 — Arquitectura de plantillas

```
┌─────────────────────────────────────────────────────────┐
│              Template Registry (versioned)               │
│  template_id + version + locale + doc_type + schema_json │
└───────────────────────────┬─────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  body_blocks[]      field_schema{}      signature_plan{}
  (markdown/html)    (types, rules)     (order, roles)
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                   Published Template Snapshot
                   (immutable after publish)
```

| Capa | Responsabilidad |
|------|-----------------|
| **Template definition** | Metadatos, doc type, versión, locales |
| **Block library** | Cláusulas reutilizables (anti-bypass, arbitration, payment) |
| **Field schema** | JSON Schema-like — validación pre-send |
| **Signature plan** | Orden, roles, initial points, checkbox map |
| **Render view** | HTML print-friendly — **no** lógica de negocio en template |

**Reglas**

| # | Regla |
|---|-------|
| TP-01 | Plantilla publicada = hash SHA-256 almacenado; instancia referencia `template_id@version`. |
| TP-02 | Custom staff template solo combina **bloques aprobados** — no HTML libre fase 1. |
| TP-03 | W-9 usa plantilla IRS pixel-stable; campos posicionados para PDF overlay. |

---

# ENTREGABLE 9 — Arquitectura de documentos emitidos

```
Staff UI (MOD-319)
       │
       ▼
LegalDocumentsService (MOD-410)
       │
       ├── DocumentInstance
       │     id, template_ref, status, field_values{}, links[]
       │
       ├── SignerAssignment[]
       │     signer_id, role, email, user_id?, mdjb_id?, order
       │
       ├── SigningSession (tokenized)
       │     opaque token, expires_at, channel email|sms
       │
       ├── SignatureRecord[]
       │     type full|initial|checkbox, payload_hash, metadata
       │
       └── FinalArtifact
             pdf_storage_ref, sha256, completed_at
```

**Vinculación de identidad**

| Clave | Uso |
|-------|-----|
| `user_id` | Cuenta Supabase cuando existe |
| `mdjb_id` | MDJB-XXXX — stem C/A/S/M |
| `email` | Matching pre-cuenta + reenvío |
| `lead_id` / `order_id` | Contexto comercial |
| `profile_type` | client \| artist \| vendor \| commercial |

**Post-hoc account linking:** al crear cuenta con mismo email verificado, RPC `legal_link_pending_documents(email, user_id)` asocia instancias `sent|viewed|partially_signed|completed` — sin re-firma.

---

# ENTREGABLE 10 — Modelo de auditoría

| Evento | Actor | Campos registrados |
|--------|-------|-------------------|
| `document.created` | staff_user_id | template_ref, instance_id |
| `document.field_updated` | staff_user_id | field_key (no PII crítica en log) |
| `document.approved` | staff_user_id | — |
| `document.sent` | staff_user_id | channel, recipient_hash |
| `signing.link_opened` | signer/token | ip_hash, ua, geo coarse |
| `signing.field_completed` | signer | field_key |
| `signing.signature_applied` | signer | signature_hash, method |
| `signing.initial_applied` | signer | section_id |
| `signing.checkbox_checked` | signer | clause_id |
| `document.completed` | system | pdf_hash |
| `document.voided` | staff_user_id | reason_code |
| `document.pdf_downloaded` | actor | — |
| `w9.tin_submitted` | signer | **NO log raw TIN** — evento booleano + timestamp |

**Retención:** mínimo 7 años acuerdos comerciales; W-9 según IRS (4+ años desde reporting); alineado Privacy §4.

**Integración:** MOD-316 Staff Audit consume stream read-only; MOD-010 Logging **nunca** emite TIN/firma raw.

---

# ENTREGABLE 11 — Flujo para usuarios con cuenta

```
1. Staff crea DocumentInstance → prefill desde perfil/order
2. Sistema asigna SignerAssignment con user_id + mdjb_id
3. MOD-402 Notifications → in-app + email “Document ready to sign”
4. Usuario autenticado → Client/Artist portal MOD-114/216
5. Permissions gate legal.sign_own
6. Render documento + campos pendientes + signature UI
7. On complete → status partially_signed | completed
8. PDF final → disponible download/print en portal
9. Activity en MOD-408 (usuario ve propio historial)
```

**Paridad V1:** reemplaza click-wrap único en signup por instancia trazable por versión de términos.

---

# ENTREGABLE 12 — Flujo para usuarios sin cuenta

```
1. Staff crea instancia con email destinatario (lead sin auth)
2. LegalDocumentsService genera SigningSession
   - opaque token (≥128 bits entropy)
   - TTL default 14 días (configurable)
   - single-use o rotación en re-send
3. Email (futuro MOD-411 / Edge) con URL:
   https://{root}/sign/{token}  — página mínima sin portal shell completo
4. Destinatario verifica email (OTP opcional fase 2) → view document
5. Completa campos + firma + checkboxes
6. Audit trail vinculado a email + token session
7. Si luego crea cuenta con mismo email → auto-link (Entregable 9)
8. PDF entregado por email secure link post-completion
```

**Seguridad enlace:** token no adivinable; rate limit; expiración; revocación en void; no indexable; `Referrer-Policy: no-referrer`.

---

# ENTREGABLE 13 — Diseño especial de seguridad para W-9

| Control | Implementación futura (diseño) |
|---------|--------------------------------|
| **Clasificación datos** | Tier `FISCAL_CRITICAL` — separado de contratos generales |
| **Cifrado** | TIN/SSN/EIN cifrado en reposo (KMS); nunca en client_logs |
| **Transporte** | Solo TLS; POST directo a Edge — no query params |
| **RLS** | Fila W-9: SELECT solo payee own + `is_staff_management` con columna masked |
| **UI staff** | Default masked `***-**-1234`; reveal full TIN auditado + reason |
| **UI artist** | Editable solo en sesión propia; no descarga PDF con TIN a terceros |
| **Storage PDF** | Bucket privado separado `legal-w9/`; signed URLs ≤15 min |
| **Audit** | Eventos sin payload TIN; acceso full TIN = evento `w9.tin_revealed` |
| **Retención** | No delete hasta periodo IRS; account deletion anonimiza excepto obligación fiscal |
| **Acceso seller** | **Denegado** completamente |
| **Anti-screenshot** | UX warning only fase 1 — no DRM |

**Compliance note (discovery):** validación final con asesor fiscal US — especialmente si plataforma almacena W-9 vs solo actúa como conduit a proveedor e-sign.

---

# ENTREGABLE 14 — Estrategia de PDF final

| Fase | Enfoque |
|------|---------|
| **Generación** | HTML render (plantilla + field_values + signature images) → PDF server-side (Headless Chromium o servicio dedicado) |
| **Momento** | Trigger en transición a `completed` — idempotente |
| **Contenido** | Todas las páginas, checkboxes marcados visibles, firmas/iniciales embebidas, footer: doc_id, template version, sha256, completed_at UTC |
| **Inmutabilidad** | Object storage WORM-style; nueva versión = nuevo objeto |
| **Entrega** | Download autenticado o token time-limited |
| **Print** | CSS `@media print`; mismo PDF fuente |
| **Integridad** | Hash en DB + opcional QR verificación interna staff |

**W-9 PDF:** overlay campos IRS sobre plantilla oficial PO; TIN visible solo en PDF entregado al payee + archivo fiscal staff autorizado.

---

# ENTREGABLE 15 — Estrategia futura de proveedor de firma electrónica

| Etapa | Modelo | Cuándo |
|-------|--------|--------|
| **L1 — Native MDJB** | Canvas/typed signature + audit trail + ESIGN/UETA disclosures | MVP MOD-410 |
| **L2 — Enhanced native** | OTP identity, IP reputation, certificate page | Post-MVP |
| **L3 — Provider adapter** | Abstracción `SignatureProviderPort` → DocuSign / Adobe Sign / HelloSign | Enterprise clients, multi-party externo |
| **L4 — Hybrid** | Native para DJ/Client estándar; provider para venue/corp | PO decision |

**Puerto propuesto (conceptual):**

```
SignatureProviderPort
  createEnvelope(instance) → external_id
  getStatus(external_id) → status
  downloadFinalPdf(external_id) → blob
  handleWebhook(event) → audit events
```

**Criterios selección provider:** costo por sobre, API webhook, FL law support, data residency, W-9 handling (muchos providers **no** soportan IRS forms — W-9 likely siempre native).

---

# ENTREGABLE 16 — Integración futura con email

| Caso | Trigger | Contenido |
|------|---------|-----------|
| Document sent | `sent` | Link firmante, expira, soporte |
| Reminder | T-3 días antes expire | Re-send token |
| Completed | `completed` | PDF link + portal link si cuenta |
| Voided | void | Notificación sin adjunto |
| W-9 requested | staff action | Instrucciones + link seguro |

**Stack futuro:** Edge Function transactional email (Resend/SendGrid/SES) — **fuera de alcance discovery runtime**.

**Reglas:** no PII innecesaria en subject; links tokenizados; bounce handling; unsubscribe no aplica transactional legal.

**Dependencias V2:** MOD-011 Notifications (in-app), MOD-402 Hub, MOD-005 API Client invoke Edge.

---

# ENTREGABLE 17 — Riesgos legales y técnicos

| ID | Riesgo | Severidad | Mitigación diseño |
|----|--------|-----------|-------------------|
| R-L01 | Plantillas desalineadas vs PDF PO | Alta | **Bloqueo actual** — reconciliación PO |
| R-L02 | ESIGN enforceability gaps | Alta | Disclosure screens + audit; legal review FL |
| R-L03 | W-9 storage = custodia fiscal | Alta | Cifrado, acceso mínimo, asesor fiscal |
| R-L04 | Anti-bypass liquidated damages no enforceable | Media | PO + counsel review antes publish |
| R-L05 | Menor firmando release | Media | Age gate / guardian flow TBD-PO |
| R-T01 | PDF generation drift vs template | Media | Golden tests + hash snapshot |
| R-T02 | Token leak unsigned doc | Alta | TTL, revoke, OTP fase 2 |
| R-T03 | RLS misconfig expone W-9 | Crítica | Red zone ticket + penetration test |
| R-T04 | Dual V1/V2 contract truth | Alta | Cutover flag; V1 read-only post-migration |
| R-T05 | Email spoofing | Media | SPF/DKIM/DMARC + branded domain |
| R-T06 | Account linking wrong email | Media | Verified email only + manual staff override audit |

---

# ENTREGABLE 18 — Roadmap de implementación por fases

| Fase | Nombre | Entregables | Gate |
|------|--------|-------------|------|
| **LD-0** | PO PDF reconciliation | Campos finales Entregables 2–5; copy legal aprobado | **Actual — bloqueado** |
| **LD-1** | Spec MOD-410 + ADR | LEGAL-DOCUMENTS-SPEC.md, RLS draft, SignatureProviderPort interface | PO + counsel |
| **LD-2** | Template registry mock | Plantillas DJ + Client terms versionadas; sin DB | Lab tests |
| **LD-3** | Document instance mock | Staff create → mock send; estados | Staff PO visual |
| **LD-4** | Native signing UI | Signature, initials, checkbox; audit events | QA legal |
| **LD-5** | Token signing page | Flujo sin cuenta + email stub | Security review |
| **LD-6** | PDF pipeline | Final artifact + download/print | Hash validation |
| **LD-7** | W-9 module | Tier FISCAL_CRITICAL + masked staff view | Fiscal counsel |
| **LD-8** | Supabase + RLS | Tablas, Edge, Storage buckets | Red zone ticket |
| **LD-9** | Email production | Transactional send + reminders | MOD-402 |
| **LD-10** | Portal integration | MOD-114, MOD-216, MOD-319 UI | Cross-portal QA |
| **LD-11** | V1 cutover | Migrar `legal.html` estático a versioned instances | APROBADO DEPLOY PRODUCCIÓN |
| **LD-12** | E-sign provider (opcional) | L3 adapter | Enterprise PO |

**Dependencias V2 previas recomendadas:** MOD-003 Permissions, MOD-409 Orders Core, MOD-316 Audit, MOD-404 Files.

---

## Decisiones abiertas (requieren PO / counsel)

| # | Pregunta |
|---|----------|
| D-01 | ¿PDFs oficiales por tipo — cuáles existen hoy en papel? |
| D-02 | ¿W-9 almacenado in-platform vs solo export a contabilidad externa? |
| D-03 | ¿Vendor/venue contracts in scope MVP o fase LD-7+? |
| D-04 | ¿Iniciales obligatorias por sección en DJ Agreement o firma única? |
| D-05 | ¿OTP obligatorio en enlaces sin cuenta? |
| D-06 | ¿Proveedor e-sign externo requerido day-1 para B2B? |
| D-07 | ¿Relación con tabla V1 `public.contracts` — migrar o reemplazar? |

---

## Fuera de alcance (este ticket)

| Item | Motivo |
|------|--------|
| TypeScript / HTML / CSS | Prohibido por ticket |
| Supabase migrations / RLS runtime | Fase LD-8 |
| Stripe / pagos | Módulo aparte |
| Email / e-sign runtime | Solo estrategia |
| Commit / push / PR / deploy | Gobernanza |

---

## Referencias cruzadas

| Documento | Relación |
|-----------|----------|
| `docs/V2/PROFILE-TAXONOMY.md` | Roles signatario |
| `docs/V2/MiamiDJBeat-V2-MODULE-CATALOG.md` | MOD-114, MOD-404, MOD-316 |
| `web/DJ_AGREEMENT.md` | Copy anti-bypass DJ |
| `web/CLIENT_TERMS.md` | Copy client + e-acceptance |
| `web/PRIVACY_POLICY.md` | Retención y derechos |
| `web/PRO_PARTNER_POLICY.md` | PRO contractual |
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Gate PO |

---

## Criterio de cierre del discovery

| Criterio | Estado |
|----------|--------|
| 18 entregables documentados | ✅ |
| Inventario V1 | ✅ |
| PDFs PO revisados | ⏳ **PENDIENTE** |
| Aprobación counsel | ⏳ **PENDIENTE** |
| Ticket implementación LD-1 | ❌ **NO AUTORIZADO** |

**ESTADO FINAL: DISCOVERY PENDIENTE DE REVISIÓN DE DOCUMENTOS DEL PRODUCT OWNER.**
