# LC-13A — RPC Read Contract Matrix

**Ticket:** TICKET-V2-LEGAL-CENTER-LC-13A-READ-SECURITY-RPC-DISCOVERY-001
**Status:** Discovery specification only — **no SQL functions created**

---

## Transport envelope (LC-11 canonical)

All read RPCs return:

```typescript
{
  data: T[];
  next_cursor: string | null;
  has_more: boolean;
}
```

Errors normalized via ApiClient → `LegalPersistenceResult` with codes in `legal-persistence-errors.ts`.

---

## RPC inventory

### PO-specified primary RPCs (5)

| # | RPC name | Aggregate |
|---|----------|-----------|
| 1 | `legal_read_templates` | Templates + versions + assets (see scope note) |
| 2 | `legal_read_instances` | Document instances |
| 3 | `legal_read_w9_requests` | W-9 workflow |
| 4 | `legal_read_submissions` | Submissions |
| 5 | `legal_read_audit_events` | Audit trail |

### LC-11 transport names (7) — parity extension

| RPC | LC-11 constant | Recommendation |
|-----|----------------|----------------|
| `legal_read_templates` | `templates` | Keep |
| `legal_read_template_versions` | `templateVersions` | **Keep separate** for port parity |
| `legal_read_template_assets` | `templateAssets` | **Keep separate** for port parity |
| `legal_read_instances` | `instances` | Keep |
| `legal_read_w9_requests` | `w9Requests` | Keep |
| `legal_read_submissions` | `submissions` | Keep |
| `legal_read_audit_events` | `auditEvents` | Keep |

**LC-13A recommendation:** Implement **7 RPCs** in LC-13B to match `LEGAL_READ_RPC_NAMES` in `legal-persistence-read-transport.ts`. Document the 5-family grouping above as logical grouping for PO review.

**Security pattern (all RPCs):** `SECURITY INVOKER` · RLS enforced on underlying tables · no dynamic SQL · schema-qualified identifiers · identity resolved inside RPC from `auth.uid()` + profile lookup — **not** from RPC params alone.

---

## 1. `legal_read_templates`

| Field | Value |
|-------|-------|
| **Purpose** | List/get published legal templates for authorized portals |
| **Actors** | Owner, Manager, Artist (allowed), Client (public library), Seller (non-fiscal public) |
| **RLS** | SELECT filtered by template status + fiscal classification + `allowed_portals` |

### Parameters (conceptual)

| Param | Type | Notes |
|-------|------|-------|
| `template_id` | text? | Business ID `SPC-*` — get single |
| `category` | text? | Filter |
| `status` | text? | e.g. `published` |
| `is_fiscal` | boolean? | Server validates actor may request fiscal=true |
| `active_only` | boolean? | Published + current version exists |
| `cursor` | text? | Opaque keyset cursor |
| `limit` | int? | 1–100, default 25 |

### Output (permitted)

- `business_id`, `template_code`, `official_name`, `category`, `status`
- `is_policy`, fiscal classification flag
- `current_published_version_id` (business ID)
- Authorized asset availability flags (not `object_key`)

### Omitted (never default)

- Internal UUID `id`
- `object_key`, bucket, checksum
- Raw `field_schema_default` / internal metadata

### Role differences

| Role | Behavior |
|------|----------|
| Owner/Manager | All published + draft if param authorized |
| Seller | Public non-fiscal templates only |
| Artist | Templates allowed for artist portal + W-9 flow |
| Client | Public library only |

### Errors

| Case | Code |
|------|------|
| Fiscal filter by seller/client | `persistence_access_forbidden` |
| Invalid cursor | `persistence_cursor_invalid` |
| Invalid limit | `persistence_limit_invalid` |
| Unknown template (scoped) | `persistence_entity_not_found` |

---

## 2. `legal_read_template_versions` (LC-11 extension)

| Param | Notes |
|-------|-------|
| `template_id` | Required business ID |
| `version_id` | Optional TV-* |
| `cursor`, `limit` | Pagination |

Output: semver, content_hash (staff only?), effective_from, locale_bodies **not** in list — detail get only.

---

## 3. `legal_read_template_assets` (LC-11 extension)

| Param | Notes |
|-------|-------|
| `template_id` | Filter |
| `asset_key` | Get single |
| `cursor`, `limit` | Pagination |

Output: filename, mime, kind, availability, `allowed_portals` — **no** `object_key`.
Signed download URL: **future ticket** (not LC-13B read RPC).

---

## 4. `legal_read_instances`

| Field | Value |
|-------|-------|
| **Purpose** | Read legal document instances with recipient scope |
| **Actors** | Per authorization matrix |

### Parameters

| Param | Type | Notes |
|-------|------|-------|
| `instance_id` | text? | LDI-* business ID |
| `recipient_type` | text? | **Ignored unless matches session ownership** |
| `recipient_id` | text? | **Never sole authorization** |
| `status` | text? | Filter |
| `template_id` | text? | SPC-* business ID |
| `created_from` | timestamptz? | Range |
| `created_to` | timestamptz? | Range |
| `cursor` | text? | Keyset `(created_at, business_id)` |
| `limit` | int? | 1–100 |

### Rules

- Owner/Manager: full authorized list/get
- Seller: ⏳ operational subset if persisted relationship exists — else 🚫
- Artist/Client: server injects own `recipient_id` from profile; foreign → ∅
- Staff owner/manager bypass recipient filter (matches LC-11 `getInstanceById`)

### Output

