-- Host default pay link (Docs settings) and per-event-type pay link shown to guests.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_pay_url text,
  ADD COLUMN IF NOT EXISTS default_pay_label text;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS payment_link_label text;
