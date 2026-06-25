-- Extend guest reminder prefs RPC to update SMS opt-in (notify_via)
CREATE OR REPLACE FUNCTION public.save_guest_reminder_prefs(
  p_booking_id uuid,
  p_action_token text,
  p_reminder_channels text[],
  p_reminder_times text[],
  p_notify_via text[] DEFAULT NULL
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
    notify_via = COALESCE(p_notify_via, notify_via),
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
