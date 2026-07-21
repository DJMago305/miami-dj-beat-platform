# TICKET-V2-LEGAL-GOVERNANCE-FOUNDATION-001

## Estado

**DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Modo | Discovery + documentación — **sin implementación** |
| Fecha | 2026-07-20 |
| Jurisdicción diseño | **Estados Unidos — Florida** (Miami DJ Beat LLC) |
| Rama analizada | `plan/v2-phase-4-api-client` |
| HEAD referencia | `7f93933b3b5a89754cec9e663e96cff51924834b` |
| Ticket relacionado | `TICKET-V2-LEGAL-CONTRACTS-DISCOVERY-001` (detalle técnico instancias/firma/PDF) |
| Autorización | Sin TS, HTML, CSS, SQL, Supabase, Stripe, Edge, email, e-sign, commit, push, merge, PR, deploy ni cambios producción |

### Aviso legal (discovery)

Este documento es **arquitectura de producto y gobernanza documental**. **No** constituye asesoría legal. **No** redacta contratos finales. **No** afirma validez jurídica definitiva. Todo copy ejecutable requiere revisión por **counsel especializado en derecho comercial y laboral independiente — Florida / US**.

### Aviso sobre contratos de referencia PO

Los contratos de referencia aportados por el Product Owner (incl. inspiración conceptual de México, Colombia, Perú, Ecuador u otras jurisdicciones) son **únicamente referencia de intención de negocio**. El sistema V2 **no** debe:

- copiar cláusulas literalmente;
- importar terminología ajena a US law;
- asumir mecanismos de enforcement válidos fuera de Florida/US.

El objetivo es una **arquitectura legal moderna para Miami DJ Beat LLC** operando en Estados Unidos, extensible a revisión counsel posterior.

---

## Problema

Miami DJ Beat invierte marketing, publicidad, tiempo, infraestructura y operaciones para generar demanda. Sin un módulo **Legal Documents & Contracts** unificado, la plataforma queda expuesta a:

- bypass off-platform (DJs/artistas negociando directo con clientes, venues, clubes, restaurantes o empresas obtenidos vía MDJB);
- aceptaciones implícitas no trazables (V1: click-wrap en signup/booking sin instancia versionada);
- gaps de protección cliente (pagos, cancelaciones, sustituciones);
- gaps de protección artista (honorarios, condiciones, seguridad/logística);
- riesgo fiscal/documental (W-9, licencias, seguros, consentimientos).

**Partes a proteger simultáneamente:** Miami DJ Beat LLC · DJs · artistas · proveedores · empresas · restaurantes · clubes · venues · clientes privados · clientes corporativos.

---

## Mapa de módulos V2 (documental)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOD-410 Legal Documents Service               │
│         (dominio transversal — plantillas, instancias, audit)    │
└───────────────┬───────────────────────────────┬─────────────────┘
                │                               │
     ┌──────────▼──────────┐         ┌──────────▼──────────┐
     │ MOD-319 Staff Legal │         │ Portal surfaces      │
     │ LEGAL & CONTRACTS   │         │ MOD-114 Client Docs  │
     │ panel (management)  │         │ MOD-216 Artist Docs  │
     └──────────┬──────────┘         │ Public /sign/{token} │
                │                    └──────────────────────┘
     ┌──────────▼──────────┐
     │ Legal Status Profile │  ← per DJ / artist / vendor / commercial
     │ (compliance badges)  │
     └─────────────────────┘
