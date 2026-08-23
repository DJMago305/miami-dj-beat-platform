-- LC-12 — Legal Center persistence foundation (local migration only)
-- Ticket: TICKET-V2-LEGAL-CENTER-LC-12-SUPABASE-SCHEMA-LOCAL-MIGRATION-FOUNDATION-001
-- Status: NOT APPLIED — review-only local schema definition
-- Aligns with LC-11 row contracts in MiamiDJBeat-MigracionV2/shared/services/legal/persistence/schema/

-- 1) Audit sequence (append-only monotonic ordering)
CREATE SEQUENCE IF NOT EXISTS public.legal_audit_event_sequence
  AS bigint
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

COMMENT ON SEQUENCE public.legal_audit_event_sequence IS
  'Monotonic sequence for legal_audit_events.sequence. Server-side only; never computed from MAX(sequence)+1.';

-- 2) legal_templates
CREATE TABLE IF NOT EXISTS public.legal_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id text NOT NULL,
  template_code text NOT NULL,
  category text NOT NULL,
  official_name text NOT NULL,
  current_published_version_id text,
  status text NOT NULL,
  is_policy boolean NOT NULL DEFAULT false,
  requires_countersign boolean NOT NULL DEFAULT false,
  counsel_review_required boolean NOT NULL DEFAULT false,
  signature_plan_default jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_schema_default jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_templates_business_id_unique UNIQUE (business_id),
  CONSTRAINT legal_templates_business_id_format CHECK (business_id ~ '^SPC-[0-9]{3,}$'),
  CONSTRAINT legal_templates_row_version_positive CHECK (row_version >= 1),
  CONSTRAINT legal_templates_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT legal_templates_signature_plan_object CHECK (jsonb_typeof(signature_plan_default) = 'object'),
  CONSTRAINT legal_templates_field_schema_object CHECK (jsonb_typeof(field_schema_default) = 'object')
);

COMMENT ON TABLE public.legal_templates IS
  'Legal template catalog. Internal UUID in id; domain exposes business_id (SPC-*).';
COMMENT ON COLUMN public.legal_templates.id IS 'Internal UUID primary key; not exposed to portals.';
COMMENT ON COLUMN public.legal_templates.business_id IS 'Domain template business ID (SPC-*).';

