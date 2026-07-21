/** LC-11 — Legal read fixture store (fictitious lab data) */

import type {
  LegalAuditEventRow,
  LegalDocumentInstanceRow,
  LegalDocumentSubmissionRow,
  LegalTemplateAssetRow,
  LegalTemplateRow,
  LegalTemplateVersionRow,
  LegalW9RequestRow,
} from '../schema/legal-persistence-row-types';

const TS = '2026-07-21T12:00:00.000Z';

export const LC11_FIXTURE_UUIDS = Object.freeze({
  template: '11111111-1111-4111-8111-111111111101',
  templateVersion: '11111111-1111-4111-8111-111111111102',
  templateAsset: '11111111-1111-4111-8111-111111111103',
  instance: '22222222-2222-4222-8222-222222222201',
  w9Request: '33333333-3333-4333-8333-333333333301',
  submissionActive: '44444444-4444-4444-8444-444444444401',
  submissionDeleted: '44444444-4444-4444-8444-444444444402',
  audit1: '55555555-5555-4555-8555-555555555501',
  audit2: '55555555-5555-4555-8555-555555555502',
});

export const LC11_FIXTURE_TEMPLATE_ROW: LegalTemplateRow = Object.freeze({
  id: LC11_FIXTURE_UUIDS.template,
  business_id: 'SPC-001',
  template_code: 'SPC-001',
  category: 'SPC',
  official_name: 'W-9 Request for Taxpayer Identification',
  current_published_version_id: 'TV-SPC-001-1',
  status: 'published',
  is_policy: false,
  requires_countersign: false,
  counsel_review_required: true,
  signature_plan_default: Object.freeze({ requirement: 'single_signer' }),
  field_schema_default: Object.freeze({ channel: 'legal_center' }),
  created_at: TS,
  updated_at: TS,
  row_version: 1,
});

export const LC11_FIXTURE_TEMPLATE_VERSION_ROW: LegalTemplateVersionRow = Object.freeze({
  id: LC11_FIXTURE_UUIDS.templateVersion,
  business_id: 'TV-SPC-001-1',
  template_id: LC11_FIXTURE_UUIDS.template,
  template_business_id: 'SPC-001',
  semver: '1.0.0',
  content_hash: 'sha256:demo-template-hash-001',
  published_at: TS,
  published_by_staff_id: 'STAFF-OWNER-001',
  effective_from: TS,
  retired_at: null,
  locale_bodies: Object.freeze({ en: 'W-9 template body demo' }),
  row_version: 1,
});

export const LC11_FIXTURE_TEMPLATE_ASSET_ROW: LegalTemplateAssetRow = Object.freeze({
  id: LC11_FIXTURE_UUIDS.templateAsset,
  template_version_id: LC11_FIXTURE_UUIDS.templateVersion,
  template_business_id: 'SPC-001',
  template_version_business_id: 'TV-SPC-001-1',
  asset_key: 'tax/SPC-001/TV-SPC-001-1/fw9-corporate',
  filename: 'fw9-corporate.pdf',
  mime_type: 'application/pdf',
  kind: 'pdf',
  category: 'w9',
  availability: 'ready',
  object_key: 'legal/templates/tax/SPC-001/TV-SPC-001-1/fw9-corporate.pdf',
  shared_across_portals: true,
  allowed_portals: Object.freeze(['staff', 'artist']),
  is_public_library_document: false,
  row_version: 1,
});

export const LC11_FIXTURE_INSTANCE_ROW: LegalDocumentInstanceRow = Object.freeze({
  id: LC11_FIXTURE_UUIDS.instance,
  business_id: 'LDI-000101',
  template_id: 'SPC-001',
  template_version_id: 'TV-SPC-001-1',
  category: 'SPC',
  title: 'Demo W-9 Instance',
  recipient_type: 'artist',
  recipient_id: 'ART-DEMO-001',
  recipient_display_name: 'Demo Artist',
  recipient_email: 'demo-artist@example.test',
  owner_type: 'platform',
  owner_id: 'MDJB-PLATFORM',
  issued_by: 'STAFF-OWNER-001',
  assigned_by: 'STAFF-OWNER-001',
  status: 'viewed',
  instance_version: 2,
  source: 'template',
  signature_requirement: Object.freeze({ requirement: 'single_signer', requiredSignerCount: 1 }),
  metadata: Object.freeze({ channel: 'legal_center' }),
  expires_at: null,
  sent_at: TS,
  viewed_at: TS,
  signed_at: null,
  rejected_at: null,
  cancelled_at: null,
  expired_at: null,
  created_at: TS,
  updated_at: TS,
  row_version: 2,
});