```

| ID | Nombre | Ubicación futura |
|----|--------|------------------|
| MOD-410 | Legal Documents Service | `shared/services/legal/` |
| MOD-319 | Staff Legal & Contracts | `staff/legal/` |
| MOD-114 | Client Documents | `client/documents/` |
| MOD-216 | Artist Documents | `artist/documents/` |
| MOD-316 | Staff Audit *(consume)* | trazabilidad legal read-only |

**Red zone V1/V2:** mismo nivel que leads, billing, contracts, payments — ticket + ADR + counsel antes de runtime.

---

# ENTREGABLE 1 — Arquitectura del módulo LEGAL

## 1.1 Capas

| Capa | Responsabilidad | Runtime futuro |
|------|-----------------|----------------|
| **Policy Layer (Nivel 1)** | Documentos obligatorios plataforma — aceptación global o por rol | Onboarding, gates booking, roster |
| **Operational Layer (Nivel 2)** | Contratos por evento/relación comercial | Staff + portal + token |
| **Special Layer (Nivel 3)** | W-9, seguros, licencias, exclusividad | Fiscal + compliance gates |
| **Template Registry** | Versiones inmutables, locales EN/ES | Spec only |
| **Instance Engine** | Documento emitido con field_values + signers | Spec only |
| **Acceptance Engine** | Checkbox, firma, iniciales, confirmación | Audit obligatorio |
| **Artifact Engine** | PDF final, download, print | Post-`COMPLETED` |
| **Audit Ledger** | Eventos append-only | MOD-316 feed |

## 1.2 Principios de diseño

| # | Principio |
|---|-----------|
| LG-01 | **US-first:** governing law Florida; ESIGN/UETA para aceptación electrónica — subject to counsel. |
| LG-02 | **Version everything:** ningún documento “vivo” sin `template_id + version`. |
| LG-03 | **Separate policy from contract:** anti-bypass puede ser policy standalone + anexo en acuerdos. |
| LG-04 | **Legal name on formal docs:** stage name solo display; paridad Constitución V2. |
| LG-05 | **No literal copy** de referencias PO extranjeras — solo requisitos de negocio mapeados. |
| LG-06 | **Platform effort recognition:** cláusulas deben reflejar inversión MDJB en adquisición de demanda (subject to counsel enforceability). |
| LG-07 | **Least privilege:** W-9 y fiscal = tier aparte; seller staff sin acceso. |

## 1.3 Integración con taxonomía V2

| Perfil | Documentos típicos |
|--------|-------------------|
| `client.regular` / `client.vip` | Terms, Payment, Cancellation, Privacy, Event Agreement |
| `client.commercial` | + Commercial / Corporate / Venue agreements |
| `artist.dj` / otras categorías | DJ Partner Agreement, Anti-Bypass, Event Agreement, W-9 |
| Vendor (externo) | Vendor Contract, W-9, Insurance |
| Venue / club / restaurant | Venue / Commercial Contract, Event addenda |
| `staff.*` | Emisión y counter-sign — no sustituye counsel |

## 1.4 Gates operativos (conceptual)

| Gate | Bloqueo si incumple |
|------|---------------------|
| Roster / accept booking | DJ Partner Agreement + Anti-Bypass + Privacy + W-9 (si payout US) |
| PRO subscription | + PRO Partner Policy |
| Client deposit | Client Terms + Payment + Cancellation |
| Commercial onboarding | Commercial / Corporate agreement |
| Payout release | W-9 valid + completed agreements |

---

# ENTREGABLE 2 — Catálogo completo de documentos

## NIVEL 1 — Documentos obligatorios de la plataforma

| Doc ID | Nombre oficial | Audiencia | Propósito de negocio | V1 referencia conceptual |
|--------|----------------|-----------|----------------------|--------------------------|
| `L1.privacy_policy` | Privacy Policy | Todos | Recopilación, uso, retención, derechos | `PRIVACY_POLICY.md` |
| `L1.terms_of_service` | Terms of Service | Todos | Uso general plataforma, cuenta, conducta | Parcial `CLIENT_TERMS` + site terms |
| `L1.dj_partner_agreement` | DJ Partner Agreement | Performer DJ | Relación marketplace, independent contractor, comisiones | `DJ_AGREEMENT.md` |
| `L1.anti_bypass_policy` | Anti-Bypass Policy | DJ, artista, vendor con acceso clientes | Prohibición negociación directa post-introducción MDJB | DJ §6–7, Client §4 |
| `L1.payment_policy` | Payment Policy | Client, performer | Depósito 30%, balance T-3, comisiones, payouts | DJ §3, Client §2 |
| `L1.cancellation_policy` | Cancellation Policy | Client, performer | Cancelaciones, no-show, reemplazo, forfeiture | DJ §4–5, Client §3–5 |

**Nota:** Nivel 1 puede aceptarse vía **Policy Acceptance Flow** (Entregable 5) sin instancia por evento.

## NIVEL 2 — Contratos operativos

| Doc ID | Nombre oficial | Partes | Propósito |
|--------|----------------|--------|-----------|
| `L2.dj_contract` | DJ Contract | MDJB ↔ DJ | Evento o marco — honorarios, horarios, rider, cancelación |
| `L2.artist_contract` | Artist Contract | MDJB ↔ artista (no-DJ) | Performance terms, categoría artística |
| `L2.vendor_contract` | Vendor Contract | MDJB ↔ proveedor | Servicios auxiliares (AV, staffing, etc.) |
| `L2.commercial_contract` | Commercial Contract | MDJB ↔ negocio recurrente | B2B términos marco |
| `L2.venue_contract` | Venue Contract | MDJB ↔ venue/club/restaurant | Acceso, producción, responsabilidad instalaciones |
| `L2.corporate_contract` | Corporate Contract | MDJB ↔ corporación | Eventos corporativos, PO, facturación |
| `L2.event_service_agreement` | Event Service Agreement | MDJB ↔ client (+ performers por anexo) | SOW por evento: fecha, venue, servicios, precio |

## NIVEL 3 — Documentos especiales

| Doc ID | Nombre oficial | Propósito | Sensibilidad |
|--------|----------------|-----------|--------------|
| `L3.form_w9` | IRS Form W-9 | Tax ID payee US | **FISCAL_CRITICAL** |
| `L3.insurance_certificate` | Insurance Certificate / COI | General liability, event coverage | Media |
| `L3.business_license` | Business / Occupational License | Compliance local performer/vendor | Media |
| `L3.exclusivity_agreement` | Exclusivity Agreement | Restricciones booking exclusivo MDJB | Alta — counsel |
| `L3.artist_representation` | Artist Representation Agreement | Representación comercial MDJB ↔ artista | Alta — counsel |
| `L3.pro_partner_policy` | PRO Partner Policy | Suscripción PRO, tiers comisión | `PRO_PARTNER_POLICY.md` |
| `L3.data_consent` | Marketing / SMS / Data Consent | Consentimientos granulares | Privacy alignment |
| `L3.photo_video_release` | Photo / Video Release | Derechos imagen evento | Baja — evento |

**Regla catálogo:** cada entrada tiene `required_for[]` (roles/gates), `renewal_period`, `supersedes_policy`.

---

# ENTREGABLE 3 — Matriz de permisos

Capabilities propuestas para MOD-003 (futuro). Autoridad Postgres: `is_staff` / `is_staff_management`.

| Capability | guest (token) | client | artist/vendor | staff.seller | staff.manager | staff.owner |
|------------|---------------|--------|---------------|--------------|---------------|-------------|
| `legal.policy.view` | token | ✅ | ✅ | ✅ | ✅ | ✅ |
| `legal.policy.accept` | token | ✅ | ✅ | ❌ | ❌ | ❌ |
| `legal.contract.view_own` | token | ✅ | ✅ | ✅ queue | ✅ | ✅ |
| `legal.contract.sign` | token | ✅ | ✅ | ❌ | ❌ | ❌ |
| `legal.contract.create` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `legal.contract.send` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `legal.contract.void` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `legal.template.view` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `legal.template.publish` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `legal.w9.submit_own` | ❌ | ❌ | ✅ own | ❌ | ❌ | ❌ |
| `legal.w9.view_masked` | ❌ | ❌ | own | ❌ | ✅ | ✅ |
| `legal.w9.view_full` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅* |
| `legal.status.view_roster` | ❌ | ❌ | own | ✅ limited | ✅ | ✅ |
| `legal.audit.export` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

\* Rol fiscal dedicado futuro — default owner-only.

**Seller:** lectura cola firmas y legal status roster; **sin** W-9, void, template publish.

---

# ENTREGABLE 4 — Flujo de firmas

## 4.1 Ciclo de vida legal (estados mínimos PO)

```
DRAFT
  → READY_TO_SEND
  → SENT
  → VIEWED
  → IN_PROGRESS
  → SIGNED_BY_RECIPIENT
  → SIGNED_BY_MIAMI_DJ_BEAT   (counter-sign cuando aplique)
  → COMPLETED
  → (terminal) VOIDED | EXPIRED | SUPERSEDED
