# Scout2 — Calendly SMB lead pipeline

Last updated: August 25, 2026

Python 3.9+ works (3.12 ideal). Finds small US businesses that use **Calendly** (and related booking signals), classifies them with Claude Haiku, extracts emails, verifies MX, stores in Supabase (`scout2_leads`), exports to Google Sheets for GMass.

## Current status (Aug 25, 2026)

### Done
- Pipeline live under `~/Projects/PinOnIt/scout2` (venv + `.env` configured)
- Schema applied: migrations `001`–`007` (`scout2_leads`, scoring/directory, export batches, **`scout2_send_batches`**, `send_batch_id`)
- Google service account loads (`secrets/google-sa.json`); campaign sheet via `GOOGLE_CAMPAIGN_SHEET_ID`
- **Ramp-batch** mode: `export-batch`, `batches`, `config/ramp.yaml`, repo-root `batch.sh`, alias `scoutbatch`
- Weekday launchd plist via `--schedule` (10:00am Mon–Fri) — **you** load it; weekends do not run

### Next
```bash
cd ~/Projects/PinOnIt && ./batch.sh landscaping
# or: scoutbatch landscaping
python -m scout2.cli batches --niche landscaping
```
- Load launchd when ready (see Ramp automation below)
- Outreach from a **separate warmed domain** (not pinonit.com); CAN-SPAM basics

### Do not
- Reverse Common Crawl “who links to Calendly” via CDX (not supported cheaply)
- Auto-load the launchd plist without reviewing it
- Spend Places/Anthropic without a cost cap (`--limit-queries` / `--limit`)

---

## Honest scope (read this)

**Common Crawl reverse-lookup** (“who links *to* calendly.com”) is **not** cheap via CDX — CDX indexes by URL, not page body. This pipeline is **Places-first + seedlist**, with homepage/path Calendly detection. A future optional path is bulk WET processing; `discover --source commoncrawl` is an explicit stub so we don’t pretend CDX can do reverse content search.

**Outreach:** CAN-SPAM is workable for B2B cold email (accurate From, physical address, working unsubscribe). Send from a **separate domain** (e.g. `getpinonit.com`) with SPF/DKIM/DMARC — never burn `pinonit.com`. Warm the sending domain **2–3 weeks** before volume.

## Layout

```
scout2/
  config/niches.yaml
  config/metros.yaml
  config/domains.txt
  config/exclude_domains.txt
  config/ramp.yaml              # Daily GMass warmup targets
  migrations/001_leads.sql
  migrations/002_lead_scoring.sql
  migrations/003_directory_leads.sql
  migrations/004_export_campaign.sql
  migrations/005_send_batches.sql
  migrations/006_converted_attribution.sql
  migrations/007_send_batch_id.sql
  scout2/
    export_sheet.py             # Ad-hoc GMass sheet + stats
    ramp_export.py              # export-batch / batches
    sync_results.py
    discover_cc.py
    discover_places.py
    fingerprint.py
    classify.py
    extract.py
    verify.py
    cli.py
    night.py
    scrapers/
    politeness.py
  .env.example
  requirements.txt
```

## Setup

```bash
cd scout2
# macOS often has python3 (3.9+) but not python3.12 — either works
python3 -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
cp .env.example .env
# fill SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, GOOGLE_PLACES_KEY,
# GOOGLE_SERVICE_ACCOUNT_FILE, DRIVE_FOLDER_ID, GOOGLE_CAMPAIGN_SHEET_ID
```

Apply schema in Supabase (SQL editor or `supabase db query --linked -f …`):

```bash
# 001 → 007 (send_batches + send_batch_id)
```

## Run order

```bash
# 1) Discover (cheap first)
python -m scout2.cli discover --source seedlist
# or Places (costs Google $ — start with --limit-queries 5)
python -m scout2.cli discover --source places --limit-queries 5

# 2) Detect Calendly on site
python -m scout2.cli detect --limit 200

# 3) Classify (Haiku); skips 11+ and non-US
python -m scout2.cli classify --limit 100

# 4) Extract emails
python -m scout2.cli extract --limit 100

# 5) MX verify → status=ready
python -m scout2.cli verify --limit 200

# 6) Score
python -m scout2.cli score --limit 500

# 7) Campaign sheet (GMass) — classified + valid email only, never the same address twice
python -m scout2.cli stats
python -m scout2.cli export-sheet --niche landscaping --limit 25

# After you send: match GMass results back to leads
python -m scout2.cli sync-results --sheet YOUR_GMASS_RESULTS_SHEET_ID
python -m scout2.cli stats
```

