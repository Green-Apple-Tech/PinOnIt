# PinOnIt

**Smarter scheduling. No friction.**

Professional scheduling platform — a Calendly alternative with SMS coordination, email signatures, paid booking pages, and referral rewards.

**Live:** [https://pinonit.com](https://pinonit.com)

Operated by **Miami Expeditions LLC** dba PinOnIt.

## Features

- Shareable booking pages (`pinonit.com/yourname`)
- Google, Outlook, and Apple (CalDAV) calendar sync
- Email, SMS, WhatsApp, and voice reminders (including critical meeting alerts)
- Paid bookings via Stripe, PayPal, and P2P options (Venmo, Cash App, Zelle)
- Meeting polls and SMS group availability coordination
- Email signature creator, QR codes, and embeddable booking widgets
- Referral program and public leaderboard

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, RLS) |
| Payments | Stripe, PayPal |
| Email | Resend |
| SMS / Voice | Twilio |
| OAuth | Google, Microsoft, Zoom |

## Local development

```bash
npm install
# Create .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Other scripts:

```bash
npm run build      # production build
npm run typecheck  # TypeScript check
npm run lint       # ESLint
```

## Project docs

See [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) for routes, database schema, edge functions, and integration status.

## Deploy

**`git push` does not update pinonit.com.** Use this every time:

1. **Cursor:** `git add . && git commit -m "…" && git push`
2. **Bolt:** [Open project](https://bolt.new/~/sb1-nzt1kjlj) → wait ~30s (auto-sync from GitHub) → verify in Code tab
3. **Bolt:** **Publish** → **Update**

Full checklist: [DEPLOY.md](./DEPLOY.md). Optional terminal reminder after push: `./scripts/enable-deploy-hook.sh`

- **Edge functions**: `supabase functions deploy coordinate-sms --project-ref adlusgtlwgcfyxgeoias`
- **Database**: `supabase db push --linked` (after `supabase link --project-ref adlusgtlwgcfyxgeoias`)

## Reminder intake

`reminder-intake` accepts reminder signups from businesslicensebycity.com and rentalrulesbycity.com. Call it from the site server. Keep `REMINDER_INTAKE_SECRET` off the browser.

Email reminders are on unless `email_opt_in` is `false`. SMS is sent only when `sms_opt_in` is boolean `true` and the request includes the phone, the consent text the person saw, `consent_version`, `source_url`, `client_ip`, and `user_agent`. The same person, title, and due time is stored once.

Set these Edge Function secrets before using it:

| Variable | Required | Purpose |
| --- | --- | --- |
| `REMINDER_INTAKE_SECRET` | yes | Shared secret. Callers send it in `x-intake-secret`. |
| `REMINDER_INTAKE_HOST_ID` | yes | Active PinOnIt user that owns the contacts and reminder rows. |

Allowed browser origins are `https://businesslicensebycity.com`, `https://www.businesslicensebycity.com`, `https://rentalrulesbycity.com`, and `https://www.rentalrulesbycity.com`.

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to Edge Functions.

Apply `supabase/migrations/20261025130000_reminder_intake.sql` before deploying. It only adds nullable columns. Deploy this function with `--no-verify-jwt` (the gateway must not require a Supabase JWT) and deploy `send-reminder` in the same release. `send-reminder` emails `recipient_email` and texts `recipient_phone` when those columns are set, and still uses the host profile when they are null. Voice and WhatsApp are unchanged.

