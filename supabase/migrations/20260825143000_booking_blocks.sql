-- Host blocklist: stop specific emails or whole domains from booking. Reason can be blocked or spam.

CREATE TABLE IF NOT EXISTS public.booking_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_type text NOT NULL CHECK (match_type IN ('email', 'domain')),
  value text NOT NULL,
  reason text NOT NULL DEFAULT 'blocked' CHECK (reason IN ('blocked', 'spam')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (host_id, match_type, value)
);

CREATE INDEX IF NOT EXISTS booking_blocks_host_id_idx ON public.booking_blocks (host_id);

ALTER TABLE public.booking_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view own booking blocks" ON public.booking_blocks;
CREATE POLICY "Hosts can view own booking blocks"
  ON public.booking_blocks FOR SELECT TO authenticated
  USING (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can insert own booking blocks" ON public.booking_blocks;
CREATE POLICY "Hosts can insert own booking blocks"
  ON public.booking_blocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update own booking blocks" ON public.booking_blocks;
CREATE POLICY "Hosts can update own booking blocks"
  ON public.booking_blocks FOR UPDATE TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can delete own booking blocks" ON public.booking_blocks;
CREATE POLICY "Hosts can delete own booking blocks"
  ON public.booking_blocks FOR DELETE TO authenticated
  USING (auth.uid() = host_id);

CREATE OR REPLACE FUNCTION public.guest_is_blocked(p_host_id uuid, p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.booking_blocks b
    WHERE b.host_id = p_host_id
      AND p_email IS NOT NULL
      AND length(trim(p_email)) > 0
      AND (
        (b.match_type = 'email' AND b.value = lower(trim(p_email)))
        OR (b.match_type = 'domain' AND b.value = split_part(lower(trim(p_email)), '@', 2))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.guest_is_blocked(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_is_blocked(uuid, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_booking_guest_not_blocked()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.guest_email IS NOT NULL AND public.guest_is_blocked(NEW.host_id, NEW.guest_email) THEN
    RAISE EXCEPTION 'guest_blocked' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_guest_not_blocked ON public.bookings;
CREATE TRIGGER trg_enforce_booking_guest_not_blocked
  BEFORE INSERT OR UPDATE OF guest_email, host_id
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_booking_guest_not_blocked();
