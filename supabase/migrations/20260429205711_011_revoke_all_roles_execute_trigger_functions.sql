/*
  # Revoke EXECUTE on internal SECURITY DEFINER trigger functions

  These three functions are trigger-only and must never be callable directly
  via the REST API (/rest/v1/rpc). Revoke EXECUTE from all roles.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_templates() FROM PUBLIC, anon, authenticated;