```bash
curl -sS -X POST \
  'https://adlusgtlwgcfyxgeoias.supabase.co/functions/v1/reminder-intake' \
  -H 'Content-Type: application/json' \
  -H 'x-intake-secret: YOUR_SECRET' \
  -d '{
    "email": "owner@example.com",
    "name": "Ada Lovelace",
    "phone": "3055550100",
    "source_site": "https://businesslicensebycity.com",
    "source_url": "https://businesslicensebycity.com/miami/hair-salon",
    "city": "Miami",
    "state": "FL",
    "trade": "Hair Salon",
    "title": "Miami hair salon license renewal",
    "due_dates": ["2026-12-01"],
    "sms_opt_in": true,
    "consent_text": "I agree to receive recurring SMS reminders from PinOnIt about this renewal. Message frequency varies. Msg and data rates may apply. Reply STOP to cancel.",
    "consent_version": "2026-10-01",
    "client_ip": "203.0.113.10",
    "user_agent": "Mozilla/5.0"
  }'
```

A date with no time is 9:00 in `timezone` (default `America/New_York`). Email fires 24 hours before and at that time. SMS fires 1 hour before. New signups are limited to 8 reminders per email and 24 per connection IP each hour.

## Trial signup links

Share these links. `stripe-checkout` maps the code. It does not trust a `trial_period_days` value sent with a code. With no code, a requested trial is still capped at 90 days. An unknown code is a 14-day trial.

| Code | Link | Trial |
| --- | --- | --- |
| `FREE60` | https://pinonit.com/signup?promo=FREE60 | 60 days, card on file |
| `SWITCH` | https://pinonit.com/signup?promo=SWITCH | 90 days, for people replacing both Calendly and DocuSign |

The code is stored in the browser and sent to checkout after signup. `FREE60` and `SWITCH` are not secrets.

## Lead alerts

`lead-alert` texts `LEAD_ALERT_PHONE` when another project reports a new lead. `save-bot-lead` calls it after a bot lead is saved. Callers send a shared secret. The function does not accept a Supabase user JWT as its authorization.

Deploy with `--no-verify-jwt` (`./scripts/deploy-edge-functions.sh` does this). SMS uses the existing `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `LEAD_ALERT_TOKEN` | yes | Shared secret. Callers send it in the `x-lead-alert-token` header. |
| `LEAD_ALERT_PHONE` | yes | E.164 phone that receives the SMS, for example `+13055550100`. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to Edge Functions. A missing token or phone returns 503. A wrong token returns 401. The lead row is still saved if the text fails.

```bash
curl -sS -X POST \
  'https://adlusgtlwgcfyxgeoias.supabase.co/functions/v1/lead-alert' \
  -H 'Content-Type: application/json' \
  -H 'x-lead-alert-token: YOUR_TOKEN' \
  -d '{
    "source": "PinOnIt",
    "name": "Ada Lovelace",
    "contact": "ada@example.com",
    "note": "Replacing Calendly and DocuSign"
  }'
```

The text looks like `New lead (PinOnIt): Ada Lovelace – ada@example.com – Replacing Calendly and DocuSign`.

## Zip Owners

A verified Zip Owners subscriber can receive Pro at no charge, with no extra trial. The grant is its own `plan_grants.kind` (`zip_owners`). It does not convert a complimentary or creator grant, and it does not change a Stripe subscription, including a card trial. A no-card local trial is ended when the grant starts, so the days do not stack. When Zip Owners ends, the grant ends and the normal $9.99 checkout applies.

The website publish does not read `ZIP_OWNERS_SYNC_TOKEN`. Apply `supabase/migrations/20261028170000_zip_owners_grant.sql` before the first call. Deploy the function with `--no-verify-jwt` because the caller sends the shared secret, not a user JWT:

```bash
supabase functions deploy zip-owners-sync --no-verify-jwt --project-ref adlusgtlwgcfyxgeoias
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `ZIP_OWNERS_SYNC_TOKEN` | yes, at request time | Shared secret. Callers send it in the `x-zip-owners-token` header. |

If the token is missing, the function returns 503 and grants nobody.

## Legal

- [Terms of Service](https://pinonit.com/terms)
- [Privacy Policy](https://pinonit.com/privacy)
- [Acceptable Use](https://pinonit.com/acceptable-use)

Support: [support@pinonit.com](mailto:support@pinonit.com)
# test
