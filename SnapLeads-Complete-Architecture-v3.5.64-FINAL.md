# SnapLeads Complete Architecture Document — v3.5.64

**Date:** March 22, 2026
**Version:** 3.5.64
**Status:** Production-ready (PNG platform logo replacement)

---

## 1. What's New in v3.5.64

### Replace SVG Platform Icons with High-Quality Transparent PNG Logos

All 20 platform icons in the New Extraction sidebar have been replaced from inline SVG paths to high-quality transparent PNG images provided by the user.

| Change | File | Details |
|--------|------|---------|
| **20 PNG logos added** | `frontend/src/assets/platform-logos/` | Transparent background PNGs for all social + B2B platforms |
| **PlatformIcons.tsx rewritten** | `frontend/src/components/icons/PlatformIcons.tsx` | Replaced 20 SVG icon functions with image-based components using `<img>` tags |
| **Backward-compatible** | Same file | `PLATFORM_ICONS` mapping retains identical keys — zero changes needed in NewExtraction.tsx |
| **No cutting/distortion** | Component code | Icons render with `objectFit: 'contain'` + `width/height: 100%` |

### Platforms Covered (20 total)

**Social (12):** LinkedIn, Google Maps, Reddit, Telegram, Instagram, Facebook, Twitter/X, WhatsApp, TikTok, YouTube, Pinterest, Email

**B2B (8):** IndiaMART, Email Finder B2B, TradeIndia, ExportersIndia, JustDial, Google Maps B2B, GitHub B2B, Business Directories

### Implementation Details

```typescript
// Each platform icon is created via a factory function:
function createPlatformIcon(src: string, alt: string) {
  return function PlatformIcon({ className, style }: PlatformIconProps) {
    return (
      <img src={src} alt={alt} className={className}
        style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }}
        draggable={false} />
    );
  };
}

// Usage unchanged in NewExtraction.tsx:
const Icon = PLATFORM_ICONS[p.id];
{Icon ? <Icon className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
```

PNG imports are handled natively by Vite (returns URL strings). TypeScript declarations from `vite/client` (already in `tsconfig.app.json`) provide type support.

---

## 2. Version History (v3.5.32 — v3.5.64)

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
| v3.5.59 | YellowPages max_delay fix + Job Boards dorking improvement | #146 |
| v3.5.60 | Directories page-visit enrichment + Indeed RSS + APScheduler | #147 |
| v3.5.61 | Indeed RSS wired into endpoint + RemoteOK + Arbeitnow | #148 |
| v3.5.62 | Startup Directories feature (npm + PyPI + GitHub + HN + contact scraping) | #149 |
| v3.5.63 | 5 sleep/resume/crash resilience fixes (progress, detection, batch save, graceful shutdown, recovery) | #150 |
| **v3.5.64** | **Replace SVG platform icons with 20 high-quality transparent PNG logos** | **#151** |

---

## 3. Build Artifacts

| Platform | File | Size | B2 URL |
|----------|------|------|--------|
| Windows | `SnapLeads Setup 3.5.64.exe` | ~658 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.64.exe` |
| macOS | `SnapLeads-3.5.64-arm64-mac.zip` | ~279 MB | `https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.64-arm64-mac.zip` |

**Build:** GitHub Actions Run #23398208061 (Windows + macOS — both SUCCESS)
**Tag:** `v3.5.64`

---

## 4. Repositories

| Repo | Purpose | Latest PR |
|------|---------|-----------|
| `harryroger798/social-lead-extractor-pro` | Desktop Electron app (backend + frontend) | PR #151 (v3.5.64 — PNG logos) |
| `harryroger798/snapleads-platform` | Marketing website (getsnapleads.store) | PR #140 (download links v3.5.64) |
| `harryroger798/Test` | Architecture documentation | This PR |
| `bytepassperks/snapleads-search-api` | Render search API (DuckDB proxy) | PR #1 |

---

## 5. Database Infrastructure

| Database | Records | Location | Query Method |
|----------|---------|----------|-------------|
| LinkedIn | 86.9M | iDrive E2 S3 (us-west-1) | DuckDB httpfs |
| Instagram | 2.45M | iDrive E2 S3 | DuckDB httpfs |
| Google Maps | 32K+ | iDrive E2 S3 | DuckDB httpfs |
| PAN India | 101M+ | iDrive E2 S3 | DuckDB httpfs |
| YouTube | 1,085 channels | iDrive E2 S3 | DuckDB httpfs |
| Apify B2B | 101 leads | iDrive E2 S3 | DuckDB httpfs |
| Apify GMaps | 9,306 businesses | iDrive E2 S3 | DuckDB httpfs |
| **TOTAL** | **~190M+** | | |

---

## 6. Platform Support (v3.5.64)

### Social Platforms (DB + Live Scraping + Dorking)
LinkedIn, Instagram, Facebook, Google Maps, Twitter/X, Telegram, WhatsApp, YouTube, TikTok, Pinterest, Reddit, Snapchat

### B2B Platforms (Live Scraping + Dorking)
IndiaMART, TradeIndia, ExportersIndia, JustDial, Google Maps B2B, Email Finder B2B, GitHub B2B, Business Directories

### Standalone Features
- Google Maps Scraper (httpx + YellowPages + Yelp)
- Email Finder (website contact page crawler)
- Directories (YellowPages + Yelp + page-visit enrichment)
- Job Boards (Indeed RSS + Arbeitnow + RemoteOK + dorking)
- Startup Directories (npm + PyPI + GitHub + HN + contact scraping)
- Schedules (APScheduler — daily/weekly/monthly)

---

## 7. Sleep/Resume/Crash Behavior (v3.5.64)

| Scenario | What Happens | Data Lost? |
|----------|-------------|------------|
| **Laptop sleep** | Backend suspends. On resume, continues from exact point. Frontend detects gap, force-refreshes. | No |
| **App closed (X button)** | Graceful shutdown: saves unsaved leads in batch, marks sessions completed, then exits. | Minimal (last <100 leads) |
| **Laptop shutdown** | Same graceful shutdown flow via `before-quit` event. | Minimal (last <100 leads) |
| **Crash / force kill** | On next launch: orphaned sessions recovered, batch-saved leads preserved + counted. | Only in-memory leads since last batch |

### Batch Save Timeline
```
Lead 1-100:   saved + committed to SQLite
Lead 101-200: saved + committed to SQLite
Lead 201-300: saved + committed to SQLite
...
Lead N:       << CRASH HERE >>
Result:       Leads 1-300 preserved. Leads 301-N lost.
              On restart: session marked "completed", total_leads = 300
```

---

## 8. Testing Results Summary (v3.5.32 — v3.5.64)

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

All credentials stored in Devin secrets. Key services:
- **iDrive E2 S3:** `s3.us-west-1.idrivee2.com` / bucket: `crop-spray-uploads`
- **Backblaze B2:** bucket: `snapleads-downloads`
- **Render Search API:** `https://snapleads-search-api.onrender.com`
- **GitHub PAT:** For API operations (PR creation, workflow triggers)

---

## 10. Devin Session

Link to Devin Session: https://app.devin.ai/sessions/ce8b4f755691410d815688ff59aefd1a
Requested by: @bytepassperks (bytepass5@gmail.com)