- Business IDs, title, status, recipient display name, template business IDs
- No internal UUID, no owner internal IDs in client portal view

### Data leakage risk

High if `recipient_id` param trusted — **mitigation:** RPC resolves `session_recipient_id` and applies RLS + explicit check.

---

## 5. `legal_read_w9_requests`

### Parameters

| Param | Notes |
|-------|-------|
| `w9_request_id` | W9R-* |
| `status` | Filter |
| `recipient_type`, `recipient_id` | Server-validated only |
| `active_only` | Uses LC-7 active set (includes `submitted`) |
| `requested_from`, `requested_to` | Range |
| `cursor` | Keyset `(requested_at, business_id)` |
| `limit` | 1–100 |

### Fiscal rules

| Role | Access |
|------|--------|
| Owner | Full |
| Manager | Full (PO LC-10 approved) |
| Artist | Own only |
| Seller, Client | 🚫 or ∅ |

---

## 6. `legal_read_submissions`

### Parameters

| Param | Notes |
|-------|-------|
| `submission_id` | LDS-* |
| `document_instance_id` | LDI-* |
| `w9_request_id` | W9R-* |
| `status` | Filter |
| `include_deleted` | Owner only; default false |
| `submitted_from`, `submitted_to` | Range |
| `cursor` | Keyset `(submitted_at, business_id)` |
| `limit` | 1–100 |

### Output levels

| Level | Audience | Fields |
|-------|----------|--------|
| **L0 — Portal public** | Artist own | id, filename, mime, size, status, timestamps (`toSubmissionPublicView`) |
| **L1 — Staff operational** | Manager | L0 + review metadata, no storage_key |
| **L2 — Owner internal** | Owner | L1 + checksum, content_reference class — **still no storage_key in list** |

### Never default

- UUID, `storage_key`, bucket, checksum (in list), `deleted_by_actor_id`, raw metadata

### Signed URL

Future RPC/ticket: `legal_create_submission_download_url` — not LC-13B.

---

## 7. `legal_read_audit_events`

### Parameters

| Param | Notes |
|-------|-------|
| `entity_type` | legal_document_instance, w9_request, … |
| `entity_id` | Business ID |
| `action` | Filter |
| `actor_type` | Filter (staff only) |
| `outcome` | success/denied/failed |
| `correlation_id` | LAC-* |
| `occurred_from`, `occurred_to` | Range |
| `cursor` | Keyset `(sequence, business_id)` |
| `limit` | 1–100 |

### Output by role

| Role | Output |
|------|--------|
| Owner/Manager | Full row minus sanitized state (`sanitizeAuditState`) |
| Artist | Filtered raw → mapped to public view in app layer, or RPC returns projection DTO |
| Seller/Client | 🚫 at RPC gate |

### Omitted from portal projection

- Internal `actor_id`, full `previous_state`/`next_state`, internal `reason_code`, raw `metadata`, `correlation_id` (optional in staff view)

---

## Pagination design (DB future)

| Entity | Sort key | Cursor tuple | Direction |
|--------|----------|--------------|-----------|
| Instances | `created_at`, `business_id` | ISO timestamp + LDI-* | DESC default |
| Submissions | `submitted_at`, `business_id` | ISO + LDS-* | DESC |
| Audit | `sequence`, `business_id` | bigint + LAE-* | ASC |
| W-9 | `requested_at`, `business_id` | ISO + W9R-* | DESC |

- Cursor: opaque base64 JSON `{ v: 1, k: [...] }` validated server-side
- Invalid cursor → `persistence_cursor_invalid`
- Limit 1–100; default 25
- Stable sort with tie-breaker business_id

LC-11 lab uses offset cursor — **LC-13B must replace** with keyset for production RPC.

---

## Error catalog (future)

| Code | When |
|------|------|
| `persistence_access_forbidden` | Role cannot perform operation class |
| `persistence_entity_not_found` | Missing or out-of-scope resource |
| `persistence_query_invalid` | Bad filter combination |
| `persistence_cursor_invalid` | Tampered/expired cursor |
| `persistence_limit_invalid` | limit ∉ [1,100] |
| `persistence_identity_unavailable` | No session / no profile row |
| `persistence_role_unresolved` | Cannot map staff role |
| `persistence_rpc_failed` | Transport/DB failure |
| `persistence_contract_violation` | Row fails validation post-fetch |

**Forbidden vs not-found:** foreign resource → not found; global op denied → forbidden; missing auth → identity unavailable.

---

## Field sanitization matrix

| Field | Browser portal | Staff L1 | Owner L2 | Never |
|-------|----------------|----------|----------|-------|
| UUID `id` | — | — | — | ✅ never |
| business IDs | ✅ | ✅ | ✅ | |
| `recipient_id` | own only | ✅ | ✅ | |
| `actor_id` | — | partial | ✅ | in artist view |
| `storage_key` / `object_key` | — | — | get-by-id owner | list |
| `checksum` | — | — | detail only | list |
| `metadata` | sanitized | filtered | filtered | raw secrets |
| `previous_state` / `next_state` | — | sanitized | sanitized | full raw |
| `correlation_id` | — | ✅ | ✅ | artist |
| `deleted_by_actor_id` | — | — | ✅ | |
| `rejection_reason_code` | label only | ✅ | ✅ | |

---

## Test matrix (LC-13B — not implemented in LC-13A)

See main ticket §19. Minimum: 6 roles × cross-scope × fiscal × deleted × audit projection × cursor tampering × UUID leak scan.
