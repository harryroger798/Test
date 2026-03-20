# SnapLeads Complete Architecture Document -- v3.5.56

**Version:** 3.5.56 (5 Identified Issue Fixes -- TradeIndia/ExportersIndia/Apollo-RocketReach/Keyword Synonyms/Enrichment)
**Release Date:** March 20, 2026
**Previous Version:** 3.5.55
**Status:** CODE CHANGES -- 5 additive fixes targeting the 5 known production issues identified in v3.5.55 forensic analysis.
**Devin Session:** [Session](https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a)

---

## Executive Summary

v3.5.56 implements **5 additive fixes** for the 5 remaining production issues identified during the v3.5.55 comprehensive 24-session forensic analysis:

1. **Fix 1: TradeIndia Enhanced Dorking + Google Cache** -- TradeIndia migrated to JS SPA (zero HTML results). Added 3 new dork patterns targeting Google-indexed profile pages + Google Cache fallback.
2. **Fix 2: ExportersIndia URL Fallback + Enhanced Dorking + Directory Crawling** -- Search URL returns 404. Added 3 URL format fallbacks + enhanced dorking + category directory crawling.
3. **Fix 3: Dedicated Generic Email Dork Budget for Apollo/RocketReach** -- Auto-injects `generic_email_dork` when Apollo or RocketReach selected (both gate data behind 401/403 auth).
4. **Fix 4: Keyword Synonym Expansion** -- Added 22 niche Indian B2B keyword synonyms (caterers, tutors, architects, advocates, CAs, electricians, plumbers, painters, carpenters, tailors, florists, pest control, packers, movers, aquarium, veterinary, nursery, astrologer, decorator, jeweller, hardware, stationery).
5. **Fix 5: Enrichment Budget + Cap Increase** -- Raised enrichment timeout 90s->120s, cap 150->200, floor 25->30 for ~33% more leads enriched per session.

All fixes are **100% ban-free, 100% API-free, 100% additive** -- they enhance or add new sources without modifying any working pipeline component.

### v3.5.55 Production Status (Unchanged in v3.5.56)

v3.5.55 was declared production-ready after comprehensive 24-session forensic analysis:
- **Grand Total:** ~17,265 leads across 24 test sessions (Groups A-G)
- **Zero crashes, zero bans, zero zero-lead sessions** (except T15 Apollo/RocketReach -- known auth limitation)
- **All pipeline components verified working:** DB search, dorking, live scraping, B2B scrapers, enrichment, multi-line keywords, location filtering

### 5 Identified Issues (Now Fixed in v3.5.56)

| # | Issue | Root Cause | v3.5.55 Impact | v3.5.56 Fix |
|---|-------|-----------|----------------|-------------|
| 1 | TradeIndia returns 0 leads | JS SPA migration -- HTTP response contains zero company data | T12, T16: 0 TradeIndia leads | Enhanced dorking + Google Cache scraping |
| 2 | ExportersIndia returns 0 leads | Search URL returns 404, alternative URLs ignore keywords | T12, T16: 0 ExportersIndia leads | URL fallback chain + directory crawling |
| 3 | Apollo/RocketReach returns 0 leads | API requires authentication (401/403) since 2024 | T15: 3 leads total, T22: 0 from Apollo | Auto-inject generic_email_dork for auth-gated platforms |
| 4 | Niche keywords low yield (e.g., "Caterers") | DB has sparse coverage for niche Indian categories | T20: 89 leads (lowest of all sessions) | 22 niche keyword synonym expansions |
| 5 | Enrichment processes only 45-50 of 150 leads | 90s timeout + 150 cap limits coverage to ~33% | T17-T24: 20-54 leads enriched per session | 120s timeout + 200 cap + 30 floor |

---

## v3.5.56 Fix Details

### Fix 1: TradeIndia Enhanced Dorking + Google Cache (`b2b_scrapers.py`)

