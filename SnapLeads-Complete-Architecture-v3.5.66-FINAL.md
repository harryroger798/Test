# SnapLeads Complete Architecture Document — v3.5.66

**Date:** March 22, 2026
**Version:** 3.5.66
**Status:** Production-ready (weekly leads.cm automation + Instagram backfill)

---

## 1. What's New in v3.5.66

### Weekly Leads.cm Automation + Instagram Backfill

**Change 1: Instagram Backfill — 5.5M New Records**
- Downloaded 111 missing Instagram datasets (50-160) from vorbidden.com
- **5,508,726 new records** uploaded to iDrive S3
- Instagram database: 2,450,000 → **7,958,726 records** (+224% increase)
- Path: `s3://crop-spray-uploads/leads-cm-database/instagram/dataset_{50-160}.csv`

**Change 2: Weekly Incremental Sync Script**
- New `weekly_incremental_sync.py` — completely separate from existing extraction scripts (zero risk)
- Phase 1: LinkedIn probe (187 countries × 1 request each = ~3 min)
- Phase 2: Instagram probe (sequential from max+1 until 2 consecutive 404s = ~5 sec)
- Phase 3: Technology probe (21 HEAD requests = ~30 sec)
- If new data found → downloads JSON → converts to CSV → uploads to iDrive S3
- State tracking on S3: `weekly_sync_state.json` (keeps last 52 syncs = 1 year history)

**Change 3: GitHub Actions Weekly Cron**
- Workflow: `.github/workflows/weekly-leads-sync.yml`
- Schedule: `cron: '0 2 * * 0'` (every Sunday 2:00 AM UTC)
- Also supports manual trigger (`workflow_dispatch`) from GitHub Actions UI
- S3 credentials stored as GitHub Actions encrypted secrets (IDRIVE_S3_ENDPOINT, IDRIVE_S3_BUCKET, IDRIVE_S3_ACCESS_KEY, IDRIVE_S3_SECRET_KEY)

**Change 4: GitHub Actions Secrets Configured**
- 4 encrypted secrets added to `harryroger798/social-lead-extractor-pro` repo
- Encrypted via GitHub's NaCl public key (key_id: 3380204578043523366)
- Used by the weekly sync workflow — never exposed in logs

### How Users Get Fresh Leads (Automatically)
```
Every Sunday 2 AM UTC:
  GitHub Actions → weekly_incremental_sync.py
    → Probes vorbidden.com for new datasets
    → Downloads new JSON → converts CSV → uploads to iDrive S3
    → Users search in SnapLeads app
    → DuckDB queries S3 → returns latest data automatically
    → NO app update needed
```

### Files Added/Modified

| File | Repo | Changes |
|------|------|---------|
| `weekly_incremental_sync.py` | social-lead-extractor-pro | NEW — 361-line Python script for weekly incremental sync |
| `.github/workflows/weekly-leads-sync.yml` | social-lead-extractor-pro | NEW — GitHub Actions cron workflow |

### PRs

| PR | Repo | Description |
|----|------|-------------|
| #153 | social-lead-extractor-pro | Weekly leads.cm incremental sync (GitHub Actions cron) — merged |

---

## 2. Version History (v3.5.32 — v3.5.66)

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
| v3.5.62 | Startup Directories feature (npm + PyPI + GitHub + HN + contact scraping) | #149 |
| v3.5.63 | 5 sleep/resume/crash resilience fixes | #150 |
| v3.5.64 | Replace SVG platform icons with 20 high-quality transparent PNG logos | #151 |
| v3.5.65 | Icon rendering fixes + tooltip descriptions + landing page update to 20 platforms | #152 (desktop) + #141, #142 (platform) |
| **v3.5.66** | **Weekly leads.cm automation + Instagram backfill (5.5M records)** | **#153** |

---

## 3. Build Artifacts

| Platform | File | Size | B2 URL |
|----------|------|------|--------|
| Windows | `SnapLeads Setup 3.5.65.exe` | ~694 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.65.exe` |
| macOS | `SnapLeads-3.5.65-arm64-mac.zip` | ~297 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.65-arm64-mac.zip` |

**Note:** v3.5.66 is a backend automation change (no app binary changes). Users continue using v3.5.65 builds. The weekly sync runs server-side via GitHub Actions.

---

## 4. Repositories

| Repo | Purpose | Latest PR |
|------|---------|-----------|
| `harryroger798/social-lead-extractor-pro` | Desktop Electron app (backend + frontend) + weekly sync | PR #153 (v3.5.66 — weekly sync) |
| `harryroger798/snapleads-platform` | Marketing website (getsnapleads.store) | PR #142 (download links v3.5.65) |
| `harryroger798/Test` | Architecture documentation | This PR |
| `bytepassperks/snapleads-search-api` | Render search API (DuckDB proxy) | PR #1 |

---

## 5. Database Infrastructure (Updated)

| Database | Records | Location | Query Method |
|----------|---------|----------|-------------|
| LinkedIn | 86.9M | iDrive E2 S3 (us-west-1) | DuckDB httpfs |
| **Instagram** | **7.96M** | iDrive E2 S3 | DuckDB httpfs |
| Google Maps | 102K+ | iDrive E2 S3 | DuckDB httpfs |
| PAN India | 101M+ | iDrive E2 S3 | DuckDB httpfs |
| YouTube | 1,085 channels | iDrive E2 S3 | DuckDB httpfs |
| Apify B2B | 101 leads | iDrive E2 S3 | DuckDB httpfs |
| Apify GMaps | 70K+ businesses | iDrive E2 S3 | DuckDB httpfs |
| **TOTAL** | **~196M+** | | |

