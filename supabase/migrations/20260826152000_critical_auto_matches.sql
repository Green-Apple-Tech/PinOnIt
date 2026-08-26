-- Auto-critical matches for Smart Reminders (email / domain / name)

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS critical_auto_matches jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN profiles.critical_auto_matches IS
  'JSON array of {type: email|domain|name, value: string} — bookings matching these are auto-marked critical';

CREATE OR REPLACE FUNCTION public.mark_booking_critical_from_auto_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matches jsonb;
  item jsonb;
  email text;
  gname text;
  domain text;
  mtype text;
  mval text;
BEGIN
  IF NEW.is_critical IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT p.critical_auto_matches INTO matches
  FROM profiles p
  WHERE p.id = NEW.host_id;

  IF matches IS NULL OR jsonb_typeof(matches) <> 'array' OR jsonb_array_length(matches) = 0 THEN
    RETURN NEW;
  END IF;

  email := lower(trim(coalesce(NEW.guest_email, '')));
  gname := lower(trim(coalesce(NEW.guest_name, '')));
  domain := CASE
    WHEN position('@' IN email) > 0 THEN split_part(email, '@', 2)
    ELSE ''
  END;

  FOR item IN SELECT value FROM jsonb_array_elements(matches)
  LOOP
    mtype := item->>'type';
    mval := lower(trim(coalesce(item->>'value', '')));
    IF mval = '' THEN
      CONTINUE;
    END IF;
    IF mtype = 'email' AND email = mval THEN
      NEW.is_critical := true;
      RETURN NEW;
    ELSIF mtype = 'domain' AND mval <> '' AND (domain = mval OR domain LIKE '%.' || mval) THEN
      NEW.is_critical := true;
      RETURN NEW;
    ELSIF mtype = 'name' AND mval <> '' AND (gname = mval OR position(mval IN gname) > 0) THEN
      NEW.is_critical := true;
      RETURN NEW;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_auto_critical ON bookings;
CREATE TRIGGER bookings_auto_critical
  BEFORE INSERT OR UPDATE OF guest_email, guest_name, host_id ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_booking_critical_from_auto_matches();