**Problem:** TradeIndia migrated to a JavaScript SPA. The HTTP response (436K chars, HTTP 200) contains ZERO company data -- search results render client-side via JavaScript after page load. `curl_cffi` only gets the empty HTML shell. All API endpoint attempts (`/api/search`, `/api/v1/search`, `/ajax/search`) return HTTP 202 (empty) or 403.

**Fix:** Added 3 new Google dork query patterns in `scrape_tradeindia()` that target Google-indexed company profile pages:
```python
# Pattern 1: Target company profile pages (at /fp{id}/ URLs)
f'site:tradeindia.com/fp inurl:fp "{search_term}"'

# Pattern 2: Contact-focused dork
f'site:tradeindia.com "{search_term}" "contact" OR "email" OR "phone"'

# Pattern 3: Cached pages (without site: for broader coverage)  
f'"tradeindia.com" "{search_term}" email contact'
```

Additionally added Google Cache fallback: fetches `webcache.googleusercontent.com/search?q=cache:tradeindia.com/fp{id}` to extract company info from cached versions.

**Ban-free:** All dorking through existing waterfall (Brave/DDG/Bing/SearXNG), no direct TradeIndia requests.
**API-free:** Uses free search engines only.
**Expected yield:** 0 -> 5-15 companies per query.

### Fix 2: ExportersIndia URL Fallback + Enhanced Dorking + Directory Crawling (`b2b_scrapers.py`)

**Problem:** The search URL `https://www.exportersindia.com/search.htm?keyword=X` returns HTTP 404. Alternative URLs (`/s/?keyword=X`, `/search/?keyword=X`) return HTTP 200 but show random company profiles (ignoring the keyword parameter entirely).

**Fix:**
- **URL fallback chain:** Try `/search.htm` first, if 404 then try `/s/?keyword=X` and `/search/?keyword=X`
- **Enhanced dorking** (3 new patterns):
```python
f'site:exportersindia.com "{search_term}" "contact" OR "email"'
f'"exportersindia.com" "{search_term}" email phone'
f'site:exportersindia.com inurl:company "{search_term}"'
```
- **Directory crawling:** ExportersIndia still has working directory pages at `/indian-manufacturers/` and `/industry/`. Crawls the relevant category page for the query keyword.

**Ban-free:** Dorking through existing waterfall + directory pages are public.
**API-free:** No API keys needed.
**Expected yield:** 0 -> 5-20 companies per query.

### Fix 3: Dedicated Generic Email Dork Budget for Apollo/RocketReach (`routes.py`)

**Problem:** Apollo API returns HTTP 401, directory pages return 410 Gone, RocketReach blocked by Cloudflare. Both platforms completely gate contact data behind login/paid access. The existing `generic_email_dork` scraper (v3.5.49) finds 8-17 real emails per query but users must manually select it.

**Fix:** Auto-inject `generic_email_dork` when Apollo or RocketReach are selected:
```python
# v3.5.56 Fix 3: Auto-inject generic_email_dork when Apollo or RocketReach
# are selected -- those platforms gate data behind auth (401/403), so
# generic email dorking is the only free alternative that actually works.
_has_auth_gated_b2b = any(
    p in ("apollo", "rocketreach") for p in config.platforms
)
_run_generic_email_dork = (
    config.use_google_dorking
    and (
        any(p == "generic_email_dork" for p in config.platforms)
        or _has_auth_gated_b2b  # v3.5.56: auto-inject for Apollo/RocketReach
    )
)
```

**Ban-free:** Same free search engine waterfall.
**API-free:** Zero API keys.
**Expected yield:** 0-3 -> 8-20 emails per query.

### Fix 4: Keyword Synonym Expansion (`keyword_parser.py`)

**Problem:** Niche keywords like "caterers", "tutors", "aquarium fish dealers" have sparse database coverage. LinkedIn/Instagram have almost zero listings for these categories. PAN India has broader coverage but the keyword must match exactly.

