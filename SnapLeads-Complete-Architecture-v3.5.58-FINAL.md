# SnapLeads Complete Architecture Document — v3.5.58

**Date:** March 20, 2026
**Version:** 3.5.58
**Status:** Production Release

---

## 1. Version Summary

v3.5.58 fixes a **critical bug** where the 3 new B2B platforms added in v3.5.57 (Email Finder B2B, GitHub B2B, Business Directories) were being **silently skipped for all Indian queries**. The `_GLOBAL_B2B` classification inherited from the old Apollo/RocketReach/Crunchbase platforms incorrectly blocked these location-agnostic scrapers from running on Indian keywords.

### Root Cause
In `routes.py` line 1486, the set `_GLOBAL_B2B = {"email_finder_b2b", "github_b2b", "business_directories"}` was populated with all 3 new platforms. Line 1521 then skipped any `_GLOBAL_B2B` platform when `is_indian_query` was True. Since the old Apollo/RocketReach/Crunchbase were truly Western-only API platforms, this skip logic made sense for them. But the 3 replacements use **dorking + contact scraping** which is location-agnostic — they work for ANY location including India.

### Evidence from v3.5.57 Test Logs
```
P4: Skipping email_finder_b2b — Indian query (pune)
P4: Skipping github_b2b — Indian query (mumbai)
P4: Skipping business_directories — Indian query (chennai)
```

All 3 new scrapers were skipped in every Indian test session. The 1,032 / 376 / 1,382 leads reported in Tests 1-3 came entirely from the **S3 database fallback** (Google Maps + PAN India), NOT from the new scrapers.

### Fix Applied
```python
# v3.5.57 (broken):
_GLOBAL_B2B = {"email_finder_b2b", "github_b2b", "business_directories"}

# v3.5.58 (fixed):
_GLOBAL_B2B: set[str] = set()
# All 3 v3.5.57 replacements work for ANY location (Indian or global).
# The old Apollo/RocketReach/Crunchbase were truly Western-only APIs,
# but Email Finder/GitHub/Business Directories use dorking + contact
# scraping which is location-agnostic.
```

---

## 2. Changes Made

### 2.1 Backend Changes

**`backend/app/api/routes.py`** — Lines 1485-1489
- Cleared `_GLOBAL_B2B` set from `{"email_finder_b2b", "github_b2b", "business_directories"}` to `set()`
- Added detailed comment explaining why the set is now empty
- The skip logic at line 1521 (`if p in _GLOBAL_B2B and is_indian_query: continue`) still exists but now has no effect since the set is empty

### 2.2 Version Files
- `frontend/src/lib/version.ts` — `3.5.57` to `3.5.58`
- `package.json` — `3.5.57` to `3.5.58`

### 2.3 Platform Download Links
- `DownloadSection.tsx` — All URLs updated to v3.5.58
- `_redirects` — All redirect URLs updated to v3.5.58

---

## 3. Build and Deploy