`export-sheet` opens **`GOOGLE_CAMPAIGN_SHEET_ID`** (share that sheet with the service account). One tab per niche for ad-hoc dumps. Rows are `status=ready` with `employees_bucket` set, a real email, and `mx_valid=true`. Domains in `config/exclude_domains.txt` are dropped. After a successful write, those leads become `exported` and will not go out again.

**Two spreadsheets:** the working **Scout2** sheet (`GOOGLE_SHEETS_ID`) keeps every lead in five tabs (all niches). **Scout2 Campaigns** is GMass. Early warmup used `--niche landscaping` only, so Campaigns looked like “just landscapers.” Restore the full mix (does **not** mark rows exported):

```bash
python -m scout2.cli campaign-inventory
```

That rewrites the **All emails** tab (~every address in Supabase). Leave `landscaping` / `landscaping-day*` send tabs alone. Daily ramp can mix industries with `./batch.sh all` (or `export-batch --niche all`).

### Ramp batches (daily GMass warmup)

```bash
# From PinOnIt root (activates scout2/.venv):
./batch.sh landscaping
# or alias (added to ~/.zshrc):
scoutbatch landscaping

# Or from scout2/:
python -m scout2.cli export-batch --niche landscaping
python -m scout2.cli export-batch --niche landscaping --date 2026-08-26
python -m scout2.cli batches --niche landscaping
```

Each run creates a **new** sheet tab named `<niche>-day<NN>-<YYYYMMDD>` (e.g. `landscaping-day01-20260825`), marks those leads `exported` with `send_batch_id`, and leaves full-list niche tabs untouched. Targets live in `config/ramp.yaml` (day 1–3: 10 … day 21+: 110 cap). Same niche+date refuses unless `--force`. Emails never export twice across niches/batches. On completion, check yesterday’s GMass report before sending.

### Ramp automation (launchd, weekdays 10:00am)

Weekends are **not** scheduled — the day counter only advances when `export-batch` actually runs.

```bash
cd ~/Projects/PinOnIt/scout2 && source .venv/bin/activate
# Write plist only (does NOT load):
python -m scout2.cli export-batch --niche landscaping --schedule
```

Then **you** enable it:

```bash
# Load
launchctl load ~/Library/LaunchAgents/com.pinonit.scout2.batch.landscaping.plist

# Verify registered
launchctl list | grep com.pinonit.scout2.batch

# Unload / disable
launchctl unload ~/Library/LaunchAgents/com.pinonit.scout2.batch.landscaping.plist
```

Logs append to `scout2/logs/batch.log`.

GMass tracking columns (`campaign_sent`, `date_sent`, `replied`, `unsubscribed`) are left blank on export. Bounced and unsubscribed from `sync-results` stay out of every future export.

CSV dump (no campaign marking): `python -m scout2.cli export --out leads_ready.csv`

Working copy of every lead (five tabs, not GMass):

```bash
python -m scout2.cli sheets-sync
```

The spreadsheet uses **five tabs** (each lead goes to exactly one):

| Tab | Who lands there |
|-----|-----------------|
| Calendly users | Detected Calendly (even if they also have email/phone) |
| Emails and phones | Email **and** phone, no Calendly |
| Emails | Email only |
| Phones | Phone only |
| Blanks | No Calendly, no email, no phone |

If the sheet still has a mixed **Scout2 Leads** tab, `sheets-sync` splits it. The Apps Script in `scripts/sheets-webhook.gs` must be pasted into the spreadsheet (keep your SECRET) and **Deploy → New version**. Reloading the sheet also adds **Scout2 → Split into 5 tabs**.

Or one shot: `python -m scout2.cli run-all --source seedlist`

## Places (run when you choose)

`config/metros.yaml` lists **1,000+ US cities across all 50 states + DC**. Each run finishes every job type in the **next unfinished city**, then stops. ScaleSERP is not used.

```bash
cd scout2
source .venv/bin/activate
./scripts/run-once.sh        # one city
./scripts/run-once.sh 2      # two cities
python -m scout2.cli places-status
```

Manual start / stop (you decide when it runs):

```bash
cd scout2
./scripts/start.sh    # background Places loop
./scripts/stop.sh     # stop now — also unloads launchd KeepAlive
```

Optional overnight loop (same work, unattended): `./scripts/run-nightly.sh`