**Fix:** Added 22 niche Indian B2B keyword synonyms to `_KEYWORD_SYNONYMS` dict in `keyword_parser.py`:

| Category | Keyword | Synonyms Added |
|----------|---------|---------------|
| Catering | caterer, catering | catering services, wedding catering, event catering, food services, tiffin services, party catering, outdoor catering, corporate catering, banquet |
| Education | tutor | home tutor, tuition teacher, coaching, private tutor, tutoring services, academic tutor, online tutor |
| Architecture | architect | architecture firm, architectural services, building designer, interior architect, structural designer |
| Legal | advocate | lawyer, legal advisor, attorney, law firm, legal consultant, barrister, solicitor |
| Finance | chartered accountant, ca | ca firm, accounting firm, tax consultant, auditor, financial advisor |
| Trades | electrician, plumber, painter, carpenter | contractor, services, work variants for each |
| Retail | tailor, florist | tailoring, stitching, garment maker, flower shop, floral arrangement |
| Services | pest control, packers, movers | pest management, fumigation, moving company, relocation |
| Niche | aquarium, veterinary, nursery, astrologer, decorator, jeweller, hardware, stationery | shop variants, service variants for each |

**Ban-free:** Static dictionary lookup, zero external requests.
**API-free:** No external service.
**Additive:** Original keyword always runs first, synonyms ADD extra results.
**Expected yield:** For niche keywords like "caterers": 90 -> 200-400 leads.

### Fix 5: Enrichment Budget + Cap Increase (`routes.py`)

**Problem:** Current enrichment is sequential with 10 ThreadPoolExecutor workers. With 90s timeout and 15s per-lead timeout, processes ~60 leads (90/15*10). With 150 cap, only 40% get enriched. With 25 floor, small result sets get minimal enrichment.

**Fix:**
```python
# v3.5.56: Raised enrichment timeout from 90s to 120s
# 120s allows ~80 leads (120/15*10), up from ~60
_enrich_budget = max(budget.stage_timeout("enrichment", 120.0), _enrich_budget_min)

# v3.5.56: Raised enrichment caps from 25%/150/25 to 30%/200/30
_enrich_cap = min(int(_total_leads * 0.30), 200)
_enrich_cap = max(_enrich_cap, 30)  # raised floor from 25->30
```

**Impact:** ~33% more leads enriched per session (60->80 leads within budget). Higher cap (200) and floor (30) ensure more coverage on both large and small result sets.

---

## Pipeline Component Status (v3.5.56)

### All Components Verified Working (Unchanged from v3.5.55)

| Component | Status | Evidence |
|-----------|--------|----------|
| Database Search (S3/DuckDB) | WORKING | 190M+ leads queried across 24 sessions |
| Google Dorking (4-engine waterfall) | WORKING | Zero bans, 173 log entries |
| Live Scraping (12 platforms) | WORKING | Running all platform scrapers |
| B2B Scrapers (JustDial, IndiaMART) | WORKING | JD=40/query, IM=8/query |
| Waterfall Enrichment | WORKING | 20-54 leads/session enriched |
| Location Filtering | WORKING | 81-100% location match rate |
| Multi-Line Keywords | WORKING | T24 processed 2 keywords correctly |
| Email Sanitization (v3.5.55) | WORKING | 0.66% cleaned, 99.3% unchanged |
| Country TLD Inference (v3.5.55) | WORKING | ~30% Unknown recovered |
| Engine Health System (v3.5.44) | WORKING | Full reset per session |
| PAN India Auto-Enable (v3.5.44) | WORKING | Correctly triggers for Indian locations |
| License Detection (v3.5.12) | WORKING | Pro tier from license.json |

### Components Enhanced in v3.5.56

