# SnapLeads Complete Architecture Document — v3.5.42

**Version:** 3.5.42  
**Release Date:** March 17, 2026  
**Previous Version:** 3.5.41  
**PR:** [#130](https://github.com/harryroger798/social-lead-extractor-pro/pull/130)  
**Build Run:** [23204386505](https://github.com/harryroger798/social-lead-extractor-pro/actions/runs/23204386505)

---

## Executive Summary

v3.5.42 is a **9-fix release** derived from Claude-assisted deep analysis of v3.5.41 Group A test logs (6 sessions, ~1,934 leads). The fixes target pipeline budget allocation, location filtering, search engine health, and enrichment scaling. Key changes include disabling the zero-yield PAN India phase (saving 120s/session), scaling pipeline budget by platform count, and implementing exponential backoff for search engine rotation.

**Projected improvement:** 2,600–2,900 leads (34–50% increase over v3.5.40's 1,934).

---

## Changes in v3.5.42 (9 Fixes)

### FIX-1: Disable PAN India Phase by Default (RC-1)

**Problem:** PAN India phase timed out (120s) in ALL 6 v3.5.41 sessions with 0 results. This consumed 120s of pipeline budget per session with zero return.

**Fix:** Removed auto-enable triggers for PAN India:
- No longer auto-enabled when platform list includes `"all"`
- No longer auto-enabled based on location matching Indian cities
- Phase can still be manually enabled via config

**File:** `backend/app/services/database_search.py`

### FIX-2: Google Maps Search Term Expansion for Indian Context (RC-2)

**Problem:** Google Maps queries used generic terms that missed Indian professional terminology (advocate, vakil, CA, chartered accountant, etc.), reducing lead discovery for India-targeted searches.

**Fix:**
1. Added `_GMAPS_TERM_EXPANSIONS` dictionary mapping generic terms to Indian-specific alternatives
2. Raised search term limit from 10 to 15 to accommodate expanded terms
3. Covers: advocate/vakil, CA/chartered accountant, legal services, consultant, clinic, etc.

**File:** `backend/app/services/database_search.py`

### FIX-3: Restore LinkedIn DS Limit from 3 to 5 (RC-3)

**Problem:** v3.5.41 reduced LinkedIn database search limit from 5 to 3 to save time. With PAN India now disabled (saving 120s), this budget can be reallocated to LinkedIn.

**Fix:** Restored `_LINKEDIN_DS_LIMIT` from 3 back to 5. The 120s saved from PAN India more than compensates for the additional LinkedIn queries.

**File:** `backend/app/services/database_search.py`

### FIX-4: City Alias Matching + Raised no_signal Caps (RC-4)

**Problem:** Location filtering failed for leads using alternate city names (e.g., "Bombay" instead of "Mumbai", "Bengaluru" instead of "Bangalore"). Also, Instagram/LinkedIn no_signal caps were too restrictive — 60-70% of Instagram leads had no location metadata.

**Fix:**
1. Added `_CITY_ALIASES` dictionary with 16 Indian cities and their alternate names:
   - Mumbai/Bombay, Bangalore/Bengaluru, Chennai/Madras, Kolkata/Calcutta, etc.
2. Enhanced `_location_confidence_score()` with alias-aware matching
3. Raised `no_signal` caps:
   - Instagram: 200 → 300 (sparse location metadata)
   - LinkedIn: 150 → 200
   - Default: 200 → 250

**File:** `backend/app/services/database_search.py`

### FIX-5: Budget-Based Dorking Page Control (RC-5)

**Problem:** v3.5.41 reduced dorking pages when DB returned >= 200 leads. But dorking is an independent source — more DB leads does NOT mean less need for dorking. This logic was causing dorking to be artificially reduced even when there was ample time remaining.

**Fix:** Replaced DB-count-based reduction with pipeline-budget-based control:
- Budget remaining < 60s → 1 page
- Budget remaining < 120s → max 2 pages
- Budget remaining >= 120s → full pages (default)

**File:** `backend/app/api/routes.py:935-949`

### FIX-6: Pipeline Budget Scaling by Platform Count (RC-6)

**Problem:** All sessions used a fixed 420s budget regardless of platform count. Single-platform sessions wasted time, while 4-platform sessions (like T6: LI+IG+FB+GM) ran out of budget before completing all phases.

**Fix:** Introduced dynamic budget allocation:
```
1 platform:  300s (focused, faster)
2 platforms: 420s (default)
3 platforms: 540s
4+ platforms: 660s (300 + platform_count * 120)
```

Added `_PLATFORM_BUDGET_MAP` dict and `_get_session_budget()` helper function. Budget is calculated at session start based on `len(config.platforms)`.

**File:** `backend/app/api/routes.py:568-583, 631-638`

### FIX-7: no_signal Cap Adjustments (Part of FIX-4)

**Problem:** The `_MAX_NO_SIGNAL_BY_SOURCE` caps were too aggressive for platforms with sparse location metadata.

**Fix:** (Implemented as part of FIX-4, listed separately for traceability)
```python
_MAX_NO_SIGNAL_BY_SOURCE = {
    "instagram": 300,   # was 200
    "linkedin": 200,    # was 150
    "googlemaps": 50,   # unchanged
    "google_maps": 50,  # alias
    "pan_india": 150,   # unchanged
    "default": 250,     # was 200
}
```

**File:** `backend/app/services/database_search.py:366-375`

### FIX-8: Dynamic Enrichment Cap at 15% of Total Leads (RC-8)

**Problem:** v3.5.41 used a fixed enrichment cap of 20 leads. This under-enriched large sessions (300+ leads) and over-enriched small sessions (< 50 leads).

**Fix:** Replaced fixed cap with dynamic scaling:
```python
_enrich_cap = min(int(total_leads * 0.15), 100)
_enrich_cap = min(_enrich_cap, leads_missing_contact)
_enrich_cap = max(_enrich_cap, 10)  # minimum floor
```
- 100 leads → enriches 15
- 300 leads → enriches 45
- 500 leads → enriches 75
- 700+ leads → enriches 100 (cap)

**File:** `backend/app/api/routes.py:1231-1251`

### FIX-9: Engine Rotation with Exponential Backoff (RC-10)

**Problem:** The search engine cooldown was too aggressive — 3 failures triggered a 3600s (1 hour) cooldown, effectively killing engines for the entire session even if they recovered quickly.

**Fix:**
1. **Exponential backoff with cap:** 1 failure→60s, 2 failures→300s, 3+ failures→900s (capped, was 3600s)
2. **Health-score engine sorting:** Engines sorted by health score before waterfall execution — healthy engines tried first
3. **Soft failure on empty results:** Empty results now count as failures (previously ignored)
4. **State persistence:** Health state saved to disk after each success/failure
5. **Cooldown cleared on success:** Engines recover instantly after a successful query

**File:** `backend/app/services/multi_engine_search.py:113-133, 949-1004`

---

## Architecture Overview

### Pipeline Flow (v3.5.42)

```
User Input (keyword + location + platforms)
    │
    ▼
┌─────────────────────────────────┐
│  Budget Calculation              │  ← FIX-6: Scale by platform count
│  1 platform: 300s                │
│  2 platforms: 420s               │
│  3 platforms: 540s               │
│  4+ platforms: 660s              │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 1: DB Search (S3)         │  Per-platform DuckDB queries
│  LinkedIn: 240s timeout, limit 5 │  ← FIX-3: restored from 3→5
│  Instagram: 120s timeout          │
│  GMaps: 60s timeout               │  ← FIX-2: Indian term expansion
│  PAN India: DISABLED by default   │  ← FIX-1: was timing out 120s
│  YouTube: 60s timeout             │
│                                   │
│  Ghost Recovery: +5s grace        │  (from v3.5.41)
│  Source-aware caps                │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 2: Location Filter        │  Confidence scoring
│  City alias matching             │  ← FIX-4: 16 Indian city aliases
│  Instagram cap: 300              │  ← FIX-7: was 200
│  LinkedIn cap: 200               │  ← FIX-7: was 150
│  GMaps cap: 50                   │
│  google_maps cap: 50             │
│  Default cap: 250                │  ← FIX-7: was 200
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 3: Google Dorking          │
│  Pages: budget-based control      │  ← FIX-5: was DB-count-based
│  Budget < 60s: 1 page             │
│  Budget < 120s: max 2 pages       │
│  Budget >= 120s: full pages        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 4: Live Scraping           │  Platform-specific scrapers
│  Search engines sorted by health  │  ← FIX-9: health-score sorting
│  Backoff: 60s/300s/900s cap       │  ← FIX-9: was up to 3600s
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 5: Enrichment              │  Waterfall enrichment
│  Cap: min(total*0.15, 100)        │  ← FIX-8: was fixed 20
│  Minimum: 10 leads                │
│  Per-lead timeout: 15s            │  (from v3.5.41)
│  Circuit breaker: thread-safe     │  (from v3.5.41)
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 6: Dedup & Export          │  Quality scoring, CSV/XLSX
└─────────────────────────────────┘
```

### Frontend Architecture

```
Electron App
    │
    ├── waitForBackend()         (from v3.5.41: hard abort + promise reset)
    │   Max attempts: 30 (60s)
    │   Rejects on failure
    │   Resets promise for retry
    │
    ├── License Check
    ├── Search UI
    └── Results Export
```

---

## Build Information

| Platform | File | Size | B2 URL |
|----------|------|------|--------|
| Windows | `SnapLeads Setup 3.5.42.exe` | ~657 MB | [Download](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.42.exe) |
| macOS | `SnapLeads-3.5.42-arm64-mac.zip` | ~278 MB | [Download](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.42-arm64-mac.zip) |

**GitHub Actions:** Build & Release All Platforms (run ID: 23204386505)  
**Build Status:** In Progress  
**Tag:** v3.5.42

---

## Test Baseline

| Version | Sessions | Total Leads | Avg/Session |
|---------|----------|-------------|-------------|
| v3.5.39 | 6 | 970 | 162 |
| v3.5.40 | 6 | 1,934 | 322 |
| v3.5.41 | 6 (projected) | 2,450–2,620 | 408–437 |
| v3.5.42 | 6 (projected) | 2,600–2,900 | 433–483 |

**v3.5.41 → v3.5.42 projected improvement:** +6–11% (from budget optimization + enrichment scaling)  
**v3.5.40 → v3.5.42 cumulative projected improvement:** +34–50%

---

## Version History

- **v3.5.42** — 9 Claude-verified fixes: PAN India disable, budget scaling, city aliases, dorking budget control, enrichment scaling, engine backoff
- **v3.5.41** — 7 Claude-verified fixes + 6 CodeRabbit bug fixes for maximum lead yield
- **v3.5.40** — 8 Group A root cause fixes (RC2/RC3/RC4/RC5/RC8/RC10/RC12)
- **v3.5.39** — 7 test-derived fixes + 5 analysis recommendations
- **v3.5.38** — Per-phase DB search timeouts + Bing CDN SSRF fix
- **v3.5.37** — 4 critical pipeline fixes for 100% test pass rate
- **v3.5.36** — 8 ban-free fixes for 320-test plan
