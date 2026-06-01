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

- **Frontend (pinonit.com)**: Publish from [Bolt Cloud](https://bolt.new) — pushing to GitHub does not update production
- **Edge functions**: `supabase functions deploy coordinate-sms --project-ref adlusgtlwgcfyxgeoias`
- **Database**: `supabase db push --linked` (after `supabase link --project-ref adlusgtlwgcfyxgeoias`)

## Legal

- [Terms of Service](https://pinonit.com/terms)
- [Privacy Policy](https://pinonit.com/privacy)
- [Acceptable Use](https://pinonit.com/acceptable-use)

Support: [support@pinonit.com](mailto:support@pinonit.com)
