-- Track host voice reminder calls per booking (prevents duplicate Twilio calls).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS voice_reminder_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_voice_reminder_pending
  ON public.bookings (start_time)
  WHERE status = 'confirmed' AND voice_reminder_sent = false;
