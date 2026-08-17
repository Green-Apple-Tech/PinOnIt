-- Industry-standard idle auto sign-out: 15 minutes (HIPAA workstation / OWASP mid-risk).
-- NULL previously meant Never, so existing accounts never signed out.

ALTER TABLE public.profiles
  ALTER COLUMN session_timeout_minutes SET DEFAULT 15;

UPDATE public.profiles
SET session_timeout_minutes = 15
WHERE session_timeout_minutes IS NULL;
