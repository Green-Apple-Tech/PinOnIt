-- Unused single-use links expire after 90 days (Calendly-style), even if expires_at was null.

DROP FUNCTION IF EXISTS public.get_single_use_link(text);

CREATE OR REPLACE FUNCTION public.get_single_use_link(p_token text)
RETURNS TABLE (
  id uuid,
  host_id uuid,
  service_id uuid,
  token text,
  used boolean,
  used_at timestamptz,
  expires_at timestamptz,
  booking_id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.host_id,
    l.service_id,
    l.token,
    l.used,
    l.used_at,
    COALESCE(l.expires_at, l.created_at + interval '90 days') AS expires_at,
    l.booking_id,
    l.created_at
  FROM public.single_use_links l
  WHERE l.token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_single_use_link(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_single_use_link(text) TO anon, authenticated;
