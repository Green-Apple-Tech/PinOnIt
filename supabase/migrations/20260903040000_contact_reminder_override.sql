-- Per-contact NeverMiss reminder defaults (override account-wide rules when set).

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS reminder_override jsonb;

COMMENT ON COLUMN public.contacts.reminder_override IS
  'Optional NeverMiss defaults for this contact: { channels: text[], times: text[] }. Null = use account defaults.';

NOTIFY pgrst, 'reload schema';