When a city finishes, the overnight loop **starts the next city immediately** (no 10‑minute wait). It only pauses overnight when the daily Places cap is hit. Do not load `com.pinonit.scout2.nightly` if you want start/stop to stay manual — KeepAlive will restart it.

Google’s list prices (legacy Places, USD): Text Search **$32 / 1,000**, Place Details **$17 / 1,000**, website field **$3 / 1,000**. Each city is ~29 Scout2 searches (2 Google pages + website lookups). **80 searches ≈ 2–3 cities, usually about $5–$25** after Google’s monthly free allowance (often a few thousand Text Search / Details calls free). One city is less. Check the bill in Google Cloud → Maps.

Default cap is **80 Google Places searches/day** on the overnight script only. Manual `run-once` does the city you asked for.

## Extra directories (no ScaleSERP)

Public listings that often already have a booking link. Uses DuckDuckGo/Bing, then checks each business website for Calendly.

```bash
./scripts/run-extra.sh
./scripts/run-extra.sh "Miami FL"
python -m scout2.cli scrape-extra --location "Austin TX"
```

Sources: Psychology Today, The Knot, WeddingWire, ICF/Noomii coaches, Houzz, Angi, BBB, Avvo, state `.gov` license rosters, plus pages that already mention `calendly.com`.

If you buy a **BuiltWith / PublicWWW / SimilarTech** “uses Calendly” export, load it then fingerprint:

```bash
python -m scout2.cli import-domains ~/Downloads/calendly-sites.csv --source builtwith
python -m scout2.cli fingerprint --limit 500
python -m scout2.cli classify --limit 200
```

## Directory night session (optional, hours)

Loops free SERP + chamber + thumbtack + bark + extra directories. Ctrl+C prints a summary.

```bash
python -m scout2.cli scrape-night --hours 5
python -m scout2.cli scrape-directories --location "Denver CO"
```

Each stage **upserts** `leads` so runs are **resumable** (re-run only the next stage after a failure).

## Status flow

`discovered` → `detected` | `no_calendly` → `classified` | `skipped_size` → `extracted` → `ready` | `invalid_email`

After GMass export: `ready` → `exported` → `sent` | `replied` | `bounced` | `unsubscribed`. Domain excludes become `excluded`. Bounced and unsubscribed never return to the ready pool.

## Politeness

- 1 request/sec **per domain**
- `robots.txt` respected
- Custom UA (`SCOUT2_USER_AGENT`)
- 10s timeout, 2 retries (env-overridable)

## Cost notes (approximate)

| Stage | Driver | Notes |
|-------|--------|--------|
| Places discover | Google Places Text + Details | Text Search ~$32/1k, Details ~$17/1k (check current pricing). Use `--limit-queries`. |
| Detect / extract | Your bandwidth | Free beyond hosting. |
| Classify | Anthropic Haiku | Tiny prompts (~title+2k chars). Roughly fractions of a cent per lead. |
| Verify | DNS MX | Free. |
| Common Crawl WET (future) | S3/compute | Only if you batch-process WARC/WET offline. |

## Env

| Variable | Required |
|----------|----------|
| `SUPABASE_URL` | yes |
| `SUPABASE_SERVICE_KEY` | yes (service role; pipeline is internal) |
| `ANTHROPIC_API_KEY` | for classify |
| `GOOGLE_PLACES_KEY` | for places discover (Google charges; optional vs directories) |
| `GOOGLE_SHEETS_ID` | 5-tab working sheet (service-account path) |
| `GOOGLE_SHEETS_WEBAPP_URL` | Apps Script web app URL (current setup) |
| `GOOGLE_SHEETS_WEBHOOK_SECRET` | must match `SECRET` in the Apps Script |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | path to service-account JSON (or the JSON itself) for GMass export |
| `GOOGLE_SERVICE_ACCOUNT_FILE` | fallback path (`secrets/google-sa.json`) |
| `DRIVE_FOLDER_ID` | Google Drive folder for new campaign spreadsheets (share it with the SA email) |
| `SCOUT2_SEARCH` | `free` (default) or `scaleserp` |
| `SCALESERP_KEY` | only if `SCOUT2_SEARCH=scaleserp` |

## Outreach checklist (not in code)

1. Dedicated sending domain + SPF/DKIM/DMARC  
2. Warm 2–3 weeks  
3. CAN-SPAM: real From, physical address, one-click unsubscribe  
4. Export with `export-sheet` (not a mixed CSV of unclassified rows)
