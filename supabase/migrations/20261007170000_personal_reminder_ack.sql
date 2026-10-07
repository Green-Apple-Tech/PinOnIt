-- Safety reminders can be marked done so later pings stop.

ALTER TABLE public.personal_reminders
  ADD COLUMN IF NOT EXISTS urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS ack_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS personal_reminders_ack_token_idx
  ON public.personal_reminders (ack_token);

ALTER TABLE public.personal_reminder_jobs
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'remind';

ALTER TABLE public.personal_reminder_jobs
  DROP CONSTRAINT IF EXISTS personal_reminder_jobs_kind_check;

ALTER TABLE public.personal_reminder_jobs
  ADD CONSTRAINT personal_reminder_jobs_kind_check
  CHECK (kind IN ('remind', 'escalate'));

NOTIFY pgrst, 'reload schema';