export const LC11_FIXTURE_W9_REQUEST_ROW: LegalW9RequestRow = Object.freeze({
  id: LC11_FIXTURE_UUIDS.w9Request,
  business_id: 'W9R-000101',
  document_instance_id: LC11_FIXTURE_UUIDS.instance,
  document_instance_business_id: 'LDI-000101',
  template_id: 'SPC-001',
  template_version_id: 'TV-SPC-001-1',
  recipient_type: 'artist',
  recipient_id: 'ART-DEMO-001',
  recipient_display_name: 'Demo Artist',
  recipient_email: 'demo-artist@example.test',
  requested_by_actor_id: 'STAFF-OWNER-001',
  requested_by_display_name: 'Staff Owner Demo',
  requested_by_role: 'owner',
  status: 'awaiting_upload',
  review_status: 'not_started',
  submission_id: LC11_FIXTURE_UUIDS.submissionActive,
  submission_business_id: 'LDS-000101',
  requested_at: TS,
  updated_at: TS,
  due_at: '2026-07-26T12:00:00.000Z',
  viewed_at: TS,
  completed_at: null,
  metadata: Object.freeze({ seed: 'lc11-fixture' }),
  row_version: 3,
});

export const LC11_FIXTURE_SUBMISSION_ACTIVE_ROW: LegalDocumentSubmissionRow = Object.freeze({
  id: LC11_FIXTURE_UUIDS.submissionActive,
  business_id: 'LDS-000101',
  document_instance_id: LC11_FIXTURE_UUIDS.instance,
  document_instance_business_id: 'LDI-000101',
  workflow_id: LC11_FIXTURE_UUIDS.w9Request,
  workflow_business_id: 'W9R-000101',
  template_id: 'SPC-001',
  template_version_id: 'TV-SPC-001-1',
  storage_key: 'legal/submissions/LDI-000101/LDS-000101.pdf',
  filename: 'w9-demo.pdf',
  mime_type: 'application/pdf',
  size_bytes: 2048,
  checksum: 'sha256:demo-checksum-lc11-001',
  content_reference: 'in-memory://w9/demo/lc11-001',
  submitted_by_actor_id: 'ART-DEMO-001',
  submitted_by_display_name: 'Demo Artist',
  submitted_by_portal: 'artist',
  submitted_by_role: null,
  status: 'uploaded',
  metadata: Object.freeze({ channel: 'legal_center' }),
  replaces_submission_id: null,
  replaced_by_submission_id: null,
  deleted_at: null,
  deleted_by_actor_id: null,
  delete_reason_code: null,
  recipient_type: 'artist',
  recipient_id: 'ART-DEMO-001',
  created_at: '2026-07-21T11:55:00.000Z',
  submitted_at: TS,
  updated_at: TS,
  row_version: 1,
});

export const LC11_FIXTURE_SUBMISSION_DELETED_ROW: LegalDocumentSubmissionRow = Object.freeze({
  ...LC11_FIXTURE_SUBMISSION_ACTIVE_ROW,
  id: LC11_FIXTURE_UUIDS.submissionDeleted,
  business_id: 'LDS-000102',
  status: 'deleted',
  deleted_at: TS,
  deleted_by_actor_id: 'STAFF-OWNER-001',
  delete_reason_code: 'owner_cleanup',
  replaced_by_submission_id: LC11_FIXTURE_UUIDS.submissionActive,
  row_version: 2,
});

