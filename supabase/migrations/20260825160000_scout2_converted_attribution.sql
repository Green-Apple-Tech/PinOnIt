-- Link PinOnIt signups to Scout2 outreach leads by email.
-- Safe to re-run.

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

-- Extend handle_new_user: create profile (existing behavior) then attribute scout leads.
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_base text;
  v_slug text;
  v_attempt int := 0;
  v_full_name text;
BEGIN
  v_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );

  v_base := lower(regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);

  IF length(v_base) < 3 THEN
    v_base := 'user-' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE p.slug = v_slug) LOOP
    v_attempt := v_attempt + 1;
    v_slug := v_base || v_attempt::text;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    slug,
    default_reminder_channel,
    voice_reminder_enabled
  )
  VALUES (
    NEW.id,
    v_email,
    v_full_name,
    v_slug,
    'email',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  PERFORM public.attribute_scout2_lead_on_signup(NEW.id, v_email);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

-- One-time backfill: existing PinOnIt hosts whose email is already in scout2_leads
UPDATE public.scout2_leads s
SET
  status = 'converted',
  converted_user_id = p.id,
  converted_at = COALESCE(s.converted_at, now()),
  updated_at = now()
FROM public.profiles p
WHERE s.email IS NOT NULL
  AND p.email IS NOT NULL
  AND lower(trim(s.email)) = lower(trim(p.email))
  AND s.converted_user_id IS NULL;

NOTIFY pgrst, 'reload schema';