| Item | Value |
|------|-------|
| **Desktop PR** | Merged to main (v3.5.58 tag pushed) |
| **Platform PR** | [#133](https://github.com/harryroger798/snapleads-platform/pull/133) — merged |
| **Tag** | v3.5.58 |
| **GitHub Actions** | Run #23351110456 — SUCCESS (Windows + macOS) |
| **Windows** | [SnapLeads Setup 3.5.58.exe](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.58.exe) (658 MB) |
| **macOS** | [SnapLeads-3.5.58-arm64-mac.zip](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.58-arm64-mac.zip) (279 MB) |
| **Live Site** | getsnapleads.store — auto-deployed from merged platform PR |

---

## 4. Current B2B Platform Matrix (v3.5.58)

| # | Platform ID | Name | Region | Skip Logic | Status |
|---|------------|------|--------|------------|--------|
| 1 | `generic_email_dork` | Generic Email Dorking | Global | None | Working (8-15 emails/query) |
| 2 | `justdial` | JustDial | India | `_INDIA_B2B` (skip Western) | Working (40 leads/query) |
| 3 | `indiamart` | IndiaMART | India | `_INDIA_B2B` (skip Western) | Working (8-33 leads/query) |
| 4 | `google_maps_b2b` | Google Maps B2B | Global | None | Working (15-80 leads/query) |
| 5 | `email_finder_b2b` | Email Finder B2B | **Global** | **None (v3.5.58 fix)** | Runs for ALL locations now |
| 6 | `github_b2b` | GitHub B2B | **Global** | **None (v3.5.58 fix)** | Runs for ALL locations now |
| 7 | `business_directories` | Business Directories | **Global** | **None (v3.5.58 fix)** | Runs for ALL locations now |
| 8 | `tradeindia` | TradeIndia | India | `_INDIA_B2B` (skip Western) | Working (enhanced dorking v3.5.56) |
| 9 | `exportersindia` | ExportersIndia | India | `_INDIA_B2B` (skip Western) | Working (enhanced dorking v3.5.56) |

---

## 5. v3.5.57 Test Results Analysis (Pre-Fix)

### Sessions Tested (4 of 8 — Tests 4-7 were not run)

| # | Test | Keyword | Platform | Total Leads | From New Scraper | From DB Fallback |
|---|------|---------|----------|-------------|-----------------|-----------------|
| 1 | Email Finder B2B | Web Design Agency in Pune | email_finder_b2b | 1,032 | **0** (SKIPPED) | 1,032 (GMaps+PAN) |
| 2 | GitHub B2B | React Developers in Mumbai | github_b2b | 376 | **0** (SKIPPED) | 376 (GMaps+PAN) |
| 3 | Business Directories | Hardware Stores in Chennai | business_directories | 1,382 | **0** (SKIPPED) | 1,382 (GMaps+PAN) |
| 8 | Regression | Civil Engineers | LI+IG+FB | 1,996 | N/A | 1,996 (DB) |

### Pipeline Component Status (v3.5.57)

| Component | Status | Evidence |
|-----------|--------|----------|
| S3 Database (DuckDB) | WORKING | LinkedIn, Instagram, GMaps, PAN India all returning leads |
| Google Dorking | WORKING | 4-engine waterfall executing, zero bans |
| B2B Scrapers (existing) | WORKING | JustDial 40/query, IndiaMART 8-33/query |
| **New B2B Scrapers** | **SKIPPED** | `_GLOBAL_B2B` classification blocked all 3 for Indian queries |
| Enrichment | WORKING | 45-120s budget, processing leads |
| Location Filtering | WORKING | India 82-98% match |
| Email Sanitization (v3.5.55) | WORKING | Running silently |
| Country TLD Inference (v3.5.55) | WORKING | Running silently |

---

## 6. Complete Version History (v3.5.32 — v3.5.58)

| Version | Key Changes | Group A Leads | Status |
|---------|------------|---------------|--------|
| v3.5.32 | Enhanced dorking (7-module architecture) + direct scraping | — | Superseded |
| v3.5.33 | 6 location-aware filtering fixes | — | Superseded |
| v3.5.34 | Backend-ready preload + retry + splash | — | Superseded |
| v3.5.35 | One-click automated testing button | — | Superseded |
| v3.5.36 | 8 ban-free fixes for 320-test plan | — | Superseded |
| v3.5.37 | 4 critical pipeline fixes | 1 lead | Superseded |
| v3.5.38 | Per-phase DB search timeouts | — | Superseded |
| v3.5.39 | 7 test-derived + 5 analysis fixes | — | Superseded |
| v3.5.40 | 8 Group A root cause fixes | 1,934 | Superseded |
| v3.5.41 | 7 Claude-verified fixes | 1,920 | Superseded |
| v3.5.42 | 9 yield optimization fixes | 1,329 | Superseded |
| v3.5.43 | 7 break/fix cycle prevention fixes | 1,194 | Superseded |
| v3.5.44 | 7 comprehensive fixes (engine reset, rate-limit awareness) | **3,233** | Verified |
| v3.5.45 | 5 dorking parser fixes (Brave/DDG/Bing/SearXNG) | — | Verified |
| v3.5.46 | 3 Group C root cause fixes (SSRF allowlist) | — | Verified |
| v3.5.47 | 5 B2B double-location fixes | — | Verified |
| v3.5.48 | Live scraping double-location guard | — | Verified |
| v3.5.49 | Generic Email Dorking B2B scraper (Tier 0) | — | Verified |
| v3.5.50 | 5 root cause fixes for maximum yield | — | Verified |
| v3.5.51 | 5 dorking page scrape + enrichment fixes | — | Verified |
| v3.5.52 | UnboundLocalError fix (_run_generic_email_dork) | — | Verified |
| v3.5.53 | UnboundLocalError fix (_company_website_urls) | — | Verified |
| v3.5.54 | Analysis-only release (Groups E+F+G verified, 4,627 leads) | — | Verified |
| v3.5.55 | Email sanitization + country TLD inference | — | Verified |
| v3.5.56 | 5 identified issue fixes (TradeIndia/ExportersIndia/Synonyms/Enrichment) | — | Verified |
| v3.5.57 | Replace Apollo/RocketReach/Crunchbase with 3 proven alternatives | — | Bug found |
| **v3.5.58** | **Fix _GLOBAL_B2B skip — new platforms now run for ALL locations** | — | **Current** |

### Cumulative Test Results (Groups A-G across all versions)

| Group | Sessions | Total Leads | Best Version |
|-------|----------|-------------|-------------|
| A (Social + Location) | 6 | 3,233 | v3.5.44 |
| B (Social - No Location) | 4 | 2,750 | v3.5.44 |
| C (B2B + Location) | 4 | 6,126 | v3.5.46 |
| D (B2B - No Location) | 2 | 529 | v3.5.48 |
| E (DB-Only) | 3 | 2,138 | v3.5.53 |
| F (Full Pipeline) | 3 | 907 | v3.5.53 |
| G (Edge Cases) | 2 | 1,582 | v3.5.53 |
| v3.5.57 New Platforms | 4 | 4,786 | v3.5.57 (DB fallback only) |
| **GRAND TOTAL** | **28** | **~22,051** | — |

---

## 7. Testing Instructions for v3.5.58

### Re-run the 3 new platform tests with Indian keywords:

**Test 1 — Email Finder B2B (was skipped in v3.5.57):**
- Keyword: `Web Design Agency in Pune`
- Platform: Email Finder B2B
- Dorking: ON, Direct Scraping: OFF
- Expected: DB leads (same as v3.5.57) + **NEW** leads from contact page scraping

**Test 2 — GitHub B2B (was skipped in v3.5.57):**
- Keyword: `React Developers in Mumbai`
- Platform: GitHub B2B
- Dorking: ON, Direct Scraping: OFF
- Expected: DB leads (same as v3.5.57) + **NEW** leads from GitHub API search

**Test 3 — Business Directories (was skipped in v3.5.57):**
- Keyword: `Hardware Stores in Chennai`
- Platform: Business Directories
- Dorking: ON, Direct Scraping: OFF
- Expected: DB leads (same as v3.5.57) + **NEW** leads from multi-directory dorking

### Regression — Re-run Tests 4-8 (were not run in v3.5.57):
| # | Keywords | Platforms | Dorking | Scraping |
|---|----------|-----------|---------|----------|
| 4 | `Accountants in Jaipur` | LinkedIn | ON | OFF |
| 5 | `Photographers in Kolkata` | Instagram | ON | OFF |
| 6 | `Bakeries in Ahmedabad` | Facebook, Google Maps | ON | OFF |
| 7 | `Packaging Suppliers in Surat` | IndiaMART, JustDial | ON | OFF |
| 8 | `Civil Engineers` | LinkedIn, Instagram, Facebook | ON | ON |

### What to verify in logs:
- **v3.5.57 showed:** `P4: Skipping email_finder_b2b — Indian query (pune)`
- **v3.5.58 should show:** The new scrapers actually running (no "Skipping" messages for the 3 new platforms)

---

## 8. Architecture Overview

### Database Sources (S3/DuckDB — Primary)
| Source | Records | S3 Datasets |
|--------|---------|-------------|
| LinkedIn | 86.9M | 1,738 |
| Instagram | 2.45M | 49 |
| Google Maps | 32K+ | 20+ |
| PAN India | 101M+ | 608 |
| YouTube | 1K+ | 1 |
| **TOTAL** | **~190M+** | **2,416+** |

### Extraction Pipeline
```
User Input -> Keyword Parser -> Location Detection
    |
Phase 1: DB Search (LinkedIn + Instagram + GMaps + PAN India via DuckDB/S3)
    |
Phase 2: Live Scraping (per-platform scrapers via curl_cffi)
    |
Phase 3: Google Dorking (4-engine waterfall: Brave -> DDG Lite -> Bing -> SearXNG)
    |
Phase 3.5: Page Scrape (visit dorking URLs for full-page email extraction)
    |
Phase 4: B2B Scraping (JustDial -> IndiaMART -> Email Finder -> GitHub -> Directories -> TradeIndia -> ExportersIndia)
    |
Phase 5: Waterfall Enrichment (contact page crawl -> email pattern gen -> MX verify)
    |
Dedup -> Location Filter -> Save to SQLite
```

### Anti-Detection Stack
- curl_cffi TLS fingerprinting (Chrome 131/124/120/116 + Safari 17)
- Log-normal jitter delays (not uniform random)
- Per-engine health tracking with exponential backoff
- 4-engine waterfall with automatic failover
- Zero proxies (desktop app = user's residential IP)

---

## 9. Credentials Reference

| Service | Details |
|---------|---------|
| GitHub PAT | `<REDACTED — stored in Devin secrets>` |
| Backblaze B2 Key ID | `005fbb66d7a76330000000001` |
| Backblaze B2 App Key | `K005kQ9e56hfToec0Qd1eK9WoIHHZ8E` |
| Backblaze B2 Bucket | `snapleads-downloads` |
| iDrive S3 Endpoint | `https://s3.us-west-1.idrivee2.com` |
| iDrive S3 Bucket | `crop-spray-uploads` |
| iDrive S3 Access Key | `EQQ53Vm4Cr9Rov1FsOPt` |
| iDrive S3 Secret Key | `far8XneFX3NH9UT6HFUjAAt9YZ3CB8RmJiCvKpe6` |
| Render API | `https://snapleads-search-api.onrender.com` |

---

## 10. Devin Session

**Session URL:** https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a
**Requested by:** @bytepassperks (bytepass5@gmail.com)
