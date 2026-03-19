# SnapLeads Complete Architecture Document -- v3.5.52

**Version:** 3.5.52 (UnboundLocalError Fix -- Variable Scope Bug)
**Release Date:** March 19, 2026
**Previous Version:** 3.5.51
**Status:** HOTFIX -- 1 critical variable scoping bug fix
**PR:** [#140](https://github.com/harryroger798/social-lead-extractor-pro/pull/140)
**Devin Session:** [Session](https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a)

---

## Executive Summary

v3.5.52 is a **hotfix release** that resolves a critical UnboundLocalError introduced in v3.5.51. When users ran extractions, the app crashed with:

    Extraction failed: cannot access local variable '_run_generic_email_dork' where it is not associated with a value

### Root Cause

In v3.5.51 Fix 1, the variable `_run_generic_email_dork` was initialized in TWO places:
1. **Line ~1476 (B2B section):** `_run_generic_email_dork = False` -- inside the B2B platform filtering block
2. **Line ~1105 (Dorking section):** `if _run_generic_email_dork and not _skip_dorking:` -- used BEFORE the B2B section runs

When the dorking section (Phase 1.5) executed before the B2B section (Phase 4), Python encountered `_run_generic_email_dork` at line ~1105 before it was assigned at line ~1476 -> UnboundLocalError.

### Fix (v3.5.52)

Added proper initialization at line ~1099 (before the `if` check):

    # v3.5.52: Initialize here (was only set at line ~1470 in B2B section,
    # causing UnboundLocalError when dorking runs before B2B).
    _run_generic_email_dork = (
        config.use_google_dorking
        and any(p == "generic_email_dork" for p in config.platforms)
    )
    if _run_generic_email_dork and not _skip_dorking:
        # ... dedicated generic email dorking phase

This initialization is also MORE CORRECT than the v3.5.51 approach -- it checks both `use_google_dorking` AND whether `generic_email_dork` is in the selected platforms, rather than blindly setting True when dorking is enabled.

### What Changed (v3.5.52)

| Change | File | Description |
|--------|------|-------------|
| Fix: Variable scope | routes.py | Initialize _run_generic_email_dork before first use (line ~1099) |
| Version bump | package.json | 3.5.51 -> 3.5.52 |
| Version bump | version.ts | 3.5.51 -> 3.5.52 |

### What Did NOT Change (v3.5.51 Safe)

| Module | Status | Notes |
|--------|--------|-------|
| Database Search (S3/DuckDB) | UNTOUCHED | All DB search paths preserved |
| Generic Email Dorking Scraper | UNTOUCHED | v3.5.49 two-phase scraper preserved |
| All 9 B2B Scrapers | UNTOUCHED | All scraper logic preserved |
| Live Scraping | UNTOUCHED | v3.5.48 double-location guard preserved |
| Location Filtering | UNTOUCHED | Score > -2 threshold preserved |
| Engine Health System | UNTOUCHED | Full reset + rate-limit aware preserved |
| Anti-Detection (SSRF) | UNTOUCHED | All SearXNG instances in allowlist |
| Multi-Engine Search | UNTOUCHED | v3.5.50 parameters preserved |
| All v3.5.51 Fixes 2-5 | UNTOUCHED | Social URL filter, company URLs, adaptive cap, enrichment timeout |
| Frontend (except version) | UNTOUCHED | All UI components preserved |

---

## Build and Deployment

### Build Artifacts

| Platform | Filename | Size | B2 URL |
|----------|----------|------|--------|
| Windows | SnapLeads Setup 3.5.52.exe | 689 MB | https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.52.exe |
| macOS | SnapLeads-3.5.52-arm64-mac.zip | 292 MB | https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.52-arm64-mac.zip |

### Deployment

- **Desktop PRs:** [#140](https://github.com/harryroger798/social-lead-extractor-pro/pull/140) (code fix, merged)
- **Platform PRs:** [#127](https://github.com/harryroger798/snapleads-platform/pull/127) (download links, merged)
- **Tag:** v3.5.52 on main
- **Build:** GitHub Actions (Windows + macOS) -- both succeeded
- **Backblaze B2:** Both installers uploaded and verified (HTTP 200)
- **Live site:** getsnapleads.store auto-deploys with v3.5.52 links

---

## Complete Version History (v3.5.32 -- v3.5.52)

### v3.5.52 -- UnboundLocalError Fix (March 19, 2026)
- **PR:** [#140](https://github.com/harryroger798/social-lead-extractor-pro/pull/140)
- **Fix:** _run_generic_email_dork variable referenced before assignment when dorking runs before B2B section
- **Root Cause:** v3.5.51 Fix 1 initialized the variable in the B2B section (~line 1476) but used it in the dorking section (~line 1105) which executes first
- **Files:** routes.py (+4 lines), package.json, version.ts

### v3.5.51 -- 5 Root Cause Fixes for Maximum Yield (March 19, 2026)
- **PR:** [#139](https://github.com/harryroger798/social-lead-extractor-pro/pull/139)
- **Fix 1:** Run generic_email_dork FIRST with dedicated 60s budget (before platform dorking)
- **Fix 2:** Filter social media URLs from dorking sources before page scrape
- **Fix 3:** Extract company website URLs from DB leads for page scrape pool
- **Fix 4:** Adaptive dorking cap (180s for >3 platforms, 300s for <=3)
- **Fix 5:** Increase enrichment stage timeout from 60s to 90s
- **Root Cause:** v3.5.50 Group E+F analysis showed 0 incremental leads from full pipeline
- **Files:** routes.py (+137/-18), package.json, version.ts

### v3.5.50 -- 5 Root Cause Fixes for Maximum Yield (March 19, 2026)
- **PR:** [#138](https://github.com/harryroger798/social-lead-extractor-pro/pull/138)
- Enhanced page scraping, enrichment always runs, dorking time cap, auto-inject generic_email_dork, dedicated page scrape pass

### v3.5.49 -- Generic Email Dorking B2B Scraper (March 19, 2026)
- **PR:** [#137](https://github.com/harryroger798/social-lead-extractor-pro/pull/137)
- New scraper: scrape_generic_email_dorking() -- two-phase email extraction, SSRF 3-layer protection

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
- **Group A Results:** 3,233 leads across 6 sessions (+171% over v3.5.43)

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

### v3.5.38 -- Per-Phase DB Search Timeouts + Bing CDN SSRF Fix (March 17, 2026)
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

## Architecture Overview (Current -- v3.5.52)

### Complete Pipeline Flow

    User Input (keyword + location + platforms)
        |
        v
    SESSION INITIALIZATION
      1. Full Engine Reset (v3.5.44)
      2. Domain Failure Cache Reset (v3.5.41)
      3. Budget Calculation (v3.5.42)
      4. LinkedIn Budget Cap (v3.5.43)
      5. Keyword Sanitization (v3.5.44)
      6. Keyword Parsing
      7. PAN India Auto-Enable (v3.5.44)
        |
        v
    PHASE 1: DATABASE SEARCH (S3/DuckDB)
      190M+ leads in S3 Parquet files
      Per-phase timeouts (v3.5.38)
      LinkedIn phase timeout cap (v3.5.43)
      Location-aware scoring (v3.5.33)
      Score > -2 threshold (v3.5.44)
        |
        v
    PHASE 1.5: GENERIC EMAIL DORKING
      v3.5.51 Fix 1: Runs BEFORE platform dorking with dedicated 60s budget
      v3.5.52: Variable properly initialized before first use (was UnboundLocalError)
      Uses scrape_generic_email_dorking() from b2b_scrapers.py (v3.5.49)
        |
        v
    PHASE 2: LIVE SCRAPING
      Multi-engine free search waterfall
      Engine health system (v3.5.44 reset)
      Double-location guard (v3.5.48)
      Page content scraping (v3.5.50 Fix 1) max_urls=15, delay=1.0s
        |
        v
    PHASE 3: GOOGLE DORKING
      Platform-specific dork patterns
      Adaptive cap (v3.5.51 Fix 4): 180s for >3 platforms, 300s for <=3
      Budget-based page control (v3.5.42)
      Source URL collection for page scrape
        |
        v
    PHASE 3.5: DORKING PAGE SCRAPE
      v3.5.51 Fix 2: Social media URLs pre-filtered
      v3.5.51 Fix 3: Company website URLs from DB leads added
      scrape_page_emails(sources, 20, 1.0)
        |
        v
    PHASE 4: B2B SCRAPERS
      Priority: JustDial > IndiaMART > Google Maps B2B > Apollo > TradeIndia > ExportersIndia > RocketReach > Crunchbase
      (generic_email_dork removed from here -- now Phase 1.5)
        |
        v
    PHASE 5: WATERFALL ENRICHMENT
      v3.5.50 Fix 2: ALWAYS runs (min 45s)
      v3.5.51 Fix 5: Timeout 60s -> 90s
        |
        v
    PHASE 6: DEDUP + SAVE
      Composite key deduplication, Lead quality scoring, CSV/JSON export

---

## Testing Groups -- Cumulative Results (v3.5.32 -- v3.5.52)

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

### Group E: Database Only (v3.5.50: 2,138 leads)
- T17: Dentists in Delhi (DB-only) -> 412 leads
- T18: Plumbers in Mumbai (DB-only) -> 449 leads
- T19: Restaurants (DB-only) -> 1,277 leads

### Group F: Full Pipeline (v3.5.50: 907 leads -- v3.5.51/52 fixes targeting this)
- T20: Caterers in Delhi (All, ON/ON) -> 89 leads
- T21: Home Tutors in Mumbai (5 platforms, ON/ON) -> 503 leads
- T22: Architects (5 platforms, ON/ON) -> 315 leads

### Group G: Edge Cases (PENDING -- requires E+F pass on v3.5.52 first)
- T23: Aquarium Fish Dealers in Kolkata (Google Maps, JustDial)
- T24: Multi-keyword (Dentists in Delhi + Plumbers in Mumbai)

---

## File Reference

| File | Purpose | Key Changes in v3.5.52 |
|------|---------|----------------------|
| backend/app/api/routes.py | Pipeline orchestrator | Fix: _run_generic_email_dork initialization before first use (+4 lines) |
| frontend/src/lib/version.ts | Frontend version constant | 3.5.51 -> 3.5.52 |
| package.json | Root package version | 3.5.51 -> 3.5.52 |

---

## Break/Fix Cycle Prevention -- Lessons Learned

### v3.5.52 Pattern: Variable Scope in Long Functions
- **Problem:** _run_extraction() is ~1,280 lines with 6 pipeline phases. Variables set in Phase 4 (B2B) were used in Phase 1.5 (Dorking) which runs earlier.
- **Fix:** Initialize variables at the EARLIEST point of use, not at the logical "definition" point.
- **Lesson:** In monolithic async functions, variable initialization order matters across phases. Always initialize before the first if check, not inside a later code block.
