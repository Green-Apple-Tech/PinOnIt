-- Dedicated business/company name on the public host view (booking page + link previews).
DROP VIEW IF EXISTS public.public_host_profiles;

CREATE VIEW public.public_host_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  slug,
  full_name,
  business_name,
  bio,
  avatar_url,
  brand_color,
  timezone,
  booking_page_header,
  paid_booking_theme,
  paid_booking_settings,
  global_require_terms,
  global_terms_text,
  calendar_conflict_settings,
  CASE WHEN plan_override = 'pro' THEN 'pro' ELSE plan END AS plan
FROM public.profiles
WHERE slug IS NOT NULL;

GRANT SELECT ON public.public_host_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
