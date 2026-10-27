-- Reminder intake from partner sites.
-- Nullable columns only. Existing personal reminders and SMS opt-in rows are unchanged.
-- personal_reminder_jobs stay the delivery queue. service_reminders are per-service rules
-- and are intentionally not used here, because a new rule would fire for every booking
-- on that service.

ALTER TABLE public.personal_reminders
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS intake_source text,
  ADD COLUMN IF NOT EXISTS intake_dedupe_key text,
  ADD COLUMN IF NOT EXISTS intake_ip text;

COMMENT ON COLUMN public.personal_reminders.recipient_email IS
  'When set, send-reminder emails this address instead of the host profile. Null keeps host delivery.';
COMMENT ON COLUMN public.personal_reminders.recipient_phone IS
  'When set, send-reminder texts this number instead of the host profile. Null keeps host delivery. Intake sets it only after TCPA consent is stored.';
COMMENT ON COLUMN public.personal_reminders.intake_source IS
  'Partner site host for reminder-intake. Null for reminders created in PinOnIt.';
COMMENT ON COLUMN public.personal_reminders.intake_dedupe_key IS
  'Idempotency key for reminder-intake. Null for in-app reminders.';
COMMENT ON COLUMN public.personal_reminders.intake_ip IS
  'Connection IP of the intake request, used for rate limits.';

CREATE UNIQUE INDEX IF NOT EXISTS personal_reminders_intake_dedupe_idx
  ON public.personal_reminders (host_id, intake_dedupe_key)
  WHERE intake_dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS personal_reminders_intake_email_created_idx
  ON public.personal_reminders (recipient_email, created_at DESC)
  WHERE recipient_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS personal_reminders_intake_ip_created_idx
  ON public.personal_reminders (intake_ip, created_at DESC)
  WHERE intake_ip IS NOT NULL;

ALTER TABLE public.sms_optins
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS consent_version text;

COMMENT ON COLUMN public.sms_optins.ip_address IS
  'Client IP captured with an explicit SMS opt-in.';
COMMENT ON COLUMN public.sms_optins.consent_version IS
  'Version of the consent disclosure the person agreed to.';

NOTIFY pgrst, 'reload schema';
