/*
  # Revoke PUBLIC execute on generate_referral_code

  ## Problem
  The trigger function `public.generate_referral_code()` has EXECUTE granted to
  the PUBLIC role (which all roles, including `anon` and `authenticated`, inherit).
  The previous migration revoked from `anon` and `authenticated` directly, but the
  inherited grant from PUBLIC remained in effect.

  ## Fix
  Revoke EXECUTE on the function from PUBLIC entirely. The function is a trigger
  and only needs to run as the table owner via the trigger mechanism — no role
  needs direct EXECUTE access.
*/

REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC;
