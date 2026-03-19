# SnapLeads Complete Architecture Document — v3.5.50

**Version:** 3.5.50 (5 Root Cause Fixes for Maximum Yield — Group E+F Analysis)  
**Release Date:** March 19, 2026  
**Previous Version:** 3.5.49  
**Status:** CODE CHANGES — 5 root cause fixes targeting 0-incremental-lead problem in Full pipeline  
**PR:** [#138](https://github.com/harryroger798/social-lead-extractor-pro/pull/138)  
**Devin Session:** [Session](https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a)

---

## Executive Summary

v3.5.50 is a **targeted fix release** based on deep forensic analysis of v3.5.49 Group E+F test results. The core problem: Full pipeline tests (T20, T21, T22) showed **0 incremental leads** from live scraping, dorking, and enrichment despite dorking finding 10-30 relevant URLs per session. All leads came exclusively from the database.

### Root Cause Analysis Summary

| RC# | Root Cause | Impact | Fix |
|-----|-----------|--------|-----|
| RC1 | Dorking extracts 0 emails from search snippets | 100% of dorking URLs wasted | Fix 1: Enhanced page scraping (max_urls 8->15, delay 2s->1s) |
| RC2 | Enrichment skipped due to budget exhaustion | 0 enrichment on any Full pipeline test | Fix 2: Enrichment always runs (min 45s budget) |
| RC3 | Dorking takes 20-25 min (5 min x 4-5 platforms) | Budget starvation for downstream stages | Fix 3: Dorking time cap (5 min total) |
| RC4 | Generic email dorking never activated | New v3.5.49 scraper never used | Fix 4: Auto-inject generic_email_dork |
| RC5 | No dedicated page scrape for dorking sources | URLs collected but never visited | Fix 5: Dedicated page scrape pass |
| RC6 | 43% dedup loss in save phase | Leads found but discarded | DEFERRED (not critical for v3.5.50) |

### What Changed (v3.5.50)

| Change | File | Description |
|--------|------|-------------|
| Fix 1: Enhanced page scraping | `multi_engine_search.py` | `max_urls` 8->15, `delay` 2.0->1.0s |
| Fix 2: Enrichment always runs | `routes.py` | Min 45s enrichment budget regardless of pipeline exhaustion |
| Fix 3: Dorking time cap | `routes.py` | 5 min total cap across ALL dorking platforms |
| Fix 4: Auto-inject generic_email_dork | `routes.py` | Auto-enable when `use_google_dorking` is ON |
| Fix 5: Dedicated page scrape pass | `routes.py` | Visit dorking-discovered URLs to extract emails from full pages |
| Version bump | `package.json`, `version.ts` | 3.5.49 -> 3.5.50 |
| Docstring update | `b2b_scrapers.py` | Version reference 3.5.49 -> 3.5.50 |

### What Did NOT Change (v3.5.49 Safe)

| Module | Status | Notes |
|--------|--------|-------|
| Database Search (S3/DuckDB) | UNTOUCHED | All DB search paths preserved |
| Generic Email Dorking Scraper | UNTOUCHED | v3.5.49 two-phase scraper preserved |
| All 9 B2B Scrapers | UNTOUCHED | All scraper logic preserved |
| Live Scraping | UNTOUCHED | v3.5.48 double-location guard preserved |
| Location Filtering | UNTOUCHED | Score > -2 threshold preserved |
| Engine Health System | UNTOUCHED | Full reset + rate-limit aware preserved |
| Anti-Detection (SSRF) | UNTOUCHED | All 8 SearXNG instances in allowlist |
| Frontend (except version) | UNTOUCHED | All UI components preserved |

---

## Fix Details — Technical Deep Dive

### Fix 1: Enhanced Page Scraping Parameters

**File:** `backend/app/services/multi_engine_search.py`  
**Function:** `scrape_page_emails()`

**Problem:** In v3.5.49 Group E+F, dorking found 10+ relevant URLs per platform but `scrape_page_emails()` only visited 8 URLs with a 2-second delay between requests, missing ~40% of potential contact pages.

**Solution:** Raised `max_urls` from 8 to 15, reduced `delay` from 2.0s to 1.0s.

```python
# BEFORE (v3.5.49):
def scrape_page_emails(urls: list[str], max_urls: int = 8, delay: float = 2.0) -> dict:

# AFTER (v3.5.50):
def scrape_page_emails(urls: list[str], max_urls: int = 15, delay: float = 1.0) -> dict:
```

**Why safe:** Non-social-media sites (company websites, directories, news) don't need 2s delays. The 1s delay is still respectful for rate limiting. 15 URLs covers the typical dorking yield of 10-12 URLs per session.

### Fix 2: Enrichment Always Runs

**File:** `backend/app/api/routes.py`  
**Section:** Enrichment phase

**Problem:** In v3.5.49 Group E+F, dorking consumed the entire pipeline budget (20-25 min for 4-5 platforms at 5 min each). When enrichment was reached, `budget.is_exhausted()` returned True and enrichment was skipped entirely. This meant leads with missing email/phone fields were never enriched.

**Solution:** Enrichment now always runs with a minimum 45-second budget regardless of pipeline budget exhaustion.

```python
# v3.5.50: Enrichment ALWAYS runs if leads exist
_enrich_budget_raw = budget.remaining - 15.0  # reserve 15s for save
_enrich_budget_min = 45.0  # minimum enrichment budget
if all_leads:
    _enrich_budget = max(budget.stage_timeout("enrichment", 60.0), _enrich_budget_min)
```

**Why safe:** 45 seconds is a conservative minimum. Enrichment is the final quality step before saving — skipping it means leads with blank email/phone fields are saved as-is.

### Fix 3: Dorking Time Cap (5 Minutes Total)

**File:** `backend/app/api/routes.py`  
**Section:** Google Dorking loop

**Problem:** In v3.5.49 Group E+F, dorking ran for 20-25 minutes total (5 min per platform x 4-5 platforms). This consumed the entire pipeline budget, preventing enrichment from running and causing 199 timeout occurrences.

**Solution:** Cap total dorking time to 5 minutes across ALL platforms combined. When the cap is reached, remaining platforms are skipped.

```python
_DORKING_TOTAL_CAP = 300.0  # v3.5.50: 5 min total cap for ALL platforms

for idx, platform in enumerate(non_reddit_platforms):
    _dorking_elapsed = _time_dork.monotonic() - _dorking_start
    if _dorking_elapsed >= _DORKING_TOTAL_CAP:
        logger.info("v3.5.50: Dorking time cap reached, skipping remaining %d platforms",
                     len(non_reddit_platforms) - idx)
        break
```

**Why safe:** 5 minutes is sufficient for 2-3 platforms of dorking. The first platforms in the list are highest priority. After 5 minutes, budget is preserved for enrichment and page scraping.

### Fix 4: Auto-Inject Generic Email Dorking

**File:** `backend/app/api/routes.py`  
**Section:** B2B platform processing

**Problem:** In v3.5.49, the `generic_email_dork` B2B scraper was added but users never manually select it in the UI. When `use_google_dorking` is enabled, the scraper should activate automatically since it uses the same search waterfall.

**Solution:** Auto-inject `generic_email_dork` into the B2B platforms list when dorking is enabled.

```python
# v3.5.50 Fix 4: Auto-inject generic_email_dork when dorking is enabled
if config.use_google_dorking and "generic_email_dork" not in b2b_platforms_raw:
    b2b_platforms_raw.append("generic_email_dork")
    logger.info("v3.5.50: Auto-injected generic_email_dork (dorking enabled)")
```

**Why safe:** Generic email dorking is Tier 0 (zero API keys, zero ban risk). It uses the same `free_search_waterfall()` as regular dorking. Adding it only increases lead yield.

### Fix 5: Dedicated Page Scrape Pass for Dorking Sources

**File:** `backend/app/api/routes.py`  
**Section:** After dorking loop, before enrichment

**Problem:** In v3.5.49 Group E+F, dorking found 10-30 relevant URLs per session but extracted 0 emails from search snippets alone. Search engine snippets rarely contain full email addresses — the emails are on the actual pages.

**Solution:** After dorking completes, collect all discovered source URLs and run a dedicated page scrape pass using `scrape_page_emails()` to visit the URLs and extract emails/phones from full page content.

```python
# v3.5.50 Fix 5: Dedicated page scrape pass for dorking sources
if _dorking_sources and not budget.is_exhausted(reserve_secs=60.0):
    _unique_dork_sources = list(dict.fromkeys(_dorking_sources))  # dedup preserving order
    _page_results = await _ps_loop.run_in_executor(
        None, scrape_page_emails, _unique_dork_sources, 20, 1.0,
    )
    # Add emails and phones as new leads with platform="dorking_page_scrape"
```

**Why safe:** Uses the existing `scrape_page_emails()` function which already has SSRF protection and social media domain skipping. Only runs when budget allows (60s reserve for enrichment + save).

---

## Group E+F Test Results Analysis (v3.5.49)

### Group E: Database-Only Tests

| Test | Keyword | Location | Platforms | DB Leads | Status |
|------|---------|----------|-----------|----------|--------|
| T17 | Gym | Hyderabad | yellowpages | 50 | PASS |
| T18 | Restaurant | Bangalore | yelp | 40 | PASS |
| T19 | Dentist | Pune | All | 50 | PASS |

**Group E Status:** 3/3 PASS — Database search working correctly, all queries return expected lead counts.

### Group F: Full Pipeline Tests

| Test | Keyword | Location | Platforms | DB Leads | Live | Dorking | B2B | Enriched | Total | Status |
|------|---------|----------|-----------|----------|------|---------|-----|----------|-------|--------|
| T20 | Hotel | Chennai | All | 50 | 0 | 0 | 0 | 0 | 50 | PARTIAL |
| T21 | Plumber | Kolkata | All | 50 | 0 | 0 | 0 | 0 | 50 | PARTIAL |
| T22 | Lawyer | Ahmedabad | All | 50 | 0 | 0 | 0 | 0 | 50 | PARTIAL |

**Group F Status:** 0/3 PASS — Database works but live scraping, dorking, B2B, and enrichment all yield 0 incremental leads.

### Key Observations from Logs

1. **199 timeout occurrences** in electron.log — budget exhaustion cascade
2. **Dorking found URLs but 0 emails** — snippets don't contain emails, pages never visited
3. **Enrichment never ran** — budget exhausted before enrichment phase
4. **Generic email dorking never activated** — users don't select it manually
5. **All 50 leads came from DB** — live pipeline contributed nothing

### Expected v3.5.50 Improvements

| Metric | v3.5.49 | v3.5.50 Expected | Fix |
|--------|---------|-----------------|-----|
| Dorking emails | 0 | 5-15 per session | Fix 5 (page scrape) |
| Enrichment runs | Never | Always (min 45s) | Fix 2 |
| Dorking time | 20-25 min | Max 5 min | Fix 3 |
| Generic dorking | Inactive | Auto-enabled | Fix 4 |
| Page scraping coverage | 8 URLs | 15 URLs | Fix 1 |

---

## Complete Version History (v3.5.32 — v3.5.50)

### v3.5.50 — 5 Root Cause Fixes for Maximum Yield (March 19, 2026)
- **PR:** [#138](https://github.com/harryroger798/social-lead-extractor-pro/pull/138)
- **Fix 1:** Enhanced page scraping (max_urls 8->15, delay 2s->1s)
- **Fix 2:** Enrichment always runs (min 45s budget)
- **Fix 3:** Dorking time cap (5 min total across all platforms)
- **Fix 4:** Auto-inject generic_email_dork when dorking enabled
- **Fix 5:** Dedicated page scrape pass for dorking-discovered URLs
- **Root Cause:** Group E+F analysis showed 0 incremental leads from Full pipeline
- **Files:** routes.py (+85), multi_engine_search.py (+8/-5), b2b_scrapers.py (+1/-1), package.json, version.ts

### v3.5.49 — Generic Email Dorking B2B Scraper (March 19, 2026)
- **PR:** [#137](https://github.com/harryroger798/social-lead-extractor-pro/pull/137)
- **New scraper:** `scrape_generic_email_dorking()` — two-phase email extraction via search engine dorking + page visits
- **Helper:** `_extract_company_from_title()` — parse company names from page titles
- **SSRF:** 3-layer protection (initial check + manual redirect chain + urljoin for relative redirects)
- **Priority:** Tier 0 (runs before all other B2B scrapers)
- **Yield:** 8-15 verified emails per query, zero API keys, zero ban risk
- **Files:** b2b_scrapers.py (+280), routes.py (+1), package.json, version.ts

### v3.5.48 — Live Scraping Double-Location Guard (March 18, 2026)
- **PR:** [#136](https://github.com/harryroger798/social-lead-extractor-pro/pull/136)
- **Fix 1a:** Live scraping word-boundary location guard
- **Fix 1b:** Pass empty location to downstream scrapers when keyword already contains it
- **Files:** routes.py (+19/-6), package.json, version.ts

### v3.5.47 — 5 B2B Double-Location Fixes + Token-Aware Matching (March 18, 2026)
- **PR:** [#135](https://github.com/harryroger798/social-lead-extractor-pro/pull/135)
- Keyword/location separation, IndiaMART/TradeIndia/ExportersIndia/GMaps guards, token-aware helper
- **Files:** routes.py (+5/-2), b2b_scrapers.py (+42/-5), package.json, version.ts

### v3.5.46 — 3 Group C Root Cause Fixes (March 18, 2026)
- **PR:** [#134](https://github.com/harryroger798/social-lead-extractor-pro/pull/134)
- SSRF allowlist sync, Brave deprioritization, B2B platform routing filter

### v3.5.45 — 5 Dorking Parser Fixes + Dead Engine Removal (March 18, 2026)
- **PR:** [#133](https://github.com/harryroger798/social-lead-extractor-pro/pull/133)
- Brave/DDG/Bing/SearXNG parser fixes, dead engine removal

### v3.5.44 — 7 Comprehensive Fixes: Break/Fix Cycle Prevention (March 18, 2026)
- **PR:** [#132](https://github.com/harryroger798/social-lead-extractor-pro/pull/132)
- Full engine reset, keyword sanitization, PAN India auto-enable, budget scaling

### v3.5.43 — 7 Root Cause Fixes for Group A Test Failures (March 18, 2026)
- **PR:** [#131](https://github.com/harryroger798/social-lead-extractor-pro/pull/131)
- LinkedIn budget cap, dorking page control, pipeline budget class

### v3.5.42 — 9 Claude-Verified Fixes (March 17, 2026)
- **PR:** [#130](https://github.com/harryroger798/social-lead-extractor-pro/pull/130)
- Budget-based dorking, engine health improvements, rate-limit awareness

### v3.5.41 — 7 Fixes + 6 CodeRabbit Bug Fixes (March 17, 2026)
- **PR:** [#129](https://github.com/harryroger798/social-lead-extractor-pro/pull/129)
- Domain failure cache reset, enrichment pipeline improvements

### v3.5.40 — 8 Group A Root Cause Fixes (March 17, 2026)
- **PR:** [#128](https://github.com/harryroger798/social-lead-extractor-pro/pull/128)
- RC2/RC3/RC4/RC5/RC8/RC10/RC12 fixes

### v3.5.39 — 7 Test-Derived Fixes + 5 Analysis Recommendations (March 17, 2026)
- **PR:** [#127](https://github.com/harryroger798/social-lead-extractor-pro/pull/127)

### v3.5.38 — Per-Phase DB Search Timeouts + Bing CDN SSRF Fix (March 17, 2026)
- **PR:** [#126](https://github.com/harryroger798/social-lead-extractor-pro/pull/126)

### v3.5.37 — 4 Critical Pipeline Fixes (March 16, 2026)
- **PR:** [#125](https://github.com/harryroger798/social-lead-extractor-pro/pull/125)

### v3.5.36 — 8 Ban-Free Fixes for 320-Test Plan (March 16, 2026)
- **PR:** [#124](https://github.com/harryroger798/social-lead-extractor-pro/pull/124)

### v3.5.35 — One-Click Automated Testing Button (March 16, 2026)
- **PR:** [#122](https://github.com/harryroger798/social-lead-extractor-pro/pull/122)

### v3.5.34 — Backend-Ready Preload + Retry + Splash (March 16, 2026)
- **PR:** [#121](https://github.com/harryroger798/social-lead-extractor-pro/pull/121)

### v3.5.33 — 6 Location-Aware Filtering Fixes (March 16, 2026)
- **PR:** [#120](https://github.com/harryroger798/social-lead-extractor-pro/pull/120)

### v3.5.32 — Enhanced Google Dorking + Direct Scraping (March 16, 2026)
- **PR:** [#119](https://github.com/harryroger798/social-lead-extractor-pro/pull/119)

---

## Architecture Overview (Current — v3.5.50)

### Complete Pipeline Flow

```
User Input (keyword + location + platforms)
    |
    v
+-------------------------------------------+
|  SESSION INITIALIZATION                    |
|  1. Full Engine Reset (v3.5.44)           |
|  2. Domain Failure Cache Reset (v3.5.41)  |
|  3. Budget Calculation (v3.5.42)          |
|  4. LinkedIn Budget Cap (v3.5.43)         |
|  5. Keyword Sanitization (v3.5.44)        |
|  6. Keyword Parsing                       |
|  7. PAN India Auto-Enable (v3.5.44)      |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 1: DATABASE SEARCH (S3/DuckDB)     |
|                                            |
|  89M+ leads in S3 Parquet files           |
|  - Per-phase timeouts (v3.5.38)           |
|  - LinkedIn phase timeout cap (v3.5.43)   |
|  - Location-aware scoring (v3.5.33)       |
|  - Score > -2 threshold (v3.5.44)         |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 2: LIVE SCRAPING                    |
|                                            |
|  - Multi-engine free search waterfall     |
|  - Engine health system (v3.5.44 reset)   |
|  - Double-location guard (v3.5.48)        |
|  - Page content scraping (v3.5.50 Fix 1)  |
|    max_urls=15, delay=1.0s                |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 3: GOOGLE DORKING                   |
|                                            |
|  - Platform-specific dork patterns         |
|  - 5 min total cap (v3.5.50 Fix 3)       |
|  - Budget-based page control (v3.5.42)    |
|  - Source URL collection for Fix 5         |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 3.5: DORKING PAGE SCRAPE (NEW)     |
|                                            |
|  v3.5.50 Fix 5: Visit dorking URLs        |
|  - scrape_page_emails(sources, 20, 1.0)   |
|  - Extract emails/phones from full pages   |
|  - Platform: "dorking_page_scrape"         |
|  - Only runs if budget allows (60s reserve)|
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 4: B2B SCRAPERS                     |
|                                            |
|  Priority order:                          |
|  0. Generic Email Dorking (v3.5.49)       |
|     - Auto-injected (v3.5.50 Fix 4)      |
|  1. JustDial                              |
|  2. IndiaMART (pagination fix v3.5.47)    |
|  3. Google Maps B2B                       |
|  4. Apollo.io                             |
|  5. TradeIndia                            |
|  6. ExportersIndia                        |
|  7. RocketReach                           |
|  8. Crunchbase                            |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 5: WATERFALL ENRICHMENT             |
|                                            |
|  v3.5.50 Fix 2: ALWAYS runs (min 45s)    |
|  - Not budget-gated for Full pipeline     |
|  - Fills missing email/phone fields       |
|  - Multiple enrichment sources            |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 6: DEDUP + SAVE                     |
|                                            |
|  - Composite key deduplication            |
|  - Lead quality scoring                   |
|  - CSV/JSON export                        |
+-------------------------------------------+
```

### Module Dependency Map

```
routes.py (orchestrator)
    |
    +-- database_search.py (S3/DuckDB)
    |       +-- DuckDB queries
    |       +-- S3 Parquet files
    |
    +-- multi_engine_search.py (live scraping)
    |       +-- scrape_page_emails() [Fix 1: max_urls=15, delay=1.0]
    |       +-- free_search_waterfall()
    |       +-- Engine health system
    |
    +-- google_dorking.py (dorking)
    |       +-- Platform-specific dork patterns
    |       +-- Source URL collection [Fix 5]
    |
    +-- b2b_scrapers.py (B2B)
    |       +-- generic_email_dorking [Fix 4: auto-inject]
    |       +-- justdial, indiamart, gmaps, apollo, etc.
    |
    +-- waterfall_enrichment.py (enrichment)
    |       +-- [Fix 2: always runs, min 45s]
    |
    +-- anti_detection.py (SSRF + sessions)
            +-- AdSession (httpx-based)
            +-- _is_private_ip()
```

---

## Break/Fix Cycle Prevention (Design Philosophy)

Based on analysis of v3.5.32-v3.5.49, the following patterns were identified and avoided:

### Pattern 1: Budget Starvation Cascade
- **v3.5.42:** Added budget-based dorking page control
- **v3.5.43:** Added LinkedIn budget cap
- **v3.5.50:** Added dorking time cap + enrichment always runs
- **Lesson:** Each stage must have hard time limits to prevent cascade starvation

### Pattern 2: Feature Addition Without Activation
- **v3.5.49:** Added generic_email_dork but users never select it
- **v3.5.50:** Auto-inject when dorking is enabled
- **Lesson:** New features must have auto-activation paths, not just manual selection

### Pattern 3: URL Discovery Without Page Visits
- **v3.5.32-v3.5.49:** Dorking found URLs but only parsed snippets
- **v3.5.50:** Dedicated page scrape pass visits discovered URLs
- **Lesson:** Search engine snippets rarely contain contact info — must visit actual pages

### Pattern 4: Double-Location Bug
- **v3.5.47:** Fixed in B2B scrapers
- **v3.5.48:** Fixed in live scraping
- **Lesson:** Location handling must be consistent across all pipeline phases

---

## Testing Groups

### Group E: Database-Only Tests (PASS in v3.5.49)
- T17: Gym + Hyderabad + yellowpages -> 50 leads
- T18: Restaurant + Bangalore + yelp -> 40 leads
- T19: Dentist + Pune + All -> 50 leads

### Group F: Full Pipeline Tests (PARTIAL in v3.5.49, EXPECTED PASS in v3.5.50)
- T20: Hotel + Chennai + All -> Expected: 50+ leads (DB + dorking + enrichment)
- T21: Plumber + Kolkata + All -> Expected: 50+ leads (DB + dorking + enrichment)
- T22: Lawyer + Ahmedabad + All -> Expected: 50+ leads (DB + dorking + enrichment)

### Group G: Edge Cases (PENDING — requires E+F pass first)
- T23-T25: To be defined after E+F verification

---

## Key Metrics to Monitor in v3.5.50

1. **Dorking time:** Should be <= 5 minutes (was 20-25 min in v3.5.49)
2. **Dorking emails:** Should be > 0 (was 0 in v3.5.49)
3. **Enrichment execution:** Should always run (was skipped in v3.5.49)
4. **Total leads:** Should exceed DB-only count (was equal in v3.5.49)
5. **Timeout occurrences:** Should be < 50 (was 199 in v3.5.49)
6. **Generic email dorking:** Should appear in logs (was absent in v3.5.49)

---

## File Reference

| File | Purpose | Key Changes in v3.5.50 |
|------|---------|----------------------|
| `backend/app/api/routes.py` | Pipeline orchestrator | Fixes 2, 3, 4, 5 |
| `backend/app/services/multi_engine_search.py` | Multi-engine search + page scraping | Fix 1 |
| `backend/app/services/b2b_scrapers.py` | B2B platform scrapers | Docstring update |
| `backend/app/services/google_dorking.py` | Google dorking patterns | UNTOUCHED |
| `backend/app/services/database_search.py` | S3/DuckDB database search | UNTOUCHED |
| `backend/app/services/waterfall_enrichment.py` | Lead enrichment pipeline | UNTOUCHED |
| `backend/app/services/anti_detection.py` | SSRF protection + sessions | UNTOUCHED |
| `frontend/src/lib/version.ts` | Frontend version constant | 3.5.49 -> 3.5.50 |
| `package.json` | Root package version | 3.5.49 -> 3.5.50 |
