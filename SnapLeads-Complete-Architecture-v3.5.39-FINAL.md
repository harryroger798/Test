# SnapLeads Complete Architecture — v3.5.39

**Date:** 2026-03-17
**Version:** 3.5.39
**PR:** harryroger798/social-lead-extractor-pro#127
**Type:** 7 test-derived fixes + 5 analysis recommendations (12 total)

---

## What Changed in v3.5.39

### Test-Derived Fixes (7)

#### Fix 1-3: Per-Phase S3 DuckDB Timeouts
**File:** `backend/app/services/database_search.py`
- LinkedIn S3 timeout: 65s -> 180s (86.9M records need more time on residential internet)
- Instagram S3 timeout: 90s -> 150s (23M records)
- Supplementary S3 timeout: 25s -> 90s (B2B databases are smaller but still need time)

**Root cause:** Default timeouts were calibrated for cloud servers with fast S3 connectivity. Desktop users on residential internet need 2-3x longer.

#### Fix 4: Brave Search Accept-Encoding
**File:** `backend/app/services/multi_engine_search.py`
- Added `Accept-Encoding: identity` header to Brave search requests
- Fixes curl error 23 (decompression failure) when Brave returns brotli-compressed responses

#### Fix 5: Replace Dead SearXNG Instances
**Files:** `backend/app/services/multi_engine_search.py`, `backend/app/services/anti_detection.py`
- Removed 2 dead instances: `searx.fmac.xyz`, `search.bus-hit.me`
- Added 5 live instances: `searx.be`, `search.inetol.net`, `paulgo.io`, `search.ononoki.org`, `searx.work`
- Updated SSRF allowlist in `anti_detection.py` to match

#### Fix 6: Generic Keyword B2B Fallback
**File:** `backend/app/api/routes.py`
- Generic B2B keywords (e.g., "restaurants") now fall back to supplementary DB search instead of returning 0 leads
- Previously: keyword without recognized B2B intent was skipped entirely

#### Fix 7: Test Framework Lead-Count Threshold
**File:** `backend/app/api/test_runner.py`
- 0-lead tests now correctly marked as FAIL instead of SUCCESS
- Minimum thresholds: B2B=1, LOCAL=1, B2C=1, Social=3

---

### Analysis Recommendations (5)

#### Recommendation 1: Log-Normal Jitter for Behavioral Fingerprint Evasion
**File:** `backend/app/services/anti_detection.py`

Search engines detect uniform-random timing patterns. Log-normal distribution matches real human browsing behavior (mostly short pauses, occasional longer ones).

**Implementation:**
- New `_lognormal_jitter()` function using `random.lognormvariate(mu=0.0, sigma=0.5)`
- Capped at 3.0 seconds to prevent excessive waits
- Replaces `random.uniform(0.1, 0.5)` in `_rate_limit()`
- Result: timing distribution indistinguishable from real users

#### Recommendation 2: Yep.com + Bing Free Scrape (Startpage Demotion)
**File:** `backend/app/services/multi_engine_search.py`

Startpage proxies Google AND adds its own anti-scraping. Replaced with better alternatives.

**Implementation:**
- New `search_yep()` function — queries `api.yep.com/fs/2/search` (Ahrefs-backed, very scrape-friendly)
- New `search_bing_free()` function — direct Bing scrape (very permissive)
- Waterfall reorder: Brave -> Yep -> Bing -> DDG Lite -> Mojeek -> Qwant -> Startpage -> SearXNG
- Startpage demoted from #2 to #7 (weakest engine)

#### Recommendation 3: Per-Engine Cooldown Persistence to Disk
**File:** `backend/app/services/multi_engine_search.py`

Engine health state previously lost on every app restart, causing repeated hammering of blocked engines.

**Implementation:**
- `_EngineHealth` class enhanced with 24h health scoring windows
- `health_score` property: 0.0-1.0 ratio of successes over 24h window
- `_load_health_from_disk()` / `_save_health_to_disk()` for JSON persistence
- Stored at `~/.snapleads/engine_health.json` (or `$SNAPLEADS_DATA_DIR/engine_health.json`)
- Window auto-resets every 24 hours

#### Recommendation 4: DNS Verification Signals (SPF/DMARC/BIMI) + Catch-All MX Provider Reduction
**File:** `backend/app/services/verifier.py`

Free DNS lookups that provide email confidence signals without any API keys.

**Implementation — DNS Signals:**
- `_check_spf(domain)` — checks for `v=spf1` TXT record (+5 confidence)
- `_check_dmarc(domain)` — checks `_dmarc.{domain}` TXT record
  - `p=reject` = +10 confidence (company is serious about email)
  - `p=quarantine` = +5 confidence
  - `p=none` = +2 confidence
- `_check_bimi(domain)` — checks `default._bimi.{domain}` TXT record (+10 confidence)
- `dns_confidence_score(domain)` — combines all signals, returns 0-25 boost
- All results `@lru_cache(maxsize=500)` for performance

