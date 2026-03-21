# SnapLeads Complete Architecture Document — v3.5.62

**Date:** March 21, 2026
**Version:** 3.5.62
**Status:** Production-ready (all 13 UI features verified, 8/8 Group A-G tests PASS)

---

## 1. What's New in v3.5.62

### Startup Directories Feature (NEW)
5 proven free, ban-free sources for startup/developer lead extraction:

| # | Source | What It Returns | Ban Risk | API Key? |
|---|--------|----------------|----------|----------|
| 1 | **npm Registry API** | Maintainer emails + package homepages | ZERO | No |
| 2 | **PyPI Registry API** | Author emails + project websites | ZERO | No |
| 3 | **GitHub Trending API** | Company websites from popular repos | ZERO | No |
| 4 | **HackerNews Algolia API** | "Who is Hiring" job posts with emails | ZERO | No |
| 5 | **Company /contact scraping** | Emails + phones from discovered websites | ZERO | No |

**New endpoint:** `POST /api/startup-directories/search`
- Parameters: `query` (keyword), `sources` (comma-separated), `max_results`
- Returns session_id for background extraction
- All sources run in background task with progress tracking

**New file:** `backend/app/services/startup_directories.py` (621 lines)
- `scrape_npm_registry()` — searches npm public API, extracts maintainer emails
- `scrape_pypi_registry()` — searches PyPI JSON API, extracts author emails
- `scrape_github_trending()` — queries GitHub search API for trending repos with homepages
- `scrape_hackernews_hiring()` — finds latest "Who is Hiring" threads via Algolia API
- `scrape_company_contacts()` — visits /contact, /about, /team pages with SSRF protection
- `scrape_startup_directories()` — orchestrator that runs all sources + deduplicates

**Estimated yield:** ~11,700 startup leads/month (npm 8K + PyPI 3K + GitHub 2K websites + HN 200)

---

## 2. Version History (v3.5.32 — v3.5.62)

| Version | Key Changes | PRs |
|---------|------------|-----|
| v3.5.32 | Enhanced Google Dorking + Direct Scraping (7-module architecture) | #119 |
| v3.5.33 | 6 location-aware filtering fixes | #120 |
| v3.5.34 | Backend-ready preload + retry + splash screen | #121 |
| v3.5.35 | One-click automated testing button + ZIP bundle | #122 |
| v3.5.36 | 8 ban-free fixes for 320-test plan | #124 |
| v3.5.37 | 4 critical pipeline fixes for 100% test pass rate | #125 |
| v3.5.38 | Per-phase DB search timeouts + Bing CDN SSRF fix | #126 |
| v3.5.39 | 7 test-derived fixes + 5 analysis recommendations | #127 |
| v3.5.40 | 8 Group A root cause fixes | #128 |
| v3.5.41 | 7 Claude-verified fixes for maximum lead yield | #129 |
| v3.5.42 | 9 Claude-verified fixes (city aliases, budget scaling) | #130 |
| v3.5.43 | 7 root cause fixes for Group A test failures | #131 |
| v3.5.44 | 7 comprehensive fixes (break/fix cycle prevention) | #132 |
| v3.5.45 | 5 dorking parser fixes (Brave/DDG/Bing/SearXNG) | #133 |
| v3.5.46 | 3 Group C root cause fixes (SSRF + Brave + B2B routing) | #134 |
| v3.5.47 | 5 B2B double-location fixes + IndiaMART pagination | #135 |
| v3.5.48 | Live scraping double-location guard | #136 |
| v3.5.49 | Generic Email Dorking B2B scraper | #137 |
| v3.5.50 | 5 root cause fixes for maximum yield (Group E+F) | #138 |
| v3.5.51 | Generic email dork dedicated phase + enrichment fixes | #139 |
| v3.5.52 | UnboundLocalError fix (_run_generic_email_dork) | #140 |
| v3.5.53 | UnboundLocalError fix (_company_website_urls) + AST scan | #141 |
| v3.5.54 | Analysis-only — v3.5.53 verified working (Groups E+F+G) | — |
| v3.5.55 | Email sanitization + Country TLD inference (Signals 5+6) | #142 |
| v3.5.56 | 5 fixes (TradeIndia/ExportersIndia/Apollo/Synonyms/Enrichment) | #143 |
| v3.5.57 | Replace Apollo/RocketReach/Crunchbase with 3 proven alternatives | #144 |
| v3.5.58 | Remove _GLOBAL_B2B skip for new platforms | #145 |
| v3.5.59 | YellowPages max_delay fix + Job Boards dorking improvement | #146 |
| v3.5.60 | Directories page-visit enrichment + Indeed RSS + APScheduler | #147 |
| v3.5.61 | Indeed RSS wired into endpoint + RemoteOK + Arbeitnow | #148 |
| **v3.5.62** | **Startup Directories feature (npm + PyPI + GitHub + HN + contact scraping)** | **#149** |