```

| Estado | Significado |
|--------|-------------|
| `DRAFT` | Staff compone; editable |
| `READY_TO_SEND` | Validación campos + counsel checkpoint opcional |
| `SENT` | Email/link generado; TTL activo |
| `VIEWED` | Destinatario abrió documento (audit) |
| `IN_PROGRESS` | Al menos un campo/firma/checkbox iniciado |
| `SIGNED_BY_RECIPIENT` | Firmante externo completó su parte |
| `SIGNED_BY_MIAMI_DJ_BEAT` | Counter-firma plataforma (management) |
| `COMPLETED` | PDF final locked; legalmente archivado |
| `VOIDED` | Invalidado staff |
| `EXPIRED` | TTL vencido sin completar |
| `SUPERSEDED` | Reemplazado por nueva versión/instancia |

## 4.2 Flujo A — Usuario con cuenta

```
Staff (MOD-319)
  → crea instancia desde template (N2/N3)
  → READY_TO_SEND → SENT
  → notificación in-app + email (futuro)
  → Client/Artist portal (MOD-114 / MOD-216)
  → VIEWED → IN_PROGRESS
  → checkbox / initials / signature blocks
  → SIGNED_BY_RECIPIENT
  → [si aplica] staff counter-sign → SIGNED_BY_MIAMI_DJ_BEAT
  → COMPLETED → PDF final
  → historial legal en perfil + Legal Status update
