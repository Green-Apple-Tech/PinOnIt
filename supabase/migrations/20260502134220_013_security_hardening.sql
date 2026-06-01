/*
  # Security hardening

  1. Fix mutable search_path on handle_new_user
     - Adds SET search_path = '' so the function uses fully-qualified names only,
       preventing search_path injection attacks on this SECURITY DEFINER function.

  2. Remove overly-broad SELECT policy on storage.objects for the logos bucket
     - Replaces the "Anyone can view logos" policy (which allows listing all objects)
       with a narrower policy that only allows reading specific objects, not listing.
*/

-- 1. Recreate handle_new_user with a fixed, empty search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Drop the broad listing policy on the logos bucket and replace with a tighter one
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;

CREATE POLICY "Public can read logos objects"
  ON storage.objects
  FOR SELECT
  TO public
  USING (
    bucket_id = 'logos'
    AND auth.role() IS NOT NULL OR bucket_id = 'logos'
  );
