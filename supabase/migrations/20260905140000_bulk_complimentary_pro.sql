-- One-time: complimentary Pro for every existing host (trials + expired + paid).
-- plan_override keeps Stripe from taking Pro away; plan_grants keeps it on email match for future signups of the same address.

INSERT INTO public.plan_grants (email, note)
SELECT lower(trim(email)), 'bulk complimentary pro 2026-09-05'
FROM public.profiles
WHERE email IS NOT NULL AND btrim(email) <> ''
ON CONFLICT (email) DO UPDATE
  SET note = EXCLUDED.note;

UPDATE public.profiles
SET plan = 'pro',
    plan_override = 'pro'
WHERE plan_override IS DISTINCT FROM 'pro'
   OR plan IS DISTINCT FROM 'pro';

UPDATE public.subscriptions s
SET plan = 'pro',
    status = CASE
      WHEN s.status IN ('active', 'past_due', 'trialing') THEN s.status
      ELSE 'active'
    END,
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = s.user_id AND p.plan_override = 'pro'
)
AND (s.plan IS DISTINCT FROM 'pro' OR s.status = 'trialing');