```

## 4.3 Flujo B — Usuario sin cuenta

```
Staff → instancia con email destinatario (lead/venue contact)
  → SENT → email con URL /sign/{opaque_token}
  → VIEWED (sin auth; token + optional email verify fase 2)
  → IN_PROGRESS → firma / checkboxes
  → SIGNED_BY_RECIPIENT
  → [counter-sign MDJB si aplica]
  → COMPLETED → PDF por link seguro
  → vinculación futura: mismo email verificado al registrarse → merge instancias
```

## 4.4 Multi-firmante

Orden configurable por plantilla: Client → Artist → MDJB; o MDJB → Vendor. Estado `IN_PROGRESS` hasta que todos los `required_signers[]` completen.

---

# ENTREGABLE 5 — Flujo de aceptación de políticas

Separado de contratos por evento — aplica **Nivel 1**.

```
1. Usuario alcanza gate (signup, roster, PRO, deposit)
2. Sistema resuelve políticas requeridas no aceptadas en versión vigente
3. Presenta Policy Bundle (Privacy + ToS + Anti-Bypass + Payment + Cancellation según rol)
4. Usuario completa:
   - checkbox por documento (clause-level opcional)
   - initials en secciones críticas (anti-bypass, arbitration) — PO decide
   - signature o "I Agree" explícito (ESIGN disclosure screen)
