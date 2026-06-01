/*
  # Fix Security Definer Issues

  ## Problems addressed

  1. `public.referral_leaderboard` view was created with SECURITY DEFINER,
     meaning it runs queries as the view owner (superuser) rather than the
     calling role. Recreating it without that property so it respects the
     caller's RLS context.

  2. `public.generate_referral_code()` is a trigger function that should
     never be callable directly via the REST API. Revoking EXECUTE from
     both `anon` and `authenticated` roles.

  ## Changes

  - Drop and recreate `referral_leaderboard` as a plain (SECURITY INVOKER) view
  - Revoke EXECUTE on `generate_referral_code()` from `anon` and `authenticated`
*/

-- 1. Recreate the view without SECURITY DEFINER
--    (views are SECURITY INVOKER by default; we must DROP and re-CREATE
--     because ALTER VIEW cannot change the security property directly)
DROP VIEW IF EXISTS public.referral_leaderboard;

CREATE VIEW public.referral_leaderboard
  WITH (security_invoker = true)
AS
  SELECT
    p.id,
    p.full_name,
    p.slug,
    p.avatar_url,
    count(r.id) FILTER (WHERE r.status = 'converted') AS converted_count,
    count(r.id) FILTER (WHERE r.status IN ('signed_up', 'converted'))  AS signup_count
  FROM profiles p
  JOIN referrals r ON r.referrer_id = p.id
  GROUP BY p.id, p.full_name, p.slug, p.avatar_url
  HAVING count(r.id) FILTER (WHERE r.status = 'converted') > 0
  ORDER BY converted_count DESC;

-- 2. Revoke direct RPC access to the trigger function from public roles
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM authenticated;
