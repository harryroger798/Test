# SnapLeads — Complete Consolidated Architecture Document

**Version:** v3.5.11 (Current)
**Date:** March 14, 2026
**Author:** Architecture Audit (Claude Sonnet 4.6 + Devin Deep Code Audit)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repositories](#2-repositories)
3. [Credentials & Secrets](#3-credentials--secrets)
4. [Desktop App (Electron + Python Backend)](#4-desktop-app-electron--python-backend)
5. [License Server & Web Platform](#5-license-server--web-platform)
6. [Database Architecture](#6-database-architecture)
7. [Extraction Pipeline](#7-extraction-pipeline)
8. [Build System & CI/CD](#8-build-system--cicd)
9. [Download & Distribution System](#9-download--distribution-system)
10. [Live Site & Deployment](#10-live-site--deployment)
11. [Feature Map & Connections](#11-feature-map--connections)
12. [Pricing & License Management](#12-pricing--license-management)
13. [All Pull Requests](#13-all-pull-requests)
14. [Artifacts & Versioning](#14-artifacts--versioning)
15. [Directory Structure](#15-directory-structure)
16. [DEEP AUDIT: Root Cause Analysis — Why Extraction Returns 0-44 Leads](#16-deep-audit-root-cause-analysis)
17. [DEEP AUDIT: Platform-by-Platform Analysis (All 20 Platforms)](#17-platform-by-platform-analysis)
18. [DEEP AUDIT: Dashboard CSS Issue (Black Text on Dark Background)](#18-dashboard-css-issue)
19. [AI-Powered Offline Solution Plan](#19-ai-powered-offline-solution-plan)
20. [Recommendations & Fix Priority](#20-recommendations--fix-priority)
21. [Version History (v3.4.3 — v3.5.11)](#21-version-history)

---

## 1. System Overview

SnapLeads is a desktop lead-extraction application that extracts emails and phone numbers from **12 social media platforms + 8 B2B business platforms** using a 6-engine free search waterfall, **190M+ pre-extracted leads database** (LinkedIn 86.9M + Instagram 2.45M + Google Maps 32K+ + PAN India 101M+), and page content scraping. It is distributed as an Electron desktop app (Windows/macOS/Linux) with a bundled Python (FastAPI) backend.

### High-Level Architecture

```
+-----------------------------------------------------+
|                   USER'S MACHINE                     |
|                                                      |
|  +----------------------+  +----------------------+  |
|  |   Electron Shell      |  |  PyInstaller Binary   |  |
|  |   (React/Vite UI)     |--|  (FastAPI on :8000)   |  |
|  |   electron/main.js    |  |  backend/app/main.py  |  |
|  +----------+------------+  +----------+------------+  |
|             |                          |              |
|             |    IPC (preload.js)      |              |
|             +--------------------------+              |
|             |                          |              |
|        +----v----+            +--------v--------+    |
|        | SQLite  |            | S3 (DuckDB)     |    |
|        | leads.db|            | 190M+ leads     |    |
|        | (local) |            | records via net  |    |
|        +---------+            +-----------------+    |
+--------------------------+----------------------------+
                           | HTTPS
                +----------v----------+
                |  License Server     |
                |  (Render.com)       |
                |  snapleads-api      |
                |  .onrender.com      |
                +----------+----------+
                           |
                +----------v----------+
                |  Marketing Site     |
                |  getsnapleads.store  |
                |  (Netlify)          |
                |  _redirects -> B2   |
                +-----------------------+
```

### Tech Stack Summary

| Component | Technology |
|-----------|-----------|
| Desktop Shell | Electron 33+ |
| Frontend UI | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend API | Python 3.12 + FastAPI + Uvicorn |
| Local Database | SQLite (aiosqlite) with WAL mode (v3.5.11) |
| Remote Database | DuckDB over S3 (iDrive E2) — 190M+ records |
| Build Tool | PyInstaller (backend binary) + electron-builder (installer) |
| CI/CD | GitHub Actions |
| License Server | FastAPI + SQLite (hosted on Render.com) |
| Marketing Site | React + Vite (hosted on Netlify) |
| File Storage | Backblaze B2 (download binaries) |
| Data Storage | iDrive E2 S3 (leads database CSVs) |
| Anti-Detection | curl_cffi TLS fingerprint impersonation (v3.5.0+) |

---

## 2. Repositories

### Repository 1: `harryroger798/Test` (Desktop App)

- **GitHub URL:** https://github.com/harryroger798/Test
- **Actual repo name:** `social-lead-extractor-pro`
- **Clone URL:** https://github.com/harryroger798/social-lead-extractor-pro.git
- **Default branch:** main
- **Language:** TypeScript (frontend) + Python (backend)

### Repository 2: `harryroger798/snapleads-platform` (License Server + Marketing Site)

- **GitHub URL:** https://github.com/harryroger798/snapleads-platform
- **Default branch:** main
- **Subfolders:**
  - `snapleads-api/` — License server (FastAPI, deployed on Render.com)
  - `snapleads-web/` — Marketing site (React/Vite, deployed on Netlify)

---

## 3. Credentials & Secrets

### GitHub

```
GitHub PAT: <REDACTED — stored in Devin secrets as GITHUB_PAT>
Owner: harryroger798
```

### iDrive E2 S3 (Leads Database)

```
Endpoint: https://s3.us-west-1.idrivee2.com
Access Key: <REDACTED — base64-embedded in database_search.py>
Secret Key (embedded, read-only): <REDACTED — base64-embedded in database_search.py>
Bucket: crop-spray-uploads
Region: us-west-1
```

**VERIFIED:** Embedded credentials ARE valid — successfully tested DuckDB S3 queries returning LinkedIn data (44/50 rows with email for "Software Engineer" query across 15 CSV files in 21 seconds).

**Databases on S3:**
- `s3://crop-spray-uploads/leads-cm-database/linkedin/{Country}/dataset_N.csv` — 86.9M LinkedIn records (1738 datasets across 170+ countries)
- `s3://crop-spray-uploads/leads-cm-database/instagram/dataset_N.csv` — 2.45M Instagram records (49 datasets)
- `s3://crop-spray-uploads/leads-cm-database/technology_lookup/{technology}.csv` — 4.3M technology lookup records
- `s3://crop-spray-uploads/leads-cm-database/googlemaps/dataset_N.csv` — 32,544 Google Maps business records (19 datasets, v3.5.10)
- `s3://crop-spray-uploads/leads-cm-database/pan_india/dataset_N.csv` — 101M+ PAN India business records (608 datasets, v3.5.10)

### Backblaze B2 (Download Binary Storage)

```
Key ID:          <REDACTED — stored in Devin secrets>
Key Name:        SnapLeads
Application Key: <REDACTED — stored in Devin secrets>
Bucket:          snapleads-downloads
Download URL:    https://f005.backblazeb2.com/file/snapleads-downloads/
```

**File layout (v3.5.11 — current):**
```
snapleads-downloads/
  v3.5.11/
    SnapLeads-Setup-3.5.11.exe             (Windows NSIS installer, ~330MB)
    SnapLeads-3.5.11-arm64-mac.zip         (macOS zip, ~273MB)
    SnapLeads-3.5.11.AppImage              (Linux AppImage, ~4.1GB)
  v3.5.10/
    SnapLeads-Setup-3.5.10.exe
    SnapLeads-3.5.10-arm64-mac.zip
    SnapLeads-3.5.10.AppImage
```

### VirusTotal

```
API Key: <REDACTED — stored in Devin secrets as VIRUSTOTAL_API_KEY>
```

### AWS (Bedrock — Claude AI Consultation)

```
Account:            096938402960
AWS Access Key ID:  <REDACTED — stored in Devin secrets>
AWS Secret Key:     <REDACTED — stored in Devin secrets>
Region:             us-east-1
Model:              us.anthropic.claude-sonnet-4-6
```

### PhantomBuster

```
Email: <REDACTED — stored in Devin secrets>
Password: <REDACTED — stored in Devin secrets>
```

---

## 4. Desktop App (Electron + Python Backend)

### Frontend (React + Vite + TypeScript)

```
frontend/
  src/
    components/
      extraction/
        NewExtraction.tsx       -- Main extraction form (keyword, platform, options)
        B2BPlatforms.tsx        -- B2B platform selector (v3.5.4+)
      dashboard/
        Dashboard.tsx           -- Stats cards, charts (Recharts), recent sessions
      results/
        ResultsView.tsx         -- Results table with export options
      account/
        AccountProfile.tsx      -- License activation, team management
      icons/
        PlatformIcons.tsx       -- SVG icons for all 20+ platforms
    lib/
      version.ts                -- APP_VERSION = '3.5.11'
      api.ts                    -- Backend API client
      utils.ts                  -- formatNumber, formatDate, cn() helper
    index.css                   -- Theme variables (dark theme, zinc palette)
    App.tsx                     -- Root component with router
```

### Backend (Python + FastAPI)

```
backend/
  app/
    main.py                     -- FastAPI app entry point
    database.py                 -- SQLite connection manager (WAL mode v3.5.11)
    api/
      routes.py                 -- All API endpoints (~2905 lines)
    services/
      ## Core Extraction Pipeline ##
      keyword_parser.py         -- Smart keyword parsing with Hinglish + location extraction (759 lines)
      database_search.py        -- DuckDB S3 queries against 190M+ leads (1257 lines)
      multi_engine_search.py    -- 6-engine free search waterfall (763 lines)
      features.py               -- Email finder, job boards, directories, PDF export
      extractor.py              -- Email/phone regex, scoring, classification
      anti_detection.py         -- curl_cffi TLS fingerprint, rate limiting, SSRF protection (549 lines)
      quality_scorer.py         -- Lead quality scoring 0-100 (205 lines)

      ## Live Scraping (v3.5.0+) ##
      live_scrapers.py          -- 12-platform live scrapers (1310 lines):
                                   Reddit, WhatsApp, Facebook, Telegram, Twitter,
                                   LinkedIn, Tumblr, Instagram, Pinterest, TikTok,
                                   YouTube, Google Maps

      ## B2B Platform Scrapers + Waterfall Enrichment (v3.5.4) ##
      b2b_scrapers.py           -- 8 B2B platform scrapers (1600+ lines):
                                   IndiaMART, Apollo.io, TradeIndia, ExportersIndia,
                                   JustDial, Google Maps B2B, RocketReach, Crunchbase
      website_email_finder.py   -- Website email/phone finder
      waterfall_enrichment.py   -- 4-stage enrichment engine (870 lines)

      ## Google Dorking ##
      google_dorking.py         -- Multi-engine dorking with 10+ templates per platform (497 lines)

      ## Directory & YellowPages ##
      yellowpages_scraper.py    -- YellowPages + Yelp scraper
      gmaps_scraper.py          -- Google Maps scraper
```

---

## 5. License Server & Web Platform

### License Server (snapleads-api)

- **Host:** Render.com
- **URL:** https://snapleads-api.onrender.com
- **Framework:** FastAPI + SQLite
- **Features:** License CRUD, activation/deactivation, team management, usage tracking

### Marketing Site (snapleads-web)

- **Host:** Netlify
- **URL:** https://getsnapleads.store
- **Framework:** React + Vite + Tailwind CSS
- **Features:** Landing page, download section (OS-specific), VirusTotal badges

---

## 6. Database Architecture

### Local SQLite (leads.db)

- Extraction sessions, results, settings, blacklist, schedules, outreach logs
- Managed via `aiosqlite` async driver
- **v3.5.11:** WAL mode enabled, nested connection deadlock eliminated

### Remote S3 (DuckDB over iDrive E2)

- **190M+ pre-extracted leads** queried via DuckDB httpfs extension
- LinkedIn: 86.9M records across 1,738 CSV datasets (170+ countries)
- Instagram: 2.45M records across 49 datasets
- Technology Lookup: 4.3M records
- Google Maps: 32,544 business records across 19 CSV datasets (v3.5.10)
- PAN India: 101M+ business records across 608 CSV datasets (v3.5.10)

### LinkedIn CSV Schema

```
name, title, department, managementlevel, email, phone, linkedin, city, state,
country, postalcode, company, revenue, foundedyear, employees, keywords,
industry, description, languages, cfacebook, clinkedin, cx, website, cphone,
technologies, ccity, cstate, ccountry, cpostalcode, totalfunding
```

### Instagram CSV Schema

```
bio, category, email, followerCount, followingCount, name, phone, username, website, status
```

### Google Maps CSV Schema (PhantomBuster)

```
name, category, address, phone, website, rating, reviewCount, sourceUrl, query, currentStatus
```

### PAN India CSV Schema (Standardized)

```
name, phone, email, company, city, state, category
```

---

## 7. Extraction Pipeline

```
User enters keyword + selects platform(s)
          |
    [keyword_parser.py]
    Parse keyword: extract location, expand synonyms,
    Hinglish support, plural normalization
          |
    [routes.py — v3.5.8 B2B skip logic]
    If ONLY B2B platforms selected, skip database search
    (S3 has zero B2B data). Mixed selections run DB search normally.
          |
    [database_search.py]
    Query 190M+ S3 database FIRST (database-first strategy)
    Tier-aware: free=3 datasets, starter=5, pro=8
    30s timeout per query, OR-based semantic expansion
          |
    [multi_engine_search.py]
    6-engine free search waterfall:
    Brave > Startpage > DDG Lite > Mojeek > Qwant > SearXNG
          |
    [live_scrapers.py]
    Platform-specific live scrapers (12 platforms)
    Uses curl_cffi anti-detection + search engine dorking
          |
    [b2b_scrapers.py]
    B2B platform scrapers (8 platforms, if B2B selected)
    IndiaMART dual endpoints, JustDial, Apollo, etc.
          |
    [google_dorking.py]
    Multi-template dorking (10+ queries per platform)
    Waterfall: Serper API > Multi-engine > Patchright
          |
    [waterfall_enrichment.py]
    Auto-fill missing email/phone/LinkedIn via
    Hunter pattern, Google dorking, website crawl, Clearbit
          |
    [quality_scorer.py]
    Score 0-100: email(+25), phone(+20), name(+15),
    URL(+10), location(+5), platform(+5-15), verified(+10)
          |
    [routes.py — Save to SQLite]
    INSERT leads, update session status, commit
```

### Extraction Flow in routes.py (lines 224-817)

1. **Initialize** — Parse keywords, detect B2B-only platforms
2. **Database Search** (lines 306-370) — Query S3 via DuckDB, tier-gated limits
3. **Reddit RSS** (lines 388-410) — Fast RSS/JSON extraction
4. **Live Scraping** (lines 412-441) — 12 platforms via curl_cffi
5. **Google Dorking** (lines 443-487) — Multi-template per platform
6. **Bio Link Following** (lines 489-616) — Extract from personal websites
7. **B2B Scraping** (lines 618-651) — 8 B2B platforms
8. **Waterfall Enrichment** (lines 653-674) — Fill missing fields
9. **Firecrawl** (lines 676-694) — Optional paid enrichment
10. **Save to DB** (lines 707-787) — Score, verify, INSERT leads

---

## 8. Build System & CI/CD

### GitHub Actions Workflow

Located at `.github/workflows/build.yml`:

```yaml
trigger: push to main (tag v*)
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - PyInstaller build (backend → single binary)
      - npm run build (frontend → dist/)
      - electron-builder --win nsis
      - Upload artifact

  build-macos:
    runs-on: macos-latest (ARM64)
    steps: same but --mac zip

  build-linux:
    runs-on: ubuntu-latest
    steps: same but --linux AppImage
```

### Build Process

1. Tag push triggers GitHub Actions
2. PyInstaller compiles Python backend to single binary
3. Vite builds React frontend to `dist/`
4. electron-builder packages everything into platform installer
5. Artifacts uploaded to GitHub Actions

### Release Pipeline (Manual Steps After Build)

1. Download 3 artifacts from GitHub Actions
2. Upload to Backblaze B2 (`v{VERSION}/` prefix)
3. Scan with VirusTotal
4. Update platform download links (snapleads-platform repo)
5. Verify live site shows correct URLs

---

## 9. Download & Distribution System

### Current URLs (v3.5.11)

| Platform | Download URL |
|----------|-------------|
| Windows | `https://f005.backblazeb2.com/file/snapleads-downloads/v3.5.11/SnapLeads-Setup-3.5.11.exe` |
| macOS | `https://f005.backblazeb2.com/file/snapleads-downloads/v3.5.11/SnapLeads-3.5.11-arm64-mac.zip` |
| Linux | `https://f005.backblazeb2.com/file/snapleads-downloads/v3.5.11/SnapLeads-3.5.11.AppImage` |

### VirusTotal Scan Results (v3.5.11)

| File | VT ID | Detections |
|------|-------|------------|
| Windows .exe | `da14cddc48afaa3c20bc97c26f9e6aa41a96dae12acc62f6a4dde8c2a50f0ed6` | 0/72 |
| macOS .zip | `abdf2f2e6ff3ad3ee5eaf0a5f6ef03b3acc2e8ab8e4a45fb6b4d1f24c3a5e900` | 0/62 |
| Linux .AppImage | `e6f4e3fcd67b2f894ad231b0ea9c8372fa03a6f2e7d81c5b6c97f35a4a2b0d12` | 0/64 |

---

## 10. Live Site & Deployment

### Marketing Site

- **URL:** https://getsnapleads.store
- **Host:** Netlify
- **Auto-deploy:** On push to `snapleads-web/` in snapleads-platform repo
- **CDN:** Cloudflare (s-maxage=300, 5 min cache)

### License Server

- **URL:** https://snapleads-api.onrender.com
- **Host:** Render.com
- **Auto-deploy:** On push to `snapleads-api/` in snapleads-platform repo

---

## 11. Feature Map & Connections

### 20 Extraction Platforms

| # | Platform | Type | Method | Database |
|---|----------|------|--------|----------|
| 1 | LinkedIn | Social | DB Search + Dorking | 86.9M records |
| 2 | Instagram | Social | DB Search + Dorking + Bio Links | 2.45M records |
| 3 | Facebook | Social | Dorking only (never touch fb.com) | - |
| 4 | Twitter/X | Social | Dorking + Nitter mirrors | - |
| 5 | YouTube | Social | Dorking + Channel pages | - |
| 6 | TikTok | Social | Dorking only | - |
| 7 | Pinterest | Social | Dorking only | - |
| 8 | Tumblr | Social | Dorking only | - |
| 9 | Reddit | Social | RSS/JSON endpoints | - |
| 10 | Telegram | Social | Dorking + t.me pages | - |
| 11 | WhatsApp | Social | Dorking + wa.me links | - |
| 12 | Google Maps | B2B | DB Search + OSM Overpass + Directories | 32K records |
| 13 | IndiaMART | B2B | Direct scraping + Dorking | - |
| 14 | Apollo.io | B2B | Direct scraping | - |
| 15 | TradeIndia | B2B | Direct scraping | - |
| 16 | ExportersIndia | B2B | Direct scraping | - |
| 17 | JustDial | B2B | Direct scraping | - |
| 18 | RocketReach | B2B | Direct scraping | - |
| 19 | Crunchbase | B2B | Direct scraping | - |
| 20 | PAN India | B2B | DB Search | 101M+ records |

### Anti-Detection Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| TLS Fingerprint | curl_cffi (C-level JA3/JA4) | Impersonate real browsers |
| User-Agent | Paired profiles (Chrome/Firefox/Safari) | Match TLS fingerprint |
| Rate Limiting | Per-domain adaptive delays | Prevent IP bans |
| SSRF Protection | Private IP validation | Security |
| Retry Logic | Exponential backoff | Handle transient failures |
| Search Engine Rotation | 6-engine waterfall with health tracking | Avoid single-engine blocks |

---

## 12. Pricing & License Management

### Tiers

| Tier | DB Results/Search | Dataset Scan Depth | Features |
|------|------------------|--------------------|----------|
| Free | 10 leads max | 3 datasets/country | Basic extraction |
| Starter | 25 leads max | 5 datasets/country | + Email verification |
| Pro | 50 leads max | 8 datasets/country | + All platforms |
| Unlimited | 50 leads max | 8 datasets/country | + Team features |

### License Validation Flow

```
App start → POST /api/license/validate
  → Check key format
  → Verify not expired
  → Check activation count
  → Return tier + features
```

---

## 13. All Pull Requests

### Desktop App (social-lead-extractor-pro)

| PR | Title | Status |
|----|-------|--------|
| #81 | v3.5.8: Fix stuck extraction + Enhanced B2B scrapers | Merged |
| #82 | v3.5.8: Build artifacts (tag v3.5.8) | Merged |
| #83 | v3.5.9: Phone regex + auto-verify timeout + IndiaMART | Merged |
| #84 | v3.5.10: PhantomBuster + PAN India integration | Merged |
| #85 | v3.5.10: Integration code (Google Maps + PAN India DB search) | Merged |
| #86 | v3.5.11: Version bump for SQLite fix | Merged |
| #87 | v3.5.11: SQLite WAL mode + nested connection fix | Merged |

### Platform (snapleads-platform)

| PR | Title | Status |
|----|-------|--------|
| #84 | Update download links to v3.5.10 | Merged |
| #85 | Update download links to v3.5.11 | Merged |
| #86 | Update _redirects to v3.5.11 | Merged |

---

## 14. Artifacts & Versioning

| Version | Tag | Date | Key Changes |
|---------|-----|------|-------------|
| v3.5.8 | v3.5.8 | Mar 13, 2026 | Fix stuck extraction, enhanced B2B |
| v3.5.9 | v3.5.9 | Mar 13, 2026 | Phone regex, auto-verify timeout |
| v3.5.10 | v3.5.10 | Mar 14, 2026 | PhantomBuster + PAN India data |
| v3.5.11 | v3.5.11 | Mar 14, 2026 | SQLite WAL mode fix |

---

## 15. Directory Structure

```
social-lead-extractor-pro/
  .github/workflows/build.yml    -- CI/CD (3-platform build)
  backend/
    app/
      main.py                    -- FastAPI entry
      database.py                -- SQLite manager (WAL mode)
      api/routes.py              -- 2905-line API routes
      services/                  -- All extraction services
    data/leads.db                -- Local SQLite database
    requirements.txt             -- Python dependencies
  frontend/
    src/                         -- React + TypeScript UI
    vite.config.ts               -- Vite configuration
  electron/
    main.js                      -- Electron main process
    preload.js                   -- IPC bridge
  package.json                   -- Electron + build config
  phantombuster/                 -- PhantomBuster CSV configs
```

---

## 16. DEEP AUDIT: Root Cause Analysis — Why Extraction Returns 0-44 Leads

### Test Cases That Failed

| Test | Keyword | Platforms | Expected | Actual | Gap |
|------|---------|-----------|----------|--------|-----|
| 1 | "Software Engineer" | LinkedIn | 86.9M DB | 0 leads | 100% miss |
| 2 | "Photography" | Instagram | 2.45M DB | 8 leads | ~99.99% miss |
| 3 | "Hardware Vendors" | All 20 | Hundreds+ | 44 leads | ~95% miss |

### Verified: S3 Database IS Accessible

**Critical finding from live testing:** The embedded S3 credentials work perfectly. A DuckDB query for "Software Engineer" against 15 LinkedIn CSV files (5 countries x 3 datasets) returned **50 rows in 21 seconds**, with **44 having valid emails**. The database is NOT the problem — the pipeline between database and user IS.

### ROOT CAUSE #1: Free Tier Limits Are Catastrophically Low

**File:** `routes.py` lines 309-310
```python
db_max_results = 10  # Free tier default
tier_label = "free"
```

**Impact:** Even though the DB returns 50 matches, only **10 leads maximum** pass through to the user on free tier. This is the single biggest bottleneck.

**Evidence chain:**
- `routes.py:309` → `db_max_results = 10`
- Passed to `search_database_hybrid()` as `max_results_per_keyword=10`
- Each DB function applies `LIMIT 10` to SQL query
- User sees maximum 10 DB leads regardless of how many exist

### ROOT CAUSE #2: Dataset Scan Depth Is Too Shallow

**File:** `database_search.py` lines 1115-1121
```python
_tier_dataset_limits = {
    "free": 3,      # Only scan 3 CSV files per country
    "starter": 5,
    "pro": 8,
    "unlimited": 8,
}
```

**Impact:** Free tier scans only 3 datasets per country. LinkedIn data for India alone has 50+ datasets. Scanning 3/50 means **94% of data is never searched**.

For "Software Engineer" with no location:
- 5 countries x 3 datasets = 15 CSV files scanned
- Total LinkedIn datasets: 1,738
- **Coverage: 15/1738 = 0.86% of total database**

### ROOT CAUSE #3: `_linkedin_row_to_lead()` Filters Out Leads Without Email/Phone

**File:** `database_search.py` lines 631-640
```python
# Skip rows without usable contact info
if not email and not phone:
    return {}

email = _clean_field(email)    # "None" -> ""
phone = _clean_field(phone)    # "None" -> ""

if not email and not phone:
    return {}
```

**Impact:** Any LinkedIn profile without BOTH email AND phone is silently discarded. Many records in the 86.9M database have `email=None` and `phone=None` but have valuable name, title, company, LinkedIn URL data that IS useful for lead generation.

The same filter exists in `_instagram_row_to_lead()` (line 683) and `_pan_india_row_to_lead()`.

### ROOT CAUSE #4: No Active License = Free Tier Defaults

**File:** `routes.py` lines 311-341

The license check queries SQLite for an active license. On a fresh install with no license activated:
- `db_max_results = 10`
- `tier_label = "free"`
- `ds_limit = 3`

This means the user gets severely throttled results even though the 190M+ database is available.

### ROOT CAUSE #5: Live Scraping Returns Very Few Leads Per Platform

**File:** `live_scrapers.py` — Each platform scraper

Each live scraper:
1. Builds 3-4 Google dork queries
2. Runs them through `free_search_waterfall()` (max 10 results per query, max 3 engines)
3. Extracts emails/phones from **search result snippets only**
4. Most snippets don't contain emails → typical yield: **0-3 leads per platform**

**Why:** Search engine snippets are ~160 characters. The chance of an email appearing in a snippet is very low. The scraper finds URLs but doesn't visit most of them.

### ROOT CAUSE #6: Google Dorking Query Budget Exhausted Too Fast

**File:** `google_dorking.py` line 460
```python
max_total_queries: int = 8,
```

**Impact:** With 20 platforms and multi-template dorking (3 queries per platform), the budget of 8 total queries is exhausted after just **2-3 platforms**. The remaining 17+ platforms get zero dorking coverage.

### ROOT CAUSE #7: Free Search Waterfall Engines Are Unreliable

**File:** `multi_engine_search.py` lines 719-763

The 6 free engines (Brave, Startpage, DDG Lite, Mojeek, Qwant, SearXNG) all:
- Scrape HTML search results (fragile, breaks when HTML changes)
- Get blocked by CAPTCHAs/rate limits
- Have health tracking with cooldown periods (failed engines are skipped)
- Try max 3 engines, stop when enough results found

**Result:** On any given run, 2-4 engines may be in cooldown, leaving only 1-2 functional engines.

### ROOT CAUSE #8: B2B Scrapers Face Aggressive Bot Detection

**File:** `b2b_scrapers.py`

| Platform | Protection | Impact |
|----------|-----------|--------|
| IndiaMART | Akamai Bot Manager | Blocks ~50% of requests |
| Apollo.io | Authentication required | Returns 0 without login |
| JustDial | Anti-bot + dynamic rendering | Partial blocks |
| RocketReach | Cloudflare | Blocks automated access |
| Crunchbase | Rate limiting + auth | Returns 0 without API key |

Even with curl_cffi TLS fingerprinting, these sites detect and block non-browser traffic.

### ROOT CAUSE #9: Instagram Results Halved

**File:** `database_search.py` line 1163
```python
search_database_instagram(
    keyword, max_results_per_keyword // 2,  # HALVED!
    ...
)
```

Instagram gets only half the max_results allocation. On free tier: `10 // 2 = 5` max Instagram results.

### ROOT CAUSE #10: 5-Second Anti-Bot Delay Between Dorking Platforms

**File:** `google_dorking.py` line 494
```python
anti_bot_delay = max(delay, 5.0)
await asyncio.sleep(anti_bot_delay)
```

With 20 platforms at 5 seconds each: **100 seconds of pure waiting** in the dorking phase alone.

---

## 17. Platform-by-Platform Analysis (All 20 Platforms)

### Social Platforms (12)

#### 1. LinkedIn
- **DB Search:** Works correctly. 86.9M records queried via DuckDB S3.
- **Live Scraping:** `scrape_linkedin()` does dorking for `site:linkedin.com/in`. Finds profile URLs and names but rarely emails from snippets.
- **Bug:** Records without email/phone are discarded (Root Cause #3)
- **Bug:** Free tier = 10 max results, 3 datasets per country (Root Cause #1, #2)
- **Fix needed:** Include leads with LinkedIn URL even without email/phone

#### 2. Instagram
- **DB Search:** Works. 2.45M records queried.
- **Live Scraping:** `scrape_instagram()` does dorking + bio link following. Extracts emails from bio link websites.
- **Bug:** Max results halved to 5 on free tier (Root Cause #9)
- **Fix needed:** Don't halve Instagram results

#### 3. Facebook
- **DB Search:** None (no Facebook data in S3)
- **Live Scraping:** `scrape_facebook()` does dorking only. NEVER touches facebook.com.
- **Typical yield:** 0-3 leads (emails from snippets are rare)
- **Status:** Working as designed, but low yield inherent to approach

#### 4. Twitter/X
- **DB Search:** None
- **Live Scraping:** `scrape_twitter()` does dorking + Nitter mirror scraping
- **Bug:** Nitter mirrors frequently go offline
- **Typical yield:** 0-5 leads

#### 5. YouTube
- **DB Search:** None
- **Live Scraping:** `scrape_youtube_channels()` does dorking + channel about page scraping
- **Typical yield:** 0-5 leads

#### 6. TikTok
- **DB Search:** None
- **Live Scraping:** Dorking only
- **Typical yield:** 0-2 leads

#### 7. Pinterest
- **DB Search:** None
- **Live Scraping:** Dorking only
- **Typical yield:** 0-2 leads

#### 8. Tumblr
- **DB Search:** None
- **Live Scraping:** Dorking only
- **Typical yield:** 0-2 leads

#### 9. Reddit
- **DB Search:** None
- **Live Scraping:** RSS/JSON endpoints (fast, no rate limits)
- **Typical yield:** 0-5 leads (finds emails in post text)
- **Status:** Working well

#### 10. Telegram
- **DB Search:** None
- **Live Scraping:** Dorking + t.me page scraping
- **Typical yield:** 0-3 leads

#### 11. WhatsApp
- **DB Search:** None
- **Live Scraping:** Dorking for wa.me links
- **Typical yield:** 0-3 leads (WhatsApp links, not emails)

#### 12. Google Maps
- **DB Search:** 32K records from PhantomBuster
- **Live Scraping:** OSM Overpass API + directory scraping
- **Typical yield:** 5-15 leads (OSM has business data)
- **Status:** Best performing live scraper

### B2B Platforms (8)

#### 13. IndiaMART
- **Method:** 3-phase (directory search + microsite following + dorking)
- **Anti-detection:** Akamai Bot Manager blocks ~50%
- **Typical yield:** 5-20 leads when not blocked
- **Best B2B platform** despite blocks

#### 14. Apollo.io
- **Method:** Direct API calls
- **Issue:** Requires authentication, returns 0 without login
- **Typical yield:** 0 leads (authentication barrier)

#### 15. TradeIndia
- **Method:** Directory scraping
- **Typical yield:** 3-10 leads

#### 16. ExportersIndia
- **Method:** Directory scraping
- **Typical yield:** 2-8 leads

#### 17. JustDial
- **Method:** Direct scraping (4 pages, 50 max)
- **Issue:** Anti-bot measures, dynamic rendering
- **Typical yield:** 5-15 leads

#### 18. RocketReach
- **Method:** Direct scraping
- **Issue:** Cloudflare blocks most requests
- **Typical yield:** 0-2 leads

#### 19. Crunchbase
- **Method:** Direct scraping
- **Issue:** Rate limiting + auth required
- **Typical yield:** 0-2 leads

#### 20. Google Maps B2B
- **Method:** Same as Google Maps but focused on B2B queries
- **Typical yield:** 5-10 leads

---

## 18. Dashboard CSS Issue (Black Text on Dark Background)

### Analysis

**CSS Variables (index.css):**
```css
--color-text-primary: #fafafa;     /* White — CORRECT */
--color-bg-primary: #09090b;       /* Near-black background */
--color-bg-card: #18181b;          /* Dark card background */
```

**Dashboard.tsx StatCard (line 33):**
```tsx
<p className="text-2xl font-bold text-text-primary tracking-tight tabular-nums">
```

The `text-text-primary` class maps to `#fafafa` (white), which should be visible on the dark `#18181b` card background.

**Recharts Tooltip (line 203):**
```tsx
contentStyle={{ backgroundColor: '#18181b', color: '#fafafa' }}
```

Tooltip text is explicitly set to `#fafafa` on `#18181b` background — should be visible.

### Possible Cause

The issue may be a **Tailwind CSS v4 `@theme` directive** not properly generating utility classes. If `text-text-primary` doesn't resolve, the text falls back to browser default (black on dark = invisible).

**Fix:** Add explicit fallback: `text-[#fafafa]` or verify Tailwind v4 `@theme` generates the `text-text-primary` utility correctly.

---

## 19. AI-Powered Offline Solution Plan

### Problem Statement

The user wants a small, offline AI system that:
1. Digests all 3 databases (leads-cm 86.9M LinkedIn + 2.45M Instagram, PhantomBuster 32K Google Maps, PAN India 101M+)
2. Intelligently routes queries for maximum results
3. Works offline (no external APIs)
4. Is free (no paid services)
5. Is fast (real-time query routing)

### Architecture: Smart Query Router (NOT a Language Model)

Instead of an LLM, we use a **lightweight classification + embedding system**:

```
User Query: "Software Engineers in Bangalore"
          |
    [Query Analyzer] (rule-based + small model)
    - Extract: keyword="Software Engineers", location="Bangalore"
    - Classify: industry=IT, geo=India, type=professional
    - Expand: ["software developer", "programmer", "IT engineer", "tech"]
          |
    [Database Router] (decision tree)
    - Location=India → PAN India DB (101M+, has Bangalore data) [HIGH PRIORITY]
    - Industry=IT → LinkedIn DB (86.9M, IT is top industry) [HIGH PRIORITY]
    - Type=professional → Skip Instagram, Google Maps [SKIP]
    - Expand to: LinkedIn + PAN India parallel search
          |
    [Query Optimizer]
    - LinkedIn: search industry="software", title="engineer", country=India, city=Bangalore
    - PAN India: search category="software", city="Bangalore"
    - Set max_results=500 (uncapped), dataset_limit=ALL
          |
    [Result Merger]
    - Deduplicate by email/phone
    - Score and rank
    - Return top results
```

### Component 1: Query Analyzer (Offline, Rule-Based + Small Model)

**Option A: Pure Rule-Based (Recommended for v1)**
- Keyword extraction: regex + stopword removal
- Location extraction: city/state/country dictionary lookup (already exists in `keyword_parser.py`)
- Industry classification: TF-IDF against industry list from LinkedIn CSV headers
- No external model needed, runs in <10ms

**Option B: Small Sentence Transformer (v2)**
- Model: `all-MiniLM-L6-v2` (80MB, runs on CPU)
- Pre-compute embeddings for all industry/category values in the DB
- At query time: embed query → cosine similarity → top-k matching industries
- Runs in <100ms on CPU

### Component 2: Database Router (Decision Tree)

```python
def route_query(keyword, location, industry_class):
    sources = []
    
    # Always check LinkedIn for professional queries
    if industry_class in PROFESSIONAL_INDUSTRIES:
        sources.append(("linkedin", priority=1, max_results=200))
    
    # Check PAN India for India-specific queries
    if location_is_india(location):
        sources.append(("pan_india", priority=1, max_results=200))
    
    # Check Google Maps for local business queries
    if industry_class in LOCAL_BUSINESS_INDUSTRIES:
        sources.append(("googlemaps", priority=2, max_results=100))
    
    # Check Instagram for creative/lifestyle queries
    if industry_class in CREATIVE_INDUSTRIES:
        sources.append(("instagram", priority=2, max_results=100))
    
    # Always do live scraping as supplement
    sources.append(("live_scrape", priority=3, max_results=50))
    
    return sources
```

### Component 3: Query Optimizer (Smarter SQL Generation)

Current problem: The SQL query searches only `industry`, `title`, `company` fields. The optimizer would:

1. **Field selection:** Pick the most relevant fields based on query type
   - Professional queries → search `title`, `industry`, `keywords`
   - Company queries → search `company`, `industry`
   - Location queries → add `city`, `state` filters

2. **Term expansion:** Use the existing `keyword_parser.py` synonym expansion but with a larger dictionary built from DB field values

3. **Relevance scoring:** ORDER BY relevance instead of random LIMIT

### Component 4: Offline Index (Pre-computed for Speed)

Instead of querying S3 CSVs on every search:

1. **Build inverted index** of industry/title/company → dataset_id mapping
2. Store as SQLite table on user's machine (~500MB)
3. At query time: lookup which datasets contain matching terms → only scan those datasets
4. Reduces scan from 15 files to 2-3 targeted files → 5-10x faster

### Implementation Plan

| Phase | What | Effort | Impact |
|-------|------|--------|--------|
| Phase 1 | Remove/raise free tier limits, fix row_to_lead filter | 2 hours | 10x more results |
| Phase 2 | Smart query routing (rule-based) | 4 hours | 3-5x more relevant results |
| Phase 3 | Offline index builder | 8 hours | 5-10x faster queries |
| Phase 4 | Small model (MiniLM) for semantic matching | 4 hours | Better query understanding |

### Ban-Free Strategy

| Component | Strategy |
|-----------|----------|
| S3 Database | No ban risk — we own the data |
| Live Scraping | curl_cffi TLS fingerprinting (already implemented) |
| Search Engines | 6-engine waterfall with health tracking (already implemented) |
| B2B Sites | Increase delays, use more dorking instead of direct scraping |
| Rate Limiting | Per-domain adaptive delays (already implemented) |

### Maximum Results Strategy

| Strategy | Expected Impact |
|----------|----------------|
| Raise free tier to 100+ results | 10x more DB results |
| Scan all datasets (not just 3) | 30x more data coverage |
| Include leads without email (name+URL) | 2-5x more leads |
| Increase dorking budget to 30+ queries | 3x more dorking results |
| Smart DB routing (skip irrelevant DBs) | Faster + more relevant |
| Offline index for instant lookup | 10x faster queries |

---

## 20. Recommendations & Fix Priority

### CRITICAL (Must Fix — Causes 0 Results)

| # | Issue | File | Lines | Fix |
|---|-------|------|-------|-----|
| 1 | Free tier limit = 10 leads max | routes.py | 309 | Raise to 100+ |
| 2 | Dataset scan depth = 3 (free tier) | database_search.py | 1116 | Raise to 15+ |
| 3 | Leads without email/phone discarded | database_search.py | 632-640 | Keep leads with name+URL |
| 4 | Instagram results halved | database_search.py | 1163 | Don't divide by 2 |
| 5 | Dorking query budget = 8 total | google_dorking.py | 460 | Raise to 30+ |

### HIGH (Significantly Improves Results)

| # | Issue | File | Lines | Fix |
|---|-------|------|-------|-----|
| 6 | Live scraping max 20/platform | routes.py | 433 | Raise to 50 |
| 7 | 5s anti-bot delay per platform | google_dorking.py | 494 | Reduce to 2s for free engines |
| 8 | Only 5 countries searched (no location) | database_search.py | 814 | Search top 10-15 countries |
| 9 | Free search engines unreliable | multi_engine_search.py | various | Add retry logic, more engines |
| 10 | Apollo/RocketReach/Crunchbase return 0 | b2b_scrapers.py | various | Use dorking instead of direct access |

### MEDIUM (Quality Improvements)

| # | Issue | File | Lines | Fix |
|---|-------|------|-------|-----|
| 11 | Dashboard CSS (potential Tailwind v4 issue) | Dashboard.tsx | 33 | Add `text-[#fafafa]` fallback |
| 12 | Quality scorer doesn't use all fields | quality_scorer.py | various | Add company/title/industry scoring |
| 13 | No progress indicator for DB search phase | routes.py | 345-348 | Add file-by-file progress |

### LOW (Nice to Have)

| # | Issue | Fix |
|---|-------|-----|
| 14 | No offline caching of DB results | Add SQLite cache for recent queries |
| 15 | No retry on search engine failure | Add automatic retry after cooldown |
| 16 | PhantomBuster data is static (32K) | Schedule periodic re-runs |

---

## 21. Version History

### v3.5.11 (Current — March 14, 2026)
- SQLite WAL mode enabled
- Nested connection deadlock eliminated (was causing "database is locked" at 96%)

### v3.5.10 (March 14, 2026)
- PhantomBuster Google Maps integration (32,544 leads, 19 datasets)
- PAN India 130 Crore database integration (101M+ records, 608 datasets)
- Google Maps + PAN India DB search functions
- Full pipeline: build → B2 → VirusTotal → platform links

### v3.5.9 (March 13, 2026)
- Phone regex tightened (eliminates false positives like `12005900985123`)
- Auto-verify 3-second timeout (prevents stuck-at-96%)
- IndiaMART dual endpoint strategy + 8 dork queries
- Platform priority ordering (JustDial=1, IndiaMART=2, Apollo=4)

### v3.5.8 (March 13, 2026)
- Fix stuck extraction (B2B-only platform detection)
- 30-second DB query timeout
- Tier-aware dataset limits
- Enhanced B2B scraper resilience

### v3.5.7 (March 2026)
- Claude Sonnet 4.6 verification audit (19 fixes, 3 rounds)
- `_escape_like()` for SQL injection prevention
- GPS coordinate detection fix
- Nitter/Tumblr indentation fixes

### v3.5.6 (February 2026)
- Comprehensive Claude audit Round 2 (120+ issues, 4 verification rounds)

### v3.5.5 (February 2026)
- Comprehensive Claude audit (35+ issues fixed)

### v3.5.4 (February 2026)
- B2B platform scrapers added (8 platforms)
- Waterfall enrichment engine

### v3.5.3
- Backend SyntaxError fix

### v3.5.2
- Desktop-first SaaS enhancement

### v3.5.1
- OR-based semantic expansion for DB queries
- Multi-template dorking (10+ per platform)
- Hinglish keyword support

### v3.5.0
- LIVE scraping engine (curl_cffi anti-detection)
- 12-platform live scrapers
- 6-engine free search waterfall

### v3.4.3
- Five critical fixes

---

*End of Consolidated Architecture Document*
