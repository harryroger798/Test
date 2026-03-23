# SnapLeads Complete Architecture Document — v3.5.71

**Date:** March 23, 2026
**Version:** 3.5.71
**Status:** Production-ready (Citation Checker blank screen fix)

---

## 1. What's New in v3.5.71

### Citation Checker Blank Screen Fix

**Problem:** After running the citation checker in v3.5.70, the UI showed a blank screen instead of displaying the results. The backend returned correctly (77.6s response with citation data), but the frontend crashed silently during rendering.

**Root Cause:** Type mismatch between backend response and frontend expectations:
- Backend returns `found[].name` (object with `{name, domain, importance, url}`) and `not_found` as objects with `{name, domain, importance, url, error?}`
- Frontend expected `found[].source` (string) and `not_found` as `string[]`
- This caused a silent React render crash → blank screen instead of error message

**Fixes Implemented (all additive — zero changes to extraction pipeline):**

| Fix | File | What it does |
|-----|------|-------------|
| **Updated state type definition** | `CitationChecker.tsx` | Changed `found`/`not_found` types to match backend schema with `{name, domain, importance, url, error?}` objects |
| **Added error state** | `CitationChecker.tsx` | New `error` state variable + error display panel with red styling |
| **Defensive array checks** | `CitationChecker.tsx` | `Array.isArray()` checks + nullish coalescing for `score`/`grade`/`recommendations` |
| **Fixed field references** | `CitationChecker.tsx` | Changed `f.source` → `f.name` (line 136) and `nf` (string) → `nf.name` (line 154) |
| **Updated API return type** | `api.ts` | `checkCitations()` return type updated to match backend schema |

**Expected Improvement:**
- Before: Blank screen after citation check completes
- After: Results display correctly OR clear error message shown

### What's in v3.5.70 (previous release)

Citation Checker Engine Health + Dedicated Budget + Timeouts:
- Engine soft reset before citation checking (dedicated budget)
- Engine availability pre-check (early return if all exhausted)
- Per-source 15s timeout (prevents 28-min waits)
- Consecutive failure bail-out (stops after 5 straight zeros)
- Total 5-minute hard timeout cap

### Code Changes

| File | Lines Changed | Description |
|------|--------------|-------------|
| `CitationChecker.tsx` | ~50 lines | Updated state types, added error state, defensive checks, fixed field references |
| `api.ts` | ~5 lines | Updated `checkCitations` return type to match backend schema |
| `package.json` | version bump | `3.5.70` → `3.5.71` |

### PRs

| PR | Repo | Description |
|----|------|-------------|
| #159 | social-lead-extractor-pro | v3.5.71 — Citation checker blank screen fix (merged) |
| #160 | social-lead-extractor-pro | Version bump to v3.5.71 (merged) |
| #157 | snapleads-platform | Update platform download links to v3.5.71 (merged) |

---

## 2. Current User Role Architecture (v3.5.67+)

### Roles

| Role | Access | Can Do |
|------|--------|--------|
| `super_admin` | Admin dashboard at `/admin` | Generate unlimited keys (up to 100/batch), revoke/reactivate keys, view all stats + revenue, manage download links, share templates |
| `customer` | Desktop app only | Self-register via `/api/auth/register`, activate license keys, use the extraction pipeline |

### Admin Credentials

- **Email:** harryroger798@gmail.com
- **Password:** 007JamesBond@@
- **Login:** https://snapleads-api.onrender.com/api/auth/login

### Current Pricing (v3.5.68+)

| Plan | Monthly | Yearly |
|------|---------|--------|
| **Starter** | $7/mo | $59/yr |
| **Pro** | $19/mo | $169/yr |

**Removed in v3.5.68:** Lifetime pricing entirely.

---

## 3. Version History (v3.5.32 — v3.5.70)

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
| v3.5.59 | YellowPages max_delay fix + Job Boards dorking improvement | #146 (desktop) |
| v3.5.60 | Directories page-visit enrichment + Indeed RSS + APScheduler | #147 |
| v3.5.61 | Indeed RSS wired into endpoint + RemoteOK + Arbeitnow | #148 |
| v3.5.62 | Startup Directories feature (npm + PyPI + GitHub + HN + contact scraping) | #149 |
| v3.5.63 | 5 sleep/resume/crash resilience fixes | #150 |
| v3.5.64 | Replace SVG platform icons with 20 high-quality transparent PNG logos | #151 |
| v3.5.65 | Icon rendering fixes + tooltip descriptions + landing page update to 20 platforms | #152 (desktop) + #141, #142 (platform) |
| v3.5.66 | Weekly leads.cm automation + Instagram backfill (5.5M records) | #153 |
| v3.5.67 | Remove reseller roles — keep only super_admin + customer (820 lines removed) | #146 (platform) |
| v3.5.68 | Remove lifetime pricing completely + ProGate 12→20 platforms fix | #154 (desktop) + #152 (platform) |
| v3.5.69 | Blank screen fix — loading spinner when extraction starts | #156 (desktop) |
| v3.5.70 | Citation checker engine health + dedicated budget + 5 timeout/bailout fixes | #158 (desktop) + #156 (platform) |
| **v3.5.71** | **Citation checker blank screen fix (type mismatch + defensive checks + error state)** | **#159, #160 (desktop) + #157 (platform)** |

