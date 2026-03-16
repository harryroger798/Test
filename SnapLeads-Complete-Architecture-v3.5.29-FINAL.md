# SnapLeads — Complete Consolidated Architecture Document

**Version:** v3.5.29 (Current)
**Date:** March 16, 2026
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
16. [DEEP AUDIT: Root Cause Analysis — Why Extraction Returns 0-44 Leads (FIXED in v3.5.12)](#16-deep-audit-root-cause-analysis)
17. [DEEP AUDIT: Platform-by-Platform Analysis (All 20 Platforms)](#17-platform-by-platform-analysis)
18. [DEEP AUDIT: Dashboard CSS Issue (Black Text on Dark Background)](#18-dashboard-css-issue)
19. [AI-Powered Offline Solution Plan](#19-ai-powered-offline-solution-plan)
20. [Recommendations & Fix Priority](#20-recommendations--fix-priority)
21. [Version History (v3.4.3 — v3.5.29)](#21-version-history)

---

## 1. System Overview

SnapLeads is a desktop lead-extraction application that extracts emails and phone numbers from **12 social media platforms + 8 B2B business platforms** using a 6-engine free search waterfall, **190M+ pre-extracted leads database** (LinkedIn 86.9M + Instagram 2.45M + Google Maps 32K+ + PAN India 101M+ + YouTube 1,085 channels), Patchright headless browser, and page content scraping. It is distributed as an Electron desktop app (Windows/macOS) with a bundled Python (FastAPI) backend.

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
| Local Database | SQLite (aiosqlite) with WAL mode (v3.5.11+) |
| Remote Database | DuckDB over S3 (iDrive E2) — 190M+ records |
| Build Tool | PyInstaller (backend binary) + electron-builder (installer) |
| CI/CD | GitHub Actions |
| License Server | FastAPI + SQLite (hosted on Render.com) |
| Marketing Site | React + Vite (hosted on Netlify) |
| File Storage | Backblaze B2 (download binaries) |
| Data Storage | iDrive E2 S3 (leads database CSVs) |
| Anti-Detection | curl_cffi TLS fingerprint impersonation (v3.5.0+) |
| Headless Browser | Patchright (Chromium + driver binary, fully bundled in Windows build v3.5.27+) |
| Search API | FastAPI on Render.com (server-side S3 queries, v3.5.25+) |

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

### Repository 3: `harryroger798/snapleads-search-api` (Render Search API)

- **GitHub URL:** https://github.com/harryroger798/snapleads-search-api
- **Default branch:** main
- **Host:** Render.com
- **URL:** https://snapleads-search-api.onrender.com
- **Framework:** FastAPI + DuckDB
- **Purpose:** Server-side S3 database queries for faster results (~9s vs ~100s client-side)
- **Supported Platforms:** LinkedIn, Instagram, Google Maps, PAN India, YouTube (v3.5.26+)

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
- `s3://crop-spray-uploads/leads-cm-database/youtube/dataset_1.parquet` — 1,085 YouTube channels across 53 categories (v3.5.26)

### Backblaze B2 (Download Binary Storage)

```
Key ID:          <REDACTED — stored in Devin secrets>
Key Name:        SnapLeads
Application Key: <REDACTED — stored in Devin secrets>
Bucket:          snapleads-downloads
Download URL:    https://f005.backblazeb2.com/file/snapleads-downloads/
```

**File layout (v3.5.29 — current):**
```
snapleads-downloads/
  v3.5.29/
    SnapLeads-Setup-3.5.29.exe           (Windows NSIS installer, ~688MB — includes Patchright Chromium + driver)
    SnapLeads-3.5.29-arm64-mac.zip       (macOS zip, ~291MB)
  v3.5.28/
    SnapLeads-Setup-3.5.28.exe           (Windows NSIS installer, ~657MB)
    SnapLeads-3.5.28-arm64-mac.zip       (macOS zip, ~278MB)
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
      version.ts                -- APP_VERSION = '3.5.29'
      logger.ts                 -- Frontend logging utility (captures console.log/warn/error, batches to backend)
      api.ts                    -- Backend API client
      utils.ts                  -- formatNumber, formatDate, cn() helper
    index.css                   -- Theme variables (dark theme, zinc palette)
    App.tsx                     -- Root component with router
```

### Backend (Python + FastAPI)

```
backend/
  app/
    main.py                     -- FastAPI app entry point (v3.5.22: persistent logging with rotating file handlers)
    database.py                 -- SQLite connection manager (WAL mode v3.5.11, v3.5.23: orphaned session recovery on startup)
    api/
      routes.py                 -- All API endpoints (~2905 lines)
    services/
      ## Core Extraction Pipeline ##
      keyword_parser.py         -- Smart keyword parsing with Hinglish + location extraction (759 lines)
      database_search.py        -- DuckDB S3 queries against 190M+ leads (2026 lines, v3.5.24 residential timeout fix + semaphore concurrency)
      multi_engine_search.py    -- 6-engine free search waterfall (763 lines)
      features.py               -- Email finder, job boards, directories, PDF export
      extractor.py              -- Email/phone regex, scoring, classification
      anti_detection.py         -- curl_cffi TLS fingerprint, rate limiting, SSRF protection (549 lines)
      quality_scorer.py         -- Lead quality scoring 0-100 (205 lines)

      ## Live Scraping (v3.5.0+) ##
      live_scrapers.py          -- 12-platform live scrapers (2000+ lines, v3.5.29: Facebook 10-source pipeline rewrite):
                                   Reddit, WhatsApp, Facebook (v3.5.29: 10-source pipeline with 6 root cause fixes), Telegram, Twitter,
                                   LinkedIn, Tumblr, Instagram, Pinterest, TikTok,
                                   YouTube, Google Maps

      ## B2B Platform Scrapers + Waterfall Enrichment (v3.5.4) ##
      b2b_scrapers.py           -- 8 B2B platform scrapers (1600+ lines):
                                   IndiaMART, Apollo.io, TradeIndia, ExportersIndia,
                                   JustDial, Google Maps B2B, RocketReach, Crunchbase
      website_email_finder.py   -- Website email/phone finder
      waterfall_enrichment.py   -- 4-stage enrichment engine (870 lines)

      ## Google Dorking ##
      google_dorking.py         -- Multi-engine dorking with 10+ templates per platform + DuckDuckGo via Patchright (v3.5.29: html.duckduckgo.com/html/ pure HTML endpoint, zero CAPTCHA) + HTTP fallback (v3.5.26: httpx+BS4 when Patchright unavailable)
      log_service.py            -- Persistent logging service (v3.5.22): rotating file handlers, log list/tail/export/clear API (v3.5.26: Windows file-lock fix for Clear Logs)

      ## Patchright Headless Browser (v3.5.26+) ##
      patchright_engine.py      -- Patchright Chromium launcher with PyInstaller bundle detection (sys._MEIPASS), runtime auto-install fallback for macOS, diagnostic directory logging (v3.5.27)

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

**Schema A (datasets 1-3):**
```
name, category, address, phone, website, rating, reviewCount, sourceUrl, query, currentStatus
```

**Schema B (datasets 4+):**
```
placeUrl, title, rating, reviewCount, category, attributes, address, plusCode, website, phoneNumber, currentStatus, imgUrl, isClaimed, friday-thursday, query, timestamp, info
```

**v3.5.13:** Both schemas are normalized at query time via separate SELECT clauses with column aliasing (title→name, phoneNumber→phone, placeUrl→sourceUrl).

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
    Tier-aware: free=3, starter=5, pro=5, unlimited=8 (v3.5.24)
    120s timeout per query, 180s master timeout, semaphore(2) concurrency
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
    Waterfall: Serper API > Multi-engine > Patchright→DuckDuckGo (v3.5.29: html.duckduckgo.com/html/)
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
    Re-tag leads with user's requested platform (v3.5.28)
    Store source_platform for audit trail
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

Located at `.github/workflows/build-release.yml`:

```yaml
trigger: push to main (tag v*)
jobs:
  build-windows:
    runs-on: windows-latest
    steps:
      - Pre-install DuckDB httpfs extension
      - Zip extension into httpfs_bundle.zip (avoids macOS codesign issues)
      - PyInstaller build (backend → single binary, --add-data httpfs_bundle.zip)
      - npm run build (frontend → dist/)
      - electron-builder --win nsis
      - Upload artifact

  build-macos:
    runs-on: macos-latest (ARM64)
    steps: same but --mac zip
    Note: httpfs_bundle.zip prevents codesign failure on .duckdb_extension files

  (Linux build removed in v3.5.14)
```

### v3.5.20 Python-Based httpfs Download Fix — THE COMPLETE FIX (EC2 NSIS-Validated)

The DuckDB httpfs extension is required for S3 access to the 190M+ leads database. v3.5.12-v3.5.19 all returned 0 LinkedIn leads on user's machine despite successful EC2 testing with 7-Zip extraction. v3.5.20 identifies and fixes the complete chicken-and-egg problem:

**ROOT CAUSE: Chicken-and-Egg Problem with DuckDB httpfs + SSL in PyInstaller**
1. Bundled httpfs has ABI mismatch → LOAD fails
2. DuckDB's `INSTALL httpfs` needs HTTPS to download from extensions.duckdb.org
3. DuckDB's internal HTTP client (cpp-httplib) may not find CA certificates in PyInstaller bundles on Windows
4. `ca_cert_file` setting is registered BY httpfs, so can't be set before httpfs loads
5. Result: INSTALL fails silently → all strategies fail → 0 leads

**Previous fixes addressed parts of the problem, not the full chain:**
- v3.5.14: Fixed extension directory detection (correct, but not the real issue)
- v3.5.15: Bundle-first httpfs (correct, but ABI mismatch)
- v3.5.17: DLL search path + error surfacing (correct, but SSL still failed)
- v3.5.18: SSL_CERT_FILE env var (DuckDB ignores env vars)
- v3.5.19: ca_cert_file setting (correct, but can't set before httpfs loads — chicken-and-egg)

**v3.5.20 Solution: Python-Based httpfs Download Fallback**
1. **`_python_download_httpfs()`** — New function that downloads httpfs extension binary using Python's `urllib` (which correctly uses certifi via ssl module), completely bypassing DuckDB's internal SSL
2. **Exact path placement** — Extension placed at `{ext_dir}/v{version}/{platform}/httpfs.duckdb_extension` so DuckDB's `LOAD httpfs` finds it
3. **Gzip decompression** — DuckDB CDN serves `.duckdb_extension.gz`, Python handles decompression
4. **Strategy 4 in cascade** — Added as final fallback after all DuckDB-native strategies fail: deletes stale cache, downloads fresh, then LOADs
5. **All previous fixes retained** — ca_cert_file, SSL_CERT_FILE, autoload, bundled extension, diagnostic logging

**EC2 Windows NSIS Installer Validation (ALL 3 MODES):**
- Spun up Windows EC2 instance (i-0c3060ff3fd1fb2b3) with SSM
- Downloaded v3.5.20 exe from B2, installed via **NSIS installer** (not 7-Zip extraction) at C:\SnapLeads
- Test 1 (DB-only, GD=off, DS=off): **24 leads, 23 emails** ✓
- Test 2 (GDOn/DSOff): **24 leads, 23 emails** ✓
- Test 3 (GDOn/DSOn): **24 leads, 23 emails** ✓
- DuckDB v1.5.0 httpfs extension downloaded via Python to AppData\Roaming\duckdb\extensions
- EC2 instance terminated after successful validation

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

### Current URLs (v3.5.29)

| Platform | Download URL |
|----------|-------------|
| Windows | `https://f005.backblazeb2.com/file/snapleads-downloads/v3.5.29/SnapLeads-Setup-3.5.29.exe` |
| macOS | `https://f005.backblazeb2.com/file/snapleads-downloads/v3.5.29/SnapLeads-3.5.29-arm64-mac.zip` |

### SHA256 Hashes (v3.5.29)

| File | SHA256 |
|------|--------|
| Windows .exe | *(pending)* |
| macOS .zip | *(pending)* |

### VirusTotal Scan URLs (v3.5.29)

| File | VirusTotal URL |
|------|---------------|
| Windows .exe | *(pending VT scan)* |
| macOS .zip | *(pending VT scan)* |

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
| 3 | Facebook | Social | 10-source pipeline (v3.5.29): Bing, DDG HTML, Web Archive CDX, JustDial, IndiaMART, Sulekha, 99acres, MagicBricks, Housing.com, Google organic + contact enrichment | - |
| 4 | Twitter/X | Social | Dorking + Nitter mirrors | - |
| 5 | YouTube | Social | DB Search + Dorking + Channel pages | 1,085 channels (v3.5.26) |
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
| Free | 100 leads max (was 10) | 10 datasets/country (was 3) | Basic extraction |
| Starter | 200 leads max (was 25) | 15 datasets/country (was 5) | + Email verification |
| Pro | 500 leads max (was 50) | 25 datasets/country (was 8) | + All platforms |
| Unlimited | 500 leads max (was 50) | 25 datasets/country (was 8) | + Team features |

**v3.5.12 License Sync Fix:** Backend now reads Electron's `{userData}/license.json` to detect Pro/Starter tier. Previously only checked SQLite `licenses` table (never populated during Electron activation), causing all Pro users to fall back to free tier.

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
| #89 | v3.5.12: License sync + raise extraction limits | Merged |
| #90 | v3.5.12: Version bump | Merged |
| #91 | v3.5.13: Per-country parallel LinkedIn DB queries (fixes 0-leads timeout) | Merged |
| #92 | v3.5.13: Version bump | Merged |
| #93 | v3.5.13: Google Maps dual-schema support + PAN India strict_mode=false | Merged |
| #94 | v3.5.14: DuckDB httpfs extension fix for PyInstaller | Merged |
| #95 | v3.5.14: Version bump | Merged |
| #96 | v3.5.15: Bundle-first httpfs extension (pre-install + bundle in binary) | Merged |
| #97 | v3.5.15: Fix YAML syntax in build workflow (heredoc) | Merged |
| #98 | v3.5.15: Fix macOS codesign failure (zip-based bundling) | Merged |
| #99 | v3.5.17: Three-bug fix for 0-leads (backslash escaping + version-aware extraction + error surfacing) | Merged |
| #101 | v3.5.18: SSL CA certificates for PyInstaller — root cause of 0-leads bug | Merged |
| #102 | v3.5.19: DuckDB ca_cert_file fix — definitive root cause of 0-leads bug (EC2-validated) | Merged |
| #103 | v3.5.20: Python-based httpfs download fallback — complete chicken-and-egg fix (EC2 NSIS-validated) | Merged |
| #108 | v3.5.24: S3 query timeout fix for residential internet (Claude Opus 4.6 validated) | Merged |
| #110 | v3.5.26: Patchright + Chromium bundling + Google Dorking HTTP fallback + Clear Logs fix | Merged |
| #111 | v3.5.26: YouTube database search (1,085 channels, 53 categories) | Merged |
| #112 | v3.5.26: Version bump to v3.5.26 | Merged |
| #113 | v3.5.26: macOS build fix (conditional Patchright bundling — Windows only) | Merged |
| #114 | v3.5.27: Bundle Patchright driver binary for Windows (fixes FileNotFoundError) | Merged |
| #115 | v3.5.28: Platform tag mismatch fix + Facebook multi-source + DDG dorking | Merged |
| #116 | v3.5.29: Complete Facebook pipeline rewrite with 10 sources (6 root cause fixes) | Merged |

### Render Search API (snapleads-search-api)

| PR | Title | Status |
|----|-------|--------|
| #1 | feat: Add YouTube platform support to search API | Merged |

### Platform (snapleads-platform)

| PR | Title | Status |
|----|-------|--------|
| #84 | Update download links to v3.5.10 | Merged |
| #85 | Update download links to v3.5.11 | Merged |
| #86 | Update _redirects to v3.5.11 | Merged |
| #87 | Update download links + redirects to v3.5.12 | Merged |
| #88 | Fix download links to Backblaze B2 (was iDrive S3) | Merged |
| #89 | Update download links + redirects to v3.5.13 | Merged |
| #90 | Update download links + redirects to v3.5.14 | Merged |
| #91 | Update download links + redirects to v3.5.15 | Merged |
| #92 | Update download links + redirects to v3.5.17 | Merged |
| #94 | Update download links + redirects to v3.5.18 | Merged |
| #95 | Update download links + redirects to v3.5.19 | Merged |
| #96 | Update download links + redirects to v3.5.20 | Merged |
| #97 | Update download links + redirects to v3.5.23 | Merged |
| #100 | Update download links + redirects to v3.5.26 | Merged |
| #101 | Update download links + redirects to v3.5.27 | Merged |
| #102 | Update download links + redirects to v3.5.28 | Merged |
| #103 | Update download links + redirects to v3.5.29 | Merged |

---

## 14. Artifacts & Versioning

| Version | Tag | Date | Key Changes |
|---------|-----|------|-------------|
| v3.5.8 | v3.5.8 | Mar 13, 2026 | Fix stuck extraction, enhanced B2B |
| v3.5.9 | v3.5.9 | Mar 13, 2026 | Phone regex, auto-verify timeout |
| v3.5.10 | v3.5.10 | Mar 14, 2026 | PhantomBuster + PAN India data |
| v3.5.11 | v3.5.11 | Mar 14, 2026 | SQLite WAL mode fix |
| v3.5.12 | v3.5.12 | Mar 14, 2026 | License sync + raised limits |
| v3.5.13 | v3.5.13 | Mar 14, 2026 | LinkedIn timeout fix + Google Maps schema fix + PAN India CSV fix |
| v3.5.14 | v3.5.14 | Mar 15, 2026 | DuckDB httpfs extension fix + live scraping toggle + lead count fix |
| v3.5.15 | v3.5.15 | Mar 15, 2026 | Bundle-first httpfs extension + macOS codesign fix + YAML heredoc fix |
| v3.5.17 | v3.5.17 | Mar 15, 2026 | Three-bug fix: Windows backslash escaping + version-aware extraction + error surfacing (Claude Opus 4.6 analysis) |
| v3.5.18 | v3.5.18 | Mar 15, 2026 | TRUE root cause fix: SSL CA certificates missing in PyInstaller bundle (Claude Opus 4.6 deep analysis) |
| v3.5.19 | v3.5.19 | Mar 15, 2026 | DEFINITIVE root cause fix: DuckDB ca_cert_file setting (EC2-validated, 24 leads on Windows) |
| v3.5.20 | v3.5.20 | Mar 15, 2026 | COMPLETE FIX: Python-based httpfs download fallback (EC2 NSIS-validated, all 3 modes return 24 leads) |
| v3.5.21 | v3.5.21 | Mar 15, 2026 | Global 120s extraction timeout (prevents stuck-at-96% sessions) |
| v3.5.22 | v3.5.22 | Mar 15, 2026 | Comprehensive persistent logging system (backend + electron + frontend + Settings UI) |
| v3.5.23 | v3.5.23 | Mar 15, 2026 | Orphaned session recovery (auto-mark "running" sessions as complete on startup) |
| v3.5.24 | v3.5.24 | Mar 15, 2026 | S3 query timeout fix for residential internet (raised http_timeout to 90s, semaphore concurrency) |
| v3.5.25 | v3.5.25 | Mar 15, 2026 | Render Search API integration (server-side S3 queries ~9s vs ~100s) |
| v3.5.26 | v3.5.26 | Mar 15, 2026 | Patchright + Chromium bundling, Google Dorking HTTP fallback, Clear Logs fix, YouTube DB search |
| v3.5.27 | v3.5.27 | Mar 15, 2026 | Patchright driver binary bundling fix (--collect-all patchright), diagnostic browser directory logging |
| v3.5.28 | v3.5.28 | Mar 15, 2026 | Platform tag mismatch fix, Facebook 6-source pipeline, DDG dorking (Claude Sonnet 4.6 consultation) |
| v3.5.29 | v3.5.29 | Mar 16, 2026 | Complete Facebook 10-source pipeline rewrite — 6 root cause fixes (Claude consultation) |

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

snapleads-search-api/              -- Render Search API (v3.5.25+)
  app/
    main.py                        -- FastAPI entry + CORS + health check
    search.py                      -- DuckDB S3 query engine (LinkedIn, Instagram, Google Maps, PAN India, YouTube)
  requirements.txt                 -- Python dependencies (fastapi, uvicorn, duckdb)
  render.yaml                      -- Render deployment config
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
- **Live Scraping (v3.5.29):** `scrape_facebook()` uses a 10-source pipeline. NEVER touches facebook.com directly.
  - **Sources:** Bing (two-pass), DDG HTML endpoint, Web Archive CDX, JustDial direct, IndiaMART direct, Sulekha, 99acres, MagicBricks, Housing.com, Google organic (directory dorking)
  - **Enrichment:** Google Cache + Wayback Machine for FB URLs missing contacts
  - **Deduplication:** MD5 hash-based UID deduplication across all sources
- **Expected yield (v3.5.29):** 150-300 leads for India queries like "Real Estate in India"
- **Previous yield (v3.5.28):** 0-3 leads (Facebook de-indexed from search engines)
- **Root causes fixed:** Bing query syntax, DDG JS SPA detection, Google site:facebook.com de-indexing, Web Archive SURT malformation, JustDial/IndiaMART SearXNG SSRF block, missing real-estate sources

#### 4. Twitter/X
- **DB Search:** None
- **Live Scraping:** `scrape_twitter()` does dorking + Nitter mirror scraping
- **Bug:** Nitter mirrors frequently go offline
- **Typical yield:** 0-5 leads

#### 5. YouTube
- **DB Search:** 1,085 channels across 53 categories (v3.5.26, Parquet format)
- **Live Scraping:** `scrape_youtube_channels()` does dorking + channel about page scraping
- **Typical yield:** 5-20 leads (DB search + live scraping combined)

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
- **LINKEDIN DB TIMEOUT FIX:** v3.5.12 raised dataset_limit to 25/country, causing 125-file UNION ALL queries to timeout at 30s. Fixed by splitting into per-country parallel queries (5 threads), each running ~25 files independently. Results merged and deduplicated.
- **GOOGLE MAPS DUAL-SCHEMA FIX:** PhantomBuster datasets 1-3 use Schema A (name, phone, sourceUrl) but datasets 4-5 use Schema B (title, phoneNumber, placeUrl). Fixed by detecting schema based on dataset number and building separate SELECT statements with column aliasing.
- **PAN INDIA CSV PARSER FIX:** Dataset_4 has malformed CSV rows causing "CSV Parser state machine reached an invalid state" error. Fixed by adding `strict_mode=false` to `read_csv_auto()` call.
- **COMPREHENSIVE TEST RESULTS:** 62/65 tests passed across all platforms using diverse keywords from 1,258-keyword CSV:
  - LinkedIn: 19/20 PASS (1,680 leads returned)
  - Instagram: 10/10 PASS (500 leads returned)
  - Google Maps: 18/20 PASS (630 leads returned)
  - PAN India: 15/15 PASS (750 leads returned)
  - Total: 3,560 leads across 65 test queries
- Builds uploaded to Backblaze B2 (Windows + Mac, Linux skipped)
- PRs: #91 (LinkedIn fix), #92 (version bump), #93 (Google Maps + PAN India fix)
- Platform PR: #89 (download links to v3.5.13)

### v3.5.15 (Current — March 15, 2026)
- **CRITICAL FIX: Bundle-First httpfs Extension** — Root cause of LinkedIn 0-leads bug in PyInstaller builds. Extension download fails silently at runtime. Solution: pre-install during CI, zip into `httpfs_bundle.zip`, bundle inside binary, extract at runtime.
- **macOS Codesign Fix:** PyInstaller tries to codesign `.duckdb_extension` files on macOS, causing build failure. Fixed by zipping extensions before PyInstaller processes them.
- **YAML Heredoc Fix:** Inline Python in CI workflow broke YAML parsing. Replaced `python -c "..."` with `python - <<'PYEOF'...PYEOF` heredoc syntax.
- **`_ensure_bundled_httpfs()` function:** Extracts bundled zip to writable extension dir at runtime. Falls back to raw `duckdb_extensions/` directory for --onedir builds.
- **`/api/diagnostic` endpoint:** Returns DuckDB version, extension status, S3 connectivity, and extension directory info for troubleshooting.
- **Local test validation:** 50,000 rows returned for "Software Developer" query against US LinkedIn dataset_1 (confirms httpfs loads correctly).
- PRs: [#96](https://github.com/harryroger798/social-lead-extractor-pro/pull/96) (bundle-first fix), [#97](https://github.com/harryroger798/social-lead-extractor-pro/pull/97) (YAML fix), [#98](https://github.com/harryroger798/social-lead-extractor-pro/pull/98) (macOS codesign fix)
- Platform PR: [#91](https://github.com/harryroger798/snapleads-platform/pull/91) (download links to v3.5.15)
- **SHA256 Hashes:**
  - Windows: `64b2e873d78aebdeba36cd3e71ce591e3602cb45757e1444253330896951dca6`
  - Mac: `17bbf3c482b253c378a2f882dba9a69405eb8fcd3e2c31e593c97b8782f11ad3`
- VirusTotal: [Windows](https://www.virustotal.com/gui/file/64b2e873d78aebdeba36cd3e71ce591e3602cb45757e1444253330896951dca6) | [Mac](https://www.virustotal.com/gui/file/17bbf3c482b253c378a2f882dba9a69405eb8fcd3e2c31e593c97b8782f11ad3)

### v3.5.20 (March 15, 2026)
- **COMPLETE FIX: Python-Based httpfs Download Fallback** — Solves the chicken-and-egg problem that caused 0 LinkedIn leads in v3.5.12-v3.5.19 on user's machine
- **The Problem:** Bundled httpfs has ABI mismatch, DuckDB's INSTALL needs HTTPS, DuckDB's cpp-httplib can't find CA certs in PyInstaller, ca_cert_file is registered by httpfs (can't set before load). Every path to loading httpfs is blocked.
- **Fix: `_python_download_httpfs()`** — Downloads httpfs extension binary using Python's `urllib` + `certifi` (which correctly handles SSL in PyInstaller), places it at exact path DuckDB expects, then LOADs it. Completely bypasses DuckDB's internal SSL.
- **Strategy 4 in httpfs cascade:** Deletes stale/corrupt cached extension, downloads fresh via Python, LOADs it
- **EC2 NSIS Installer Validation (ALL 3 MODES):**
  - Instance: i-0c3060ff3fd1fb2b3 (Windows Server 2022, t3.medium)
  - Installed via NSIS installer at C:\SnapLeads (replicates user's flow)
  - Test 1 (DB-only): 24 leads, 23 emails ✓
  - Test 2 (GDOn/DSOff): 24 leads, 23 emails ✓
  - Test 3 (GDOn/DSOn): 24 leads, 23 emails ✓
- PR: #103 (desktop app), Platform PR: #96
- **SHA256 Hashes:**
  - Windows: `aa07abe04144cf9332c2129975aca1d9fccbcbf1f34c1aaecca062e8a4eaed71`
  - Mac: *(pending VT scan)*
- VirusTotal: [Windows](https://www.virustotal.com/gui/file/aa07abe04144cf9332c2129975aca1d9fccbcbf1f34c1aaecca062e8a4eaed71)

### v3.5.19 (March 15, 2026)
- **DEFINITIVE ROOT CAUSE FIX:** DuckDB's httpfs uses cpp-httplib which reads CA certs from DuckDB's own `SET ca_cert_file` setting, NOT from `SSL_CERT_FILE` env var
- **The Problem:** v3.5.18 set `SSL_CERT_FILE` env var, but DuckDB's cpp-httplib ignores it entirely. DuckDB PR #10704 (Feb 2024) exposed `ca_cert_file` as a SQL-level setting.
- **Fix: `SET ca_cert_file='<certifi_path>'`** — After httpfs loads, explicitly tell DuckDB where CA certs are. `certifi.where()` resolves correctly inside PyInstaller `_MEIPASS`.
- **EC2 Windows Validation (FIRST EVER):** Spun up Windows EC2 (i-0d9da0ae62074aa71), ran v3.5.19 backend, DB-only extraction returned **24 leads, 23 emails** for "Software Developer" keyword. DuckDB diagnostic: ALL PASS, 50,000 test rows returned.
- **Bundled extension note:** The zip-bundled httpfs has an ABI mismatch on Windows, but the network `INSTALL httpfs` fallback works because ca_cert_file enables HTTPS for DuckDB's extension CDN.
- PR: [#102](https://github.com/harryroger798/social-lead-extractor-pro/pull/102)
- Platform PR: [#95](https://github.com/harryroger798/snapleads-platform/pull/95)
- **SHA256 Hashes:**
  - Windows: `2a629e921948f298a1bc5272015040c057b0678d8d18be394cb8d7fcc973e4b7`
  - Mac: `744ae86832b963322d0645db44400ce17f251c468fa8fa6595137a9c6a8a9366`
- VirusTotal: [Windows](https://www.virustotal.com/gui/file/2a629e921948f298a1bc5272015040c057b0678d8d18be394cb8d7fcc973e4b7) | [Mac](https://www.virustotal.com/gui/file/744ae86832b963322d0645db44400ce17f251c468fa8fa6595137a9c6a8a9366)

### v3.5.18 (March 15, 2026)
- **TRUE ROOT CAUSE FIX (Claude Opus 4.6 deep consultation):** SSL/CA certificates missing in PyInstaller bundle — the REAL reason all v3.5.12-v3.5.17 returned 0 LinkedIn leads
- **The Problem:** DuckDB's httpfs uses OpenSSL directly (NOT Python's ssl). In PyInstaller --onefile, OpenSSL's compiled-in CA cert path points to CI build machine, which doesn't exist on user's machine. Every S3 HTTPS request fails silently.
- **Fix #1: `_configure_ssl_certificates()`** — Sets SSL_CERT_FILE, CURL_CA_BUNDLE, REQUESTS_CA_BUNDLE, SSL_CERT_DIR from certifi's CA bundle BEFORE any DuckDB connection. 4-strategy cascade: certifi → _MEIPASS → AppData copy → system certs.
- **Fix #2: `certifi` bundled in PyInstaller** — `--collect-all certifi` ensures CA bundle is in binary. Added as explicit dependency in pyproject.toml.
- **Fix #3: DuckDB autoload enabled** — `SET autoinstall_known_extensions = true; SET autoload_known_extensions = true;`
- **Fix #4: Simplified httpfs loading cascade** — LOAD (bundled) → INSTALL+LOAD (network) → FORCE INSTALL+LOAD, with comprehensive error reporting
- **Fix #5: Comprehensive SSL diagnostic logging** — Logs SSL_CERT_FILE and CURL_CA_BUNDLE on every connection for diagnosis
- Local test: DuckDB + httpfs + S3 returned 50,000 rows successfully
- PR: [#101](https://github.com/harryroger798/social-lead-extractor-pro/pull/101)
- Platform PR: [#94](https://github.com/harryroger798/snapleads-platform/pull/94)
- **SHA256 Hashes:**
  - Windows: `440d837f5ae0947114d9b839df5d830e5600ca0f24178f58bc1187de5f276541`
  - Mac: `d31a1048d8c9abcc8f68f3dacc12f783befdc79bd212d0033c6b381b1b6ab717`
- VirusTotal: [Windows](https://www.virustotal.com/gui/file/440d837f5ae0947114d9b839df5d830e5600ca0f24178f58bc1187de5f276541) | [Mac](https://www.virustotal.com/gui/file/d31a1048d8c9abcc8f68f3dacc12f783befdc79bd212d0033c6b381b1b6ab717)

### v3.5.17 (March 15, 2026)
- **ROOT CAUSE FIX (Claude Opus 4.6 consultation):** Three critical bugs causing 0 leads in packaged .exe (persisted through v3.5.12-v3.5.16)
- **Fix #1: DLL search path for PyInstaller bundles** — Added `_fix_dll_search_path()` that adds `sys._MEIPASS` to Windows DLL search path via 3 methods (os.add_dll_directory, PATH prepend, SetDllDirectoryW). httpfs extension depends on OpenSSL DLLs which are in `_MEIPASS` but Windows can't find them without this fix.
- **Fix #2: Per-connection LOAD httpfs** — `_HTTPFS_INSTALLED` flag now only gates INSTALL step. LOAD runs on EVERY new connection because DuckDB connections are independent.
- **Fix #3: Eliminate silent exception swallowing** — Previous `except Exception: pass` blocks replaced with proper error handling and logging. Failures now raise instead of silently returning `[]`.
- **Windows path escaping** — Extension directory paths use forward slashes in SQL to prevent `\U`, `\A` etc. being treated as escape sequences.
- Local test: 50 leads returned for "Software Developer" keyword
- PR: [#100](https://github.com/harryroger798/social-lead-extractor-pro/pull/100)
- Platform PR: [#93](https://github.com/harryroger798/snapleads-platform/pull/93)
- **SHA256 Hashes:**
  - Windows: `ac2a026cbd1e33571885c41ce6d34b0a78522eb28dc8a5d49d988d6a52ad6fb6`
  - Mac: `e5f84a7d6bd0448a9deb9485711cf52de283a49b775142e7739eab987841b952`
- VirusTotal: [Windows](https://www.virustotal.com/gui/file/ac2a026cbd1e33571885c41ce6d34b0a78522eb28dc8a5d49d988d6a52ad6fb6) | [Mac](https://www.virustotal.com/gui/file/e5f84a7d6bd0448a9deb9485711cf52de283a49b775142e7739eab987841b952)

### v3.5.14 (March 15, 2026)
- **CRITICAL FIX:** DuckDB httpfs extension fails silently in PyInstaller builds — added `_get_extension_directory()` to detect/create writable extension dir, set it before `INSTALL httpfs`, retry with `FORCE INSTALL` on failure
- **Live scraping toggle fix:** Only run live scraping when `use_direct_scraping` is ON (was running unconditionally)
- **Lead count fix:** Count actual leads saved via `SELECT COUNT(*)` instead of `emails_found + phones_found` (was double-counting)
- **Better error logging:** Log full exception chain for DB search failures instead of silently swallowing
- **CI/CD:** Removed Linux build from workflow (Windows + Mac only)
- PRs: [#94](https://github.com/harryroger798/social-lead-extractor-pro/pull/94), [#95](https://github.com/harryroger798/social-lead-extractor-pro/pull/95)
- **SHA256 Hashes:**
  - Windows: `e7c78a728bbb9a8d1002c1e41885748a0c464dd1640e95430f775a6c2f0dd0a6`
  - Mac: `6c9e2fd4a942852fd95468cf35b61fcb3d9ff56ad3ef87555270b5111015a371`
- VirusTotal: [Windows](https://www.virustotal.com/gui/file/e7c78a728bbb9a8d1002c1e41885748a0c464dd1640e95430f775a6c2f0dd0a6) | [Mac](https://www.virustotal.com/gui/file/6c9e2fd4a942852fd95468cf35b61fcb3d9ff56ad3ef87555270b5111015a371)

### v3.5.13 (March 14, 2026)
- Google Maps dual-schema support (PhantomBuster Schema A + B normalized at query time)
- PAN India strict_mode=false for broader matches
- Comprehensive local testing (62/65 PASSED across all platforms)

### v3.5.12 (March 14, 2026)
- **LICENSE SYNC FIX:** Backend reads Electron's `license.json` for tier detection (was only checking empty SQLite table)
- **Raised DB limits:** Pro=500, Starter=200, Free=100 (was 50/25/10)
- **Raised dataset scan depth:** Pro=25, Starter=15, Free=10 (was 8/5/3)
- **Keep leads without email/phone:** Name/title/company/URL leads no longer silently discarded (~80% of DB results were being thrown away)
- **Stop halving Instagram results:** Full max_results for Instagram (was `max_results // 2`)
- **Raised dorking query budget:** 30 queries/session (was 8 — exhausted after 2-3 platforms)
- Builds uploaded to Backblaze B2 (`v3.5.12/` prefix)

### v3.5.29 (March 16, 2026) — CURRENT
- **COMPLETE FACEBOOK PIPELINE REWRITE: 10-source pipeline with 6 root cause fixes** — Consulted with Claude.ai for deep root cause analysis of why Facebook extraction returned 0 live results despite v3.5.28's 6-source pipeline.
- **Root Cause 1 — Bing Query Syntax:** Combining `site:` with double-quoted keywords kills Bing results. Fix: Two-pass strategy — Pass 1 uses `site:facebook.com/pages` WITHOUT quotes, Pass 2 uses directory dorking to find pages that LINK to Facebook.
- **Root Cause 2 — Patchright DDG Wrong Endpoint:** Was targeting the JS SPA at `duckduckgo.com` which detects `navigator.webdriver`. Fix: Target `html.duckduckgo.com/html/` — the pure-HTML accessibility endpoint with no JS gate or CAPTCHA.
- **Root Cause 3 — Google HTTP 200 but 0 Parsed:** `site:facebook.com` returns 0 because Facebook pages are heavily de-indexed from Google since 2022. Fix: Query directories that LINK to Facebook pages (99acres, MagicBricks, Housing.com, YellowPages, Sulekha).
- **Root Cause 4 — Web Archive CDX Malformed SURT:** Previous code used malformed SURT syntax in the CDX `filter` parameter. Fix: Use `matchType=prefix` with `url=facebook.com/pages/*`, then filter by keyword tokens in Python.
- **Root Cause 5 — JustDial/IndiaMART Routed Through SearXNG:** SearXNG's SSRF filter blocked these Indian directory sites. Fix: Direct HTTP requests with proper `Referer` headers, bypassing SearXNG entirely.
- **Root Cause 6 — Missing Real-Estate-Specific Sources:** Added 99acres, MagicBricks, Housing.com, Sulekha, YellowPages India as new high-yield sources for Indian real estate queries.
- **New: Contact Enrichment Pass:** For Facebook URLs found without contact info, enriches via Google Cache and Wayback Machine snapshots.
- **New: MD5-Based Deduplication:** All leads across 10 sources deduplicated using MD5 hash of normalized Facebook UID.
- **10 Sources (in priority order):** Bing, DDG HTML, Web Archive CDX, JustDial, IndiaMART, Sulekha, 99acres/MagicBricks/Housing.com, YellowPages India, Google organic, Contact enrichment.
- **Expected yield:** 150-300 leads for "Real Estate in India" (previously 0).
- PR: [#116](https://github.com/harryroger798/social-lead-extractor-pro/pull/116)
- Platform PR: [#103](https://github.com/harryroger798/snapleads-platform/pull/103)
- Build: [GitHub Actions Run](https://github.com/harryroger798/social-lead-extractor-pro/actions/runs/23126883328)
- Consulted with Claude.ai for 6 root cause fixes and exact code implementation.

### v3.5.28 (March 15, 2026)
- **CRITICAL FIX: Platform Tag Mismatch — 0 leads in Results despite 515 extracted (Bug 1):**
  - **Root Cause:** DB search returns leads tagged with their SOURCE platform (linkedin/instagram from S3 database), but the Results view auto-filters by the user's SELECTED platform (e.g., facebook). When user selects "facebook" but DB leads are tagged "instagram"/"linkedin", the platform filter returns 0 results.
  - **Fix (database.py):** Added `source_platform` column via SQLite migration — stores the original platform tag for audit trail.
  - **Fix (routes.py — lead saving):** Re-tag leads with user's requested platform before INSERT. If a lead's source platform doesn't match the user's selected platforms, it gets re-tagged with the first selected platform. Original tag stored in `source_platform`.
  - **Fix (routes.py — Results endpoint):** When viewing results for a specific session (`session_id` provided), platform filter is bypassed. The session_id alone correctly scopes results. Platform filter only applies when browsing ALL leads without a session.
- **Facebook Live Scraper Multi-Source Pipeline (Bug 2):**
  - **Root Cause:** `site:facebook.com` dorking returns 0 results because Facebook pages are heavily de-indexed from search engines.
  - **Fix (live_scrapers.py):** Replaced single-source dorking with a 6-source pipeline:
    1. **Bing** `site:facebook.com` — Bing indexes Facebook far better than Google/DDG
    2. **JustDial** — India's largest business directory, rich phone/email data (activated for Indian queries)
    3. **IndiaMART** — Best for B2B Indian leads like Real Estate (activated for Indian queries)
    4. **Google organic** — No `site:` operator, surfaces Facebook pages naturally in organic results
    5. **Web Archive CDX API** — Cached Facebook page snapshots, free, no rate limits
    6. **Original `site:facebook.com` dorking** — Final fallback
  - **Indian Query Detection:** Automatically detects India-specific queries (city names like Delhi, Mumbai, Bangalore, etc.) and activates JustDial + IndiaMART sources.
- **Google Dorking CAPTCHA Resilience (Bug 3):**
  - **Root Cause:** Patchright browser targeting Google always triggers CAPTCHA. HTTP fallback to Google also returns 0 results due to anti-bot protections.
  - **Fix (google_dorking.py):** Renamed `_search_google_patchright()` to `_search_ddg_patchright()` — Patchright now targets DuckDuckGo instead of Google.
  - **Zero CAPTCHA:** DuckDuckGo never shows CAPTCHAs for automated searches.
  - **Full operator support:** DDG supports `site:` and `OR` operators natively.
  - **URL extraction:** DDG wraps results in `uddg=` parameter — new parser extracts clean URLs from DDG's redirect wrapper.
  - **Legacy alias:** `_search_google_patchright = _search_ddg_patchright` for backward compatibility.
  - **HTTP Google fallback retained** as last resort when Patchright is unavailable.
- PR: [#115](https://github.com/harryroger798/social-lead-extractor-pro/pull/115)
- **Consulted with Claude.ai (Sonnet 4.6, godlyalex.online org)** for fix design — 4 artifacts with exact code changes.

### v3.5.27 (March 15, 2026)
- **CRITICAL FIX: Patchright Driver Binary Bundling (Windows):** v3.5.26 bundled Chromium browsers but NOT the Patchright driver binary (`node` executable + `package/` directory). PyInstaller's `--hidden-import=patchright` only imports Python modules — it does NOT include the ~130MB driver binary at `patchright/driver/node` that Patchright needs to spawn browser processes. Fix: Changed to `--collect-all patchright` on Windows which bundles the full driver (node + package/). macOS continues with `--hidden-import` only (auto-installs at runtime).
- **Root Cause:** `FileNotFoundError: [WinError 2] The system cannot find the file specified` when Patchright tried to launch Chromium — the `node` binary wasn't in the PyInstaller bundle.
- **Diagnostic Browser Directory Logging:** Added logging in `patchright_engine.py` that lists bundled browser directory contents on startup for debugging. Logs each subdirectory and its first 5 entries.
- **Build Size Increase:** Windows installer grew from ~622MB to ~657MB due to inclusion of the full Patchright driver binary.
- **Conditional Build Logic:** `build-release.yml` now checks `if [ -d "patchright_browsers" ]` to decide between `--collect-all patchright` (Windows) and `--hidden-import=patchright --hidden-import=patchright.async_api` (macOS).
- PR: [#114](https://github.com/harryroger798/social-lead-extractor-pro/pull/114)
- Platform PR: [#101](https://github.com/harryroger798/snapleads-platform/pull/101)

### v3.5.26 (March 15, 2026)
- **Patchright + Chromium Bundling (Windows):** Patchright headless browser bundled into PyInstaller build via `--add-data patchright_browsers:patchright_browsers`. Detected at runtime via `sys._MEIPASS`. macOS uses runtime auto-install fallback.
- **Google Dorking HTTP Fallback:** When Patchright page is `None` (not installed/failed), Google Dorking now falls back to `_search_google_http()` using httpx + BeautifulSoup instead of silently skipping. Parses Google SERP HTML (`div.g`, `div.MjjYud`) for organic results.
- **Clear Logs Fix (Windows):** `clear_logs()` now closes all `FileHandler` instances on the root logger before deleting log files, then re-initializes logging. Fixes Windows file-locking issue where `os.remove()` failed silently on open RotatingFileHandler files.
- **YouTube Database Search:** 1,085 YouTube channels across 53 categories queried from S3 Parquet file via DuckDB. Supports keyword matching on `channelName`, `category`, `description`. Returns channel URLs, subscriber counts, video counts.
- **macOS Build Fix:** Conditional Patchright bundling — only runs `patchright install chromium` on Windows (`if: matrix.platform == 'win'`). PyInstaller `--add-data` for patchright_browsers only added if directory exists. Fixes macOS build failure where PyInstaller couldn't process Chromium `.app` bundle.
- **Render Search API — YouTube Support:** Added `/search/youtube` endpoint to `snapleads-search-api` for server-side YouTube channel queries.
- PRs: [#110](https://github.com/harryroger798/social-lead-extractor-pro/pull/110), [#111](https://github.com/harryroger798/social-lead-extractor-pro/pull/111), [#112](https://github.com/harryroger798/social-lead-extractor-pro/pull/112), [#113](https://github.com/harryroger798/social-lead-extractor-pro/pull/113)
- Render API PR: [#1](https://github.com/harryroger798/snapleads-search-api/pull/1)
- Platform PR: [#100](https://github.com/harryroger798/snapleads-platform/pull/100)

### v3.5.25 (March 15, 2026)
- **Render Search API Integration:** New standalone FastAPI service (`snapleads-search-api`) deployed on Render.com at `https://snapleads-search-api.onrender.com`
- Server-side S3 queries execute in ~9s vs ~100s client-side (Render's US datacenter has low-latency to iDrive E2 us-west-1)
- Desktop app `database_search.py` updated with `_try_render_api()` fallback: tries Render API first, falls back to direct DuckDB S3 on failure
- Supports LinkedIn, Instagram, Google Maps, PAN India platforms
- PR: https://github.com/harryroger798/social-lead-extractor-pro/pull/109
- Platform PR: [#97](https://github.com/harryroger798/snapleads-platform/pull/97)

### v3.5.24 (March 15, 2026)
- **S3 query timeout fix for residential internet** (Claude Opus 4.6 validated)
- Root cause: DuckDB httpfs queries to iDrive E2 S3 (us-west-1) timeout at 45s on residential internet (India), returning 0 leads
- Fix 1: `http_timeout` raised from 30s to 90s — lets S3 range requests complete on slow links
- Fix 2: `_DB_QUERY_TIMEOUT_SECS` raised from 45s to 120s — must exceed http_timeout so DuckDB finishes naturally
- Fix 3: `_HYBRID_SEARCH_MASTER_TIMEOUT_SECS` raised from 120s to 180s — accommodates longer per-query timeouts
- Fix 4: Dataset limits reduced (free: 3, starter: 5, pro: 5, unlimited: 8) — fewer S3 round-trips = less wall-clock time
- Fix 5: `asyncio.Semaphore(2)` added to LinkedIn per-country queries — prevents thread pool saturation (5 countries × N files was blocking all 4 workers)
- EC2-validated: 495 leads from Instagram DB-only "Software Developer" extraction via Guacamole GUI
- PR: https://github.com/harryroger798/social-lead-extractor-pro/pull/108

### v3.5.23 (March 15, 2026)
- Orphaned session recovery: On startup, any "running" sessions are auto-marked "completed" with progress=100
- Prevents stuck extractions when app is killed mid-process (e.g., during reinstall)
- Added in `database.py` `init_db()` — recovers sessions before app starts accepting requests

### v3.5.22 (March 15, 2026)
- Comprehensive persistent logging system across all components:
  - **Backend (main.py):** Rotating file handler (`snapleads.log`, 10MB × 5 files) with structured format `timestamp | LEVEL | module | message`
  - **Electron (main.js):** Captures stdout/stderr from backend process, writes to `electron.log`
  - **Frontend (logger.ts):** Intercepts `console.log/warn/error`, batches writes to `/api/logs/write-batch`
  - **Log Service (log_service.py):** API endpoints for `/api/logs/list`, `/api/logs/tail`, `/api/logs/export`, `/api/logs/clear`
  - **Settings UI:** View Logs, Export Logs (ZIP), Clear Logs buttons in Settings page
- All logs stored in `userData/logs/` directory (portable, follows app data path)
- EC2-validated on Windows Server 2022 via Guacamole GUI

### v3.5.21 (March 15, 2026)
- Global 120-second extraction timeout to prevent stuck sessions
- Fixes Instagram/live scraper hangs where extraction stays at 96% "Saving leads to database..."

### v3.5.11 (March 14, 2026)
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

*End of Consolidated Architecture Document — v3.5.29*
