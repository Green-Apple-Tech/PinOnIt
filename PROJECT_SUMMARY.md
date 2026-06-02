# PinOnIt - Project Summary

Last updated: June 2, 2026

---

## PinOnIt Session Summary — June 2, 2026

### Workflow established

1. **Cursor edits** → `git push` → **Bolt GitHub icon** (confirm Synced, branch `main`, wait ~30s) → **Publish → Update**
2. **`deploypinonit`** — shell alias for Supabase edge function deploys
3. **`supabase db push --linked`** — apply migrations to linked project
4. **No CI workflow** — GitHub Actions workflow deleted (was causing all deploy failures today)

### Completed today

- **Group Scheduling page** — Meeting Poll + Align & Book Multi-Party cards
- **Coordinate Unknown Availability form** — simplified intent-first flow
- **Host manual confirmation** for coordinated meetings
- **More Tools** sidebar section (QR Code + Email Signature)
- **Single-use links** — moved to Scheduling page (fix deployed)
- **Checkboxes on event types** with "3 of 3 events" badge
- **Copy Link + QR buttons** on Scheduling page
- **Separated Paid Booking** from standard booking page (`/:slug` vs `/:slug/services`)
- **Green → indigo** color replacement throughout app (interactive UI; green kept for success toasts, Done checkmarks, connected badges)
- **T&C checkbox off by default** — moved to Settings → Booking page; per-event override in Policy tab
- **Twilio upgraded to paid**, A2P 10DLC registered — pending campaign approval (1–3 days)
- **Twilio `MessagingServiceSid`** — send-reminder uses Messaging Service (correct code deployed)
- **WhatsApp number field** + default reminder channel in Settings
- **Session timeout** setting in Settings → Profile → Session Security
- **Voice reminders** clarified as host-only
- **Calendly-style public booking page** redesign pushed
- **Calendar desktop view** improvements pushed (Appointments month/week/day)

### Still pending

- **Twilio SMS** — waiting for A2P campaign approval (check tomorrow)
- **Zoom app submission** incomplete (screenshots, App Listing)
- **Google OAuth verification** in progress (4–6 weeks)
- **DBA registration** at sunbiz.org
- **Recurring bookings** — schema exists; full guest-facing flow not yet built
- **Public booking page** Calendly-style redesign — pushed, needs verification on pinonit.com after Bolt Publish
- **Calendar desktop view** — pushed, needs verification after Bolt Publish
- **T&C migration** — run `supabase db push --linked` if `global_require_terms` / `global_terms_text` columns not yet on production DB

### Key credentials (June 2, 2026)

| Service | Value |
|---------|-------|
| Supabase project | `adlusgtlwgcfyxgeoias` |
| Bolt | https://bolt.new/~/sb1-nzt1kjlj |
| GitHub | Green-Apple-Tech/PinOnIt (private) |
| Twilio number | +1 786 952 7242 |
| Messaging Service SID | `MGed3f12c87b8332f254d9a147c5ab87bd` |

---

## Live URL
https://pinonit.com

## Legal Entity
Miami Expeditions LLC dba PinOnIt

## Tech Stack

- Frontend: React 18 / Vite / Tailwind
- Brand primary (Tailwind `brand-500`): `#5865c6`
- Backend: Supabase (project: adlusgtlwgcfyxgeoias)
- Hosting: **Bolt Cloud** (GitHub pushes do not auto-deploy — publish in Bolt)
- Payments: Stripe (live mode) + PayPal
- Email: Resend
- Domain: pinonit.com (registered via Bolt)
- SMS/Voice: Twilio (paid account, A2P 10DLC pending approval)
- WhatsApp: via `TWILIO_WHATSAPP_NUMBER` / profile `whatsapp_number` field

## Supabase Project

- Project ID: adlusgtlwgcfyxgeoias
- URL: https://adlusgtlwgcfyxgeoias.supabase.co
- Plan: Pro

## GitHub

- Organization: Green-Apple-Tech
- Repository: https://github.com/Green-Apple-Tech/PinOnIt
- Branch: main
- Local clone: ~/Projects/PinOnIt on Peter's MacBook Air