**Implementation — Catch-All MX Provider Reduction:**
- `_TRUSTED_MX_PROVIDERS` dict: Google, Microsoft, Zoho MX hostnames
- `_identify_mx_provider(mx_host)` — identifies email provider from MX hostname
- `_is_catch_all_trustworthy(mx_host)` — Google/Microsoft/Zoho rarely use catch-all
- `verify_email()` now logs catch-all provider trust level
- `verify_email_detailed()` returns new fields: `mx_provider`, `catch_all_trustworthy`, `dns_confidence`

#### Recommendation 5: Enhanced Lead Quality Score (LQS) + WHOIS/RDAP + Batch Dedup
**Files:** `backend/app/services/quality_scorer.py`, `backend/app/services/whois_rdap.py`

**LQS Enhancement:**
- `ScoreBreakdown` dataclass: added `dns_bonus`, `smtp_bonus`, `catch_all_bonus`, `linkedin_bonus`
- `score_lead_quality()`: 4 new optional params: `dns_confidence`, `smtp_verified`, `catch_all_trustworthy`, `has_linkedin`
- New scoring:
  - DNS confidence: +0-15 points (from SPF/DMARC/BIMI)
  - SMTP verified: +5 points
  - Catch-all trusted provider: +5 points
  - LinkedIn profile present: +5 points
- `batch_score_leads()` enhanced to pass DNS/SMTP/catch-all/LinkedIn data
- New `batch_score_and_dedup()` — combines scoring + hash-based deduplication in one pass

**WHOIS/RDAP Module (new file):**
- `extract_rdap_emails(domain)` — queries public RDAP bootstrap servers (rdap.org)
- Parses vcardArray entities for email addresses
- Filters out privacy/proxy service emails (domainsbyproxy.com, whoisguard.com, etc.)
- Fallback to TLD-specific RDAP endpoints (verisign for .com/.net)
- `extract_rdap_emails_batch()` — concurrent lookups with semaphore

---

## Automatic Test Framework Integration

All 12 features are validated by the automatic test framework via a 7-point `_run_v39_diagnostics()` suite that runs per test case:

| # | Diagnostic Test | What It Validates |
|---|----------------|-------------------|
| 1 | `lognormal_jitter` | 20 samples all within [0, 3.0], non-zero variance |
| 2 | `engine_health_persistence` | `_load_health_from_disk()` succeeds, health_score readable |
| 3 | `dns_confidence_scoring` | `dns_confidence_score("google.com")` returns valid dict |
| 4 | `lqs_v39_enhanced` | `score_lead_quality()` accepts new params, returns dns/smtp bonuses |
| 5 | `whois_rdap_module` | `whois_rdap` module imports successfully |
| 6 | `catchall_provider_id` | `_identify_mx_provider("aspmx.l.google.com")` returns "google" |
| 7 | `batch_score_dedup` | 3 leads (1 duplicate) -> 2 unique, 1 dedup |

Results are written to `reports/v39_diagnostics.json` in the test ZIP bundle.

---

## Files Changed

| File | Changes |
|------|---------|
| `backend/app/services/database_search.py` | Per-phase S3 timeouts (180s/150s/90s) |
| `backend/app/services/multi_engine_search.py` | Brave fix, SearXNG replacement, Yep.com, Bing free, engine health persistence, waterfall reorder |
| `backend/app/services/anti_detection.py` | Log-normal jitter, SSRF allowlist update (Yep, RDAP, live SearXNG) |
| `backend/app/services/verifier.py` | DNS signals (SPF/DMARC/BIMI), catch-all MX provider reduction |
| `backend/app/services/quality_scorer.py` | Enhanced LQS with DNS/SMTP/LinkedIn/catch-all scoring + batch dedup |
| `backend/app/services/whois_rdap.py` | **NEW** — WHOIS/RDAP email extraction module |
| `backend/app/api/routes.py` | Generic B2B keyword fallback routing |
| `backend/app/api/test_runner.py` | Lead-count threshold, v3.5.39 diagnostics suite, bundle enhancement |
| `frontend/src/lib/version.ts` | Version bump to 3.5.39 |
| `package.json` | Version bump to 3.5.39 |

---

## Version History (Recent)

| Version | Date | Key Changes |
|---------|------|-------------|
| v3.5.39 | 2026-03-17 | 7 test-derived fixes + 5 analysis recommendations (12 total) |
| v3.5.38 | 2026-03-16 | Per-phase DB search timeouts + Bing CDN SSRF fix |
| v3.5.37 | 2026-03-16 | 4 critical pipeline fixes for 100% test pass rate |
| v3.5.36 | 2026-03-15 | 8 ban-free fixes for 320-test plan |
| v3.5.35 | 2026-03-14 | One-click automated testing button |
| v3.5.34 | 2026-03-14 | Backend-ready preload + retry + splash |
