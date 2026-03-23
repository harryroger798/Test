# SnapLeads Complete Architecture Document — v3.5.69

**Date:** March 23, 2026
**Version:** 3.5.69
**Status:** Production-ready (blank screen fix + lifetime pricing removed)

---

## 1. What's New in v3.5.69

### Blank Screen Fix on New Extraction Page

**Change:** Fixed a UI bug where the New Extraction page showed a blank body after clicking "Start Extraction". The `status` state was `null` until the first poll response arrived (~2 seconds), causing the conditional `{status && (...)}` to render nothing. Added a loading spinner state that displays when `step='running' && !status`.

#### Root Cause
When user clicks Start Extraction, `handleStart()` calls `setStep('running')` and `startPolling()`. The polling interval fires every 2 seconds, but the first response takes ~2s to arrive. During those 2 seconds, `status` is `null`, so the entire extraction progress UI was blank.

#### Fix (PR #156)
- Added `Loader2` spinner + "Starting extraction... connecting to backend" message
- Displays when `step === 'running' && !status`
- Disappears automatically when first poll response sets `status`

### Previous: v3.5.68 — Lifetime Pricing Removal + ProGate Text Fix

Completely removed "lifetime" billing cycle from all 3 repositories. Only monthly and yearly plans remain. Fixed ProGate component text from "12 platforms" to "20 platforms".

#### Desktop App (social-lead-extractor-pro) — PR #154

| File | Change |
|------|--------|
| `ProGate.tsx` | "All 12 social platforms" → "All 20 platforms including B2B directories" |
| `LicenseContext.tsx` | Removed `'lifetime'` from `LicenseCycle` type union. Removed lifetime detection in mock key generation (`key.includes('-L-')` branch removed). Updated comment on expires_at check. |
| `AccountProfile.tsx` | Changed `"Never (Lifetime)"` → `"N/A"` for expires_at display when no expiry date exists |

#### Platform (snapleads-platform) — PR #152

| File | Change |
|------|--------|
| `LandingPage.tsx` | Deleted entire "Lifetime Deal" section (28 lines) — $99 Starter / $249 Pro lifetime cards + "47 lifetime keys remaining" message |
| `AdminDashboard.tsx` | Removed `<option value="lifetime">Lifetime</option>` from billing_cycle dropdown |
| `App.tsx` | Removed `import LifetimePage` and `<Route path="/lifetime">` |
| `LifetimePage.tsx` | **DELETED** entirely (167 lines) |
| `license.py` | Removed `"lifetime": "L"` from `CYCLE_PREFIXES`. Removed lifetime entries from `PRICING` dict (both starter and pro). Removed lifetime branch from `get_expiry_date()` |
| `admin.py` | Updated validation: `billing_cycle not in ("monthly", "yearly")` → raises 400 (was allowing "lifetime") |
| `schemas.py` | Updated `GenerateKeysRequest.billing_cycle` comment: `"monthly, yearly"` (was `"monthly, yearly, lifetime"`) |

### Current Pricing (v3.5.68)

| Plan | Monthly | Yearly |
|------|---------|--------|
| **Starter** | $7/mo | $59/yr |
| **Pro** | $19/mo | $169/yr |

**Removed:** Starter Lifetime ($99), Pro Lifetime ($249)

### Verification

Zero remaining "lifetime" references in either repo (verified via `rg -i "lifetime"` across all `.tsx`, `.ts`, `.py` files).

### PRs (v3.5.69)

| PR | Repo | Description |
|----|------|-------------|
| #156 | social-lead-extractor-pro | Fix blank screen on New Extraction page (loading spinner) — merged |
| #157 | social-lead-extractor-pro | Version bump to 3.5.69 — merged |
| #155 | snapleads-platform | Update platform download links + redirects to v3.5.69 — merged |

### PRs (v3.5.68)

| PR | Repo | Description |
|----|------|-------------|
| #154 | social-lead-extractor-pro | ProGate 12→20 platforms + remove lifetime from LicenseCycle + AccountProfile — merged |
| #155 | social-lead-extractor-pro | Version bump to 3.5.68 — merged |
| #152 | snapleads-platform | Remove lifetime pricing completely + delete LifetimePage (7 files, 207 lines removed) — merged |
| #153 | snapleads-platform | Update platform download links + redirects to v3.5.68 — merged |

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

### Admin Dashboard Tabs

| Tab | Function |
|-----|----------|
| Overview | Stats (total/active/expired/revoked keys, revenue USD/INR, activations, expiring soon) |
| License Keys | List/search/filter all keys, revoke/reactivate, export CSV |
| Generate Keys | Create Starter/Pro keys (**monthly/yearly only** — lifetime removed in v3.5.68) |
| Download | Download section with B2 links |
| Templates | Share templates for marketing/outreach |

---

## 3. Version History (v3.5.32 — v3.5.69)

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
| **v3.5.69** | **Fix blank screen on New Extraction page (loading spinner when status=null)** | **#156 (desktop) + #155 (platform)** |

---

## 4. Build Artifacts

| Platform | File | Size | B2 URL |
|----------|------|------|--------|
| Windows | `SnapLeads Setup 3.5.69.exe` | ~663 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.69.exe` |
| macOS | `SnapLeads-3.5.69-arm64-mac.zip` | ~284 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.69-arm64-mac.zip` |

**Build:** GitHub Actions Run #23444557439 — both Windows and macOS succeeded.
**Tag:** `v3.5.69` pushed to origin.
**Platform links:** PR #155 merged — download links + redirects updated to v3.5.69 on getsnapleads.store.
**License server:** Auto-deployed on Render (lifetime pricing removed in v3.5.68).

---

## 5. Repositories

| Repo | Purpose | Latest PR |
|------|---------|-----------|
| `harryroger798/social-lead-extractor-pro` | Desktop Electron app (backend + frontend) + weekly sync | **PR #156 (v3.5.69 — blank screen fix)** |
| `harryroger798/snapleads-platform` | License server API + Marketing website (getsnapleads.store) | **PR #155 (v3.5.69 — download links update)** |
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

---

## 8. Website Optimization (v3.5.68)

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

## 9. Credentials Reference

All credentials stored in Devin secrets + GitHub Actions encrypted secrets. Key services:
- **iDrive E2 S3:** `s3.us-west-1.idrivee2.com` / bucket: `crop-spray-uploads`
- **Backblaze B2:** bucket: `snapleads-downloads`
- **Render License API:** `https://snapleads-api.onrender.com`
- **Render Search API:** `https://snapleads-search-api.onrender.com`
- **GitHub PAT:** For API operations (PR creation, workflow triggers, secret management)
- **GitHub Actions Secrets:** IDRIVE_S3_ENDPOINT, IDRIVE_S3_BUCKET, IDRIVE_S3_ACCESS_KEY, IDRIVE_S3_SECRET_KEY
- **Super Admin:** harryroger798@gmail.com / 007JamesBond@@

---

## 10. Devin Session

Link to Devin Session: https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a
Requested by: @bytepassperks (bytepass5@gmail.com)