## Deploy

**Standard workflow (frontend → pinonit.com):**

1. Cursor: `git add . && git commit -m "..." && git push` to `main`
2. Bolt: **GitHub icon** (left of Publish) → confirm **Synced**, branch **`main`** → wait ~30s for auto-fetch
3. Bolt: **Publish → Update** → hard-refresh pinonit.com

Do **not** rely on Bolt chat pull for routine deploys. Private repo is OK. See [DEPLOY.md](./DEPLOY.md).

- **Edge functions**: `deploypinonit` (alias) or `supabase functions deploy <name> --project-ref adlusgtlwgcfyxgeoias`
- **Database migrations**: `supabase link --project-ref adlusgtlwgcfyxgeoias` then `supabase db push --linked`
- **CI**: No GitHub Actions deploy workflow (removed June 2, 2026 — was blocking deploys)

## Key routes

- Public booking: `/:slug`
- Booking actions: `/booking/:bookingId/:action/:actionToken`
- Group Scheduling hub: `/dashboard/group-scheduling`
- New coordination: `/dashboard/group-scheduling/coordinate?new=1` (legacy: `/dashboard/coordinate`)
- Legacy redirect: `/dashboard/messaging` → reminders tab
- Legacy redirect: `/dashboard/polls` → group scheduling polls

## Supabase CLI

- Installed via Homebrew (v2.103.0)
- Linked to project adlusgtlwgcfyxgeoias
- Deploy command: `cd ~/Projects/PinOnIt && supabase functions deploy --project-ref adlusgtlwgcfyxgeoias`
- Alias: `deploypinonit`

## Migrations

- **65** SQL files in `supabase/migrations/` (as of June 2, 2026)

## Features Built

- Google OAuth login (working)
- Azure/Microsoft OAuth login (working - multi-tenant)
- Email/password login (working)
- Custom username slug (pinonit.com/username)
- Google Calendar OAuth sync (working - verified with Google)
- Outlook Calendar OAuth sync (working - multi-tenant fixed)
- Apple iCloud CalDAV connection (working)
- iCal URL subscription (working)
- Zoom OAuth integration (working - production credentials set)
- Google Meet auto-generation on booking (working)
- Microsoft Teams auto-generation on booking (working)
- Video link auto-detection on confirmation page
- Meetings page with Month view as default (Agenda/Month/Week/Day views)
- Contacts page (auto-populated from bookings)
- Google Contacts sync (working - People API enabled)
- Outlook Contacts sync (working)
- Connect Gmail to email contacts (working)
- Event types / scheduling - combined with Scheduling page
- One-on-one and Group event types only (One-off and Round Robin removed)
- Default 3 event types for new users (15 Min Quick Call, 30 Min Consultation, Paid Service/Consultation $50)
- Default 60-min email reminder on all new event types
- Edit button on each event type with full slide-out drawer editor
- Buffer before/after meeting (pill button selector: None/5/10/15/20/30/45/60 min)
- Availability management with default 10am-3pm Mon-Fri, lunch break 12-1pm
- Reminders & Messages page with checkbox grid (Email/SMS/WhatsApp per timing)
- Critical Meeting Alerts with Twilio voice call (5 min and 1 min before)
- Critical alerts in Advanced tab of Reminders page
- Group Scheduling hub (`/dashboard/group-scheduling`) — Meeting Polls + SMS coordination
  - Per-day time slot picker with calendar busy integration
  - Global + per-day off-hours bypass
  - Pre-enter participant availability (skips SMS)
  - Outbound SMS includes host's per-day proposed times
