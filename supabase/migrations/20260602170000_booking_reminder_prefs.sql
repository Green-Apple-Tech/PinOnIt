-- Guest reminder channel/time preferences (public booking flow)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_channels text[] NOT NULL DEFAULT ARRAY['email']::text[],
  ADD COLUMN IF NOT EXISTS reminder_times text[] NOT NULL DEFAULT ARRAY['1hour']::text[];

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_reminder_channels_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_reminder_channels_check
  CHECK (
    reminder_channels <@ ARRAY['email', 'sms', 'whatsapp', 'voice']::text[]
    AND cardinality(reminder_channels) >= 1
  );

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_reminder_times_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_reminder_times_check
  CHECK (
    reminder_times <@ ARRAY['15min', '30min', '1hour', '2hour', '6hour', '24hour']::text[]
    AND cardinality(reminder_times) >= 1
  );

CREATE OR REPLACE FUNCTION public.save_guest_reminder_prefs(
  p_booking_id uuid,
  p_action_token text,
  p_reminder_channels text[],
  p_reminder_times text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_action_token IS NULL OR length(trim(p_action_token)) = 0 THEN
    RAISE EXCEPTION 'Invalid action token';
  END IF;

  UPDATE bookings
  SET
    reminder_channels = p_reminder_channels,
    reminder_times = p_reminder_times,
    updated_at = now()
  WHERE id = p_booking_id
    AND action_token = p_action_token
    AND status = 'confirmed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found or not authorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_guest_reminder_prefs TO anon, authenticated;
