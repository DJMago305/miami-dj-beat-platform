/** LC-11 — Legal persistence row contracts */

export type LegalPersistenceMetadata = Readonly<Record<string, string | number | boolean | null>>;

export type LegalTemplateRow = {
  readonly id: string;
  readonly business_id: string;
  readonly template_code: string;
  readonly category: string;
  readonly official_name: string;
  readonly current_published_version_id: string | null;
  readonly status: string;
  readonly is_policy: boolean;
  readonly requires_countersign: boolean;
  readonly counsel_review_required: boolean;
  readonly signature_plan_default: LegalPersistenceMetadata;
  readonly field_schema_default: LegalPersistenceMetadata;
  readonly created_at: string;
  readonly updated_at: string;
  readonly row_version: number;
};

export type LegalTemplateVersionRow = {
  readonly id: string;
  readonly business_id: string;
  readonly template_id: string;
  readonly template_business_id: string;
  readonly semver: string;
  readonly content_hash: string;
  readonly published_at: string;
  readonly published_by_staff_id: string;
  readonly effective_from: string;
  readonly retired_at: string | null;
  readonly locale_bodies: LegalPersistenceMetadata;
  readonly row_version: number;
};

export type LegalTemplateAssetRow = {
  readonly id: string;
  readonly template_version_id: string;
  readonly template_business_id: string;
  readonly template_version_business_id: string;
  readonly asset_key: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly kind: string;
  readonly category: string;
  readonly availability: string;
  readonly object_key: string;
  readonly shared_across_portals: boolean;
  readonly allowed_portals: readonly string[];
  readonly is_public_library_document: boolean;
  readonly row_version: number;
};

export type LegalDocumentInstanceRow = {
  readonly id: string;
  readonly business_id: string;
  readonly template_id: string;
  readonly template_version_id: string;
  readonly category: string;
  readonly title: string;
  readonly recipient_type: string;
  readonly recipient_id: string;
  readonly recipient_display_name: string;
  readonly recipient_email: string | null;
  readonly owner_type: string;
  readonly owner_id: string;
  readonly issued_by: string | null;
  readonly assigned_by: string | null;
  readonly status: string;
  readonly instance_version: number;
  readonly source: string;
  readonly signature_requirement: LegalPersistenceMetadata;
  readonly metadata: LegalPersistenceMetadata;
  readonly expires_at: string | null;
  readonly sent_at: string | null;
  readonly viewed_at: string | null;
  readonly signed_at: string | null;
  readonly rejected_at: string | null;
  readonly cancelled_at: string | null;
  readonly expired_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly row_version: number;
};

export type LegalW9RequestRow = {
  readonly id: string;
  readonly business_id: string;
  readonly document_instance_id: string;
  readonly document_instance_business_id: string;
  readonly template_id: string;
  readonly template_version_id: string;
  readonly recipient_type: string;
  readonly recipient_id: string;
  readonly recipient_display_name: string;
  readonly recipient_email: string | null;
  readonly requested_by_actor_id: string;
  readonly requested_by_display_name: string;
  readonly requested_by_role: string;
  readonly status: string;
  readonly review_status: string;
  readonly submission_id: string | null;
  readonly submission_business_id: string | null;
  readonly requested_at: string;
  readonly updated_at: string;
  readonly due_at: string | null;
  readonly viewed_at: string | null;
  readonly completed_at: string | null;
  readonly metadata: LegalPersistenceMetadata;
  readonly row_version: number;
};

export type LegalDocumentSubmissionRow = {
  readonly id: string;
  readonly business_id: string;
  readonly document_instance_id: string;
  readonly document_instance_business_id: string;
  readonly workflow_id: string | null;
  readonly workflow_business_id: string | null;
  readonly template_id: string;
  readonly template_version_id: string;
  readonly storage_key: string;
  readonly filename: string;
  readonly mime_type: string;
  readonly size_bytes: number;
  readonly checksum: string;
  readonly content_reference: string;
  readonly submitted_by_actor_id: string;
  readonly submitted_by_display_name: string;
  readonly submitted_by_portal: string;
  readonly submitted_by_role: string | null;
  readonly status: string;
  readonly metadata: LegalPersistenceMetadata;
  readonly replaces_submission_id: string | null;
  readonly replaced_by_submission_id: string | null;
  readonly deleted_at: string | null;
  readonly deleted_by_actor_id: string | null;
  readonly delete_reason_code: string | null;
  readonly recipient_type: string;
  readonly recipient_id: string;
  readonly created_at: string;
  readonly submitted_at: string;
  readonly updated_at: string;
  readonly row_version: number;
};

export type LegalAuditEventRow = {
  readonly id: string;
  readonly business_id: string;
  readonly sequence: number;
  readonly occurred_at: string;
  readonly actor_type: string;
  readonly actor_id: string;
  readonly actor_role: string;
  readonly actor_portal: string;
  readonly actor_display_name: string | null;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly related_entity_ids: LegalPersistenceMetadata;
  readonly previous_state: LegalPersistenceMetadata | null;
  readonly next_state: LegalPersistenceMetadata | null;
  readonly outcome: string;
  readonly reason_code: string | null;
  readonly correlation_id: string | null;
  readonly request_id: string | null;
  readonly metadata: LegalPersistenceMetadata;
};

export type LegalPersistenceReadEnvelope<T> = {
  readonly data: readonly T[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
};