- Recurring booking support on **services** + **bookings** tables (not a separate `event_types` table)
- Session timeout setting in Settings → Profile → Session Security
- Default reminder channel (Email/SMS/WhatsApp/Voice) in Settings → Profile
- WhatsApp number field in Settings (falls back to profile phone when blank)
- Global Terms & Conditions in Settings → Booking page (`global_require_terms`, `global_terms_text`); off by default; per-event override in event editor Policy tab
- UI theme: interactive elements use indigo (`indigo-600` / `#4F46E5`); green reserved for success toasts, Done checkmarks, connected badges
- Email Signature creator (live preview, Editor/Instructions tabs, all fields expanded)
- Stripe subscription billing ($6/mo Pro plan)
- 60-day free trial for Calendly switchers (CC required)
- 14-day free trial for new users (CC required)
- Referral system with earnings ($1/mo per referral)
- Referral leaderboard at /leaderboard
- PayPal payment for paid bookings
- QR code booking
- Calendly migration wizard (URL import working)
- Onboarding wizard (8 steps - fixed loop issue, saves onboarding_completed to profiles)
- Wizard skips steps where user already has data (calendars connected, event types exist)
- Contextual To-Do checklists on each main page
- Calendar event reminder override per booking
- Multi-calendar selection for booking destination
- Both checkboxes independently selectable on calendar wizard step
- Privacy policy at /privacy
- Terms of service at /terms
- Acceptable Use Policy at /acceptable-use
- GDPR and CCPA compliance sections added
- Landing page with earnings calculator
- Comparison table vs Calendly
- Powered by PinOnIt branding on free booking pages
- Logo click links back to pinonit.com marketing site
- Default Terms & Conditions **off by default**; configurable in Settings → Booking page
- NDA toggle on event types
- Settings page with tabs: Profile, Booking page, Branding, Embed, Referrals, Integrations
- Integrations tab with connect buttons for Zoom, Google, Outlook, Apple
- Full color picker (react-colorful) on Branding tab
- Paid Booking page with 3 themes (Clean, Bold, Warm)
  - Live preview with Smith Photography demo content
  - Copy Link, QR Code, Embed HTML, Preview Live buttons
  - Service categories, thumbnails, layout options
- Public status page at /status
- Health monitor edge function (checks services every 5 minutes)
- Toast notification system
- Branded 404 page
- Mobile responsive event type editor (full screen on mobile)

## Stripe

- Live mode enabled
- Pro plan price ID: price_1TZHhhIVv38UYFOXMXT2EV8v
- Webhook: https://adlusgtlwgcfyxgeoias.supabase.co/functions/v1/stripe-webhook
- 60-day trial for Calendly switchers (CC required)
- 14-day trial for new users (CC required)
- Money back guarantee: 60 days

## Edge Functions (all deployed and ACTIVE)

- booking-reply
- calendar-sync
- coordinate-sms (new - Group Availability SMS coordination)
- create-teams-meeting
- create-zoom-meeting
- critical-alert
- google-calendar-auth
- google-calendar-callback
- health-monitor
- outlook-calendar-auth
- outlook-calendar-callback
- parse-availability (new - AI parses natural language availability)
- paypal-order
- referral-signup
- scrape-calendly
- send-reminder
- stripe-checkout
- stripe-portal
- stripe-webhook
- test-critical-call
- verify-caldav
- zoom-auth
- zoom-callback

## Video Conferencing

- Google Meet: auto-generated via Google Calendar API (conferenceDataVersion=1)
- Microsoft Teams: auto-generated via Microsoft Graph API (/me/onlineMeetings)
- Zoom: OAuth app — production credentials in Supabase secrets
- Priority order on booking: Google Meet → Teams → Zoom

## Twilio

- Account SID: AC22cefc8bdaece88f3d02eb43dbc4efbe
- **Paid account** (upgraded June 2, 2026)
- **Production number**: +1 786 952 7242
- **Messaging Service SID**: MGed3f12c87b8332f254d9a147c5ab87bd
- A2P 10DLC registered — **campaign approval pending** (1–3 days; SMS to unverified numbers blocked until approved)
- SMS: `send-reminder` uses `MessagingServiceSid` / `TWILIO_MESSAGING_SERVICE_SID`
- Voice calls working (critical meeting alerts, host voice reminders)
- WhatsApp: profile `whatsapp_number` + default channel in Settings
- Legacy verified trial number: +1 305 321 2060
- Secrets in Supabase: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_MESSAGING_SERVICE_SID (and/or TWILIO_PHONE_NUMBER)

