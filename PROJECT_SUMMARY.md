# PinOnIt - Project Summary

Last updated: June 30, 2026

---

## PinOnIt Session Summary — June 30, 2026

### Project basics

- **Live**: pinonit.com
- **GitHub**: Green-Apple-Tech/PinOnIt (private, `main` branch)
- **Local**: ~/Projects/PinOnIt
- **Bolt**: bolt.new/~/sb1-nzt1kjlj
- **Supabase**: adlusgtlwgcfyxgeoias
- **Stack**: React/Vite/Tailwind, Supabase backend, Bolt Cloud hosting

### Deploy workflow (established and working)

1. Cursor edits → `git push` → Bolt chat ("pull latest") → Publish
2. **`deploypinonit`** — shell alias saved in `~/.zshrc`
3. **`supabase db push --linked`** — apply migrations
4. **No CI workflow** — GitHub Actions deleted (was blocking deploys)

### P0 — Twilio SMS (currently blocked)

- A2P 10DLC campaign was **rejected** — reason: invalid brand support email
- **Next step**: console.twilio.com → Messaging → Regulatory Compliance → Brands → click **Miami Expeditions LLC** → update Support Email to a real working address → resubmit
- Twilio number: +17869527242
- Messaging Service SID: MGed3f12c87b8332f254d9a147c5ab87bd
- Account SID: AC22cefc8bdaece88f3d02eb43dbc4efbe
- Code correctly uses `MessagingServiceSid` (not `From`) in send-reminder, coordinate-sms, critical-alert edge functions — confirmed deployed
- Old broken "Pin On It" Messaging Service should be deleted in Twilio; keep "Low Volume Mixed A2P Messaging Service"

### Completed this session

- Group Scheduling hub — Meeting Poll + "Align & Book Multi-Party" cards with clarifying hints
- Coordinate Unknown Availability — simplified intent-first flow, timeframe + time-of-day pills, host manual SMS confirmation (no auto-booking)
- More Tools sidebar section (QR Code Creator + Email Signature)
- Single use links — moved to Scheduling page directly (was buried/broken in Settings; fixed auth-token-refresh state reset bug)
- Checkboxes restored on event types with "X of Y events" badge controlling what's in the shared link
- Copy Link + smaller QR Code buttons on Scheduling page, plus per-event QR icons
- Paid Booking page separated from standard booking page (was incorrectly sharing the same public URL/theme)
- Clean meeting link URL (removed ugly `?types=UUID` query params)
- Green → indigo color pass throughout app (kept green for "Connected" status badges and success toasts intentionally)
- T&C agreement checkbox now OFF by default, moved to Settings as global toggle with editable text; event-type-level override remains
- WhatsApp number field + Default reminder channel selector in Settings → Profile
- Session timeout / auto-logout setting in Settings (Never/30min/1hr/4hr/8hr/1day, HIPAA hint)
- Voice reminders clarified as host-only (not sent to guests)
- Bugbot ran via Cursor — fixed: wizard incorrectly reopening on every Calendly return, `calendly_error` opening wizard without gate, false "connected" state on OAuth failure, URL params stripped too early; added SMS opt-out (`appendSmsOptOut`) on all outbound messages and consent UI on phone entry screens
- `.cursor/BUGBOT.md` added for future automated PR reviews
- Photo upload on Paid Booking page — fixed handler (validation, toasts, saves to `avatar_url`), improved circle UI with tooltip
- Email Signature carousel — mobile fix (full-width preview, nav arrows below, larger tap targets)

### Still outstanding

- **Twilio A2P campaign** — fix support email and resubmit (P0)
- Zoom app marketplace submission incomplete (needs screenshots + App Listing)
- Google OAuth verification in progress (4–6 weeks from May 28 submission)
- DBA registration at sunbiz.org pending
- Recurring bookings (weekly/monthly service businesses) — designed but not built
- Public booking page Calendly-style redesign — pushed, needs visual verification on production
- Calendar month/week/day desktop view improvements — pushed, needs visual verification
- A few non-status green UI spots may still need indigo pass (Connected badges are correctly green and should stay)

---

## Live URL
https://pinonit.com

## Legal Entity
Miami Expeditions LLC dba PinOnIt

---

## Tech Stack

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
- calendly-auth
- calendly-callback
- coordinate-sms (Group Availability SMS coordination)
- create-teams-meeting
- create-zoom-meeting
- critical-alert
- gmail-contacts-sync
- google-calendar-auth
- google-calendar-callback
- health-monitor
- outlook-calendar-auth
- outlook-calendar-callback
- outlook-contacts-sync
- parse-availability (AI parses natural language availability)
- paypal-order
- referral-signup
- save-bot-lead
- scrape-calendly
- send-reminder
- stripe-checkout
- stripe-portal
- stripe-webhook
- test-critical-call
- verify-caldav
- voice-reminder-scheduler
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
- A2P 10DLC campaign **REJECTED** — update brand support email for Miami Expeditions LLC to a real address in Twilio console and resubmit (P0)
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

- **Twilio A2P campaign REJECTED** — update brand support email (Miami Expeditions LLC) in Twilio console → resubmit (P0)
- **Bolt publish required** after every GitHub push — live site won't update otherwise
- **Verify on production** after Publish: Calendly-style booking page, calendar desktop views, indigo UI theme, T&C off-by-default
- Run **`supabase db push --linked`** if any columns missing on production
- Zoom app submission incomplete (needs screenshots, App Listing)
- Google OAuth verification in progress (4–6 weeks from May 28)
- PinOnIt DBA registration at sunbiz.org pending
- Recurring bookings — DB columns exist; full booking UX not built
- WhatsApp production may still need Meta Business verification beyond Twilio A2P
- Consider forming separate LLC for PinOnIt vs Miami Expeditions
- Apple Sign In — planned for future (needs Apple Developer account $99/yr)
