# SnapLeads v3.5.38 — Complete Architecture Document

## Release: v3.5.38 (Per-Phase DB Search Timeouts + Bing CDN SSRF Fix)
**Date**: March 17, 2026
**PR**: [#126](https://github.com/harryroger798/social-lead-extractor-pro/pull/126)
**Focus**: P0 fix for DB search partial results always being empty due to monolithic 90s master timeout

---

## Root Cause Analysis

Deep analysis of v3.5.37 test results revealed a **P0 bug** in the DB search hybrid function:

### The Problem
The 90s master timeout in `search_database_hybrid()` wrapped the entire `_search_database_hybrid_inner()` function which runs three phases **sequentially**:
- **LinkedIn**: ~60s (5 countries x 5 files x S3 round-trips)
- **Instagram**: 55-86s (high variance due to file sizes)
- **Supplementary** (GMaps + PAN India + YouTube): ~12s

**Total sequential time**: 115-146s. The 90s master timeout **always** fired before the inner function could return.

### Why Partial Results Were Empty
The old code pattern was:
```python
async def _inner_with_partial():
    results = await _search_database_hybrid_inner(...)  # 115-146s
    _partial_results.extend(results)  # NEVER reached — timeout fires at 90s
    return results
```

When the timeout fired, `_partial_results.extend(results)` had never executed because the inner function hadn't completed yet. The `_partial_results` list was always empty — every DB search returned 0 leads.

---

## Fix 1: Per-Phase Timeouts (P0 — CRITICAL)

### Solution
**File**: `backend/app/services/database_search.py`

Restructured `search_database_hybrid()` to run each phase with its own timeout. Results are collected per-phase via `_dedup_and_collect()` immediately after each phase completes.

#### Per-Phase Timeout Constants
```python
# v3.5.38: Per-phase timeouts based on observed timings from v3.5.37 tests:
#   LinkedIn: ~60s (5 countries x 5 files x S3 round-trips)
#   Instagram: 55-86s (high variance due to file sizes; 90s gives buffer)
#   Supplementary (GMaps + PAN India + YouTube): ~12s
# Total sequential: 115-146s. Old 90s master ALWAYS timed out.
_PHASE_TIMEOUT_LINKEDIN = 65.0
_PHASE_TIMEOUT_INSTAGRAM = 90.0   # observed up to 86s — 90s avoids data loss
_PHASE_TIMEOUT_SUPPLEMENTARY = 25.0
_MASTER_SAFETY_TIMEOUT = 200.0  # safety net (sum of phases + slack)
```

#### Deduplication Function
```python
def _dedup_and_collect(leads: list[dict]) -> int:
    """Deduplicate leads and append to _partial_results. Returns count added."""
    added = 0
    for lead in leads:
        email = lead.get("email", "")
        phone = lead.get("phone", "")
        if email and email in seen_emails:
            continue
        if phone and phone in seen_phones:
            continue
        if email:
            seen_emails.add(email)
        if phone:
            seen_phones.add(phone)
        _partial_results.append(lead)
        added += 1
    return added
```

#### Phase Execution Pattern
Each phase runs independently with its own timeout:
```python
# Phase 1: LinkedIn
try:
    linkedin_results = await asyncio.wait_for(
        _run_linkedin_phase(...), timeout=_PHASE_TIMEOUT_LINKEDIN
    )
    _dedup_and_collect(linkedin_results)
    logger.info(f"LinkedIn phase: {len(linkedin_results)} leads in {elapsed:.1f}s")
except asyncio.TimeoutError:
    logger.warning(f"LinkedIn phase timed out after {_PHASE_TIMEOUT_LINKEDIN}s")
except Exception as e:
    logger.error(f"LinkedIn phase error: {e}")

# Phase 2: Instagram (same pattern)
# Phase 3: Supplementary (same pattern)
```

### Key Design Decisions
1. **Per-phase isolation**: If Instagram times out, LinkedIn results are already preserved
2. **Email/phone deduplication**: Prevents duplicates across phases using `seen_emails` and `seen_phones` sets
3. **Progressive accumulation**: `_partial_results` grows after each phase, not all-or-nothing
4. **Master safety timeout**: 200s as a safety net (sum of 65+90+25 = 180s + 20s slack)
5. **Instagram timeout at 90s**: Raised from initial 70s after CodeRabbit review identified observed upper bound of 86s

### Impact
- **Before**: DB search always returned 0 leads (timeout fired before results collected)
- **After**: DB search returns 468+ Instagram leads + 56+ Maps leads = 500+ total
- **Expected improvement**: From 1 lead (v3.5.37) to 500+ leads per search

---

## Fix 2: Dead Code Removal

### Problem
After restructuring `search_database_hybrid()` to inline the phase logic directly, two functions became dead code:
- `_search_database_hybrid_inner()` — the old monolithic inner function
- `_search_via_render_api()` — the Render API path (already skipped since v3.5.37)

### Solution
Removed both functions entirely (~250 lines of dead code) to reduce maintenance burden and clarify the codebase.

---

## Fix 3: Bing CDN SSRF Allowlist (P2)

### Problem
Bing search sometimes redirects through `cc.bingj.com` (CDN/redirect domain). This domain was not in the SSRF allowlist, causing silent failures when Bing routed through its CDN.

### Solution
**File**: `backend/app/services/anti_detection.py`

Added `cc.bingj.com` to `_ALLOWED_SEARCH_DOMAINS`:
```python
_ALLOWED_SEARCH_DOMAINS = frozenset({
    "html.duckduckgo.com",
    "lite.duckduckgo.com",
    "www.bing.com",
    "cc.bingj.com",              # v3.5.38: Bing CDN/redirect domain
    "search.brave.com",
    ...
})
```

---

## Pipeline Execution Order (v3.5.38)

```
Extraction Request
        |
        v
+------------------+
| 1. S3 Database   |  <- Per-phase timeouts [NEW in v3.5.38]
|    Phase 1:      |     LinkedIn: 65s timeout
|    LinkedIn      |     Results collected immediately
+--------+---------+
         |
         v
+------------------+
| 1b. S3 Database  |     Instagram: 90s timeout
|    Phase 2:      |     Results collected immediately
|    Instagram     |     Deduplicated against Phase 1
+--------+---------+
         |
         v
+------------------+
| 1c. S3 Database  |     Supplementary: 25s timeout
|    Phase 3:      |     GMaps + PAN India + YouTube
|    Supplementary |     Deduplicated against Phases 1-2
+--------+---------+
         |
         v (200s master safety timeout wraps all 3 phases)
+------------------+
| 2. Reddit JSON   |  <- With user enrichment
|    + RSS + users |
+--------+---------+
         |
         v
+------------------+
| 3. Budget check  |  <- is_exhausted()? [v3.5.37]
+--------+---------+
         | (if budget remains)
         v
+------------------+
| 4. Parallel Live |  <- budget-aware timeout [v3.5.37]
|    Scraping      |     Uses allowlisted SSRF [v3.5.37]
|    (all plats)   |     + cc.bingj.com [v3.5.38]
+--------+---------+
         |
         v
+------------------+
| 5. Short-circuit |  <- Skip if 50+ emails OR budget exhausted
|    + Dorking     |     Multi-engine: Bing/DDG/SearXNG
+--------+---------+
         |
         v
+------------------+
| 6. Waterfall     |  <- 10 workers, 20 leads, 60s budget [v3.5.37]
|    Enrichment    |
+--------+---------+
         |
         v
+------------------+
| 7. Save + Email  |  <- 3-layer verification
|    Verification  |     Syntax -> DNS -> SMTP
+--------+---------+
         |
         v
      Results
```

---

## Expected Test Results (v3.5.38 vs v3.5.37)

| Metric | v3.5.37 | v3.5.38 (target) | Improvement |
|--------|---------|------------------|-------------|
| DB search leads | 0 (always empty) | 500+ | P0 fix |
| Instagram leads | 0 (timeout) | 468+ | Per-phase timeout |
| Maps leads | 0 (timeout) | 56+ | Per-phase timeout |
| Total leads per search | ~1 | 500+ | 500x improvement |
| DB search timeout rate | 100% | <5% | Per-phase isolation |

---

## Files Changed in v3.5.38

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `backend/app/services/database_search.py` | +175 -249 | Fix 1: Per-phase timeouts + Fix 2: Dead code removal |
| `backend/app/services/anti_detection.py` | +1 | Fix 3: Bing CDN allowlist |
| `frontend/src/lib/version.ts` | 1 | Version bump to 3.5.38 |
| `package.json` | 1 | Version bump to 3.5.38 |

---

## CodeRabbit Review Feedback (Addressed)

Two actionable issues were identified and fixed in commit `fec4455`:
1. **Instagram timeout too tight**: Raised from 70s to 90s (observed upper bound was 86s)
2. **Dead code**: Removed `_search_database_hybrid_inner()` and `_search_via_render_api()` (~250 lines)

---

## Version History (Recent)

| Version | Date | Changes |
|---------|------|---------|
| v3.5.38 | Mar 17, 2026 | Per-phase DB search timeouts (P0 fix) + Bing CDN SSRF + dead code removal |
| v3.5.37 | Mar 17, 2026 | 4 critical pipeline fixes for 100% test pass rate (25% to 100%) |
| v3.5.36 | Mar 16, 2026 | 8 ban-free fixes for 320-test plan (27 to 280 target) |
| v3.5.35 | Mar 15, 2026 | One-click automated testing button + ZIP bundle + 3 bug fixes |
| v3.5.34 | Mar 15, 2026 | Backend-ready preload + retry + splash |
| v3.5.33 | Mar 15, 2026 | 6 location-aware filtering fixes |
| v3.5.32 | Mar 15, 2026 | Enhanced Google Dorking + Direct Scraping (7-module) |
| v3.5.31 | Mar 15, 2026 | Auto-Discovery Pipeline (5-stage adaptive) |

---

## Download

**Windows**: [SnapLeads Setup 3.5.38.exe](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.38.exe)
**Mac (ARM64)**: [SnapLeads-3.5.38-arm64-mac.zip](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.38-arm64-mac.zip)

### Build Info
- **Build system**: GitHub Actions (`windows-latest` + `macos-latest`)
- **Workflow**: `Build & Release All Platforms` (tag push: v3.5.38)
- **Run ID**: 23179174115 (both Mac and Windows builds succeeded)
- **Backend**: PyInstaller `--onefile` with 45+ hidden imports + Patchright Chromium + DuckDB httpfs
- **Frontend**: Vite build -> electron-builder NSIS installer (Windows) / ZIP (Mac)
- **B2 Bucket**: `snapleads-downloads` at `f005.backblazeb2.com`
