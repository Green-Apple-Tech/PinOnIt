-- On-my-way SMS/email: log send on the booking; host template + remembered ETA.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS sent_on_my_way_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS on_my_way_eta_minutes integer DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS on_my_way_template text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS on_my_way_default_eta_minutes integer DEFAULT 20,
  ADD COLUMN IF NOT EXISTS on_my_way_eta_usage jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.bookings.sent_on_my_way_at IS 'When the host sent an On my way text/email for this visit.';
COMMENT ON COLUMN public.bookings.on_my_way_eta_minutes IS 'ETA minutes included in the On my way message.';
COMMENT ON COLUMN public.profiles.on_my_way_template IS 'Host On my way SMS body. Merge fields: {{business_name}}, {{host_first_name}}, {{eta}}.';
