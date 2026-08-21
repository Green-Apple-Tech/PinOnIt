# Scout2 — Calendly SMB lead pipeline

Python 3.12 recommended. Finds small US businesses that use **Calendly**, classifies them with Claude Haiku, extracts emails, verifies MX, stores in Supabase, exports CSV.

## Honest scope (read this)

**Common Crawl reverse-lookup** (“who links *to* calendly.com”) is **not** cheap via CDX — CDX indexes by URL, not page body. This pipeline is **Places-first + seedlist**, with homepage/path Calendly detection. A future optional path is bulk WET processing; `discover --source commoncrawl` is an explicit stub so we don’t pretend CDX can do reverse content search.

**Outreach:** CAN-SPAM is workable for B2B cold email (accurate From, physical address, working unsubscribe). Send from a **separate domain** (e.g. `getpinonit.com`) with SPF/DKIM/DMARC — never burn `pinonit.com`. Warm the sending domain **2–3 weeks** before volume.

## Layout

```
scout2/
  config/niches.yaml      # Places niches
  config/metros.yaml      # Places metros
  config/domains.txt      # Seed domains
  migrations/001_leads.sql
  scout2/
    discover_cc.py        # seedlist (+ CC stub)
    discover_places.py    # Google Places
    detect.py
    classify.py
    extract.py
    verify.py
    cli.py
    politeness.py         # 1 rps/domain, robots, UA, timeout, retries
  .env.example
  requirements.txt
```

## Setup

```bash
cd scout2
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# fill SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY, GOOGLE_PLACES_KEY
```

Apply schema in Supabase SQL editor:

```bash
# paste migrations/001_leads.sql
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

# 6) Export
python -m scout2.cli export --out leads_ready.csv
```

Or one shot: `python -m scout2.cli run-all --source seedlist`

Each stage **upserts** `leads` so runs are **resumable** (re-run only the next stage after a failure).

## Status flow

`discovered` → `detected` | `no_calendly` → `classified` | `skipped_size` → `extracted` → `ready` | `invalid_email`

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
| `GOOGLE_PLACES_KEY` | for places discover |

## Outreach checklist (not in code)

1. Dedicated sending domain + SPF/DKIM/DMARC  
2. Warm 2–3 weeks  
3. CAN-SPAM: real From, physical address, one-click unsubscribe  
4. Export `leads_ready.csv` only — no noreply/support/privacy (already filtered)