**Change from v3.5.65:** Instagram grew from 2.45M → 7.96M (+5.51M from backfill). Total DB grew from ~190M → ~196M.

### Weekly Sync State (on S3)

| File | Path | Purpose |
|------|------|---------|
| `weekly_sync_state.json` | `leads-cm-database/weekly_sync_state.json` | Tracks known max datasets per country, Instagram max, sync history |

---

## 6. Weekly Automation Architecture

```
┌──────────────────────────────────────────────┐
│           GitHub Actions (Free)               │
│           Cron: Sunday 2 AM UTC               │
│                                               │
│  ┌────────────────────────────────────────┐   │
│  │    weekly_incremental_sync.py          │   │
│  │                                        │   │
│  │  Phase 1: LinkedIn Probe               │   │
│  │    187 countries × 1 request           │   │
│  │    Check max_dataset+1 for 200 resp    │   │
│  │                                        │   │
│  │  Phase 2: Instagram Probe              │   │
│  │    Sequential from current_max+1       │   │
│  │    Stop on 2 consecutive 404s          │   │
│  │                                        │   │
│  │  Phase 3: Technology Probe             │   │
│  │    21 HEAD requests for size changes   │   │
│  │                                        │   │
│  │  If new data found:                    │   │
│  │    Download JSON → Convert CSV         │   │
│  │    → Upload to iDrive S3              │   │
│  │    → Update weekly_sync_state.json    │   │
│  └────────────────────────────────────────┘   │
│                                               │
│  Env Secrets:                                 │
│  IDRIVE_S3_ENDPOINT, IDRIVE_S3_BUCKET,       │
│  IDRIVE_S3_ACCESS_KEY, IDRIVE_S3_SECRET_KEY  │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│       iDrive E2 S3 (us-west-1)               │
│       s3://crop-spray-uploads/               │
│       leads-cm-database/                     │
│         ├── linkedin/{Country}/dataset_N.csv │
│         ├── instagram/dataset_N.csv          │
│         ├── technology_lookup/...            │
│         └── weekly_sync_state.json           │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│       SnapLeads Desktop App                   │
│       DuckDB queries S3 directly             │
│       Users get fresh leads automatically    │
│       NO app update needed                   │
└──────────────────────────────────────────────┘
```

---

## 7. Platform Support (v3.5.65 app)

### Social Platforms (12) — DB + Live Scraping + Dorking
LinkedIn, Instagram, Facebook, Google Maps, Twitter/X, Telegram, WhatsApp, YouTube, TikTok, Pinterest, Reddit, Email

### B2B Platforms (8) — Live Scraping + Dorking
IndiaMART, TradeIndia, ExportersIndia, JustDial, Google Maps B2B, Email Finder B2B, GitHub B2B, Business Directories

### Standalone Features
- Google Maps Scraper (httpx + YellowPages + Yelp)
- Email Finder (website contact page crawler)
- Directories (YellowPages + Yelp + page-visit enrichment)
- Job Boards (Indeed RSS + Arbeitnow + RemoteOK + dorking)
- Startup Directories (npm + PyPI + GitHub + HN + contact scraping)
- Schedules (APScheduler — daily/weekly/monthly)

---

## 8. Testing Results Summary (v3.5.32 — v3.5.65)

### Group A-G Test Results (v3.5.44 — best run)
| Group | Sessions | Total Leads | Avg/Session |
|-------|----------|-------------|-------------|
| A (Social + Location) | 6 | 3,233 | 539 |
| B (Social, No Location) | 4 | 2,750 | 688 |
| C (B2B + Location) | 4 | 6,126 | 1,532 |
| D (B2B, No Location) | 2 | 529 | 265 |
| E (DB-Only) | 3 | 2,138 | 713 |
| F (Full Pipeline) | 3 | 982 | 327 |
| G (Edge Cases) | 2 | 1,582 | 791 |
| **TOTAL** | **24** | **~17,340** | **~723** |

### 13-Feature UI Verification (v3.5.61)
All 13 features verified: New Extraction (4 modes), Results, History, Google Maps, Email Finder, Directories, Job Boards, Schedules, Dashboard, Settings/Logs

---

## 9. Credentials Reference

All credentials stored in Devin secrets + GitHub Actions encrypted secrets. Key services:
- **iDrive E2 S3:** `s3.us-west-1.idrivee2.com` / bucket: `crop-spray-uploads`
- **Backblaze B2:** bucket: `snapleads-downloads`
- **Render Search API:** `https://snapleads-search-api.onrender.com`
- **GitHub PAT:** For API operations (PR creation, workflow triggers, secret management)
- **GitHub Actions Secrets:** IDRIVE_S3_ENDPOINT, IDRIVE_S3_BUCKET, IDRIVE_S3_ACCESS_KEY, IDRIVE_S3_SECRET_KEY

---

## 10. Devin Session

Link to Devin Session: https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a
Requested by: @bytepassperks (bytepass5@gmail.com)
