-- One-time sender acknowledgment that SMS 2FA checks phone access, not legal identity.
-- Version 1. A later notice version requires a new acknowledgment.

CREATE TABLE IF NOT EXISTS public.sms_signature_identity_acks (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  notice_version integer NOT NULL CHECK (notice_version >= 1),
  notice_text text NOT NULL
);

COMMENT ON TABLE public.sms_signature_identity_acks IS
  'Sender acknowledgment of the SMS signature identity notice. acknowledged_at is UTC. Tied to the account, not a browser.';

ALTER TABLE public.sms_signature_identity_acks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own sms signature identity ack" ON public.sms_signature_identity_acks;
CREATE POLICY "Users read own sms signature identity ack"
  ON public.sms_signature_identity_acks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Short claim so a double-clicked SMS signature send does not text twice.
CREATE TABLE IF NOT EXISTS public.document_sms_signature_send_claims (
  document_id uuid PRIMARY KEY REFERENCES public.documents (id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_sms_signature_send_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.acknowledge_sms_signature_identity(p_version integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_required integer := 1;
  v_text text := $notice$Always Confirm/Verify the Signer's Phone Number

SMS 2FA verifies access to the phone number. You should always try to ensure the number belongs to the signer or is their authorized company phone.

I understand.$notice$;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in again.');
  END IF;
  IF p_version IS DISTINCT FROM v_required THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This notice is out of date. Reload and try again.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sms_signature_identity_acks
    WHERE user_id = uid
      AND notice_version >= v_required
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  INSERT INTO public.sms_signature_identity_acks (user_id, acknowledged_at, notice_version, notice_text)
  VALUES (uid, now(), v_required, v_text)
  ON CONFLICT (user_id) DO UPDATE
    SET acknowledged_at = EXCLUDED.acknowledged_at,
        notice_version = EXCLUDED.notice_version,
        notice_text = EXCLUDED.notice_text
    WHERE public.sms_signature_identity_acks.notice_version < EXCLUDED.notice_version;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_sms_signature_identity(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acknowledge_sms_signature_identity(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_document_sms_signature_send(p_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed uuid;
BEGIN
  INSERT INTO public.document_sms_signature_send_claims (document_id, claimed_at)
  VALUES (p_document_id, now())
  ON CONFLICT (document_id) DO UPDATE
    SET claimed_at = now()
    WHERE public.document_sms_signature_send_claims.claimed_at < now() - interval '20 seconds'
  RETURNING document_id INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_document_sms_signature_send(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_document_sms_signature_send(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