-- 3) legal_template_versions
CREATE TABLE IF NOT EXISTS public.legal_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id text NOT NULL,
  template_row_id uuid NOT NULL,
  template_business_id text NOT NULL,
  semver text NOT NULL,
  content_hash text NOT NULL,
  published_at timestamptz NOT NULL,
  published_by_staff_id text NOT NULL,
  effective_from timestamptz NOT NULL,
  retired_at timestamptz,
  locale_bodies jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT legal_template_versions_business_id_unique UNIQUE (business_id),
  CONSTRAINT legal_template_versions_business_id_format CHECK (business_id ~ '^TV-.+'),
  CONSTRAINT legal_template_versions_row_version_positive CHECK (row_version >= 1),
  CONSTRAINT legal_template_versions_locale_bodies_object CHECK (jsonb_typeof(locale_bodies) = 'object'),
  CONSTRAINT legal_template_versions_template_row_fk
    FOREIGN KEY (template_row_id) REFERENCES public.legal_templates (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

COMMENT ON TABLE public.legal_template_versions IS
  'Published template versions. template_row_id is internal UUID FK; business_id is TV-* domain ID.';

-- 4) legal_template_assets (metadata only — no binary PDF storage)
CREATE TABLE IF NOT EXISTS public.legal_template_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_version_row_id uuid NOT NULL,
  template_business_id text NOT NULL,
  template_version_business_id text NOT NULL,
  asset_key text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL,
  kind text NOT NULL,
  category text NOT NULL,
  availability text NOT NULL,
  object_key text NOT NULL,
  shared_across_portals boolean NOT NULL DEFAULT false,
  allowed_portals jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public_library_document boolean NOT NULL DEFAULT false,
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT legal_template_assets_asset_key_unique UNIQUE (asset_key),
  CONSTRAINT legal_template_assets_row_version_positive CHECK (row_version >= 1),
  CONSTRAINT legal_template_assets_allowed_portals_array CHECK (jsonb_typeof(allowed_portals) = 'array'),
  CONSTRAINT legal_template_assets_template_version_row_fk
    FOREIGN KEY (template_version_row_id) REFERENCES public.legal_template_versions (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

COMMENT ON TABLE public.legal_template_assets IS
  'Template asset metadata only. Private object_key; no binary PDF payload stored here.';
COMMENT ON COLUMN public.legal_template_assets.object_key IS
  'Private storage object key reference. Bucket remains private; no public URL stored.';

-- 5) legal_document_instances
CREATE TABLE IF NOT EXISTS public.legal_document_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id text NOT NULL,
  template_row_id uuid NOT NULL,
  template_version_row_id uuid NOT NULL,
  template_business_id text NOT NULL,
  template_version_business_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  recipient_type text NOT NULL,
  recipient_id text NOT NULL,
  recipient_display_name text NOT NULL,
  recipient_email text,
  owner_type text NOT NULL,
  owner_id text NOT NULL,
  issued_by text,
  assigned_by text,
  status text NOT NULL,
  instance_version integer NOT NULL DEFAULT 1,
  source text NOT NULL,
  signature_requirement jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_document_instances_business_id_unique UNIQUE (business_id),
  CONSTRAINT legal_document_instances_business_id_format CHECK (business_id ~ '^LDI-[0-9]{6,}$'),
  CONSTRAINT legal_document_instances_status_valid CHECK (
    status IN ('draft', 'pending', 'sent', 'viewed', 'signed', 'rejected', 'expired', 'cancelled')
  ),
  CONSTRAINT legal_document_instances_recipient_present CHECK (
    length(trim(recipient_type)) > 0 AND length(trim(recipient_id)) > 0
  ),
  CONSTRAINT legal_document_instances_row_version_positive CHECK (row_version >= 1),
  CONSTRAINT legal_document_instances_updated_at_gte_created_at CHECK (updated_at >= created_at),
  CONSTRAINT legal_document_instances_signature_requirement_object CHECK (jsonb_typeof(signature_requirement) = 'object'),
  CONSTRAINT legal_document_instances_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT legal_document_instances_template_row_fk
    FOREIGN KEY (template_row_id) REFERENCES public.legal_templates (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT legal_document_instances_template_version_row_fk
    FOREIGN KEY (template_version_row_id) REFERENCES public.legal_template_versions (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

COMMENT ON TABLE public.legal_document_instances IS
  'Legal document instances (LC-6). business_id is domain LDI-*; internal UUID FKs use *_row_id columns.';

-- 6) legal_w9_requests
CREATE TABLE IF NOT EXISTS public.legal_w9_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id text NOT NULL,
  document_instance_row_id uuid NOT NULL,
  document_instance_business_id text NOT NULL,
  template_row_id uuid NOT NULL,
  template_version_row_id uuid NOT NULL,
  template_business_id text NOT NULL,
  template_version_business_id text NOT NULL,
  recipient_type text NOT NULL,
  recipient_id text NOT NULL,
  recipient_display_name text NOT NULL,
  recipient_email text,
  requested_by_actor_id text NOT NULL,
  requested_by_display_name text NOT NULL,
  requested_by_role text NOT NULL,
  status text NOT NULL,
  review_status text NOT NULL,
  submission_row_id uuid,
  submission_business_id text,
  requested_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  viewed_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  row_version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_w9_requests_business_id_unique UNIQUE (business_id),
  CONSTRAINT legal_w9_requests_business_id_format CHECK (business_id ~ '^W9R-[0-9]{6,}$'),
  CONSTRAINT legal_w9_requests_status_valid CHECK (
    status IN (
      'requested', 'available', 'viewed', 'awaiting_upload',
      'submitted', 'accepted', 'rejected', 'expired', 'cancelled'
    )
  ),
  CONSTRAINT legal_w9_requests_review_status_valid CHECK (
    review_status IN ('not_started', 'pending_review', 'complete')
  ),
  CONSTRAINT legal_w9_requests_row_version_positive CHECK (row_version >= 1),
  CONSTRAINT legal_w9_requests_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT legal_w9_requests_document_instance_row_fk
    FOREIGN KEY (document_instance_row_id) REFERENCES public.legal_document_instances (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT legal_w9_requests_template_row_fk
    FOREIGN KEY (template_row_id) REFERENCES public.legal_templates (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT legal_w9_requests_template_version_row_fk
    FOREIGN KEY (template_version_row_id) REFERENCES public.legal_template_versions (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

COMMENT ON TABLE public.legal_w9_requests IS
  'W-9 collection workflow requests (LC-7). One active request per recipient+template enforced by partial unique index.';

-- 7) legal_document_submissions
CREATE TABLE IF NOT EXISTS public.legal_document_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id text NOT NULL,
  document_instance_row_id uuid NOT NULL,
  document_instance_business_id text NOT NULL,
  workflow_row_id uuid,
  workflow_business_id text,
  template_business_id text NOT NULL,
  template_version_business_id text NOT NULL,
  recipient_type text NOT NULL,
  recipient_id text NOT NULL,
  storage_key text NOT NULL,
  filename text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/pdf',
  size_bytes bigint NOT NULL,
  checksum text NOT NULL,
  content_reference text NOT NULL,
  submitted_by_actor_id text NOT NULL,
  submitted_by_display_name text NOT NULL,
  submitted_by_portal text NOT NULL,
  submitted_by_role text,
  status text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  replaces_submission_row_id uuid,
  replaced_by_submission_row_id uuid,
  deleted_at timestamptz,
  deleted_by_actor_id text,
  delete_reason_code text,
  created_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 1,
  CONSTRAINT legal_document_submissions_business_id_unique UNIQUE (business_id),
  CONSTRAINT legal_document_submissions_business_id_format CHECK (business_id ~ '^LDS-[0-9]{6,}$'),
  CONSTRAINT legal_document_submissions_status_valid CHECK (
    status IN ('pending_upload', 'uploaded', 'under_review', 'accepted', 'rejected', 'deleted')
  ),
  CONSTRAINT legal_document_submissions_mime_pdf CHECK (mime_type = 'application/pdf'),
  CONSTRAINT legal_document_submissions_size_positive CHECK (size_bytes > 0),
  CONSTRAINT legal_document_submissions_size_max CHECK (size_bytes <= 20971520),
  CONSTRAINT legal_document_submissions_checksum_present CHECK (length(trim(checksum)) > 0),
  CONSTRAINT legal_document_submissions_timestamp_order CHECK (
    created_at <= submitted_at AND submitted_at <= updated_at
  ),
  CONSTRAINT legal_document_submissions_deleted_coherence CHECK (
    (status = 'deleted' AND deleted_at IS NOT NULL)
    OR (status <> 'deleted' AND deleted_at IS NULL)
  ),
  CONSTRAINT legal_document_submissions_no_self_replace CHECK (
    replaces_submission_row_id IS NULL OR replaces_submission_row_id <> id
  ),
  CONSTRAINT legal_document_submissions_no_self_replaced_by CHECK (
    replaced_by_submission_row_id IS NULL OR replaced_by_submission_row_id <> id
  ),
  CONSTRAINT legal_document_submissions_row_version_positive CHECK (row_version >= 1),
  CONSTRAINT legal_document_submissions_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT legal_document_submissions_recipient_present CHECK (
    length(trim(recipient_type)) > 0 AND length(trim(recipient_id)) > 0
  ),
  CONSTRAINT legal_document_submissions_document_instance_row_fk
    FOREIGN KEY (document_instance_row_id) REFERENCES public.legal_document_instances (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT legal_document_submissions_workflow_row_fk
    FOREIGN KEY (workflow_row_id) REFERENCES public.legal_w9_requests (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT legal_document_submissions_replaces_row_fk
    FOREIGN KEY (replaces_submission_row_id) REFERENCES public.legal_document_submissions (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT legal_document_submissions_replaced_by_row_fk
    FOREIGN KEY (replaced_by_submission_row_id) REFERENCES public.legal_document_submissions (id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

COMMENT ON TABLE public.legal_document_submissions IS
  'Submission metadata only (LC-8). Soft delete via status=deleted + deleted_at. recipient_* denormalized for read authorization.';
COMMENT ON COLUMN public.legal_document_submissions.recipient_type IS
  'Controlled denormalization from instance recipient for read-scope authorization without extra join.';
COMMENT ON COLUMN public.legal_document_submissions.recipient_id IS
  'Controlled denormalization from instance recipient for read-scope authorization without extra join.';
COMMENT ON COLUMN public.legal_document_submissions.storage_key IS
  'Private storage key reference. No binary payload stored in Postgres.';

-- Deferred FK: w9 submission_row_id → submissions (after submissions table exists)
ALTER TABLE public.legal_w9_requests
  DROP CONSTRAINT IF EXISTS legal_w9_requests_submission_row_fk;
ALTER TABLE public.legal_w9_requests
  ADD CONSTRAINT legal_w9_requests_submission_row_fk
  FOREIGN KEY (submission_row_id) REFERENCES public.legal_document_submissions (id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- 8) legal_audit_events (append-only)
CREATE TABLE IF NOT EXISTS public.legal_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id text NOT NULL,
  sequence bigint NOT NULL DEFAULT nextval('public.legal_audit_event_sequence'),
  occurred_at timestamptz NOT NULL,
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  actor_role text NOT NULL,
  actor_portal text NOT NULL,
  actor_display_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  related_entity_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  previous_state jsonb,
  next_state jsonb,
  outcome text NOT NULL,
  reason_code text,
  correlation_id text NOT NULL,
  request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT legal_audit_events_business_id_unique UNIQUE (business_id),
  CONSTRAINT legal_audit_events_sequence_unique UNIQUE (sequence),
  CONSTRAINT legal_audit_events_business_id_format CHECK (business_id ~ '^LAE-[0-9]{6,}$'),
  CONSTRAINT legal_audit_events_sequence_positive CHECK (sequence > 0),
  CONSTRAINT legal_audit_events_outcome_valid CHECK (outcome IN ('success', 'denied', 'failed')),
  CONSTRAINT legal_audit_events_entity_type_valid CHECK (
    entity_type IN (
      'legal_document_instance',
      'w9_request',
      'legal_document_submission',
      'legal_template',
      'legal_template_asset'
    )
  ),
  CONSTRAINT legal_audit_events_reason_code_required CHECK (
    (outcome = 'success')
    OR (outcome IN ('denied', 'failed') AND reason_code IS NOT NULL AND length(trim(reason_code)) > 0)
  ),
  CONSTRAINT legal_audit_events_related_entity_ids_array CHECK (jsonb_typeof(related_entity_ids) = 'array'),
  CONSTRAINT legal_audit_events_correlation_id_present CHECK (
    length(trim(correlation_id)) > 0
  ),
  CONSTRAINT legal_audit_events_correlation_id_format CHECK (
    correlation_id ~ '^LAC-[0-9]{6,}$'
  ),
  CONSTRAINT legal_audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT legal_audit_events_previous_state_object CHECK (
    previous_state IS NULL OR jsonb_typeof(previous_state) = 'object'
  ),
  CONSTRAINT legal_audit_events_next_state_object CHECK (
    next_state IS NULL OR jsonb_typeof(next_state) = 'object'
  )
);

COMMENT ON TABLE public.legal_audit_events IS
  'Append-only legal audit trail (LC-9). entity_id stores business IDs; no rigid FK to preserve history.';
COMMENT ON COLUMN public.legal_audit_events.sequence IS
  'Monotonic server-side sequence from legal_audit_event_sequence.';
COMMENT ON COLUMN public.legal_audit_events.correlation_id IS
  'Required LAC-###### correlation token (LC-9). Non-empty; matches domain isValidLegalAuditCorrelationId.';

-- 9) Partial unique index — one active W-9 per recipient+template (LC-7 ACTIVE set)
CREATE UNIQUE INDEX IF NOT EXISTS legal_w9_requests_one_active_per_recipient_template
  ON public.legal_w9_requests (recipient_type, recipient_id, template_row_id)
  WHERE status IN ('requested', 'available', 'viewed', 'awaiting_upload', 'submitted');

COMMENT ON INDEX public.legal_w9_requests_one_active_per_recipient_template IS
  'Enforces one active W-9 request per recipient/template. Active set matches LC-7 ACTIVE_LEGAL_W9_REQUEST_STATUSES (includes submitted).';

-- 10) Supporting indexes (LC-11 read query patterns)
CREATE INDEX IF NOT EXISTS legal_templates_status_idx ON public.legal_templates (status);
CREATE INDEX IF NOT EXISTS legal_templates_category_idx ON public.legal_templates (category);

CREATE INDEX IF NOT EXISTS legal_template_versions_template_row_id_idx
  ON public.legal_template_versions (template_row_id);
CREATE INDEX IF NOT EXISTS legal_template_versions_effective_from_idx
  ON public.legal_template_versions (effective_from);

CREATE INDEX IF NOT EXISTS legal_template_assets_template_version_row_id_idx
  ON public.legal_template_assets (template_version_row_id);
CREATE INDEX IF NOT EXISTS legal_template_assets_template_business_id_idx
  ON public.legal_template_assets (template_business_id);

CREATE INDEX IF NOT EXISTS legal_document_instances_recipient_idx
  ON public.legal_document_instances (recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS legal_document_instances_template_business_id_idx
  ON public.legal_document_instances (template_business_id);
CREATE INDEX IF NOT EXISTS legal_document_instances_status_idx
  ON public.legal_document_instances (status);
CREATE INDEX IF NOT EXISTS legal_document_instances_created_at_idx
  ON public.legal_document_instances (created_at);
CREATE INDEX IF NOT EXISTS legal_document_instances_updated_at_idx
  ON public.legal_document_instances (updated_at);

CREATE INDEX IF NOT EXISTS legal_w9_requests_recipient_idx
  ON public.legal_w9_requests (recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS legal_w9_requests_document_instance_row_id_idx
  ON public.legal_w9_requests (document_instance_row_id);
CREATE INDEX IF NOT EXISTS legal_w9_requests_template_business_id_idx
  ON public.legal_w9_requests (template_business_id);
CREATE INDEX IF NOT EXISTS legal_w9_requests_status_idx ON public.legal_w9_requests (status);
CREATE INDEX IF NOT EXISTS legal_w9_requests_requested_at_idx ON public.legal_w9_requests (requested_at);

CREATE INDEX IF NOT EXISTS legal_document_submissions_document_instance_row_id_idx
  ON public.legal_document_submissions (document_instance_row_id);
CREATE INDEX IF NOT EXISTS legal_document_submissions_workflow_row_id_idx
  ON public.legal_document_submissions (workflow_row_id);
CREATE INDEX IF NOT EXISTS legal_document_submissions_recipient_idx
  ON public.legal_document_submissions (recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS legal_document_submissions_status_idx
  ON public.legal_document_submissions (status);
CREATE INDEX IF NOT EXISTS legal_document_submissions_submitted_at_idx
  ON public.legal_document_submissions (submitted_at);
CREATE INDEX IF NOT EXISTS legal_document_submissions_deleted_at_idx
  ON public.legal_document_submissions (deleted_at);
CREATE INDEX IF NOT EXISTS legal_document_submissions_replaces_row_id_idx
  ON public.legal_document_submissions (replaces_submission_row_id);
CREATE INDEX IF NOT EXISTS legal_document_submissions_replaced_by_row_id_idx
  ON public.legal_document_submissions (replaced_by_submission_row_id);

CREATE INDEX IF NOT EXISTS legal_audit_events_entity_idx
  ON public.legal_audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS legal_audit_events_actor_idx
  ON public.legal_audit_events (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS legal_audit_events_action_idx ON public.legal_audit_events (action);
CREATE INDEX IF NOT EXISTS legal_audit_events_correlation_id_idx
  ON public.legal_audit_events (correlation_id);
CREATE INDEX IF NOT EXISTS legal_audit_events_occurred_at_idx ON public.legal_audit_events (occurred_at);

-- 11) Append-only audit mutation guard (local schema protection)
CREATE OR REPLACE FUNCTION public.prevent_legal_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'legal_audit_events is append-only; % is forbidden', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS legal_audit_events_prevent_update ON public.legal_audit_events;
CREATE TRIGGER legal_audit_events_prevent_update
  BEFORE UPDATE ON public.legal_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_legal_audit_mutation();

DROP TRIGGER IF EXISTS legal_audit_events_prevent_delete ON public.legal_audit_events;
CREATE TRIGGER legal_audit_events_prevent_delete
  BEFORE DELETE ON public.legal_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_legal_audit_mutation();

COMMENT ON FUNCTION public.prevent_legal_audit_mutation() IS
  'Rejects UPDATE/DELETE on legal_audit_events. RLS/grants deferred to future phase.';