5. AcceptanceRecord creado por documento
6. Gate desbloqueado
```

**AcceptanceRecord (modelo conceptual)**

| Campo | Descripción |
|-------|-------------|
| `acceptance_id` | UUID |
| `document_id` | Policy template version |
| `document_type` | L1.* |
| `accepted_at` | UTC timestamp |
| `user_id` | nullable pre-account |
| `email` | required |
| `ip_hash` | hashed IP |
| `user_agent` | truncated |
| `acceptance_method` | checkbox \| signature \| initials \| explicit_confirm |
| `related_event_id` | nullable — booking context |
| `locale` | en \| es |

**Re-aceptación:** nueva versión policy → gate requerido antes de próxima acción protegida.

---

# ENTREGABLE 6 — Sistema anti-bypass

## 6.1 Objetivo de negocio

Un DJ o artista **introducido** a un cliente, club, restaurante, venue o empresa **a través de Miami DJ Beat** no puede negociar servicios directos off-platform dentro del **período de restricción** sin autorización expresa escrita de MDJB.

## 6.2 Componentes del sistema (no copy legal)

| Componente | Función |
|------------|---------|
| **L1.anti_bypass_policy** | Documento standalone — aceptación obligatoria roster |
| **Embedded clause block** | Bloque reutilizable en L2.dj_contract, L2.artist_contract |
| **Introduction record** | Audit: quién introdujo a quién, fecha, order/lead_id |
| **Restricted party registry** | Client/venue/company IDs vinculados al performer |
| **Authorization exception** | Staff-issued written waiver — instancia L2 custom con expiry |
| **Violation report** | Staff intake → audit → counsel workflow (fuera producto fase 1) |

## 6.3 Parámetros configurables (counsel review)

| Parámetro | Default propuesto | Notas |
|-----------|-------------------|-------|
| `restriction_months` | 24 | V1 DJ §6 — **no literal copy** |
| `restricted_party_scope` | client + affiliates | PO + counsel |
| `venue_types_in_scope` | club, restaurant, venue, corporate | Ticket requirement |
| `liquidated_damages` | TBD counsel | V1 tiene fórmula — **revisar enforceability FL** |
| `automatic_deduction` | TBD counsel | V1 §8 — subject to counsel |
| `express_authorization` | staff.manager+ waiver doc | Única excepción operativa |

## 6.4 Señales operativas

| Señal | Efecto |
|-------|--------|
| Anti-bypass no aceptado (versión vigente) | Block roster / booking accept |
| Waiver expirado | Restricción activa de nuevo |
| Completed L2.event con partes registradas | Extiende/refresh introduction record |

## 6.5 Simetría cliente

Client Terms incluyen prohibición off-platform engagement (V1 Client §4) — mismo Acceptance Engine, gate en deposit.

---

# ENTREGABLE 7 — Sistema W-9

## 7.1 Rol en arquitectura

Formulario **IRS W-9** para payees US (DJs, artistas, vendors) antes de payout reportable. **No** es contrato comercial — capa `L3.form_w9` separada.

## 7.2 Flujo

```
1. Gate: payout blocked until W-9 COMPLETED
2. Artist/vendor: submit via portal (own) o /sign/{token}
3. Fields: legal name, classification, address, TIN (SSN/EIN)
4. Certification checkbox + signature + date
5. Staff review: APPROVED | REJECTED (resubmit)
6. Storage: encrypted; PDF para archivo fiscal
7. Renewal: trigger on legal name change or IRS requirement
```

## 7.3 Controles (diseño)

| Control | Regla |
|---------|-------|
| Clasificación | `FISCAL_CRITICAL` |
| Acceso staff full TIN | owner (+ future tax role) |
| Seller | **denegado** |
| Logs | nunca raw TIN |
| Retención | IRS + counsel — no delete on account deletion without anonymization policy |
| PDF | bucket separado; signed URLs cortas |

## 7.4 Legal Status badge

`W-9`: ✓ aprobado · ⚠ pendiente · ⚠ rechazado · ⚠ vencido

---

# ENTREGABLE 8 — Dashboard legal (Staff — LEGAL & CONTRACTS)

## 8.1 Navegación MOD-319

| Sección | Función |
|---------|---------|
| **Dashboard** | KPIs: pending signatures, expiring, W-9 queue, compliance gaps roster |
| **Templates** | Lista N1/N2/N3; versiones; publish (owner); preview |
| **Documents** | Todas las instancias; filtros estado/tipo/fecha |
| **Send for Signature** | Wizard: template → parties → fields → READY_TO_SEND → SENT |
| **W-9** | Cola review; masked view; approve/reject |
| **Pending Signatures** | SENT, VIEWED, IN_PROGRESS, SIGNED_BY_RECIPIENT (awaiting MDJB) |
| **Completed** | COMPLETED — PDF download |
| **Voided** | VOIDED + EXPIRED + SUPERSEDED archive |
| **Audit Log** | Stream eventos legal (MOD-316 lens) |

## 8.2 Dashboard widgets (conceptual)

| Widget | Métrica |
|--------|---------|
| Action required | Count pending staff counter-sign |
| Expiring in 7d | SENT/IN_PROGRESS past TTL warning |
| Roster compliance | % DJs with full Legal Status green |
| W-9 backlog | Pending review count |
| Anti-bypass gaps | Performers without current L1 acceptance |

## 8.3 Seller subset

Seller ve: Dashboard (limited), Documents (read), Pending/Completed (read), Legal Status roster (limited). **Oculto:** Templates publish, W-9, Void, Send, Audit export.

## 8.4 Perfil legal (Legal Status) — cada DJ / artista

### 8.4.1 Ubicación UI

- Artist portal: panel **Legal Status** en dashboard / account  
- Staff roster: columna/badge **Legal** en MOD-311  
- Matching gate: MOD-307 consulta snapshot legal antes assign

### 8.4.2 Items de estado (ejemplo PO)

| Item | Badge estados |
|------|---------------|
| DJ Partner Agreement | ✓ firmado · ⚠ pendiente · ⚠ vencido · ⚠ superseded |
| Privacy Policy | ✓ aceptada · ⚠ versión nueva requerida |
| Anti-Bypass Policy | ✓ aceptada · ⚠ pendiente |
| Terms of Service | ✓ · ⚠ |
| Payment Policy | ✓ · ⚠ |
| W-9 | ✓ aprobado · ⚠ pendiente · ⚠ rechazado |
| Insurance (COI) | ✓ · ⚠ pendiente · ⚠ vencido |
| Business License | ✓ · ⚠ pendiente · ⚠ vencido |
| Event Agreement (active) | ✓ por evento · ⚠ falta firma |

### 8.4.3 Agregado Legal Status

| Agregado | Regla |
|----------|-------|
| `GREEN` | Todos required_for rol = ✓ |
| `YELLOW` | ≥1 ⚠ no bloqueante |
| `RED` | ≥1 bloqueante (W-9, Partner Agreement, Anti-Bypass) |

### 8.4.4 Snapshot API (futuro)

`legal_status_snapshot(performer_id)` → `{ aggregate, items[] }` — read-only para matching/payout gates.

---

# ENTREGABLE 9 — Modelo de auditoría

## 9.1 Eventos

| Event | Actor | Payload mínimo |
|-------|-------|----------------|
| `legal.template.published` | staff | template_id, version |
| `legal.instance.created` | staff | instance_id, type |
| `legal.instance.sent` | staff | channel, recipient_hash |
| `legal.instance.viewed` | signer/token | ip_hash, ua |
| `legal.acceptance.recorded` | user/token | document_id, method |
| `legal.signature.applied` | signer | block_id, signature_hash |
| `legal.initial.applied` | signer | section_id |
| `legal.checkbox.checked` | signer | clause_id |
| `legal.instance.recipient_signed` | signer | — |
| `legal.instance.platform_signed` | staff | role |
| `legal.instance.completed` | system | pdf_hash |
| `legal.instance.voided` | staff | reason_code |
| `legal.w9.submitted` | payee | boolean — no TIN |
| `legal.w9.approved` / `rejected` | staff | — |
| `legal.introduction.recorded` | system | parties, order_id |
| `legal.waiver.issued` | staff | exception_id, expiry |
| `legal.pdf.downloaded` | actor | instance_id |

## 9.2 Retención

| Tipo | Período diseño |
|------|----------------|
| Acuerdos comerciales | ≥ 7 años |
| W-9 / fiscal | IRS + counsel |
| Policy acceptances | vida cuenta + 7 años |
| Audit log | append-only; no delete |

## 9.3 Integración

- MOD-010 Logging: structured, no PII crítica  
- MOD-316 Staff Audit: UI Audit Log en panel Legal  
- MOD-408 Activity Log: usuario ve **propio** historial legal  

---

# ENTREGABLE 10 — Roadmap de implementación

| Fase | ID | Entregable | Gate |
|------|-----|------------|------|
| **LG-G0** | Governance | PO revisa este ticket + counsel intake | **Actual** |
| **LG-G1** | Spec | `LEGAL-DOCUMENTS-SPEC.md`, ADR jurisdiction FL | PO + counsel |
| **LG-G2** | Nivel 1 | Policy templates + Acceptance Engine mock | QA acceptance |
| **LG-G3** | Nivel 2 | Instance + lifecycle estados PO + staff send mock | Staff PO visual |
| **LG-G4** | Signing | Portal + token page; checkbox/initials/signature | Security review |
| **LG-G5** | PDF | Final artifact COMPLETED | Hash tests |
| **LG-G6** | Legal Status | DJ profile badges + roster column | Matching integration |
| **LG-G7** | W-9 | L3 isolated module | Fiscal counsel |
| **LG-G8** | Anti-bypass | Introduction registry + waiver | Counsel |
| **LG-G9** | Staff panel | MOD-319 full navigation | Management PO |
| **LG-G10** | Infra | DB, RLS, storage — **red zone ticket** | ADR |
| **LG-G11** | Email | Transactional send/remind | Edge ticket separado |
| **LG-G12** | Cutover V1 | `legal.html` → versioned L1 policies | APROBADO DEPLOY PRODUCCIÓN |

**Dependencias V2:** MOD-003 Permissions · MOD-409 Orders · MOD-316 Audit · MOD-311 Roster.

**Paralelo:** `TICKET-V2-LEGAL-CONTRACTS-DISCOVERY-001` detalla campos plantilla, PDF strategy, provider e-sign — converger en LG-G1.

---

# ENTREGABLE 11 — Riesgos legales pendientes de revisión profesional

| ID | Riesgo | Severidad | Acción |
|----|--------|-----------|--------|
| RL-01 | Enforceability anti-bypass / non-solicit Florida | Alta | Counsel review — no copy MX/COL/PE/EC |
| RL-02 | Liquidated damages reasonableness (FL) | Alta | Counsel — parametrizar o eliminar |
| RL-03 | Automatic deduction from payouts | Alta | Counsel — separación wage/indie contractor |
| RL-04 | ESIGN/UETA consent adequacy | Alta | Disclosure UX + counsel |
| RL-05 | W-9 custodia y data breach liability | Crítica | Counsel + cyber insurance |
| RL-06 | Venue/club contracts — permisos y alcohol | Media | Counsel local |
| RL-07 | Corporate B2B — indemnity scope | Media | Counsel |
| RL-08 | Exclusivity / representation agreements | Alta | Counsel — competición law |
| RL-09 | Insurance COI verification — no asesoría MDJB | Media | Disclaimers |
| RL-10 | Class action waiver enforceability | Media | Client Terms — counsel |
| RL-11 | Menores en eventos / releases | Media | PO policy |
| RL-12 | i18n ES — paridad legal EN | Media | Counsel bilingual review |

**Disclaimer:** este listado **no** sustituye opinión legal. Implementación de copy **prohibida** hasta sign-off counsel.

---

## Mapeo problemas de negocio → documentos

| Problema PO | Documentos / sistema |
|-------------|---------------------|
| 1 Anti-bypass | L1.anti_bypass_policy + embedded blocks + introduction registry + waiver |
| 2 Protección comercial MDJB | L1.* + L2.* + commission/payment policies + audit |
| 3 Protección cliente | L1.payment + cancellation + L2.event_service + replacement protocol ref |
| 4 Protección artista | L2.dj/artist_contract — fees, schedule, safety, travel/lodging fields TBD counsel |
| 5 Fiscal/documental | L3 W-9, insurance, licenses, privacy, consent |

---

## V1 → V2 (referencia conceptual únicamente)

| V1 | V2 target |
|----|-----------|
| `legal.html` static markdown | L1 versioned + Acceptance Engine |
| Implicit signup accept | AcceptanceRecord per policy version |
| `DJ_AGREEMENT.md` monolith | L1.dj_partner + L1.anti_bypass + L2.dj_contract |
| `CLIENT_TERMS.md` | L1.terms + payment + cancellation + L2.event |
| `public.contracts` (optional) | MOD-410 instances — migración TBD |

---

## Fuera de alcance

Implementación · SQL · APIs · Edge · Supabase · runtime · redacción final contratos · validez jurídica · copy literal referencias extranjeras · commit · deploy.

---

## Referencias

| Documento | Relación |
|-----------|----------|
| `TICKET-V2-LEGAL-CONTRACTS-DISCOVERY-001` | Detalle técnico instancias, PDF, e-sign strategy |
| `docs/V2/PROFILE-TAXONOMY.md` | Roles y subtipos |
| `web/DJ_AGREEMENT.md` | Inspiración US V1 — no copy |
| `web/CLIENT_TERMS.md` | Inspiración US V1 — no copy |
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Misión protección operativa |

---

## Criterio de cierre

| Criterio | Estado |
|----------|--------|
| 11 entregables documentados (Legal Status en §8.4) | ✅ |
| 3 niveles documentos | ✅ |
| Ciclo de vida PO (11 estados) | ✅ |
| Flujos A y B | ✅ |
| Panel Staff + Legal Status DJ | ✅ |
| Anti-bypass + W-9 diseño | ✅ |
| Counsel sign-off copy | ⏳ pendiente |
| Implementación | ❌ no autorizada |

**ESTADO FINAL: DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER.**
