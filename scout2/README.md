# Scout2 — Calendly SMB lead pipeline

Python 3.9+ works (3.12 ideal). Finds small US businesses that use **Calendly**, classifies them with Claude Haiku, extracts emails, verifies MX, stores in Supabase, exports CSV.

## Honest scope (read this)

**Common Crawl reverse-lookup** (“who links *to* calendly.com”) is **not** cheap via CDX — CDX indexes by URL, not page body. This pipeline is **Places-first + seedlist**, with homepage/path Calendly detection. A future optional path is bulk WET processing; `discover --source commoncrawl` is an explicit stub so we don’t pretend CDX can do reverse content search.

**Outreach:** CAN-SPAM is workable for B2B cold email (accurate From, physical address, working unsubscribe). Send from a **separate domain** (e.g. `getpinonit.com`) with SPF/DKIM/DMARC — never burn `pinonit.com`. Warm the sending domain **2–3 weeks** before volume.

## Layout

```
scout2/
  config/niches.yaml      # Places niches
  config/metros.yaml      # Places metros
  config/domains.txt      # Seed domains
  config/exclude_domains.txt  # Skip at GMass export
  migrations/001_leads.sql
  migrations/003_directory_leads.sql
  migrations/004_export_campaign.sql
  scout2/
    export_sheet.py       # GMass sheet + stats
    sync_results.py       # GMass results → replied/bounced/unsubscribed
    discover_cc.py        # seedlist (+ CC stub)
    discover_places.py    # Google Places
    fingerprint.py
    classify.py
    extract.py
    verify.py
    cli.py
    night.py              # 5-hour SERP + directory session
    scrapers/             # chamber, thumbtack, bark, ScaleSerp
    politeness.py         # 1 rps/domain, robots, UA, timeout, retries
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
# GOOGLE_SERVICE_ACCOUNT_JSON, DRIVE_FOLDER_ID
```

Apply schema in Supabase SQL editor:

```bash
# paste migrations/001_leads.sql then 002, 003, and 004_export_campaign.sql
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

### Ramp batches (daily GMass warmup)

```bash
# Next ramp day for landscaping → new tab landscaping-day01-YYYYMMDD
python -m scout2.cli export-batch --niche landscaping
python -m scout2.cli export-batch --niche landscaping --date 2026-08-26
python -m scout2.cli batches --niche landscaping

# Optional: write weekday 7am launchd plist (does NOT enable it)
python -m scout2.cli export-batch --niche landscaping --schedule
# then: launchctl load ~/Library/LaunchAgents/com.pinonit.scout2.export-batch.landscaping.plist
```

Targets live in `config/ramp.yaml` (day 1–3: 10 … day 21+: 110 cap). Same niche+date refuses unless `--force`. Emails never export twice across niches/batches.

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

Optional overnight loop (same work, unattended): `./scripts/run-nightly.sh`

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