export const LC11_FIXTURE_AUDIT_ROWS: readonly LegalAuditEventRow[] = Object.freeze([
  Object.freeze({
    id: LC11_FIXTURE_UUIDS.audit1,
    business_id: 'LAE-000101',
    sequence: 1,
    occurred_at: TS,
    actor_type: 'staff',
    actor_id: 'STAFF-OWNER-001',
    actor_role: 'owner',
    actor_portal: 'staff',
    actor_display_name: 'Staff Owner Demo',
    action: 'w9_requested',
    entity_type: 'w9_request',
    entity_id: 'W9R-000101',
    related_entity_ids: Object.freeze(['ART-DEMO-001']),
    previous_state: null,
    next_state: Object.freeze({ status: 'requested' }),
    outcome: 'success',
    reason_code: null,
    correlation_id: 'LAC-000101',
    request_id: null,
    metadata: Object.freeze({ channel: 'legal_center' }),
  }),
  Object.freeze({
    id: LC11_FIXTURE_UUIDS.audit2,
    business_id: 'LAE-000102',
    sequence: 2,
    occurred_at: '2026-07-21T12:05:00.000Z',
    actor_type: 'artist',
    actor_id: 'ART-DEMO-001',
    actor_role: 'artist',
    actor_portal: 'artist',
    actor_display_name: 'Demo Artist',
    action: 'w9_submitted',
    entity_type: 'w9_request',
    entity_id: 'W9R-000101',
    related_entity_ids: Object.freeze(['LDS-000101']),
    previous_state: Object.freeze({ status: 'awaiting_upload' }),
    next_state: Object.freeze({ status: 'submitted' }),
    outcome: 'success',
    reason_code: null,
    correlation_id: 'LAC-000101',
    request_id: null,
    metadata: Object.freeze({ channel: 'legal_center' }),
  }),
]);

export type LegalReadFixtureStore = {
  readonly templates: readonly LegalTemplateRow[];
  readonly templateVersions: readonly LegalTemplateVersionRow[];
  readonly templateAssets: readonly LegalTemplateAssetRow[];
  readonly instances: readonly LegalDocumentInstanceRow[];
  readonly w9Requests: readonly LegalW9RequestRow[];
  readonly submissions: readonly LegalDocumentSubmissionRow[];
  readonly auditEvents: readonly LegalAuditEventRow[];
};

export function createLegalReadFixtureStore(
  overrides: Partial<LegalReadFixtureStore> = {},
): LegalReadFixtureStore {
  return Object.freeze({
    templates: overrides.templates ?? Object.freeze([LC11_FIXTURE_TEMPLATE_ROW]),
    templateVersions: overrides.templateVersions ?? Object.freeze([LC11_FIXTURE_TEMPLATE_VERSION_ROW]),
    templateAssets: overrides.templateAssets ?? Object.freeze([LC11_FIXTURE_TEMPLATE_ASSET_ROW]),
    instances: overrides.instances ?? Object.freeze([LC11_FIXTURE_INSTANCE_ROW]),
    w9Requests: overrides.w9Requests ?? Object.freeze([LC11_FIXTURE_W9_REQUEST_ROW]),
    submissions:
      overrides.submissions ??
      Object.freeze([LC11_FIXTURE_SUBMISSION_ACTIVE_ROW, LC11_FIXTURE_SUBMISSION_DELETED_ROW]),
    auditEvents: overrides.auditEvents ?? LC11_FIXTURE_AUDIT_ROWS,
  });
}

export function cloneLegalReadFixtureStore(store: LegalReadFixtureStore): LegalReadFixtureStore {
  return Object.freeze({
    templates: Object.freeze([...store.templates]),
    templateVersions: Object.freeze([...store.templateVersions]),
    templateAssets: Object.freeze([...store.templateAssets]),
    instances: Object.freeze([...store.instances]),
    w9Requests: Object.freeze([...store.w9Requests]),
    submissions: Object.freeze([...store.submissions]),
    auditEvents: Object.freeze([...store.auditEvents]),
  });
}
