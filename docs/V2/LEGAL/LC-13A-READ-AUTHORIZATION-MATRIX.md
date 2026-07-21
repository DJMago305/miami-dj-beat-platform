# LC-13A — Read Authorization Matrix

**Ticket:** TICKET-V2-LEGAL-CENTER-LC-13A-READ-SECURITY-RPC-DISCOVERY-001
**Status:** Discovery only — no RLS, no RPC, no runtime
**Canonical sources:** LC-10 §13, LC-11 `legal-read-access-context.ts`, LC-11 hardening tests

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Allowed (server-side authorized read) |
| 🚫 | Denied → `persistence_access_forbidden` |
| ∅ | Hidden → `persistence_entity_not_found` (anti-enumeration) |
| 📋 | Sanitized projection only (not raw domain row) |
| ⏳ | Pending PO decision |
| — | Not applicable |

---

## Actor definitions (browser session scope)

| Actor | Identity source (future) | Notes |
|-------|--------------------------|-------|
| **Owner** | `is_staff_management(auth.uid())` + staff profile | Full Legal Center read |
| **Manager** | `is_staff(auth.uid())` + role manager | Operational; fiscal TBD per PO |
| **Seller** | `is_staff(auth.uid())` + role seller | No fiscal |
| **Artist** | `auth.uid()` → artist profile ID | Own recipient scope only |
| **Client** | `auth.uid()` → client profile ID | Own documents; no artist fiscal |
| **System** | Edge/service role (not browser anon) | Backend only — out of LC-13A browser scope |

**Not in scope:** Provider, Venue, Anonymous link, Guest signer, Service-role browser, backend worker write paths.

---

## Entity × Operation matrix

### 1. Legal Templates (`legal_templates`)

| Actor | list | get by business ID | get active | get own | get fiscal | get deleted | get audit |
|-------|------|-------------------|------------|---------|------------|-------------|-----------|
| Owner | ✅ | ✅ | ✅ | — | ✅ (catalog) | — | — |
| Manager | ✅ | ✅ | ✅ | — | ✅ (catalog) | — | — |
| Seller | ✅ public only | ✅ public only | ✅ | — | 🚫 | — | — |
| Artist | ✅ allowed templates | ✅ | ✅ | — | ✅ W-9 flow templates | — | — |
| Client | ✅ public library | ✅ public | ✅ | — | 🚫 | — | — |
| System | ⏳ backend | ⏳ | ⏳ | — | ⏳ | — | — |

**Fiscal note:** W-9 template (`SPC-001`) is not public library (`isPublicLegalLibraryDocument()`).

---

### 2. Legal Template Versions (`legal_template_versions`)

| Actor | list | get by business ID | get active | get own | get fiscal | get deleted | get audit |
|-------|------|-------------------|------------|---------|------------|-------------|-----------|
| Owner | ✅ | ✅ | ✅ current | — | ✅ | — | — |
| Manager | ✅ | ✅ | ✅ | — | ✅ | — | — |
| Seller | ✅ public template versions | ✅ | ✅ | — | 🚫 | — | — |
| Artist | ✅ for allowed templates | ✅ | ✅ | — | ✅ W-9 version | — | — |
| Client | ✅ public | ✅ | ✅ | — | 🚫 | — | — |
| System | ⏳ | ⏳ | ⏳ | — | ⏳ | — | — |

---

### 3. Legal Template Assets (`legal_template_assets`)

| Actor | list | get by business ID | get active | get own | get fiscal | get deleted | get audit |
|-------|------|-------------------|------------|---------|------------|-------------|-----------|
| Owner | ✅ metadata | ✅ metadata | ✅ | — | ✅ metadata | — | — |
| Manager | ✅ metadata | ✅ metadata | ✅ | — | ✅ metadata | — | — |
| Seller | 🚫 fiscal assets | 🚫 | 🚫 | — | 🚫 | — | — |
| Artist | ✅ authorized downloads | ✅ | ✅ | — | ✅ W-9 PDF via signed URL future | — | — |
| Client | 🚫 W-9 assets | 🚫 | 🚫 | — | 🚫 | — | — |
| System | ⏳ | ⏳ | ⏳ | — | ⏳ | — | — |

**Never expose in list/get:** `object_key`, internal UUID, bucket name.

---

### 4. Legal Document Instances (`legal_document_instances`)

| Actor | list | get by business ID | get active | get own | get fiscal | get deleted | get audit |
|-------|------|-------------------|------------|---------|------------|-------------|-----------|
| Owner | ✅ | ✅ | ✅ | — | ✅ | — | via audit RPC |
| Manager | ✅ | ✅ | ✅ | — | ✅ | — | via audit RPC |
| Seller | ⏳ ops-linked only | ⏳ | ⏳ | — | 🚫 | — | 🚫 |
| Artist | ∅ own filter | ✅ own / ∅ foreign | ✅ own | ✅ | ✅ own fiscal instances | — | 📋 projection |
| Client | ∅ own filter | ✅ own / ∅ foreign | ✅ own | ✅ | 🚫 artist fiscal | — | 📋 projection |
| System | ⏳ | ⏳ | ⏳ | — | ⏳ | — | ⏳ |