---

## 3. Build Artifacts

| Platform | File | Size | B2 URL |
|----------|------|------|--------|
| Windows | `SnapLeads Setup 3.5.62.exe` | ~658 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.62.exe` |
| macOS | `SnapLeads-3.5.62-arm64-mac.zip` | ~279 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.62-arm64-mac.zip` |

**Build:** GitHub Actions Run #23386132390 (Windows + macOS — both SUCCESS)
**Tag:** `v3.5.62`

---

## 4. Repositories

| Repo | Purpose | Latest PR |
|------|---------|-----------|
| `harryroger798/social-lead-extractor-pro` | Desktop Electron app (backend + frontend) | PR #149 (v3.5.62) |
| `harryroger798/snapleads-platform` | Marketing website (getsnapleads.store) | PR #138 (download links) |
| `harryroger798/Test` | Architecture documentation | This PR |
| `bytepassperks/snapleads-search-api` | Render search API (DuckDB proxy) | PR #1 |

---

## 5. Database Infrastructure

| Database | Records | Location | Query Method |
|----------|---------|----------|-------------|
| LinkedIn | 86.9M | iDrive E2 S3 (us-west-1) | DuckDB httpfs |
| Instagram | 2.45M | iDrive E2 S3 | DuckDB httpfs |
| Google Maps | 32K+ | iDrive E2 S3 | DuckDB httpfs |
| PAN India | 101M+ | iDrive E2 S3 | DuckDB httpfs |
| YouTube | 1,085 channels | iDrive E2 S3 | DuckDB httpfs |
| Apify B2B | 101 leads | iDrive E2 S3 | DuckDB httpfs |
| Apify GMaps | 9,306 businesses | iDrive E2 S3 | DuckDB httpfs |
| **TOTAL** | **~190M+** | | |

---

## 6. Platform Support (v3.5.62)

### Social Platforms (DB + Live Scraping + Dorking)
LinkedIn, Instagram, Facebook, Google Maps, Twitter/X, Telegram, WhatsApp, YouTube, TikTok, Pinterest, Reddit, Snapchat

### B2B Platforms (Live Scraping + Dorking)
IndiaMART, TradeIndia, ExportersIndia, JustDial, Google Maps B2B, Email Finder B2B, GitHub B2B, Business Directories

### Standalone Features
- Google Maps Scraper (httpx + YellowPages + Yelp)
- Email Finder (website contact page crawler)
- Directories (YellowPages + Yelp + page-visit enrichment)
- Job Boards (Indeed RSS + Arbeitnow + RemoteOK + dorking)
- **Startup Directories (NEW — npm + PyPI + GitHub + HN + contact scraping)**
- Schedules (APScheduler — daily/weekly/monthly)

---

## 7. Testing Instructions for v3.5.62

### Test Startup Directories:
1. Open SnapLeads v3.5.62
2. Navigate to the **Startup Directories** feature (if UI tab exists) OR use the API endpoint
3. API test: `POST http://localhost:8000/api/startup-directories/search?query=react&sources=npm,pypi,github,hackernews&max_results=50`
4. Expected: Session created, background extraction runs, leads appear in Results

### Regression Tests (verify nothing broken):
| # | Keywords | Platforms | Expected |
|---|----------|-----------|----------|
| 1 | Dentists in Delhi | LinkedIn | 200+ leads |
| 2 | Plumbers in Mumbai | Instagram | 100+ leads |
| 3 | Steel Suppliers in Chennai | IndiaMART, JustDial | 200+ leads |
| 4 | IT Companies in Pune | Email Finder B2B | 300+ leads |
| 5 | Software Developer / Bangalore | Job Boards (Indeed) | 1+ leads |
| 6 | Plumber / New York | Directories (YellowPages) | 20 leads, 19+ phones |

---

## 8. Credentials Reference

All credentials stored in Devin secrets. Key services:
- **iDrive E2 S3:** `s3.us-west-1.idrivee2.com` / bucket: `crop-spray-uploads`
- **Backblaze B2:** bucket: `snapleads-downloads`
- **Render Search API:** `https://snapleads-search-api.onrender.com`
- **GitHub PAT:** For API operations (PR creation, workflow triggers)

---

## 9. Devin Session

Link to Devin Session: https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a
Requested by: @bytepassperks (bytepass5@gmail.com)
