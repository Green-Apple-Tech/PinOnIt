/*
  # Revoke public/anon execute on SECURITY DEFINER seed functions

  1. Changes
    - Revoke EXECUTE on seed_default_event_types(uuid) from anon and authenticated
    - Revoke EXECUTE on trigger_seed_default_event_types() from anon and authenticated
    - These are internal trigger/seed functions that should never be callable via REST API

  2. Security
    - Prevents anon and authenticated users from calling SECURITY DEFINER functions
      directly through /rest/v1/rpc/, which would run them with elevated privileges
*/

REVOKE EXECUTE ON FUNCTION public.seed_default_event_types(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_seed_default_event_types() FROM anon, authenticated;