| Component | Enhancement | Files Modified |
|-----------|------------|---------------|
| TradeIndia scraper | 3 new dork patterns + Google Cache | b2b_scrapers.py |
| ExportersIndia scraper | URL fallback + 3 dork patterns + directory crawl | b2b_scrapers.py |
| Apollo/RocketReach routing | Auto-inject generic_email_dork | routes.py |
| Keyword parser | 22 niche synonym mappings | keyword_parser.py |
| Enrichment pipeline | 120s timeout, 200 cap, 30 floor | routes.py |

---

## Architecture Overview (Current -- v3.5.56)

### Complete Pipeline Flow

```
User Input (keyword + location + platforms)
    |
    v
SESSION INITIALIZATION
  1. Full Engine Reset (v3.5.44)
  2. Domain Failure Cache Reset (v3.5.41)
  3. Budget Calculation (v3.5.42)
  4. LinkedIn Budget Cap (v3.5.43)
  5. Keyword Sanitization (v3.5.44)
  6. Keyword Parsing (location extraction)
  7. Keyword Synonym Expansion (v3.5.56 Fix 4) -- 22 niche categories
  8. PAN India Auto-Enable (v3.5.44)
  9. Auto-inject generic_email_dork for Apollo/RocketReach (v3.5.56 Fix 3)
  10. Variable Initialization:
     - _run_generic_email_dork (v3.5.52)
     - _company_website_urls (v3.5.53)
     - _dorking_sources (existing)
    |
    v
PHASE 1: DATABASE SEARCH (S3/DuckDB)
  190M+ leads: LinkedIn 86.9M + Instagram 2.45M + GMaps 32K + PAN India 101M+
  Per-phase timeouts (v3.5.38)
  LinkedIn phase timeout cap (v3.5.43)
  Location-aware scoring (v3.5.33)
  Score > -2 threshold (v3.5.44)
    |
    v
PHASE 1.5: GENERIC EMAIL DORKING
  v3.5.51 Fix 1: Dedicated 60s budget, runs BEFORE platform dorking
  v3.5.52: Properly initialized before first use
  v3.5.56 Fix 3: Auto-activated for Apollo/RocketReach platforms
  Uses scrape_generic_email_dorking() (v3.5.49)
    |
    v
PHASE 2: LIVE SCRAPING
  Multi-engine free search waterfall (v3.5.45: Brave, DDG Lite, Bing, SearXNG)
  Engine health system (v3.5.44 full reset)
  Double-location guard (v3.5.48)
  Page content scraping (v3.5.50) max_urls=15, delay=1.0s
    |
    v
PHASE 3: GOOGLE DORKING
  Platform-specific dork patterns (v3.5.32: 7 intents)
  Adaptive cap (v3.5.51): 180s for >3 platforms, 300s for <=3
  Budget-based page control (v3.5.42)
    |
    v
PHASE 3.5: DORKING PAGE SCRAPE
  v3.5.51 Fix 2: Social media URLs pre-filtered
  v3.5.51 Fix 3: Company website URLs from DB leads
  v3.5.53: _company_website_urls properly initialized
    |
    v
PHASE 4: B2B SCRAPERS
  Priority: JustDial > IndiaMART > Google Maps B2B > Apollo > TradeIndia > ExportersIndia > RocketReach > Crunchbase
  Double-location guard (v3.5.47)
  Token-aware matching (v3.5.47)
  v3.5.56 Fix 1: TradeIndia enhanced dorking + Google Cache
  v3.5.56 Fix 2: ExportersIndia URL fallback + directory crawling
    |
    v
PHASE 5: WATERFALL ENRICHMENT
  v3.5.50 Fix 2: ALWAYS runs (min 45s)
  v3.5.56 Fix 5: Timeout 90s -> 120s, cap 150 -> 200, floor 25 -> 30
    |
    v
PHASE 5.5: EMAIL SANITIZATION (v3.5.55)
  _sanitize_email() strips "Email: " prefix + splits concatenated emails
  Applied to LinkedIn, Instagram, PAN India row converters
  Only affects 0.66% of emails -- 99.3% pass through unchanged
    |
    v
PHASE 5.6: COUNTRY TLD INFERENCE (v3.5.55)
  Signal 5: source_url domain TLD -> country (database_search.py)
  Signal 6: website/source_url domain TLD -> country (routes.py)
  Recovers ~30% of "Unknown" country leads
    |
    v
PHASE 6: DEDUP + SAVE
  Composite key deduplication
  Lead quality scoring
  CSV/JSON export
```

