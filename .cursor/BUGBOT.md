# PinOnIt — Bugbot review rules

Production SaaS: appointment scheduling at pinonit.com. Stack: React + Vite + Supabase (RLS, edge functions) + Stripe/PayPal + Twilio + Bolt deploy.

## Security (blocking)

- Never commit or log secrets (.env, API keys, tokens, Twilio SIDs, Stripe keys). Flag any hardcoded credentials.
- Edge functions using `--no-verify-jwt` (OAuth callbacks, webhooks) must validate state/tokens inside the function — never trust query params alone.
- Booking actions must require both `booking_id` AND `action_token` — flag endpoints that allow enumeration or status changes without token.
- Service-role key must only appear in edge functions, never in frontend bundle.
- Flag `dangerouslySetInnerHTML` without sanitization, raw SQL, or disabled RLS on sensitive tables.

## Auth & OAuth

- Calendly/Google/Outlook/Zoom OAuth: redirect_uri must match registered values; PKCE required for Calendly.
- OAuth state must include user id + code_verifier; reject missing or tampered state.
- Do not open onboarding wizard or mark onboarding complete based solely on `?calendly_error=` without `wizard_active` session.

## Payments

- Stripe webhook must verify signature before processing events.
- PayPal: confirm sandbox vs production (`PAYPAL_SANDBOX`) matches deploy target.
- Paid booking flows must not expose host secret keys to the client.

## Messaging (SMS / WhatsApp / voice)

- Guest PII (phone, email) must not appear in console.log in production paths.
- Twilio sends must handle missing guest phone gracefully without leaking internal errors to guests.

## Data & RLS

- New tables/columns need RLS policies; hosts must only access own rows (`host_id = auth.uid()`).
- Public booking page (`Book.tsx`) must use anon-safe RPCs or policies — no service-role from client.

## Deploy & config

- Frontend changes require Bolt Publish after GitHub push — flag if only git push is mentioned.
- Edge function changes require `supabase functions deploy` with correct `--no-verify-jwt` for callbacks.
- Flag references to wrong Supabase project ref or stale OAuth client IDs.

## PinOnIt-specific quality

- Onboarding wizard: closing modal must not skip onboarding unless user explicitly completes or `onboarding_completed` is intentional.
- Reminder templates and `send-reminder` must target guest contact info; host copies are email-only for confirmation/reminder types.
- Prefer existing patterns: `maybeSingle()`, lucide-react icons, Tailwind slate/emerald theme.

## When suggesting fixes

- Prefer minimal diffs; match existing file conventions.
- Link to specific line numbers in PR comments.