---

## 4. Build Artifacts

| Platform | File | B2 URL |
|----------|------|--------|
| Windows | `SnapLeads Setup 3.5.71.exe` | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.71.exe` |
| macOS | `SnapLeads-3.5.71-arm64-mac.zip` | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.71-arm64-mac.zip` |

**Build:** GitHub Actions — both Windows and macOS succeeded.
**Tag:** `v3.5.71` pushed to origin.
**Platform links:** PR #157 merged — download links updated on getsnapleads.store.

---

## 5. Repositories

| Repo | Purpose | Latest PR |
|------|---------|-----------|
| `harryroger798/social-lead-extractor-pro` | Desktop Electron app (backend + frontend) + weekly sync | **PR #159 (v3.5.71 — citation checker blank screen fix)** |
| `harryroger798/snapleads-platform` | License server API + Marketing website (getsnapleads.store) | **PR #157 (v3.5.71 — platform links update)** |
| `harryroger798/Test` | Architecture documentation | This PR |
| `bytepassperks/snapleads-search-api` | Render search API (DuckDB proxy) | PR #1 |

---

## 6. Database Infrastructure

| Database | Records | Location | Query Method |
|----------|---------|----------|-------------|
| LinkedIn | 86.9M | iDrive E2 S3 (us-west-1) | DuckDB httpfs |
| Instagram | 7.96M | iDrive E2 S3 | DuckDB httpfs |
| Google Maps | 102K+ | iDrive E2 S3 | DuckDB httpfs |
| PAN India | 101M+ | iDrive E2 S3 | DuckDB httpfs |
| YouTube | 1,085 channels | iDrive E2 S3 | DuckDB httpfs |
| Apify B2B | 101 leads | iDrive E2 S3 | DuckDB httpfs |
| Apify GMaps | 70K+ businesses | iDrive E2 S3 | DuckDB httpfs |
| **TOTAL** | **~196M+** | | |

**Weekly Sync:** GitHub Actions cron (every Sunday 2 AM UTC) checks leads.cm for new LinkedIn/Instagram/Technology datasets and uploads to S3 automatically.

---

## 7. Platform Support (20 platforms)

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
- **Citation Checker** (30 directory sources, v3.5.70 hardened with engine health + timeouts, v3.5.71 blank screen fix)
- **GBP Detection** (Bing + DDG + Google + Google Maps multi-source)

---

## 8. Website Optimization (v3.5.68+)

### Speed
- Images: 30MB → 3.2MB (89% reduction, WebP format)
- Fonts: Non-render-blocking `<link>` with `display=swap`
- Preconnect + preload for LCP image
- Sparkle particles: 24 → 6
- Lazy loading on all below-fold images

### SEO
- `robots.txt` with AI crawler permissions (GPTBot, ClaudeBot, PerplexityBot)
- `sitemap.xml` with all sections
- Canonical URL, OG image, Twitter Card meta tags
- 4 JSON-LD schemas: Organization, SoftwareApplication, FAQPage, HowTo

### Analytics
- GA4: G-RGBCFL7MJN (SnapLeads account, separate from TextShift)
- Google Search Console: verified, sitemap submitted

---

## 9. Test Results Summary (Groups A-G, 32 sessions)

| Group | Sessions | Total Leads | Key Platforms |
|-------|----------|-------------|---------------|
| A (Social + Location) | 6 | 3,233 | LinkedIn, Instagram, Facebook, Google Maps |
| B (Social, No Location) | 4 | 2,750 | LinkedIn, Instagram |
| C (B2B + Location) | 4 | 6,126 | IndiaMART, JustDial, TradeIndia |
| D (B2B, No Location) | 2 | 529 | IndiaMART, TradeIndia, ExportersIndia |
| E (DB-only) | 3 | 2,138 | LinkedIn, Instagram, Google Maps |
| F (Full Pipeline) | 3 | 907 | All platforms |
| G (Edge Cases) | 2 | 1,582 | Google Maps, JustDial, Multi-keyword |
| **TOTAL** | **24+** | **~17,265+** | **Zero bans** |

---

## 10. Credentials Reference

All credentials stored in Devin secrets + GitHub Actions encrypted secrets. Key services:
- **iDrive E2 S3:** `s3.us-west-1.idrivee2.com` / bucket: `crop-spray-uploads`
- **Backblaze B2:** bucket: `snapleads-downloads`
- **Render License API:** `https://snapleads-api.onrender.com`
- **Render Search API:** `https://snapleads-search-api.onrender.com`
- **GitHub PAT:** For API operations (PR creation, workflow triggers, secret management)
- **GitHub Actions Secrets:** IDRIVE_S3_ENDPOINT, IDRIVE_S3_BUCKET, IDRIVE_S3_ACCESS_KEY, IDRIVE_S3_SECRET_KEY
- **Super Admin:** harryroger798@gmail.com / 007JamesBond@@

---

## 11. Devin Session

Link to Devin Session: https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a
Requested by: @bytepassperks (bytepass5@gmail.com)
