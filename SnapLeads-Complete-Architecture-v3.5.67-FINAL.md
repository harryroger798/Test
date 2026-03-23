# SnapLeads Complete Architecture Document — v3.5.67

**Date:** March 23, 2026
**Version:** 3.5.67
**Status:** Production-ready (reseller roles removed — simplified to super_admin + customer only)

---

## 1. What's New in v3.5.67

### Role Simplification: Remove Reseller Roles

**Change:** Simplified the user role hierarchy from 4 roles to 2 roles.

| Before (v3.5.66) | After (v3.5.67) |
|-------------------|-----------------|
| `super_admin` → `master_reseller` → `reseller` → `customer` | `super_admin` → `customer` |

**What was removed (820 lines deleted across 10 files):**

**Backend (5 files):**
- `reseller.py` — Deleted entirely (228 lines, 7 endpoints + hierarchy logic)
- `main.py` — Removed `reseller_router` import + `app.include_router(reseller_router)`
- `admin.py` — Removed 3 reseller admin endpoints (`POST /resellers`, `GET /resellers`, `PUT /resellers/{id}`) + reseller count stats queries
- `database.py` — Removed `parent_id TEXT` column, `FOREIGN KEY (parent_id)` constraint, `idx_users_parent` index from users table
- `schemas.py` — Updated `CreateUserRequest.role` comment: `"super_admin, customer"` (was `"super_admin, master_reseller, reseller, customer"`)

**Frontend (5 files):**
- `ResellerDashboard.tsx` — Deleted entirely
- `App.tsx` — Removed `/reseller` route + `ResellerDashboard` import
- `Login.tsx` — Non-super_admin login now redirects to `/login` (was `/reseller`)
- `api.ts` — Removed 6 reseller API methods (`adminCreateReseller`, `adminListResellers`, `adminUpdateReseller`, `resellerStats`, `resellerGenerateKeys`, `resellerListKeys`)
- `AdminDashboard.tsx` — Removed: `Reseller` interface, reseller state variables (`resellers`, `showResForm`, `resName`, `resEmail`, `resPassword`, `resRole`), `loadResellers()` function, `handleCreateReseller()` function, `handleSuspendReseller()` function, "Resellers" tab from tab bar, "Add Reseller" quick action button, entire resellers tab content (100+ lines of table/form UI), unused imports (`UserPlus`, `PackageOpen`)

**What was NOT changed (zero risk to desktop app):**
- License key generation, activation, validation — completely untouched
- Desktop app Electron code — untouched
- S3 database search pipeline — untouched
- Google Dorking, live scraping, enrichment — untouched
- Pricing (Starter/Pro plans) — untouched
- HMAC signing, device-locked activations — untouched
- Weekly leads.cm sync automation — untouched

### Files Modified/Deleted

| File | Repo | Action |
|------|------|--------|
| `snapleads-api/app/routes/reseller.py` | snapleads-platform | DELETED |
| `snapleads-api/app/main.py` | snapleads-platform | Modified (removed reseller router) |
| `snapleads-api/app/routes/admin.py` | snapleads-platform | Modified (removed 3 endpoints + stats) |
| `snapleads-api/app/database.py` | snapleads-platform | Modified (removed parent_id) |
| `snapleads-api/app/models/schemas.py` | snapleads-platform | Modified (updated role comment) |
| `snapleads-web/src/pages/ResellerDashboard.tsx` | snapleads-platform | DELETED |
| `snapleads-web/src/App.tsx` | snapleads-platform | Modified (removed route + import) |
| `snapleads-web/src/pages/Login.tsx` | snapleads-platform | Modified (updated routing) |
| `snapleads-web/src/lib/api.ts` | snapleads-platform | Modified (removed 6 API methods) |
| `snapleads-web/src/pages/AdminDashboard.tsx` | snapleads-platform | Modified (removed reseller UI) |

### PRs

| PR | Repo | Description |
|----|------|-------------|
| #146 | snapleads-platform | Remove reseller roles — keep only super_admin and customer — merged |

---

## 2. Current User Role Architecture (v3.5.67)

### Roles

| Role | Access | Can Do |
|------|--------|--------|
| `super_admin` | Admin dashboard at `/admin` | Generate unlimited keys (up to 100/batch), revoke/reactivate keys, view all stats + revenue, manage download links, share templates |
| `customer` | Desktop app only | Self-register via `/api/auth/register`, activate license keys, use the extraction pipeline |

