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
| `REMINDER_INTAKE_ORIGINS` | no | Comma-separated https origins. Defaults to `https://businesslicensebycity.com`, `https://www.businesslicensebycity.com`, `https://rentalrulesbycity.com`, and `https://www.rentalrulesbycity.com`. |

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

## Legal

- [Terms of Service](https://pinonit.com/terms)
- [Privacy Policy](https://pinonit.com/privacy)
- [Acceptable Use](https://pinonit.com/acceptable-use)

Support: [support@pinonit.com](mailto:support@pinonit.com)
# test
