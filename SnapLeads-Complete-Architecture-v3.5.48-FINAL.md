# SnapLeads Complete Architecture Document — v3.5.48

**Version:** 3.5.48 (Live Scraping Double-Location Guard + Downstream Scraper Location Passthrough Fix)  
**Release Date:** March 18, 2026  
**Previous Version:** 3.5.47  
**Status:** CODE CHANGES — Live scraping double-location guard (same pattern as v3.5.47 B2B fix) + downstream scraper location passthrough fix  
**PR:** [#136](https://github.com/harryroger798/social-lead-extractor-pro/pull/136)  
**Devin Session:** [Session](https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a)

---

## Executive Summary

v3.5.48 applies the same **word-boundary location deduplication guard** from v3.5.47's B2B fix to the **live scraping path** in `routes.py`. This is a **preventive fix** — the live scraping double-location bug was never triggered in v3.5.47 Group C+D testing because all test sessions used B2B-only platforms (IndiaMART, TradeIndia, JustDial, Google Maps B2B, Apollo, RocketReach), which were correctly filtered out of the live scraping path by v3.5.46's `_B2B_ONLY_PLATFORMS` filter.

Additionally, CodeRabbit's automated review identified a **critical downstream bug**: even after preventing double-location in `search_query`, the original code still passed `loc` as a separate parameter to `live_scrape_platform()`. Since downstream scrapers (Facebook, LinkedIn, Google Maps directories, etc.) internally concatenate `query + location` via patterns like `f"{query} {location}"`, this would have re-introduced the double-location at the scraper level. v3.5.48 fixes this by passing `loc_to_pass = ""` when the location is already embedded in the keyword.

### v3.5.47 Group C+D Forensic Verification Results

| Session | Keyword | Location | Platforms | Total Leads | Emails | Phones |
|---------|---------|----------|-----------|-------------|--------|--------|
| T11 | Steel Manufacturers | Delhi | IndiaMART | 773 | 41 (5%) | 560 (72%) |
| T12 | Textile Exporters | Mumbai | TradeIndia/ExportersIndia | 600 | 40 (7%) | 232 (39%) |
| T13 | Chemical Suppliers | Chennai | JustDial/Google Maps B2B | 489 | 45 (9%) | 77 (16%) |
| T14 | Wholesale Distributors | Pune | IM/TI/JD/GM B2B | 346 | 63 (18%) | 133 (38%) |
| T15 | SaaS Founders | (none) | Apollo/RocketReach | ~200 | ~150 | ~50 |
| T16 | Packaging Manufacturers | (none) | IM/TI/EI | ~400 | ~60 | ~200 |
| **TOTAL** | | | | **~2,808** | **~399** | **~1,252** |

**Key Forensic Findings:**
- v3.5.47 B2B fix IS WORKING — all B2B queries show single location (NOT doubled)
- Live scraping path was NEVER triggered (all platforms were B2B-only)
- 801 HTTP 429 errors (Brave, as expected — demoted in v3.5.46)
- 1 SSRF false positive (already in allowlist)
- Waterfall enrichment: 69.2% success rate
- **ZERO bans** across all 6 sessions

### What Changed (v3.5.48 Fixes)

| Fix | File | Lines Changed | Description |
|-----|------|--------------|-------------|
| Fix 1 | `backend/app/api/routes.py` | +19 / -6 | Live scraping double-location guard: word-boundary regex check before appending location to search_query, PLUS pass empty location to downstream scrapers when keyword already contains it |
| Version | `package.json`, `frontend/src/lib/version.ts` | +2 / -2 | Version bump 3.5.47 -> 3.5.48 |

### What Did NOT Change (Groups A/B/C/D Safe)

| Module | Status | Notes |
|--------|--------|-------|
| Database Search (S3/DuckDB) | UNTOUCHED | All Group C/D DB leads safe |
| Google Dorking | UNTOUCHED | Waterfall order preserved from v3.5.46 |
| B2B Scrapers | UNTOUCHED | v3.5.47 token-aware matching preserved |
| Enrichment Pipeline | UNTOUCHED | Waterfall enrichment preserved |
| Location Filtering | UNTOUCHED | Score > -2 threshold preserved |
| Engine Health System | UNTOUCHED | Full reset + rate-limit aware preserved |
| Anti-Detection (SSRF) | UNTOUCHED | All 8 SearXNG instances in allowlist |
| Frontend (except version) | UNTOUCHED | All UI components preserved |

---

## Root Cause Analysis (v3.5.47 -> v3.5.48)

### RC1: Live Scraping Double-Location (PREVENTIVE — HIGH IMPACT)

**Symptom:** Live scraping path in `_scrape_one_platform()` had the same double-location bug as v3.5.47's B2B path. `parse_keyword("Steel Manufacturers Delhi")` returns `keyword="Steel Manufacturers Delhi"` + `location="Delhi"`. Old code did `search_query = f"{keyword} {loc}"` -> `"Steel Manufacturers Delhi Delhi"`.

**Evidence:** Code inspection of `routes.py` lines 1019-1037 (pre-fix). The `if loc:` check unconditionally appended location without checking if it was already present in the keyword.

**Root Cause:** Same architectural mismatch as v3.5.47 B2B bug — `parse_keyword()` extracts location from the keyword string, but the live scraping code then re-appends it without checking for presence.

**Why Not Caught in v3.5.47 Testing:** All Group C+D test sessions used B2B-only platforms (IndiaMART, TradeIndia, JustDial, Google Maps B2B, Apollo, RocketReach). The `_B2B_ONLY_PLATFORMS` filter (v3.5.46 Fix 3) correctly excluded these from the live scraping path, so `_scrape_one_platform()` was never called.

**Impact:** Would affect future Group A/B social platform queries (Facebook, Instagram, LinkedIn, Twitter, etc.) with location-embedded keywords.

**Fix (v3.5.48 Fix 1a):** Added word-boundary regex guard `re.search(rf"(?<!\w){re.escape(loc.lower())}(?!\w)", kw_parsed.keyword.lower())` before appending location to `search_query`. Same proven pattern as v3.5.47's `_query_contains_location()`.

### RC2: Downstream Scraper Location Re-Concatenation (CRITICAL — CodeRabbit)

**Symptom:** Even after preventing double-location in `search_query`, the `loc` variable was still passed as a separate `location` parameter to `live_scrape_platform()`. Downstream scrapers internally concatenate `query + location` via patterns like `f"{query} {location}"`.

**Evidence (from code inspection):**
- Facebook scraper (line 602): `f'site:facebook.com/pages {query} {location}'`
- Google Maps directories (line 2091): `search_term = f"{query} {location}".strip()`
- LinkedIn scraper (line 2442): `f'site:linkedin.com/in "{query}" "{location}"'`
- JSON-LD scraper (line 1539): `search_q = f"{query} {location} contact phone email"`

**Root Cause:** The fix in RC1 only prevented double-location in the `search_query` variable passed as the first argument. The `location` parameter was still passed unchanged, and scrapers used it independently to build their own queries.

**Impact:** With only RC1 fixed, scrapers would receive `query="Steel Manufacturers Delhi"` and `location="Delhi"`, producing `"Steel Manufacturers Delhi Delhi"` at the scraper level.

**Fix (v3.5.48 Fix 1b):** When `loc_already_present` is true, pass `loc_to_pass = ""` instead of `loc` to `live_scrape_platform()`. This ensures downstream scrapers receive an empty location and don't re-concatenate.

---

## v3.5.48 Code Changes Detail

### routes.py — Live Scraping Double-Location Guard

**Before (v3.5.47):**
```python
async def _scrape_one_platform(platform: str) -> list[dict]:
    results: list[dict] = []
    try:
        for kw_parsed in parsed_keywords:
            search_query = kw_parsed.keyword
            loc = kw_parsed.location or location_hint
            if loc:
                search_query = f"{kw_parsed.keyword} {loc}"
            live_leads = await loop.run_in_executor(
                _LIVE_SCRAPE_POOL, live_scrape_platform, platform,
                search_query, loc, 20,
            )
            results.extend(live_leads)
```

**After (v3.5.48):**
```python
async def _scrape_one_platform(platform: str) -> list[dict]:
    results: list[dict] = []
    try:
        for kw_parsed in parsed_keywords:
            # v3.5.48 Fix 1: Prevent double-location in live scraping.
            # Same root cause as v3.5.47 B2B double-location bug:
            # parse_keyword("Steel Manufacturers Delhi") returns
            # keyword="Steel Manufacturers Delhi" + location="Delhi".
            # Previously we built search_query = f"{keyword} {loc}" ->
            # "Steel Manufacturers Delhi Delhi". Now we only append
            # location if it's NOT already present as a word-boundary
            # token in the keyword string.
            # ALSO: downstream scrapers internally concatenate
            # query + location (e.g. f"{query} {location}"), so we
            # must pass empty location when it's already embedded
            # in the keyword to prevent double-location at the
            # scraper level too.
            search_query = kw_parsed.keyword
            loc = kw_parsed.location or location_hint
            loc_already_present = bool(
                loc
                and re.search(
                    rf"(?<!\w){re.escape(loc.lower())}(?!\w)",
                    kw_parsed.keyword.lower(),
                )
            )
            if loc and not loc_already_present:
                search_query = f"{kw_parsed.keyword} {loc}"
            # Pass empty location to scrapers when keyword already
            # contains it -- scrapers build their own
            # f"{query} {location}" internally.
            loc_to_pass = "" if loc_already_present else (loc or "")
            live_leads = await loop.run_in_executor(
                _LIVE_SCRAPE_POOL, live_scrape_platform, platform,
                search_query, loc_to_pass, 20,
            )
            results.extend(live_leads)
```

**Key Design Decisions:**
1. `loc_already_present` is computed once and used for both the `search_query` concatenation AND the `loc_to_pass` decision
2. Uses the same proven word-boundary regex pattern `(?<!\w)...(?!\w)` as v3.5.47's `_query_contains_location()`
3. `re.escape()` handles regex-special characters in location names (e.g., `"St. Louis"`)
4. Case-insensitive via `.lower()` on both strings
5. When location IS already present: `search_query = keyword` (unchanged) AND `loc_to_pass = ""` (empty)
6. When location is NOT present: `search_query = f"{keyword} {loc}"` AND `loc_to_pass = loc` (full location)

---

## Complete Version History (v3.5.32 — v3.5.48)

### v3.5.48 — Live Scraping Double-Location Guard (March 18, 2026)
- **PR:** [#136](https://github.com/harryroger798/social-lead-extractor-pro/pull/136)
- **Fix 1a:** Live scraping word-boundary location guard in `_scrape_one_platform()` — same regex pattern as v3.5.47 B2B fix. Prevents `"Steel Manufacturers Delhi Delhi"`.
- **Fix 1b:** Pass empty location to downstream scrapers when keyword already contains it — prevents scrapers from re-concatenating location via their internal `f"{query} {location}"` patterns. (CodeRabbit critical finding)
- **Files:** routes.py (+19/-6), package.json, version.ts

### v3.5.47 — 5 B2B Double-Location Fixes + Token-Aware Matching (March 18, 2026)
- **PR:** [#135](https://github.com/harryroger798/social-lead-extractor-pro/pull/135)
- **Fix 1:** Keyword/location separation in routes.py — Pass keyword-only to B2B scrapers, location as separate parameter. Prevented double-location queries like "Steel Manufacturers Delhi Delhi".
- **Fix 2:** IndiaMART double-location guard + pagination fix — Continue until no new leads appear per page.
- **Fix 3:** TradeIndia double-location guard — Defensive check before appending location.
- **Fix 4:** ExportersIndia double-location guard — Defensive check before appending location.
- **Fix 5:** Google Maps Local double-location guard — Defensive check before appending location.
- **Fix 6:** Token-aware `_query_contains_location()` helper — Word-boundary regex prevents false positives with short locations (LA, IN, UK). Applied to all 4 B2B scraper location guards. (CodeRabbit review fix)
- **Files:** routes.py (+5/-2), b2b_scrapers.py (+42/-5), package.json, version.ts

### v3.5.46 — 3 Group C Root Cause Fixes (March 18, 2026)
- **PR:** [#134](https://github.com/harryroger798/social-lead-extractor-pro/pull/134)
- **Fix 1:** SSRF allowlist sync — Added 3 missing SearXNG instances (searx.oxf.app, search.sapti.me, searx.namejeff.xyz) to `_ALLOWED_SEARCH_DOMAINS`. Caused 42 false-positive SSRF blocks in Group C.
- **Fix 2:** Brave deprioritization — Moved brave_free from position 1 to position 4 (last) in `_FREE_ENGINES`. 100% HTTP 429 in Group C.
- **Fix 3:** B2B platform routing filter — Added `_B2B_ONLY_PLATFORMS` to `live_platforms` exclusion.
- **Files:** anti_detection.py (+7), multi_engine_search.py (+8/-4), routes.py (+8/-1), package.json, version.ts

### v3.5.45 — 5 Dorking Parser Fixes + Dead Engine Removal (March 18, 2026)
- **PR:** [#133](https://github.com/harryroger798/social-lead-extractor-pro/pull/133)
- **Fix 1:** Brave parser rewrite — `data-type="web"` containers + `fdb` fallback.
- **Fix 2:** DDG Lite parser fix — HTTP 202 as empty (not failure), snippet extraction from `<td>` elements.
- **Fix 3:** Bing parser fix — Base64 redirect URL resolution with dynamic padding, site: query fallback.
- **Fix 4:** SearXNG orchestration fix — 8 instances (removed 2 dead), JSON+HTML fallback, per-instance cooldown.
- **Fix 5:** Dead engine removal — Removed Startpage, Mojeek, Qwant, Yep from roster. `max_engines` 3->4.
- **Files:** multi_engine_search.py (+220/-45), package.json, version.ts

### v3.5.44 — 7 Comprehensive Fixes: Break/Fix Cycle Prevention (March 18, 2026)
- **PR:** [#132](https://github.com/harryroger798/social-lead-extractor-pro/pull/132)
- **Fix 1:** Full engine health reset per session — `reset_engine_hard_failures()` replaces `reset_engine_soft_state()`.
- **Fix 2:** Rate-limit aware engine health — HTTP 429/503 now call `record_empty()` instead of `record_failure()`.
- **Fix 3:** Multi-engine dorking backend — Replaced DDG Lite-only fallback with `free_search_waterfall()` (8 engines).
- **Fix 4:** Keyword sanitization for test-format inputs — `_sanitize_keyword()` detects `T\d+-keyword-city-suffix` patterns.
- **Fix 5:** Auto-enable PAN India for Indian Google Maps queries — word-boundary regex for Indian cities.
- **Fix 6:** Softer location filter threshold — Changed from `score < 0 = DROP` to `score <= -2 = DROP`.
- **Fix 7:** Raised enrichment caps — From `15%/100/15` to `25%/150/25`.
- **Files:** routes.py (+185), multi_engine_search.py (+64), google_dorking.py (+30), database_search.py (+70)

### v3.5.43 — 7 Root Cause Fixes for Group A Test Failures (March 18, 2026)
- **PR:** [#131](https://github.com/harryroger798/social-lead-extractor-pro/pull/131)
- **Bug 1:** Engine cascade failure fix — Separate `record_empty()` from `record_failure()`, base-2 backoff, 600s cap, `try_reset()` decay.
- **Bug 2:** Timeout chain misalignment — Phase timeout = 280s = inner(150s) + ghost(60s) + slack(70s).
- **Bug 3:** Location expansion — Expanded `_CITY_ALIASES` with neighborhoods, metro areas, Hindi names, state names.
- **Bug 4:** Zero-result fallback chain — Force supplementary DBs, nuclear engine reset, retry dorking.
- **Bug 5:** GMaps country assertion filter — Multi-signal country assertion (phone, TLD, city, state, country field).
- **Bug 6:** Enrichment decoupling — Count missing ANY field (was BOTH email AND phone).
- **Bug 7:** LinkedIn budget cap — 60% of budget (max 180s), guaranteeing 40% for dorking+enrichment.
- **Files:** multi_engine_search.py, database_search.py, routes.py

### v3.5.42 — 9 Claude-Verified Fixes for Maximum Lead Yield (March 17, 2026)
- **PR:** [#130](https://github.com/harryroger798/social-lead-extractor-pro/pull/130)
- **FIX-1:** Disable PAN India by default (was timing out 120s with 0 results)
- **FIX-2:** Per-session budget scaling by platform count (1p=300s, 2p=420s, 3p=540s, 4+=660s)
- **FIX-3:** Pipeline budget enforcement (stage timeouts respect remaining budget)
- **FIX-4:** City alias map for Indian cities (Bombay=Mumbai, Bengaluru=Bangalore)
- **FIX-5:** Budget-based dorking page control (1-3 pages based on remaining time)
- **FIX-6:** Budget scaling by platform count
- **FIX-7:** Enrichment priority scoring (both missing > one missing)
- **FIX-8:** Search engine health-based sorting (highest health score first)
- **FIX-9:** Empty results count as failures (REGRESSED in v3.5.43 — caused cascade cooldowns)
- **Files:** routes.py, database_search.py, multi_engine_search.py, waterfall_enrichment.py

### v3.5.41 — 7 Claude-Verified Fixes + 6 CodeRabbit Bug Fixes (March 17, 2026)
- **PR:** [#129](https://github.com/harryroger798/social-lead-extractor-pro/pull/129)
- LinkedIn phase timeout wiring, PAN India timeout raised, Instagram dataset limit raised, enrichment per-lead timeout raised, parallel enrichment, circuit breaker reset, waitForBackend hard abort.
- **Files:** routes.py, database_search.py, waterfall_enrichment.py, frontend

### v3.5.40 — 8 Group A Root Cause Fixes (March 17, 2026)
- **PR:** [#128](https://github.com/harryroger798/social-lead-extractor-pro/pull/128)
- Supplementary phase incremental commit, Facebook platform selector, dorking threshold + pipeline budget, DuckDB http_timeout, location filter cap, PAN India individual timeout, pipeline budget increase, SSL certificate tolerance.
- **Files:** routes.py, database_search.py, google_dorking.py

### v3.5.39 — 7 Test-Derived Fixes + 5 Analysis Recommendations (March 17, 2026)
- **PR:** [#127](https://github.com/harryroger798/social-lead-extractor-pro/pull/127)
- Per-phase S3 DuckDB timeouts, Brave Accept-Encoding, replace dead SearXNG instances, generic keyword B2B fallback, test framework threshold, engine health persistence.
- **Files:** database_search.py, multi_engine_search.py, anti_detection.py, routes.py, test_runner.py

### v3.5.38 — Per-Phase DB Search Timeouts + Bing CDN SSRF Fix (March 17, 2026)
- **PR:** [#126](https://github.com/harryroger798/social-lead-extractor-pro/pull/126)
- Per-phase timeouts restructured, dead code removal, Bing CDN SSRF allowlist.
- **Files:** database_search.py, multi_engine_search.py, anti_detection.py

### v3.5.37 — 4 Critical Pipeline Fixes for 100% Test Pass Rate (March 17, 2026)
- **PR:** [#125](https://github.com/harryroger798/social-lead-extractor-pro/pull/125)
- Parallel waterfall enrichment, SSRF allowlist for search engines, skip Render API, global pipeline budget timer.
- **Files:** waterfall_enrichment.py, anti_detection.py, database_search.py, routes.py

### v3.5.36 — 8 Ban-Free Fixes for 320-Test Plan (March 17, 2026)
- **PR:** [#124](https://github.com/harryroger798/social-lead-extractor-pro/pull/124)
- Skip Patchright, DDG Lite HTTP fallback, parallel live scraping, Reddit enrichment, adaptive scope, quality-aware dorking gate.
- **Files:** google_dorking.py, routes.py, multi_engine_search.py, live_scrapers.py

### v3.5.35 — One-Click Automated Testing Button + ZIP Bundle (March 17, 2026)
- **PR:** [#122](https://github.com/harryroger798/social-lead-extractor-pro/pull/122)
- Automated test runner with 320-test plan, full log collection, ZIP bundle, frontend "Run Tests" button.

### v3.5.34 — 5 Location-Aware Fixes + Backend-Ready Preload (March 17, 2026)
- **PR:** [#121](https://github.com/harryroger798/social-lead-extractor-pro/pull/121)
- Location confidence scoring, DDG-compatible location dorks, backend-ready preload, B2B platform relevance gating, Instagram location post-filter.

### v3.5.33 — 6 Location-Aware Filtering Fixes (March 17, 2026)
- **PR:** [#120](https://github.com/harryroger798/social-lead-extractor-pro/pull/120)
- Post-query location filter, country inference cascading, city-to-country mapping, phone prefix mapping, email TLD mapping, location-triggered supplementary search.

### v3.5.32 — Enhanced Google Dorking + Direct Scraping (March 16, 2026)
- **PR:** [#119](https://github.com/harryroger798/social-lead-extractor-pro/pull/119)
- 7-module architecture, enhanced Google Dorking with multi-template dorks, multi-engine waterfall, page content scraping, anti-detection sessions with curl_cffi.

---

## Architecture Overview (Current — v3.5.48)

### Complete Pipeline Flow

```
User Input (keyword + location + platforms)
    |
    v
+-------------------------------------------+
|  SESSION INITIALIZATION                    |
|  1. Full Engine Reset (v3.5.44 Fix 1)     |  Clear ALL engine health state
|  2. Domain Failure Cache Reset (v3.5.41)  |  Clear enrichment circuit breakers
|  3. Budget Calculation (v3.5.42)          |  Scale by platform count:
|     1p=300s, 2p=420s, 3p=540s, 4+=660s   |
|  4. LinkedIn Budget Cap (v3.5.43)         |  60% of budget for single-platform
|  5. Keyword Sanitization (v3.5.44 Fix 4)  |  T\d+-keyword-city-suffix detection
|  6. Keyword Parsing (v3.5.0)              |  Extract keyword + location + intent
|  7. PAN India Auto-Enable (v3.5.44 Fix 5) |  Indian city word-boundary matching
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 1: DATABASE SEARCH (S3/DuckDB)     |
|                                            |
|  Per-Phase Timeouts (v3.5.38):            |
|    LinkedIn:  280s (inner 150s + ghost 60s)|
|    Instagram: 150s + location filter       |
|    GMaps:     30s + country assertion      |
|    PAN India: 120s (auto-enabled v3.5.44)  |
|    YouTube:   30s                          |
|                                            |
|  Each phase commits independently          |
|  (v3.5.40 RC2 fix)                        |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 2: LOCATION FILTERING               |
|                                            |
|  Confidence Scoring (v3.5.34):            |
|    +3: Strong match (explicit country)     |
|    +2: Good match (phone prefix, TLD)      |
|    +1: Weak match (city/bio text)          |
|     0: No signal (benefit of doubt)        |
|    -1: Weak contradiction (KEEP v3.5.44)   |
|    -2: Strong contradiction (DROP)         |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 3: LIVE SCRAPING (if enabled)       |
|                                            |
|  v3.5.46: B2B platforms filtered out      |
|  (handled separately in B2B scraping)      |
|                                            |
|  v3.5.48: Double-location guard           |
|  - Word-boundary regex before appending   |
|  - Empty location passed to scrapers      |
|    when keyword already contains it       |
|                                            |
|  Parallel with asyncio.gather() (v3.5.36) |
|  curl_cffi anti-detection (no browser)     |
|  60s per-platform timeout                  |
|  Budget-aware via stage_timeout()          |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 4: GOOGLE DORKING                   |
|                                            |
|  Quality Gate (v3.5.40):                  |
|    Skip only if budget exhausted AND      |
|    >= 200 unique emails collected          |
|                                            |
|  v3.5.46 Waterfall Order:                |
|    1. Bing Free (promoted - 100% success) |
|    2. DDG Lite (promoted - 95% success)   |
|    3. SearXNG (SSRF fixed, 8 instances)   |
|    4. Brave Free (demoted - 100% HTTP 429)|
|                                            |
|  Health-score sorting (v3.5.42 FIX-9)     |
|  further adjusts order dynamically         |
|                                            |
|  Budget-based pages (v3.5.42):            |
|    <60s remaining: 1 page                  |
|    <120s remaining: 2 pages                |
|    Otherwise: full pages                   |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 5: B2B SCRAPING (v3.5.47 fixed)    |
|                                            |
|  v3.5.47: keyword + location passed       |
|  SEPARATELY (no pre-concatenation)         |
|                                            |
|  Each scraper guards against double-loc   |
|  using _query_contains_location() with    |
|  word-boundary regex (v3.5.47 Fix 6)      |
|                                            |
|  Platforms: IndiaMART, TradeIndia,         |
|    ExportersIndia, JustDial, Google Maps   |
|    B2B, Apollo, RocketReach, Crunchbase   |
|                                            |
|  Location-aware relevance gating:          |
|    Indian query -> skip Western B2B        |
|    Western query -> skip India B2B         |
|                                            |
|  IndiaMART: pagination until no new leads  |
|  50 results per keyword per platform       |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 6: ENRICHMENT                       |
|                                            |
|  Waterfall: Hunter.io > GitHub > Web Crawl |
|                                            |
|  Caps (v3.5.44 Fix 7):                   |
|    Percentage: 25% of total leads          |
|    Maximum: 150 leads                      |
|    Floor: 25 (only when missing > 0)       |
|                                            |
|  Missing = ANY field (v3.5.43 Bug 6)      |
|  Parallel ThreadPoolExecutor (v3.5.37)    |
|  Per-lead timeout: 15s (v3.5.41)          |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 7: FALLBACK (if 0 leads) (v3.5.43) |
|                                            |
|  Step 1: Force supplementary DBs          |
|  Step 2: Nuclear engine reset             |
|  Step 3: Retry dorking (1 page, 2 plats)  |
+-------------------+-----------------------+
                    |
                    v
+-------------------------------------------+
|  PHASE 8: DEDUP + SAVE + EXPORT            |
|                                            |
|  Dedup by email + phone (independent)      |
|  Quality scoring                           |
|  Country inference for each lead           |
|  Save to local SQLite                      |
|  Export: CSV, XLSX, vCard, PDF             |
+-------------------------------------------+
```

### Live Scraping Location Handling (v3.5.48)

```
routes.py _scrape_one_platform() (v3.5.48):

  for each parsed keyword:
    1. Extract: keyword = kw_parsed.keyword
                loc = kw_parsed.location or location_hint
    
    2. Check: loc_already_present = regex word-boundary test
       - Pattern: (?<!\w){re.escape(loc)}(?!\w)
       - Prevents "LA" matching inside "PLAIN"
       - Prevents "IN" matching inside "INDIA"
       - Handles "St. Louis" via re.escape()
    
    3. Build search_query:
       - If loc NOT present: search_query = f"{keyword} {loc}"
       - If loc IS present:  search_query = keyword (as-is)
    
    4. Build loc_to_pass:
       - If loc NOT present: loc_to_pass = loc (full location)
       - If loc IS present:  loc_to_pass = "" (empty)
    
    5. Call: live_scrape_platform(platform, search_query, loc_to_pass, 20)
                |
                v
    Downstream scraper receives:
      query = "Steel Manufacturers Delhi"
      location = ""  (empty, won't re-concatenate)
    
    Instead of (v3.5.47 bug):
      query = "Steel Manufacturers Delhi"
      location = "Delhi"  (would produce "Delhi Delhi")
```

### B2B Scraper Location Handling (v3.5.47 — unchanged in v3.5.48)

```
routes.py (v3.5.47):
  b2b_keyword = keyword          # keyword-only, NO location
  loc = location                 # passed separately
  b2b_scrape_platform(query=b2b_keyword, location=loc, ...)
                |
                v
  Each B2B scraper:
    1. Check: _query_contains_location(query, location)
       - Uses regex: (?<!\w){re.escape(location)}(?!\w)
       - Prevents "LA" matching inside "PLAIN"
       - Prevents "IN" matching inside "INDIA"
    2. If location NOT already in query:
       - IndiaMART:      f"{query} {location}"
       - TradeIndia:     f"{query} {location}"
       - ExportersIndia: f"{query} {location}"
       - Google Maps:    f"{query} in {location}"
    3. If location IS already in query:
       - search_term = query (no append)
```

### Search Engine Waterfall (unchanged from v3.5.46)

```
Multi-Engine Free Search Waterfall (no API keys):
  1. Bing Free (web scrape) - promoted, 100% success in Group C
  2. DuckDuckGo Lite - promoted, 95%+ success in Group C
  3. SearXNG (meta-search) - SSRF allowlist fixed, 8 live instances
  4. Brave Search (web scrape) - demoted, 100% HTTP 429 in Group C

SearXNG Instances (all in SSRF allowlist as of v3.5.46):
  1. searx.be              <- v3.5.39
  2. search.inetol.net     <- v3.5.39
  3. paulgo.io             <- v3.5.39
  4. search.ononoki.org    <- v3.5.39
  5. searx.work            <- v3.5.39
  6. search.sapti.me       <- v3.5.45 (SSRF fixed v3.5.46)
  7. searx.oxf.app         <- v3.5.45 (SSRF fixed v3.5.46)
  8. searx.namejeff.xyz    <- v3.5.45 (SSRF fixed v3.5.46)

All free methods: Zero API keys | Zero browser automation | 100% ban-free
```

---

## Break/Fix Cycle Analysis (v3.5.39 — v3.5.48)

### Regression Tracking

| Version | Total Leads | Change | Regressions | Root Cause |
|---------|------------|--------|-------------|------------|
| v3.5.39 | 970 | Baseline | None | First Group A test |
| v3.5.40 | 1,934 | +99% | None | 8 good root cause fixes |
| v3.5.41 | ~2,500 | +29% | None | 7 good fixes + CodeRabbit |
| v3.5.42 | ~1,200 | -52% | 2 zero-lead sessions | FIX-9 counted empty as failure |
| v3.5.43 | 1,194 | -0.5% | 1 near-zero session | Soft reset didn't clear hard failures |
| v3.5.44 | 3,233 | +171% | **None** | All 7 fixes verified working |
| v3.5.45 | 2,208 (Group C) | N/A | SSRF allowlist mismatch | Parser fixes worked, allowlist incomplete |
| v3.5.46 | TBD (Group C re-test) | Expected +15-25% | **None expected** | 3 targeted fixes |
| v3.5.47 | ~2,808 (Group C+D) | Verified working | **None** | B2B double-location fix confirmed |
| v3.5.48 | TBD | Expected same B2B, +10-20% live | **None expected** | Preventive live scraping guard |

### Why v3.5.48 Is Low-Risk

1. **Minimal scope:** Only 1 function modified (`_scrape_one_platform()` in routes.py). No dorking, DB, B2B, enrichment, or location filtering changes.
2. **Preventive fix:** The live scraping double-location bug was never triggered in Group C+D testing. This fix prevents it from affecting future Group A/B social platform queries.
3. **Same proven pattern:** Uses the exact same word-boundary regex approach that v3.5.47 proved working across 6 test sessions with correct single-location queries.
4. **CodeRabbit verified:** Second review pass returned "No actionable comments" after the downstream scraper fix was applied.
5. **Defense in depth:** Even without the fix, live scrapers still work — just with potentially degraded search quality from doubled locations. Fix improves quality without changing pipeline flow.

---

## Build Information

| Platform | File | B2 URL |
|----------|------|--------|
| Windows | `SnapLeads Setup 3.5.48.exe` | [Download](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.48.exe) |
| macOS | `SnapLeads-3.5.48-arm64-mac.zip` | [Download](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.48-arm64-mac.zip) |

---

## Cumulative Test Results (Groups A + B + C + D)

| Group | Version | Sessions | Total Leads | Emails | Phones | Bans |
|-------|---------|----------|-------------|--------|--------|------|
| Group A | v3.5.44 | T1-T6 | 3,233 | ~1,710 | ~2,063 | **0** |
| Group B | v3.5.44 | T7-T10 | 2,750 | 2,090 | 968 | **0** |
| Group C | v3.5.47 | T11-T14 | 2,208 | 189 | 1,002 | **0** |
| Group D | v3.5.47 | T15-T16 | ~600 | ~210 | ~250 | **0** |
| **TOTAL** | | **16 sessions** | **~8,791** | **~4,199** | **~4,283** | **0** |

**~8,791 leads extracted across 16 sessions with ZERO bans.** 100% ban-free operation confirmed.

---

## Group E Testing Plan (Next Steps)

Group E tests database-only extraction to validate the S3/DuckDB pipeline without any live scraping or B2B components:

| Session | Keyword | Platform | Location | Dorking | Live Scraping | B2B |
|---------|---------|----------|----------|---------|---------------|-----|
| T17 | Software Engineers | LinkedIn | San Francisco | OFF | OFF | OFF |
| T18 | Marketing Managers | Instagram | New York | OFF | OFF | OFF |

### What Group E Tests

- Pure database search pipeline (S3/DuckDB) without any external HTTP calls
- LinkedIn dataset search quality for professional keywords
- Instagram dataset search quality for marketing keywords
- Location filtering accuracy for US cities
- PAN India auto-enable behavior (should NOT enable for US cities)
- Enrichment pipeline for DB-sourced leads

---

## Key Architectural Decisions Log

| Decision | Version | Rationale | Status |
|----------|---------|-----------|--------|
| curl_cffi over Selenium | v3.5.36 | 2,394 Google CAPTCHAs with Patchright. curl_cffi is 100% ban-free | PERMANENT |
| Full engine reset per session | v3.5.44 | Cross-session failure accumulation caused cascade failures | PERMANENT |
| Rate-limit != failure | v3.5.44 | HTTP 429/503 are transient, not engine defects | PERMANENT |
| Health-score sorting | v3.5.42 | Dynamically promotes healthy engines, demotes broken ones | PERMANENT |
| Brave last in waterfall | v3.5.46 | 100% HTTP 429 rate limiting in Group C | UNTIL Brave improves |
| SSRF allowlist for search engines | v3.5.37 | CDN/anycast IPs cause false SSRF positives | PERMANENT |
| B2B filter from live_scrapers | v3.5.46 | B2B platforms are not social media platforms | PERMANENT |
| PAN India auto-enable | v3.5.44 | Indian city queries need PAN India data | PERMANENT |
| Enrichment caps 25%/150/25 | v3.5.44 | Balance between coverage and speed | TUNABLE |
| Location filter score > -2 | v3.5.44 | Keep leads with weak contradictions | TUNABLE |
| Separate keyword/location for B2B | v3.5.47 | Prevents double-location in B2B queries | PERMANENT |
| Token-aware location matching | v3.5.47 | Prevents false positives with short location names | PERMANENT |
| Empty location passthrough for live scrapers | v3.5.48 | Prevents downstream scrapers from re-concatenating location | PERMANENT |
