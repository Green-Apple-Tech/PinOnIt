/*
  # Referral System

  ## Summary
  Adds a complete referral tracking and credit system.

  ## New Tables

  ### referrals
  Tracks each referral relationship between a referrer and a new signup.
  - id: primary key
  - referrer_id: the user who referred (FK to profiles)
  - referred_user_id: the new user who signed up via the link (FK to auth.users, nullable until signup)
  - referred_email: email of the referred user (set at signup)
  - status: 'pending' | 'signed_up' | 'converted' (converted = upgraded to pro)
  - credit_applied: whether the $1/mo credit has been applied to the referrer's Stripe balance
  - created_at / converted_at timestamps

  ### referral_credits
  Running ledger of credit amounts earned by referrers.
  - id: primary key
  - user_id: referrer (FK to profiles)
  - referral_id: which referral triggered this credit
  - amount_cents: credit amount (100 = $1)
  - stripe_credit_applied: whether it has been applied to Stripe customer balance
  - created_at

  ## New Columns on profiles
  - referral_code: unique short code per user (e.g. "abc12")
  - referred_by: the referral_code used when this user signed up

  ## Security
  - RLS enabled on both tables
  - Users can read their own referral data
*/

-- Add referral columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referral_code text UNIQUE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'referred_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referred_by text DEFAULT NULL;
  END IF;
END $$;

-- Generate referral codes for existing users who don't have one
UPDATE profiles
SET referral_code = lower(substring(md5(id::text || random()::text), 1, 8))
WHERE referral_code IS NULL;

-- Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'converted')),
  credit_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz
);

-- Referral credits ledger
CREATE TABLE IF NOT EXISTS referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_id uuid NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL DEFAULT 100,
  stripe_credit_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_user_id_idx ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS referrals_status_idx ON referrals(status);
CREATE INDEX IF NOT EXISTS referral_credits_user_id_idx ON referral_credits(user_id);
CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON profiles(referral_code);

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_credits ENABLE ROW LEVEL SECURITY;

-- Referrals policies
CREATE POLICY "Users can view their own referrals as referrer"
  ON referrals FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid());

CREATE POLICY "Service role can insert referrals"
  ON referrals FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update referrals"
  ON referrals FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Referral credits policies
CREATE POLICY "Users can view their own referral credits"
  ON referral_credits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert referral credits"
  ON referral_credits FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update referral credits"
  ON referral_credits FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public leaderboard view (no PII, just display names and counts)
CREATE OR REPLACE VIEW public.referral_leaderboard AS
SELECT
  p.id,
  p.full_name,
  p.slug,
  p.avatar_url,
  COUNT(r.id) FILTER (WHERE r.status = 'converted') AS converted_count,
  COUNT(r.id) FILTER (WHERE r.status IN ('signed_up', 'converted')) AS signup_count
FROM profiles p
JOIN referrals r ON r.referrer_id = p.id
GROUP BY p.id, p.full_name, p.slug, p.avatar_url
HAVING COUNT(r.id) FILTER (WHERE r.status = 'converted') > 0
ORDER BY converted_count DESC;

-- Trigger to auto-generate referral_code for new users
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      new_code := lower(substring(md5(NEW.id::text || random()::text || clock_timestamp()::text), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE referral_code = new_code);
      attempts := attempts + 1;
      EXIT WHEN attempts > 10;
    END LOOP;
    NEW.referral_code := new_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();