### Admin Dashboard Tabs (v3.5.67)

| Tab | Function |
|-----|----------|
| Overview | Stats (total/active/expired/revoked keys, revenue USD/INR, activations, expiring soon), plan distribution, quick actions |
| License Keys | List/search/filter all keys, revoke/reactivate, export CSV |
| Generate Keys | Create Starter/Pro keys (monthly/yearly/lifetime), assign to customer |
| Download | Download section with B2 links |
| Templates | Share templates for marketing/outreach |

**Removed tab:** "Resellers" — no longer exists.

### API Routes (v3.5.67)

| Route Group | Prefix | Endpoints |
|-------------|--------|-----------|
| Auth | `/api/auth` | `POST /register`, `POST /login` |
| Admin | `/api/admin` | `GET /stats`, `GET /keys`, `POST /keys/generate`, `GET /keys/{id}`, `PUT /keys/{id}/revoke`, `PUT /keys/{id}/activate` |
| License | `/api/license` | `POST /validate`, `POST /activate` |
| Teams | `/api/teams` | Team management |
| Usage | `/api/usage` | Usage tracking |

**Removed route group:** `/api/reseller` — no longer exists.

---

## 3. Version History (v3.5.32 — v3.5.67)

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
| **v3.5.67** | **Remove reseller roles — keep only super_admin + customer (820 lines removed)** | **#146 (platform)** |

---

## 4. Build Artifacts

| Platform | File | Size | B2 URL |
|----------|------|------|--------|
| Windows | `SnapLeads Setup 3.5.65.exe` | ~694 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.65.exe` |
| macOS | `SnapLeads-3.5.65-arm64-mac.zip` | ~297 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.65-arm64-mac.zip` |

**Note:** v3.5.67 changes the license server (snapleads-platform repo), not the desktop app (social-lead-extractor-pro). Users continue using v3.5.65 desktop builds. The license server auto-deploys on Render from the merged main branch.

---

## 5. Repositories

| Repo | Purpose | Latest PR |
|------|---------|-----------|
| `harryroger798/social-lead-extractor-pro` | Desktop Electron app (backend + frontend) + weekly sync | PR #153 (v3.5.66 — weekly sync) |
| `harryroger798/snapleads-platform` | License server API + Marketing website (getsnapleads.store) | **PR #146 (v3.5.67 — reseller removal)** |
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

## 7. Platform Support (v3.5.65 desktop app)

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

## 8. Testing Results Summary (v3.5.32 — v3.5.65)

### Group A-G Test Results (v3.5.44 — best run)
| Group | Sessions | Total Leads | Avg/Session |
|-------|----------|-------------|-------------|
| A (Social + Location) | 6 | 3,233 | 539 |
| B (Social, No Location) | 4 | 2,750 | 688 |
| C (B2B + Location) | 4 | 6,126 | 1,532 |
| D (B2B, No Location) | 2 | 529 | 265 |
| E (DB-Only) | 3 | 2,138 | 713 |
| F (Full Pipeline) | 3 | 982 | 327 |
| G (Edge Cases) | 2 | 1,582 | 791 |
| **TOTAL** | **24** | **~17,340** | **~723** |

### 13-Feature UI Verification (v3.5.61)
All 13 features verified: New Extraction (4 modes), Results, History, Google Maps, Email Finder, Directories, Job Boards, Schedules, Dashboard, Settings/Logs

---

## 9. Credentials Reference

All credentials stored in Devin secrets + GitHub Actions encrypted secrets. Key services:
- **iDrive E2 S3:** `s3.us-west-1.idrivee2.com` / bucket: `crop-spray-uploads`
- **Backblaze B2:** bucket: `snapleads-downloads`
- **Render License API:** `https://snapleads-api.onrender.com`
- **Render Search API:** `https://snapleads-search-api.onrender.com`
- **GitHub PAT:** For API operations (PR creation, workflow triggers, secret management)
- **GitHub Actions Secrets:** IDRIVE_S3_ENDPOINT, IDRIVE_S3_BUCKET, IDRIVE_S3_ACCESS_KEY, IDRIVE_S3_SECRET_KEY

---

## 10. Devin Session

Link to Devin Session: https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a
Requested by: @bytepassperks (bytepass5@gmail.com)