**Ownership key:** `recipient_type` + `recipient_id` matched to authenticated profile.

---

### 5. Legal W-9 Requests (`legal_w9_requests`)

| Actor | list | get by business ID | get active | get own | get fiscal | get deleted | get audit |
|-------|------|-------------------|------------|---------|------------|-------------|-----------|
| Owner | ✅ | ✅ | ✅ | — | ✅ | — | via audit RPC |
| Manager | ✅ | ✅ | ✅ | — | ✅ (PO approved LC-10) | — | via audit RPC |
| Seller | 🚫 | 🚫 / ∅ | 🚫 | — | 🚫 | — | 🚫 |
| Artist | ∅ own | ✅ own / ∅ foreign | ✅ own | ✅ | ✅ own only | — | 📋 projection |
| Client | 🚫 | 🚫 / ∅ | 🚫 | — | 🚫 | — | 🚫 |
| System | ⏳ | ⏳ | ⏳ | — | ⏳ | — | ⏳ |

---

### 6. Legal Document Submissions (`legal_document_submissions`)

| Actor | list | get by business ID | get active | get own | get fiscal | get deleted | get audit |
|-------|------|-------------------|------------|---------|------------|-------------|-----------|
| Owner | ✅ active | ✅ | ✅ | — | ✅ metadata L2 | ✅ deleted | via audit RPC |
| Manager | ✅ active | ✅ | ✅ | — | ✅ metadata L1 | ∅ (not owner) | via audit RPC |
| Seller | 🚫 | 🚫 / ∅ | 🚫 | — | 🚫 | 🚫 | 🚫 |
| Artist | ∅ own | ✅ own / ∅ foreign | ✅ own | ✅ | ✅ own L0 public view | ∅ | 📋 projection |
| Client | 🚫 | 🚫 / ∅ | 🚫 | — | 🚫 | 🚫 | 🚫 |
| System | ⏳ | ⏳ | ⏳ | — | ⏳ | ⏳ | ⏳ |

**Output levels:** L0 portal public view · L1 staff operational · L2 owner internal metadata (no storage key in list).

---

### 7. Legal Audit Events (`legal_audit_events`)

| Actor | list | get by business ID | get active | get own | get fiscal | get deleted | get audit |
|-------|------|-------------------|------------|---------|------------|-------------|-----------|
| Owner | ✅ raw | ✅ raw | — | — | ✅ raw | — | ✅ |
| Manager | ✅ raw ops | ✅ raw | — | — | ✅ raw | — | ✅ |
| Seller | 🚫 | 🚫 | — | — | 🚫 | — | 🚫 |
| Artist | 📋 filtered | 📋 / ∅ | — | 📋 own | 📋 own fiscal actions | — | 📋 |
| Client | 🚫 | 🚫 | — | — | 🚫 | — | 🚫 |
| System | ⏳ insert-only write path | — | — | — | ⏳ | — | ⏳ |

**Raw vs projection:** `LegalAuditEvent` (internal) vs `LegalAuditEventPublicView` / `AuditTimelineView` (UI).

---

## Forbidden vs not-found policy (LC-11 §24.7)

| Situation | Response |
|-----------|----------|
| Seller/Client attempts fiscal family read | `persistence_access_forbidden` |
| Artist queries foreign business ID | `persistence_entity_not_found` |
| Manager requests deleted submission | `persistence_access_forbidden` |
| Owner requests missing ID | `persistence_entity_not_found` |
| Spoofed `recipient_id` param without ownership | Server ignores param; uses session profile → ∅ or 🚫 |

---

## Client-supplied parameters — never authoritative

| Parameter | Treatment |
|-----------|-----------|
| `previewRole` | UI lab only — **ignored server-side** |
| `recipient_id` query/RPC param | Filter hint only after server ownership verified |
| `portal` route | Not used for authorization |
| localStorage / sessionStorage role | Ignored |
| JWT custom claims without DB validation | Not trusted alone |

---

## Cross-reference: LC-11 helper functions

| Function | Maps to |
|----------|---------|
| `canReadFiscalLegalData` | W-9 / instances / submissions fiscal gate |
| `canReadW9TemplateCatalog` | Template list for seller/client block |
| `canReadFullAuditTrail` | Owner + Manager raw audit |
| `canReadDeletedSubmissions` | Owner only |
| `matchesRecipientScope` | Artist own rows |
| `ensureAuditReadAccess` | Block client + seller |
| `canReadAuditEventForContext` | Per-row audit filter |
