/*
  # Revoke EXECUTE on SECURITY DEFINER functions from public roles

  ## Problem
  Two SECURITY DEFINER functions are callable by anon and authenticated roles
  via the REST API (/rpc/ endpoint), which is a security risk since they run
  with elevated privileges.

  ## Changes
  - Revoke EXECUTE on public.insert_default_reminder() from anon and authenticated
  - Revoke EXECUTE on public.sync_require_terms() from anon and authenticated

  These functions are internal trigger/utility functions and should only be
  invoked by the database itself (via triggers), not by API callers.
*/

REVOKE EXECUTE ON FUNCTION public.insert_default_reminder() FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_default_reminder() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_require_terms() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_require_terms() FROM authenticated;
