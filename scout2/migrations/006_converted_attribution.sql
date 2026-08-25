-- Mirror of supabase/migrations/20260825160000_scout2_converted_attribution.sql
-- for scout2 ops docs. Prefer applying via supabase db push --linked.

ALTER TABLE public.scout2_leads
  ADD COLUMN IF NOT EXISTS converted_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

CREATE INDEX IF NOT EXISTS scout2_leads_converted_user_idx
  ON public.scout2_leads (converted_user_id)
  WHERE converted_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.attribute_scout2_lead_on_signup(p_user_id uuid, p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(COALESCE(p_email, '')));
  v_count integer := 0;
BEGIN
  IF p_user_id IS NULL OR v_email = '' OR position('@' in v_email) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.scout2_leads
  SET
    status = 'converted',
    converted_user_id = p_user_id,
    converted_at = COALESCE(converted_at, now()),
    updated_at = now()
  WHERE email IS NOT NULL
    AND lower(trim(email)) = v_email
    AND converted_user_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.attribute_scout2_lead_on_signup(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attribute_scout2_lead_on_signup(uuid, text) TO service_role;
