-- Parental-consent waiver type, strip built-in legal-jargon blocks from signed
-- bodies, host-only minor participant storage, and completed-waiver retention.

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_document_type_check;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_document_type_check
  CHECK (document_type IN (
    'nda', 'invoice', 'contract', 'receipt', 'waiver', 'parental_consent_waiver', 'quote',
    'work_order', 'change_order', 'service_agreement', 'scope_of_work',
    'consent_form', 'cancellation_policy', 'credit_card_authorization',
    'recurring_service_authorization', 'property_access_authorization',
    'key_access_receipt', 'inspection_acknowledgment', 'completion_sign_off',
    'delivery_acceptance', 'damage_condition_report', 'rental_agreement',
    'photo_video_release',
    'walkthrough', 'showing_acknowledgment', 'repair_confirmation',
    'maintenance_approval', 'other', 'upload', 'quick_addendum'
  ));

ALTER TABLE public.document_templates
  DROP CONSTRAINT IF EXISTS document_templates_document_type_check;

ALTER TABLE public.document_templates
  ADD CONSTRAINT document_templates_document_type_check
  CHECK (document_type IN (
    'nda', 'invoice', 'contract', 'receipt', 'waiver', 'parental_consent_waiver', 'quote',
    'work_order', 'change_order', 'service_agreement', 'scope_of_work',
    'consent_form', 'cancellation_policy', 'credit_card_authorization',
    'recurring_service_authorization', 'property_access_authorization',
    'key_access_receipt', 'inspection_acknowledgment', 'completion_sign_off',
    'delivery_acceptance', 'damage_condition_report', 'rental_agreement',
    'photo_video_release',
    'walkthrough', 'showing_acknowledgment', 'repair_confirmation',
    'maintenance_approval', 'other', 'upload', 'quick_addendum'
  ));

ALTER TABLE public.host_document_templates
  DROP CONSTRAINT IF EXISTS host_document_templates_type_check;

ALTER TABLE public.host_document_templates
  ADD CONSTRAINT host_document_templates_type_check CHECK (document_type IN (
    'nda', 'contract', 'waiver', 'parental_consent_waiver', 'quote', 'invoice', 'receipt', 'quick_addendum'
  ));

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS parent_guardian_name text,
  ADD COLUMN IF NOT EXISTS parent_guardian_email text,
  ADD COLUMN IF NOT EXISTS parental_consent_text text,
  ADD COLUMN IF NOT EXISTS waiver_minors_purged_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS waiver_retention text DEFAULT 'keep';

COMMENT ON COLUMN public.profiles.waiver_retention IS
  'keep, or day count 365/1095/2555. After that period, children names/DOBs are removed from completed waivers.';

CREATE TABLE IF NOT EXISTS public.document_waiver_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_waiver_participants_doc_idx
  ON public.document_waiver_participants (document_id);

ALTER TABLE public.document_waiver_participants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.document_waiver_participants FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.document_waiver_participants TO service_role;

-- Strip relocated jargon from built-in (and leftover default) template bodies.
UPDATE public.document_templates
SET full_text = regexp_replace(
  regexp_replace(
    regexp_replace(
      full_text,
      E'(?:\\r?\\n)+This is a general-purpose starting template\\. Enforceability of liability[\\s\\S]*?before relying on it\\.?\\s*$',
      '',
      'n'
    ),
    E'(?:\\r?\\n)+This is a general-purpose starting template, not legal advice\\.[\\s\\S]*?for your situation\\.?\\s*$',
    '',
    'n'
  ),
  E'(?:\\r?\\n)+This is a general-purpose starting template\\. It is not legal advice\\.[\\s\\S]*$',
  '',
  'n'
)
WHERE full_text ~ 'This is a general-purpose starting template';

UPDATE public.host_document_templates
SET full_text = regexp_replace(
  regexp_replace(
    regexp_replace(
      full_text,
      E'(?:\\r?\\n)+This is a general-purpose starting template\\. Enforceability of liability[\\s\\S]*?before relying on it\\.?\\s*$',
      '',
      'n'
    ),
    E'(?:\\r?\\n)+This is a general-purpose starting template, not legal advice\\.[\\s\\S]*?for your situation\\.?\\s*$',
    '',
    'n'
  ),
  E'(?:\\r?\\n)+This is a general-purpose starting template\\. It is not legal advice\\.[\\s\\S]*$',
  '',
  'n'
)
WHERE full_text ~ 'This is a general-purpose starting template';