## Secrets Required

### Bolt Secrets

- STRIPE_SECRET_KEY
- STRIPE_PUBLISHABLE_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRO_PRICE_ID
- PAYPAL_CLIENT_ID
- PAYPAL_CLIENT_SECRET
- PAYPAL_SANDBOX=false
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_MESSAGING_SERVICE_SID

### Supabase Edge Function Secrets

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- AZURE_CLIENT_ID (471ae067-6621-4b3b-80a2-075a87867c41)
- AZURE_CLIENT_SECRET
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- ZOOM_CLIENT_ID (production: c_QmZ8WETPR6b8WL58EyQ)
- ZOOM_CLIENT_SECRET
- PAYPAL_CLIENT_ID
- PAYPAL_CLIENT_SECRET
- PAYPAL_SANDBOX
- RESEND_API_KEY
- ANTHROPIC_API_KEY
- TWILIO_ACCOUNT_SID
- TWILIO_AUTH_TOKEN
- TWILIO_MESSAGING_SERVICE_SID

## Google OAuth Status

- Login: working
- Calendar sync: working
- Contacts sync: working (People API enabled in Google Cloud)
- Verification: submitted May 28, 2026 (under review - 4-6 weeks)
- Branding: verified
- Homepage requirements: passed
- Privacy policy: under review
- App functionality: pending
- Domain: pinonit.com verified in Search Console
- Developer email: fortdefendapp@gmail.com
- Google Cloud Project: pinonit-495022
- Active client secret: ****FZ-v (created May 21, 2026)

## Azure/Microsoft OAuth Status

- App registration: PinOnIt (471ae067-6621-4b3b-80a2-075a87867c41)
- Tenant: fortdefend.com (multi-tenant enabled)
- Supported accounts: Any Entra ID + Personal Microsoft accounts
- Calendar sync: working
- Contacts sync: working
- Teams meeting creation: working

## Zoom OAuth Status

- App: PinOnIt on marketplace.zoom.us
- Type: General App / User-managed
- Status: Draft - Active for internal users
- Production credentials configured
- Beta Test: active for Peter's account
- App Submission: Not ready (needs screenshots, App Listing)
- Scopes: meeting:write:meeting, user:read:user

## Legal

- Entity: Miami Expeditions LLC dba PinOnIt
- Governing law: Florida
- Terms: /terms
- Privacy: /privacy
- Acceptable Use: /acceptable-use
- DBA registration: pending at sunbiz.org

## Database Tables (key ones)

- profiles - user profiles with onboarding_completed, trial_ends_at, paid_booking_settings, global_require_terms, global_terms_text, whatsapp_number, default_reminder_channel, session_timeout_minutes
- services - appointment types (recurring columns: is_recurring, recurrence_frequency, etc.)
- service_reminders - one row per channel per timing
- contacts - with company, phone, source, avatar_url columns
- connected_calendars - calendar connections
- bookings - with is_critical, recurring columns, critical_alert flags
- coordinated_meetings - SMS/WhatsApp multi-party coordination (selected_dates, preferred_times jsonb)
- coordinated_meeting_participants - participants with availability_pre_entered, parsed_slots
- uptime_logs - for status page

## Known Issues / To Do

- **Twilio SMS** — A2P campaign approval pending; check status daily until live
- **Bolt publish required** after every GitHub push — live site won't update otherwise
- **Verify on production** after Publish: Calendly-style booking page, calendar desktop views, indigo UI theme, T&C off-by-default
- Run **`supabase db push --linked`** if T&C / single-use link / WhatsApp columns missing on production
- Zoom app submission incomplete (needs screenshots, App Listing)
- Google OAuth verification in progress (4–6 weeks)
- PinOnIt DBA registration at sunbiz.org pending
- Recurring bookings — DB columns exist; full booking UX not built
- WhatsApp production may still need Meta Business verification beyond Twilio A2P
- Consider forming separate LLC for PinOnIt vs Miami Expeditions
- Apple Sign In — planned for future (needs Apple Developer account $99/yr)
