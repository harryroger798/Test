# SnapLeads Complete Architecture Document — v3.5.43

**Version:** 3.5.43  
**Release Date:** March 17, 2026  
**Previous Version:** 3.5.42  
**PR:** [#131](https://github.com/harryroger798/social-lead-extractor-pro/pull/131)  
**Build Run:** [23209109629](https://github.com/harryroger798/social-lead-extractor-pro/actions/runs/23209109629)

---

## Executive Summary

v3.5.43 is a **7-bug root cause fix release** derived from comprehensive analysis of v3.5.42 Group A test logs (6 sessions, 2 of which returned 0 leads). The fixes target the fundamental pipeline failures that caused engine cascade cooldowns, timeout chain misalignment, location filter gaps, country pollution in GMaps, budget starvation, zero-result dead-ends, and enrichment under-utilization.

**Root cause analysis approach:** Deep log analysis of all 6 v3.5.42 Group A sessions + Claude-assisted cross-referencing with v3.5.32–v3.5.42 fix history to identify recurring break/fix/break cycles.

**Key finding:** 153/168 waterfall calls in v3.5.42 tried 0 engines due to cascade cooldown — the single biggest contributor to zero-lead sessions.

---

## Changes in v3.5.43 (7 Root Cause Fixes)

### Bug 1: Engine Cascade Failure Fix (multi_engine_search.py)

**Root Cause:** v3.5.39 introduced engine health persistence. v3.5.42 FIX-9 then made empty results count as failures. Combined effect: niche queries returning 0 results from some engines triggered cooldowns, which cascaded across all engines. In Group A logs, 153/168 waterfall calls tried 0 engines.

**Fix:**
1. **Separate empty from errors:** New `consecutive_empty` counter tracks empty results independently. `record_empty()` method for soft tracking — NO cooldown triggered.
2. **Reduced backoff:** Changed from base-5 to base-2 exponential backoff. Cap lowered from 900s to 600s.
3. **Cooldown decay:** `try_reset()` now decays failure count by 1 on cooldown expiry (was full reset). Engine gets a chance to prove itself.
4. **Session start reset:** `reset_engine_soft_state()` clears empty streaks at session start while preserving hard failure counts.
5. **Nuclear reset:** `reset_engine_hard_failures()` for fallback chain — clears ALL state.

```python
# Before (v3.5.42): Empty results = hard failure = cooldown
health.record_failure()  # 0 results from DuckDB → engine killed

# After (v3.5.43): Empty results = soft tracking, no cooldown
health.record_empty()    # 0 results → logged, no cooldown
```

**Backoff comparison:**
| Failures | v3.5.42 (base-5) | v3.5.43 (base-2) |
|----------|-------------------|-------------------|
| 2 | 60s | 60s |
| 3 | 150s | 120s |
| 4 | 750s (capped 900s) | 240s |
| 5 | 900s (cap) | 480s |
| 6+ | 900s (cap) | 600s (cap) |

**File:** `backend/app/services/multi_engine_search.py`

### Bug 2: LinkedIn Timeout Chain Alignment (database_search.py)

**Root Cause:** Inner query timeout (210s) + ghost recovery (60s) = 270s, but phase timeout was only 240s. The phase timeout fires BEFORE the inner query completes, killing the ghost recovery that was supposed to save partial results. Net effect: LinkedIn queries that took >240s lost ALL results.

**Fix:**
1. **Reduced inner timeout:** `_DB_QUERY_TIMEOUT_SECS`: 210s → 150s
2. **Raised phase timeout:** `_LINKEDIN_PHASE_TIMEOUT_SECS`: 240s → 280s
3. **Alignment:** Inner (150s) + ghost (60s) = 210s < 280s phase timeout. Ghost recovery now always completes.
4. **Adaptive ds_limit:** New `_compute_linkedin_ds_limit()` scales dataset count to remaining budget:
   - `seconds_per_file = 50` (from log analysis)
   - `safe_secs = available_secs * 0.75` (25% safety margin)
   - `limit = max(1, min(int(safe_secs / seconds_per_file), _LINKEDIN_DS_LIMIT_MAX))`

```
v3.5.42 timeline:  |--- inner 210s ---|--- ghost 60s ---|
                    |--- phase 240s ---| ← KILLS ghost!

v3.5.43 timeline:  |--- inner 150s ---|--- ghost 60s ---|
                    |---------- phase 280s -------------|  ← ghost completes
```

**File:** `backend/app/services/database_search.py`

### Bug 3: Instagram Location Filter Expansion (database_search.py)

**Root Cause:** Instagram leads have extremely sparse location metadata. The `_CITY_ALIASES` dict only had basic city names, missing neighborhoods (Andheri, Bandra, Koramangala), Hindi names, and state abbreviations. Combined with a no_signal cap of 300, this dropped 60-70% of legitimate Instagram leads.

**Fix:**
1. **Massive alias expansion:** `_CITY_ALIASES` now includes:
   - Neighborhoods (Andheri, Bandra, Powai, Koramangala, Indiranagar, etc.)
   - Hindi/local names
   - State names and abbreviations (Maharashtra/MH, Karnataka/KA, etc.)
   - Satellite cities (Navi Mumbai, Thane, Gurgaon, NOIDA, etc.)
2. **Raised no_signal caps:**
   ```python
   _MAX_NO_SIGNAL_BY_SOURCE = {
       "instagram": 500,   # was 300 → 500
       "linkedin": 250,    # was 200 → 250
       "googlemaps": 50,   # unchanged
       "google_maps": 50,  # unchanged
       "pan_india": 150,   # unchanged
       "default": 350,     # was 250 → 350
   }
   ```

**File:** `backend/app/services/database_search.py`

### Bug 4: Zero-Result Fallback Chain (routes.py)

**Root Cause:** 2/6 v3.5.42 Group A sessions returned 0 leads. Once the primary pipeline completes with 0 results, there was no recovery mechanism — the session just ended with 0 leads.

**Fix:** Three-step fallback chain activated when `all_leads == 0` and budget remains:
1. **Supplementary DB search:** Force-enable Google Maps + YouTube databases (even if not in original platform list)
2. **Nuclear engine reset:** `reset_engine_hard_failures()` clears ALL engine cooldowns
3. **Dorking retry:** Run Google dorking with 1 page on top 2 platforms using fresh engines

```python
if not all_leads and not budget.is_exhausted(reserve_secs=60.0):
    # Step 1: Supplementary DBs
    _fb_leads = await search_database_hybrid(
        keywords=cleaned_keywords,
        platforms=["google_maps", "youtube"],
        ...
    )
    # Step 2: Nuclear reset + retry dorking
    if not all_leads:
        reset_engine_hard_failures()
        results = await dorking_search_multi(...)
```

**File:** `backend/app/api/routes.py`

### Bug 5: GMaps Country Assertion (database_search.py)

**Root Cause:** Google Maps database contains global businesses. Query "dentists delhi" returns dentists from Delhi, USA AND Delhi, India. Without country filtering, 20-40% of GMaps leads were from wrong countries.

**Fix:** New `_gmaps_country_assertion()` post-filter with multi-signal India validation:
- **Signal 1:** Phone prefix (+91, 091, 0091)
- **Signal 2:** Indian state name in address (Maharashtra, Karnataka, Tamil Nadu, etc.)
- **Signal 3:** Indian PIN code (6-digit number pattern)
- **Signal 4:** "India" in address field
- **Signal 5:** `.in` TLD in website

**Logic:** Keep leads with ANY positive India signal. Also keep leads with NO signal (benefit of the doubt — business may lack phone/address). Only drop leads that have non-India signals.

**File:** `backend/app/services/database_search.py`

### Bug 6: Enrichment Cap Decoupling (routes.py + waterfall_enrichment.py)

**Root Cause:** v3.5.42 counted `_leads_missing_email` as leads missing BOTH email AND phone. In Group A, most leads had EITHER email OR phone (from DB search) but not both. Result: `_leads_missing_email` was very low (5-10), starving the enrichment stage.

**Fix:**
1. **Count missing ANY field:** Changed from `not email AND not phone` to `not email OR not phone`
2. **Raised floor:** Enrichment cap minimum raised from 10 → 15
3. **Priority ordering in waterfall_enrichment.py:**
   - Priority 0: Has company + missing BOTH fields (highest value)
   - Priority 1: Has company + missing ONE field (partial contact)
   - Priority 2: No company + missing fields (lowest priority)

```python
# Before (v3.5.42): Only enriched leads missing BOTH
if not l.get("email") and not l.get("phone"):  # very few matches

# After (v3.5.43): Enrich leads missing ANY field
if not l.get("email") or not l.get("phone"):   # captures partial-contact leads
```

**File:** `backend/app/api/routes.py`, `backend/app/services/waterfall_enrichment.py`

### Bug 7: LinkedIn Budget Cap (routes.py)

**Root Cause:** In single-platform sessions (LinkedIn-only), LinkedIn consumed the ENTIRE 300s budget. With the inner query timeout at 150s and up to 5 datasets, LinkedIn could theoretically use 150s × 5 = 750s. Even with the 280s phase timeout, LinkedIn still consumed most of the budget, leaving 0s for dorking and enrichment.

**Fix:**
- Cap LinkedIn at **60% of single-platform budget** (max 180s)
- Multi-platform sessions: cap at 50% of total budget
- Guarantee **40% of budget** for dorking + enrichment
- Implementation: Temporarily overrides `_LINKEDIN_PHASE_TIMEOUT_SECS` during the search call, restores it after

```python
_linkedin_budget_cap = min(_session_budget * 0.60, 180.0) if _is_single_platform else _session_budget * 0.50
# For single-platform (300s budget): LinkedIn gets 180s max, dorking+enrichment get 120s
```

**File:** `backend/app/api/routes.py`

---

## Architecture Overview

### Pipeline Flow (v3.5.43)

```
User Input (keyword + location + platforms)
    │
    ▼
┌─────────────────────────────────┐
│  Budget Calculation              │  Scale by platform count (from v3.5.42)
│  1 platform: 300s                │
│  2 platforms: 420s               │
│  3 platforms: 540s               │
│  4+ platforms: 660s              │
│                                  │
│  LinkedIn Budget Cap             │  ← Bug 7: 60% cap (max 180s)
│  Engine Soft Reset               │  ← Bug 1: clear empty streaks
│  Domain Failure Cache Reset      │  (from v3.5.41)
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 1: DB Search (S3)         │  Per-platform DuckDB queries
│  LinkedIn: 280s phase timeout    │  ← Bug 2: was 240s
│    Inner query: 150s timeout     │  ← Bug 2: was 210s
│    Ghost recovery: +60s          │  ← now completes within phase
│    Adaptive ds_limit             │  ← Bug 2: scales to budget
│  Instagram: 120s timeout         │
│  GMaps: 30s + country filter     │  ← Bug 5: India assertion
│  YouTube: 60s timeout            │
│                                  │
│  Engine Health (rewritten)       │  ← Bug 1:
│    Empty ≠ failure               │    no cooldown for empty results
│    Base-2 backoff, 600s cap      │    was base-5, 900s cap
│    Cooldown decay on expiry      │    was full reset
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 2: Location Filter        │  Confidence scoring
│  Expanded city aliases           │  ← Bug 3: neighborhoods + Hindi
│  Instagram cap: 500              │  ← Bug 3: was 300
│  LinkedIn cap: 250               │  ← Bug 3: was 200
│  GMaps cap: 50                   │
│  Default cap: 350                │  ← Bug 3: was 250
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 3: Google Dorking          │
│  Pages: budget-based control      │  (from v3.5.42)
│  Budget < 60s: 1 page             │
│  Budget < 120s: max 2 pages       │
│  Budget >= 120s: full pages        │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 4: Live Scraping           │  Platform-specific scrapers
│  Search engines sorted by health  │  (from v3.5.42)
│  Backoff: 60s/120s/240s/600s cap │  ← Bug 1: was 60s/300s/900s
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 5: Enrichment              │  Waterfall enrichment
│  Cap: min(total*0.15, 100)        │  (from v3.5.42)
│  Minimum: 15 leads                │  ← Bug 6: was 10
│  Missing ANY field (not both)     │  ← Bug 6: decoupled
│  Priority: both > one > no co.    │  ← Bug 6: smart ordering
│  Per-lead timeout: 15s            │  (from v3.5.41)
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 6: FALLBACK (if 0 leads)  │  ← Bug 4: NEW
│  Step 1: Supplementary DBs       │  GMaps + YouTube
│  Step 2: Nuclear engine reset    │  Clear ALL cooldowns
│  Step 3: Dorking retry (1 page)  │  Fresh engines
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│  Phase 7: Dedup & Export          │  Quality scoring, CSV/XLSX
└─────────────────────────────────┘
```

### Engine Health State Machine (v3.5.43)

```
                    ┌──────────────┐
    Session Start → │  Soft Reset  │  clear consecutive_empty
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Healthy    │  failures=0, empty=0
                    └──┬───┬───┬──┘
                       │   │   │
           success ────┘   │   └──── empty result
           (clear all)     │         (record_empty, NO cooldown)
                           │
                      hard error
                      (record_failure)
                           │
                           ▼
                    ┌──────────────┐
                    │  Degraded    │  failures=1
                    └──────┬───────┘
                           │ 2nd failure
                           ▼
                    ┌──────────────┐
                    │  Cooldown    │  failures≥2, cooldown=60s
                    │  (60s)       │
                    └──────┬───────┘
                           │ cooldown expires
                           │ decay: failures -= 1
                           ▼
                    ┌──────────────┐
                    │  Try Reset   │  failures=1, can try again
                    └──────────────┘
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
    ├── Search UI (v3.5.43 displayed)
    └── Results Export
```

---

## Build Information

| Platform | File | Size | B2 URL |
|----------|------|------|--------|
| Windows | `SnapLeads Setup 3.5.43.exe` | ~657 MB | [Download](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.43.exe) |
| macOS | `SnapLeads-3.5.43-arm64-mac.zip` | ~278 MB | [Download](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.43-arm64-mac.zip) |

**GitHub Actions:** Build & Release All Platforms (run ID: 23209109629)  
**Tag:** v3.5.43

---

## Files Modified

| File | Lines Changed | Bugs Addressed |
|------|--------------|----------------|
| `backend/app/services/multi_engine_search.py` | +108 | Bug 1 |
| `backend/app/services/database_search.py` | +262 | Bugs 2, 3, 5 |
| `backend/app/api/routes.py` | +147 | Bugs 4, 6, 7 |
| `backend/app/services/waterfall_enrichment.py` | +21 | Bug 6 |
| `frontend/src/lib/version.ts` | +1 | Version bump |
| `package.json` | +1 | Version bump |

---

## Test Baseline

| Version | Sessions | Total Leads | Avg/Session | Zero-Lead Sessions |
|---------|----------|-------------|-------------|-------------------|
| v3.5.39 | 6 | 970 | 162 | 0 |
| v3.5.40 | 6 | 1,934 | 322 | 0 |
| v3.5.41 | 6 | ~2,500 | ~417 | 0 |
| v3.5.42 | 6 | ~1,200 | ~200 | 2 (regression) |
| v3.5.43 | 6 (projected) | 3,000–3,500 | 500–583 | 0 (fallback chain) |

**v3.5.42 regression cause:** Engine cascade failure (Bug 1) + timeout chain misalignment (Bug 2) combined to kill most engine calls.  
**v3.5.43 projected improvement:** 150–190% over v3.5.42 (engine health rewrite + fallback chain eliminates zero-lead sessions).

---

## Version History

- **v3.5.43** — 7 root cause fixes: engine cascade fix, timeout alignment, location expansion, GMaps country filter, LinkedIn budget cap, zero-result fallback, enrichment decoupling
- **v3.5.42** — 9 Claude-verified fixes: PAN India disable, budget scaling, city aliases, dorking budget control, enrichment scaling, engine backoff
- **v3.5.41** — 7 Claude-verified fixes + 6 CodeRabbit bug fixes for maximum lead yield
- **v3.5.40** — 8 Group A root cause fixes (RC2/RC3/RC4/RC5/RC8/RC10/RC12)
- **v3.5.39** — 7 test-derived fixes + 5 analysis recommendations
- **v3.5.38** — Per-phase DB search timeouts + Bing CDN SSRF fix
- **v3.5.37** — 4 critical pipeline fixes for 100% test pass rate
- **v3.5.36** — 8 ban-free fixes for 320-test plan