INSERT INTO public.document_templates (
  name, document_type, confirmation_type, summary_text, full_text, require_otp
)
SELECT
  'Waiver with Parental Consent',
  'parental_consent_waiver',
  'sign',
  'Parent or guardian signs one waiver covering each listed child.',
  $parental$WAIVER WITH PARENTAL CONSENT

I, [Recipient Name], am the parent or legal guardian of each child listed
on this form. In consideration for each listed child participating in or
receiving services related to [Activity/Service Description] provided by
[Business Name], I acknowledge and agree to the following:

1. Authority. I affirm that I am the parent or legal guardian of each child
listed on this form, and that I am authorized to sign this waiver on behalf
of each of them.

2. Assumption of Risk. I understand that the activity/service described
above carries inherent risks, which may include property damage, personal
injury, or other loss. On behalf of each listed child, I voluntarily
assume all such risks.

3. Release of Liability. To the fullest extent permitted by law, I release,
waive, and discharge [Business Name], its owners, employees, and agents
from any and all claims, liabilities, or causes of action arising from
ordinary negligence in connection with the activity/service described
above, including claims I could bring on behalf of each listed child.
This release does not apply to claims arising from gross negligence,
recklessness, or intentional misconduct.

4. Indemnification. I agree to indemnify and hold harmless [Business Name]
from any claims brought by third parties arising from each listed child's
participation in the above activity/service.

5. Severability. If any portion of this waiver is found unenforceable, the
remaining provisions will remain in full effect.

6. Acknowledgment. I confirm that I have read this waiver, understand its
terms, and am signing it voluntarily on behalf of myself and each child
listed on this form.$parental$,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.document_templates WHERE document_type = 'parental_consent_waiver'
);

