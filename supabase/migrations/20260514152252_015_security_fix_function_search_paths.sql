/*
  # Security hardening — function search paths and EXECUTE permissions

  Fixes all four warnings from the security audit:

  1. handle_updated_at — mutable search_path → set search_path = ''
  2. create_default_templates — mutable search_path → set search_path = ''
  3. handle_new_user — revoke EXECUTE from anon and authenticated roles
     (it is a trigger-only function, never callable via /rpc)
  4. handle_updated_at — revoke EXECUTE from public/anon/authenticated
  5. create_default_templates — revoke EXECUTE from public/anon/authenticated
*/

-- 1. Fix handle_updated_at — add fixed empty search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Fix create_default_templates — add fixed empty search_path
CREATE OR REPLACE FUNCTION public.create_default_templates()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.message_templates (host_id, name, type, channel, subject, body, timing_offset_minutes, auto_translate)
  VALUES
    (NEW.id, 'Booking Confirmation', 'confirmation', 'email',
     'Your appointment is confirmed',
     'Hi {{guest_name}}, your {{service_name}} with {{host_name}} is confirmed for {{date}} at {{time}} ({{timezone}}). Reply CANCEL to cancel or RESCHEDULE to request a new time.',
     0, true),
    (NEW.id, '24 Hour Reminder', 'reminder', 'email',
     'Reminder: Your appointment tomorrow',
     'Hi {{guest_name}}, this is a reminder that your {{service_name}} with {{host_name}} is tomorrow at {{time}} ({{timezone}}). Reply CONFIRM to confirm or CANCEL to cancel.',
     -1440, true),
    (NEW.id, 'Follow-up', 'follow_up', 'email',
     'Thanks for your visit',
     'Hi {{guest_name}}, thanks for your {{service_name}} appointment with {{host_name}}. We hope everything went well! Reply to rebook anytime.',
     1440, true);
  RETURN NEW;
END;
$$;

-- 3. Revoke EXECUTE on all three trigger functions from every non-superuser role
-- (triggers fire as the table owner, not via RPC — these should never be callable directly)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.create_default_templates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_default_templates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_templates() FROM authenticated;
