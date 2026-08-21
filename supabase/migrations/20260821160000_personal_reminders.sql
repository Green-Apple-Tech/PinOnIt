-- Personal "remind me to…" jobs for the host (not guest booking reminders).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS personal_reminder_defaults jsonb
  NOT NULL DEFAULT '{"day_before":["email"],"hour_before":["email"],"ten_min":["sms"]}'::jsonb;

CREATE TABLE IF NOT EXISTS public.personal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  transcript text,
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'done')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS personal_reminders_host_due_idx
  ON public.personal_reminders (host_id, due_at);

CREATE TABLE IF NOT EXISTS public.personal_reminder_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid NOT NULL REFERENCES public.personal_reminders (id) ON DELETE CASCADE,
  host_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fire_at timestamptz NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'voice')),
  sent_at timestamptz,
  error text
);

CREATE INDEX IF NOT EXISTS personal_reminder_jobs_due_idx
  ON public.personal_reminder_jobs (fire_at)
  WHERE sent_at IS NULL;

ALTER TABLE public.personal_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_reminder_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hosts manage own personal reminders"
  ON public.personal_reminders
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts manage own personal reminder jobs"
  ON public.personal_reminder_jobs
  FOR ALL
  TO authenticated
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

NOTIFY pgrst, 'reload schema';