-- Guest-readable document: parent phone/email only. Never children.
CREATE OR REPLACE FUNCTION public.get_document_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id', d.id,
    'token', d.token,
    'recipient_name', d.recipient_name,
    'recipient_phone', d.recipient_phone,
    'recipient_email', d.recipient_email,
    'document_type', d.document_type,
    'document_type_custom', d.document_type_custom,
    'template_id', d.template_id,
    'topic', d.topic,
    'status', d.status,
    'otp_verified', d.otp_verified,
    'created_at', d.created_at,
    'viewed_at', d.viewed_at,
    'signed_at', d.signed_at,
    'confirmation_type', t.confirmation_type,
    'template_name', t.name,
    'summary_text', t.summary_text,
    'full_text', COALESCE(NULLIF(btrim(d.custom_text), ''), t.full_text),
    'verification_required', d.verification_required,
    'line_items', d.line_items,
    'tax_percent', d.tax_percent,
    'notes', d.notes,
    'pay_elsewhere_url', d.pay_elsewhere_url,
    'pay_elsewhere_label', d.pay_elsewhere_label,
    'pay_mode', d.pay_mode,
    'pay_amount_cents', d.pay_amount_cents,
    'currency', d.currency,
    'valid_until', d.valid_until,
    'expired', (d.valid_until IS NOT NULL AND d.valid_until < now()),
    'file_path', d.file_path,
    'file_name', d.file_name,
    'file_size_bytes', d.file_size_bytes,
    'plain_language_summary', CASE
      WHEN d.file_path IS NOT NULL THEN NULL
      ELSE NULLIF(btrim(d.plain_language_summary), '')
    END,
    'plain_language_truncated', CASE
      WHEN d.file_path IS NOT NULL THEN false
      ELSE COALESCE(d.plain_language_truncated, false)
    END,
    'sender_business_name', COALESCE(
      NULLIF(btrim(pr.business_name), ''),
      NULLIF(btrim(pr.paid_booking_settings->>'display_name'), ''),
      NULLIF(btrim(pr.full_name), '')
    ),
    'sender_logo_url', NULLIF(btrim(pr.avatar_url), '')
  )
  INTO result
  FROM public.documents d
  JOIN public.document_templates t ON t.id = d.template_id
  LEFT JOIN public.profiles pr ON pr.id = d.sender_id
  WHERE d.token = p_token
  LIMIT 1;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_by_token(text) TO anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
    FROM pg_proc
    WHERE proname = 'record_document_event'
      AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.record_document_event(
  p_token text,
  p_action text,
  p_signature_data text DEFAULT NULL,
  p_ip text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_esign_consent_text text DEFAULT NULL,
  p_document_snapshot_text text DEFAULT NULL,
  p_document_sha256 text DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_parent_guardian_name text DEFAULT NULL,
  p_parent_guardian_email text DEFAULT NULL,
  p_parental_consent_text text DEFAULT NULL,
  p_participants jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.documents%ROWTYPE;
  v_confirm text;
  v_ip text;
  v_ua text;
  v_consent text;
  v_snapshot text;
  v_hash text;
  v_reason text;
  v_part jsonb;
  v_name text;
  v_dob date;
  v_idx int := 0;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token required');
  END IF;

  IF p_action NOT IN ('viewed', 'signed', 'declined') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid action');
  END IF;

  SELECT * INTO v_row
  FROM public.documents
  WHERE token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not found');
  END IF;

  SELECT t.confirmation_type INTO v_confirm
  FROM public.document_templates t
  WHERE t.id = v_row.template_id;

  v_ip := COALESCE(public.document_request_ip(), NULLIF(btrim(COALESCE(p_ip, '')), ''));
  v_ua := NULLIF(btrim(COALESCE(p_user_agent, '')), '');

  IF p_action = 'viewed' THEN
    IF v_row.status = 'pending' THEN
      UPDATE public.documents
      SET
        status = 'viewed',
        viewed_at = now(),
        ip_address = COALESCE(v_ip, ip_address),
        user_agent = COALESCE(v_ua, user_agent)
      WHERE token = p_token;
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', CASE WHEN v_row.status = 'pending' THEN 'viewed' ELSE v_row.status END);
  END IF;

  IF v_row.status IN ('signed', 'paid') AND p_action = 'signed' THEN
    RETURN jsonb_build_object('ok', true, 'status', v_row.status, 'id', v_row.id);
  END IF;

  IF v_row.status = 'declined' AND p_action = 'declined' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'declined', 'id', v_row.id);
  END IF;

  IF v_row.valid_until IS NOT NULL AND v_row.valid_until < now() AND p_action = 'signed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quote expired');
  END IF;

  IF p_action = 'declined' THEN
    IF v_row.status IN ('signed', 'paid') THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already approved');
    END IF;
    v_reason := NULLIF(btrim(COALESCE(p_signature_data, '')), '');
    UPDATE public.documents
    SET
      status = 'declined',
      declined_at = now(),
      decline_reason = v_reason,
      ip_address = COALESCE(v_ip, ip_address),
      user_agent = COALESCE(v_ua, user_agent)
    WHERE token = p_token;
    RETURN jsonb_build_object('ok', true, 'status', 'declined');
  END IF;

  IF COALESCE(v_row.verification_required, false) AND NOT v_row.otp_verified THEN
    RETURN jsonb_build_object('ok', false, 'error', 'phone verification required');
  END IF;

  v_consent := NULLIF(btrim(COALESCE(p_esign_consent_text, '')), '');
  IF v_consent IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'electronic consent required');
  END IF;

  IF v_confirm IS DISTINCT FROM 'confirm_receipt'
     AND (p_signature_data IS NULL OR btrim(p_signature_data) = '') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'signature required');
  END IF;

  IF v_row.document_type = 'parental_consent_waiver' THEN
    IF NULLIF(btrim(COALESCE(p_parent_guardian_name, '')), '') IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'parent name required');
    END IF;
    IF p_participants IS NULL OR jsonb_typeof(p_participants) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_participants) < 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'at least one child is required');
    END IF;
    IF jsonb_array_length(p_participants) > 20 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'too many children');
    END IF;
  END IF;

  v_snapshot := NULLIF(btrim(COALESCE(p_document_snapshot_text, '')), '');
  v_hash := lower(NULLIF(btrim(COALESCE(p_document_sha256, '')), ''));

  UPDATE public.documents
  SET
    status = 'signed',
    signed_at = now(),
    document_agreed_at = now(),
    signature_data = COALESCE(NULLIF(btrim(p_signature_data), ''), signature_data, 'confirmed'),
    ip_address = COALESCE(v_ip, ip_address),
    user_agent = COALESCE(v_ua, user_agent),
    esign_consent_text = COALESCE(v_consent, esign_consent_text),
    esign_consent_at = CASE WHEN v_consent IS NOT NULL THEN now() ELSE esign_consent_at END,
    document_snapshot_text = COALESCE(v_snapshot, document_snapshot_text),
    document_sha256 = COALESCE(v_hash, document_sha256),
    timezone_at_sign = COALESCE(NULLIF(btrim(COALESCE(p_timezone, '')), ''), timezone_at_sign),
    parent_guardian_name = COALESCE(NULLIF(btrim(COALESCE(p_parent_guardian_name, '')), ''), parent_guardian_name),
    parent_guardian_email = COALESCE(NULLIF(btrim(COALESCE(p_parent_guardian_email, '')), ''), parent_guardian_email),
    parental_consent_text = COALESCE(NULLIF(btrim(COALESCE(p_parental_consent_text, '')), ''), parental_consent_text)
  WHERE token = p_token
  RETURNING * INTO v_row;

  IF v_row.document_type = 'parental_consent_waiver' AND p_participants IS NOT NULL THEN
    DELETE FROM public.document_waiver_participants WHERE document_id = v_row.id;
    FOR v_part IN SELECT value FROM jsonb_array_elements(p_participants)
    LOOP
      v_name := NULLIF(btrim(COALESCE(v_part->>'full_name', v_part->>'fullName', '')), '');
      BEGIN
        v_dob := NULLIF(btrim(COALESCE(v_part->>'date_of_birth', v_part->>'dateOfBirth', '')), '')::date;
      EXCEPTION WHEN others THEN
        v_dob := NULL;
      END;
      IF v_name IS NULL OR v_dob IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'each child needs a name and date of birth');
      END IF;
      INSERT INTO public.document_waiver_participants (document_id, full_name, date_of_birth, sort_order)
      VALUES (v_row.id, v_name, v_dob, v_idx);
      v_idx := v_idx + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'signed', 'id', v_row.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_document_event(text, text, text, text, text, text, text, text, text, text, text, text, jsonb)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_document_waiver_participants(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT sender_id INTO v_sender
  FROM public.documents
  WHERE id = p_document_id;

  IF v_sender IS NULL OR v_sender IS DISTINCT FROM auth.uid() THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'full_name', full_name,
    'date_of_birth', date_of_birth,
    'sort_order', sort_order
  ) ORDER BY sort_order), '[]'::jsonb)
  INTO v_out
  FROM public.document_waiver_participants
  WHERE document_id = p_document_id;

  RETURN v_out;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_waiver_participants(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired_waiver_minor_data()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_row record;
  v_days int;
BEGIN
  FOR v_row IN
    SELECT d.id, d.document_snapshot_text, p.waiver_retention, d.signed_at
    FROM public.documents d
    JOIN public.profiles p ON p.id = d.sender_id
    WHERE d.document_type IN ('waiver', 'parental_consent_waiver')
      AND d.status = 'signed'
      AND d.signed_at IS NOT NULL
      AND d.waiver_minors_purged_at IS NULL
      AND COALESCE(p.waiver_retention, 'keep') <> 'keep'
  LOOP
    BEGIN
      v_days := v_row.waiver_retention::int;
    EXCEPTION WHEN others THEN
      CONTINUE;
    END;
    IF v_row.signed_at + (v_days || ' days')::interval > now() THEN
      CONTINUE;
    END IF;

    DELETE FROM public.document_waiver_participants WHERE document_id = v_row.id;
    UPDATE public.documents
    SET
      waiver_minors_purged_at = now(),
      document_snapshot_text = regexp_replace(
        COALESCE(document_snapshot_text, ''),
        E'Participants:[\\s\\S]*$',
        'Participants: [removed after retention period]',
        'n'
      )
    WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_waiver_minor_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_waiver_minor_data() TO service_role;

NOTIFY pgrst, 'reload schema';
