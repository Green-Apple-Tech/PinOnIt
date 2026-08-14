-- Host SMS/WhatsApp consent is independent of default_reminder_channel
-- (which can only store one value at a time).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET sms_opt_in = true
WHERE default_reminder_channel = 'sms'
  AND sms_opt_in = false;

UPDATE public.profiles
SET whatsapp_opt_in = true
WHERE default_reminder_channel = 'whatsapp'
  AND whatsapp_opt_in = false;