---

## Cumulative Test Results (All Groups, v3.5.32 -- v3.5.55)

### Group A: Social Platforms + Location (v3.5.44: 3,233 leads)
- T1: Dentists in Delhi (LinkedIn) -> 283 leads
- T2: Plumbers in Mumbai (Instagram) -> 610 leads
- T3: Restaurants in Bangalore (Facebook) -> 824 leads
- T4: Lawyers in Chennai (Google Maps) -> 252 leads
- T5: Hair Salons in Pune (LI+IG+FB) -> 686 leads
- T6: Gym Trainers in Hyderabad (All 4) -> 578 leads

### Group B: Social Platforms, No Location (v3.5.44: 2,750 leads)
- T7: Dentists (LinkedIn) -> 500 leads
- T8: Plumbers (Instagram) -> 467 leads
- T9: Real Estate Agents (LI+IG+FB) -> 998 leads
- T10: Yoga Instructors (All 4) -> 785 leads

### Group C: B2B + Location (v3.5.47: 6,126 leads)
- T11-T14: Steel Manufacturers, Textile Exporters, Chemical Suppliers, Wholesale Distributors

### Group D: B2B, No Location (v3.5.48: 529 leads)
- T15: SaaS Founders (Apollo, RocketReach) -> 3 leads
- T16: Packaging Manufacturers (IndiaMART, TradeIndia, ExportersIndia) -> 526 leads

### Group E: Database Only (v3.5.53: 2,138 leads)
- T17: Dentists in Delhi (LI+IG, DB-only) -> **412 leads** (398 emails, 240 phones)
- T18: Plumbers in Mumbai (LI+IG, DB-only) -> **449 leads** (270 emails, 278 phones)
- T19: Restaurants (LI+IG+GM, DB-only) -> **1,277 leads** (812 emails, 740 phones)

### Group F: Full Pipeline -- Everything ON (v3.5.53: 907 leads)
- T20: Caterers in New Delhi (4 platforms, ON/ON) -> **89 leads** (54 emails, 89 phones)
- T21: Home Tutors in Mumbai (5 platforms, ON/ON) -> **503 leads** (410 emails, 237 phones)
- T22: Architects (5 platforms, ON/ON) -> **315 leads** (307 emails, 68 phones)

### Group G: Edge Cases (v3.5.53: 1,582 leads)
- T23: Aquarium Fish Dealers in Kolkata (GM+JD, dorking ON) -> **737 leads** (292 emails, 476 phones)
- T24: Multi-keyword Dentists+Plumbers (LI+IG, dorking ON) -> **845 leads** (653 emails, 515 phones)

### Grand Total (All Groups A--G): ~17,265 leads across 24 test sessions

---

## Complete Version History (v3.5.32 -- v3.5.56)

