-- Optional per-host Slack incoming webhook for booking confirmations and reminders.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slack_webhook_url text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_slack_webhook_url_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_slack_webhook_url_chk
  CHECK (
    slack_webhook_url IS NULL
    OR slack_webhook_url ~ '^https://hooks\.slack\.com/services/[A-Za-z0-9/_-]+$'
  );

NOTIFY pgrst, 'reload schema';
