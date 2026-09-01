-- First-touch UTM / campaign params captured at signup (email or OAuth).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signup_attribution jsonb;
