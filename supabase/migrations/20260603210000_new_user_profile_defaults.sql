/*
  New user defaults on signup:
  - Auto slug from email (unique)
  - default_reminder_channel = email
  - voice_reminder_enabled = true
*/

ALTER TABLE public.profiles
  ALTER COLUMN default_reminder_channel SET DEFAULT 'email';

ALTER TABLE public.profiles
  ALTER COLUMN voice_reminder_enabled SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_base text;
  v_slug text;
  v_attempt int := 0;
  v_full_name text;
BEGIN
  v_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', '');
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  );

  v_base := lower(regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);

  IF length(v_base) < 3 THEN
    v_base := 'user-' || substr(replace(NEW.id::text, '-', ''), 1, 8);
  END IF;

  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE p.slug = v_slug) LOOP
    v_attempt := v_attempt + 1;
    v_slug := v_base || v_attempt::text;
  END LOOP;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    slug,
    default_reminder_channel,
    voice_reminder_enabled
  )
  VALUES (
    NEW.id,
    v_email,
    v_full_name,
    v_slug,
    'email',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