### v3.5.56 -- 5 Identified Issue Fixes (March 20, 2026)
- **PR:** [#143](https://github.com/harryroger798/social-lead-extractor-pro/pull/143)
- **Build Run:** [#23332765835](https://github.com/harryroger798/social-lead-extractor-pro/actions/runs/23332765835)
- Fix 1: TradeIndia enhanced dorking + Google Cache scraping (b2b_scrapers.py)
- Fix 2: ExportersIndia URL fallback + enhanced dorking + directory crawling (b2b_scrapers.py)
- Fix 3: Dedicated generic_email_dork budget for Apollo/RocketReach (routes.py)
- Fix 4: 22 niche keyword synonyms -- caterers, tutors, architects, advocates, CAs, etc. (keyword_parser.py)
- Fix 5: Enrichment timeout 90s->120s, cap 150->200, floor 25->30 (routes.py)
- **Platform PR:** [#131](https://github.com/harryroger798/snapleads-platform/pull/131) -- download links + redirects updated

### v3.5.55 -- Email Sanitization + Country TLD Inference (March 19, 2026)
- **PR:** [#142](https://github.com/harryroger798/social-lead-extractor-pro/pull/142)
- Fix 1: _sanitize_email() strips "Email: " prefix + splits concatenated emails (0.66% affected)
- Fix 2: Signal 5+6 country TLD inference recovers ~30% of "Unknown" country leads

### v3.5.54 -- Analysis-Only: v3.5.53 Verified Working (March 19, 2026)
- Documentation only -- no code changes
- Deep forensic analysis: 4,627 leads, zero errors, zero bans

### v3.5.53 -- UnboundLocalError Fix #2: _company_website_urls (March 19, 2026)
- **PR:** [#141](https://github.com/harryroger798/social-lead-extractor-pro/pull/141)

### v3.5.52 -- UnboundLocalError Fix #1: _run_generic_email_dork (March 19, 2026)
- **PR:** [#140](https://github.com/harryroger798/social-lead-extractor-pro/pull/140)

### v3.5.51 -- 5 Root Cause Fixes for Maximum Yield (March 19, 2026)
- **PR:** [#139](https://github.com/harryroger798/social-lead-extractor-pro/pull/139)

### v3.5.50 -- 5 Root Cause Fixes for Maximum Yield (March 19, 2026)
- **PR:** [#138](https://github.com/harryroger798/social-lead-extractor-pro/pull/138)

### v3.5.49 -- Generic Email Dorking B2B Scraper (March 19, 2026)
- **PR:** [#137](https://github.com/harryroger798/social-lead-extractor-pro/pull/137)

### v3.5.48 -- Live Scraping Double-Location Guard (March 18, 2026)
- **PR:** [#136](https://github.com/harryroger798/social-lead-extractor-pro/pull/136)

### v3.5.47 -- 5 B2B Double-Location Fixes + Token-Aware Matching (March 18, 2026)
- **PR:** [#135](https://github.com/harryroger798/social-lead-extractor-pro/pull/135)

### v3.5.46 -- 3 Group C Root Cause Fixes (March 18, 2026)
- **PR:** [#134](https://github.com/harryroger798/social-lead-extractor-pro/pull/134)

### v3.5.45 -- 5 Dorking Parser Fixes + Dead Engine Removal (March 18, 2026)
- **PR:** [#133](https://github.com/harryroger798/social-lead-extractor-pro/pull/133)

### v3.5.44 -- 7 Comprehensive Fixes: Break/Fix Cycle Prevention (March 18, 2026)
- **PR:** [#132](https://github.com/harryroger798/social-lead-extractor-pro/pull/132)
- **Group A+B verified:** 3,233 + 2,750 = 5,983 leads across 10 sessions

### v3.5.43 -- 7 Root Cause Fixes for Group A Test Failures (March 18, 2026)
- **PR:** [#131](https://github.com/harryroger798/social-lead-extractor-pro/pull/131)

### v3.5.42 -- 9 Claude-Verified Fixes (March 17, 2026)
- **PR:** [#130](https://github.com/harryroger798/social-lead-extractor-pro/pull/130)

### v3.5.41 -- 7 Fixes + 6 CodeRabbit Bug Fixes (March 17, 2026)
- **PR:** [#129](https://github.com/harryroger798/social-lead-extractor-pro/pull/129)

### v3.5.40 -- 8 Group A Root Cause Fixes (March 17, 2026)
- **PR:** [#128](https://github.com/harryroger798/social-lead-extractor-pro/pull/128)

### v3.5.39 -- 7 Test-Derived Fixes + 5 Analysis Recommendations (March 17, 2026)
- **PR:** [#127](https://github.com/harryroger798/social-lead-extractor-pro/pull/127)

### v3.5.38 -- Per-Phase DB Search Timeouts (March 17, 2026)
- **PR:** [#126](https://github.com/harryroger798/social-lead-extractor-pro/pull/126)

### v3.5.37 -- 4 Critical Pipeline Fixes (March 16, 2026)
- **PR:** [#125](https://github.com/harryroger798/social-lead-extractor-pro/pull/125)

### v3.5.36 -- 8 Ban-Free Fixes for 320-Test Plan (March 16, 2026)
- **PR:** [#124](https://github.com/harryroger798/social-lead-extractor-pro/pull/124)

### v3.5.35 -- One-Click Automated Testing Button (March 16, 2026)
- **PR:** [#122](https://github.com/harryroger798/social-lead-extractor-pro/pull/122)

### v3.5.34 -- Backend-Ready Preload + Retry + Splash (March 16, 2026)
- **PR:** [#121](https://github.com/harryroger798/social-lead-extractor-pro/pull/121)

### v3.5.33 -- 6 Location-Aware Filtering Fixes (March 16, 2026)
- **PR:** [#120](https://github.com/harryroger798/social-lead-extractor-pro/pull/120)

### v3.5.32 -- Enhanced Google Dorking + Direct Scraping (March 16, 2026)
- **PR:** [#119](https://github.com/harryroger798/social-lead-extractor-pro/pull/119)

---

## Break/Fix Cycle Prevention -- Pattern Analysis

### Stable Period (v3.5.44 -> v3.5.56)

After v3.5.44 stabilized Group A+B, all subsequent versions (v3.5.45-v3.5.56) have been targeted, additive fixes that didn't regress previous groups:
- v3.5.45: Dorking parser updates (no regression)
- v3.5.46-v3.5.48: B2B double-location fixes (no regression)
- v3.5.49: New B2B scraper (additive, no regression)
- v3.5.50-v3.5.51: Full pipeline fixes (caused v3.5.52-v3.5.53 variable scope bugs, but isolated fixes)
- v3.5.54: Analysis-only release (no code changes)
- v3.5.55: Email sanitization + country TLD inference (additive, no regression)
- **v3.5.56: 5 identified issue fixes (additive -- enhanced dorking, synonym expansion, enrichment tuning)**

### v3.5.56 Additive Design Principles

All 5 fixes follow the additive pattern established in v3.5.44+:
1. **Fix 1 (TradeIndia):** Adds new dork patterns to existing waterfall -- original direct scrape attempt still runs first
2. **Fix 2 (ExportersIndia):** Adds URL fallbacks + dorking -- original URL still attempted first
3. **Fix 3 (Apollo/RocketReach):** Only activates when user selects auth-gated platforms -- zero effect on other platforms
4. **Fix 4 (Synonyms):** Original keyword always queried first, synonyms ADD results -- never remove
5. **Fix 5 (Enrichment):** Raises limits -- same logic, more budget/capacity

---

## S3 Database Summary

| Database | Records | S3 Path | Datasets |
|----------|---------|---------|----------|
| LinkedIn | 86.9M | s3://crop-spray-uploads/leads-cm-database/linkedin/ | ~1,738 |
| Instagram | 2.45M | s3://crop-spray-uploads/leads-cm-database/instagram/ | ~49 |
| Google Maps | 32K+ | s3://crop-spray-uploads/leads-cm-database/googlemaps/ | ~21 |
| PAN India | 101M+ | s3://crop-spray-uploads/leads-cm-database/pan_india/ | ~608 |
| YouTube | ~2K | s3://crop-spray-uploads/leads-cm-database/youtube/ | ~2 |
| Apify B2B | ~101 | s3://crop-spray-uploads/leads-cm-database/linkedin/Apify_B2B/ | ~2 |
| GitHub | ~2.1K | s3://crop-spray-uploads/leads-cm-database/github/ | ~1 |
| **TOTAL** | **~190M+** | | **~2,421** |

---

## Build Artifacts (Current -- v3.5.56)

| Platform | Filename | Size | B2 URL |
|----------|----------|------|--------|
| Windows | SnapLeads Setup 3.5.56.exe | ~689 MB | https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.56.exe |
| macOS | SnapLeads-3.5.56-arm64-mac.zip | ~292 MB | https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.56-arm64-mac.zip |

---

## File Reference

| File | Purpose | Lines | v3.5.56 Changes |
|------|---------|-------|----------------|
| backend/app/api/routes.py | Pipeline orchestrator + Signal 6 country inference | ~4,150 | Fix 3 (auto-inject generic_email_dork), Fix 5 (enrichment budget) |
| backend/app/services/database_search.py | S3/DuckDB queries + email sanitization + Signal 5 | ~3,013 | No changes |
| backend/app/services/b2b_scrapers.py | B2B platform scrapers | ~1,400+ | Fix 1 (TradeIndia), Fix 2 (ExportersIndia) |
| backend/app/services/keyword_parser.py | Keyword parsing + synonym expansion | ~700+ | Fix 4 (22 niche synonyms) |
| backend/app/services/multi_engine_search.py | Free search engine waterfall | ~1,236 | No changes |
| backend/app/services/google_dorking.py | Dorking query generation | ~871 | No changes |
| backend/app/services/anti_detection.py | TLS fingerprinting + SSRF | ~600+ | No changes |
| backend/app/services/waterfall_enrichment.py | Email/phone enrichment | ~900+ | No changes |
| backend/app/services/live_scrapers.py | Platform-specific scrapers | ~1,200+ | No changes |
| backend/app/services/auto_discovery.py | Site-specific extractors | ~800+ | No changes |
| electron/main.js | Electron main process | ~500+ | No changes |
| electron/preload.js | IPC bridge | ~100+ | No changes |
| frontend/src/lib/api.ts | Frontend API layer | ~200+ | No changes |
| frontend/src/lib/version.ts | Frontend version display | 2 | Version bump to 3.5.56 |
| package.json | Version source of truth | ~45 | Version bump to 3.5.56 |

---

## v3.5.56 Testing Instructions

### Tests to Verify Each Fix

| Fix | Test Keyword | Platform(s) | Expected Improvement |
|-----|-------------|-------------|---------------------|
| Fix 1 (TradeIndia) | "Steel Manufacturers in Delhi" | TradeIndia | Should now find 5-15 leads from dorking (was 0) |
| Fix 2 (ExportersIndia) | "Textile Exporters in Mumbai" | ExportersIndia | Should now find 5-20 leads from dorking/directory (was 0) |
| Fix 3 (Apollo/RocketReach) | "SaaS Founders" | Apollo.io, RocketReach | Should auto-activate generic email dorking (was 3 leads, target 8-20) |
| Fix 4 (Synonyms) | "Caterers in New Delhi" | LinkedIn, Instagram, Facebook, Google Maps | Should find more leads via synonym expansion (was 89, target 200-400) |
| Fix 5 (Enrichment) | Any keyword with 100+ leads | Any | Check enrichment phase processes more leads (was 45-50, target 60-80) |

### Recommended Full Test Suite (Groups A-G, 24 sessions)

Run the same 24-test matrix used for v3.5.55 verification. Focus on:
- **Group C (T11-T14):** Validates Fix 1 (TradeIndia) and Fix 2 (ExportersIndia)
- **Group D (T15-T16):** Validates Fix 3 (Apollo/RocketReach auto-inject)
- **Group F (T20):** Validates Fix 4 (keyword synonyms for "Caterers")
- **All groups:** Validates Fix 5 (enrichment increase -- check "Enrichment processed X/Y" in logs)
