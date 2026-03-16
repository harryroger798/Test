# SnapLeads v3.5.33 — Complete Architecture Document

## Release: v3.5.33 (Location-Aware Filtering)
**Date**: March 15, 2026
**PR**: [#120](https://github.com/harryroger798/social-lead-extractor-pro/pull/120)
**Focus**: 6 location-aware filtering fixes for country-targeted lead extraction

---

## Critical Issue Fixed

**Problem**: Searches like "Interior Designers in Kolkata" returned leads from ALL countries instead of only the target location (India).

**Root Cause**: The `country` field was always inserted as an empty string `""` in the SQLite database, and Instagram/supplementary databases had no post-query location filtering.

---

## 6 Fixes Implemented

### Fix #1: Instagram Post-Query Location Filter
**File**: `backend/app/services/database_search.py`
**Function**: `filter_leads_by_location()`

Instagram parquet files on S3 lack a `country` column. After querying, we now infer each lead's country using 4 cascading signals:

| Signal | Source | Confidence |
|--------|--------|------------|
| Phone prefix | `+91` → India | 90% |
| Email TLD | `.co.in` → India | 85% |
| City name in location/address | "Mumbai" → India | 75% |
| City name in bio/industry | "Kolkata office" → India | 70% |

Leads with NO signal are kept but flagged as `country_confidence='assumed'`.

**Integration point**: Applied after `search_database_instagram()` returns results inside `_search_database_hybrid_inner()`.

### Fix #2: Render API Post-Filter
**File**: `backend/app/services/database_search.py`
**Location**: `search_database_hybrid()` after Render API returns

Even though we send the `location` parameter to the Render API server, the server may not filter Instagram results (no country column in parquet). Client-side `filter_leads_by_location()` is applied as a safety net after Render API results come back.

### Fix #3: Country Field Population on ALL Leads
**File**: `backend/app/api/routes.py`
**Function**: `_infer_country_from_lead(lead_data, location_hint)`

The core fix. Before every `INSERT OR IGNORE INTO leads`, we now call `_infer_country_from_lead()` which uses 5 cascading signals:

1. **Phone prefix** (90%): Maps `+91` → "India", `+44` → "United Kingdom", etc.
2. **Email TLD** (85%): Maps `.co.in` → "India", `.co.uk` → "United Kingdom", etc.
3. **Lead's location/address** (75%): City name matching against 50+ cities
4. **Location hint from keyword** (70%): Parsed from "Interior Designers **in Kolkata**"
5. **Existing country field** (60%): If source already provides it

**Lookup dictionaries** (defined at module level):
- `_PHONE_PREFIX_TO_COUNTRY`: 50+ phone prefixes
- `_EMAIL_TLD_TO_COUNTRY`: 30+ email TLDs
- `_CITY_TO_COUNTRY`: 50+ major cities worldwide

### Fix #4: Location-Aware Dorking Queries
**File**: `backend/app/services/google_dorking.py`
**Function**: `build_location_aware_queries()` (carried from v3.5.32)

Generates diverse dork queries across 7 intents:
1. Contact harvesting (email/phone)
2. Directory & listing sites (JustDial, Sulekha, YellowPages, Yelp)
3. Social profiles (LinkedIn, Instagram, Twitter)
4. Review & niche sites (Practo, Lybrate, Healthgrades)
5. Document/PDF leaks
6. Facebook (broadened)
7. Generic open web

### Fix #5: Location-Aware Directory URLs
**File**: `backend/app/services/enhanced_direct_scraper.py`
**Function**: `build_location_aware_urls()`

Pre-builds URLs for known directory sites with predictable URL patterns:

| Directory | URL Pattern |
|-----------|-------------|
| JustDial | `justdial.com/{location}/{keyword}` |
| Sulekha | `sulekha.com/{keyword}/{location}` |
| IndiaMART | `dir.indiamart.com/{keyword}/{location}.html` |
| YellowPages | `yellowpages.com/{location}/{keyword}` |
| Yelp | `yelp.com/search?find_desc={keyword}&find_loc={location}` |
| Clutch | `clutch.co/directory?q={keyword}&location={location}` |
| Bark | `bark.com/{location}/{keyword}` |

These URLs are automatically added to `run_enhanced_direct_scraping()` when a location is present, guaranteeing at least some location-relevant scraping targets.

### Fix #6: Auto-Enable Supplementary Databases
**File**: `backend/app/services/database_search.py`
**Location**: `_search_database_hybrid_inner()`

When a location is detected:
- **Google Maps** (PhantomBuster data) is auto-enabled — has rich address/phone fields
- **PAN India** is auto-enabled for Indian locations — has city/state fields

Previously these only ran if the user explicitly selected "google_maps" or "pan_india" as platforms.

---

## Data Flow: Location Filtering Pipeline

```
User enters: "Interior Designers in Kolkata"
                    │
                    ▼
         ┌─────────────────────┐
         │  keyword_parser.py  │
         │  Extract location:  │
         │  "kolkata"          │
         └─────────┬───────────┘
                    │
        ┌───────────┼───────────┐
        │           │           │
        ▼           ▼           ▼
   ┌─────────┐ ┌──────────┐ ┌──────────────┐
   │LinkedIn │ │Instagram │ │Google Maps   │
   │(has     │ │(NO       │ │(PhantomBuster│
   │country) │ │country)  │ │has address)  │
   └────┬────┘ └────┬─────┘ └──────┬───────┘
        │           │              │
        │      ┌────▼─────┐       │
        │      │ Fix #1:  │       │
        │      │ filter_  │       │
        │      │ leads_by_│       │
        │      │ location │       │
        │      └────┬─────┘       │
        │           │              │
        ▼           ▼              ▼
   ┌─────────────────────────────────┐
   │      ALL leads collected        │
   │                                 │
   │  Fix #3: _infer_country_from_   │
   │  lead() runs BEFORE INSERT      │
   │  → country field NEVER empty    │
   └─────────────────────────────────┘
```

---

## Database Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL DEFAULT '',
    platform TEXT NOT NULL,
    source_url TEXT NOT NULL DEFAULT '',
    keyword TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',    -- v3.5.33: Now populated via _infer_country_from_lead()
    email_type TEXT NOT NULL DEFAULT 'unknown',
    verified INTEGER NOT NULL DEFAULT 0,
    quality_score INTEGER NOT NULL DEFAULT 0,
    extracted_at TEXT NOT NULL,
    session_id TEXT NOT NULL,
    source_platform TEXT NOT NULL DEFAULT '',  -- v3.5.28: Original platform tag
    UNIQUE(email, phone, session_id)
);
```

---

## S3 Data Sources (iDrive E2)

| Database | S3 Path | Records | Has Country? |
|----------|---------|---------|--------------|
| LinkedIn | `s3://crop-spray-uploads/leads-cm-database/linkedin/{Country}/` | 86.9M | Yes (folder name) |
| Instagram | `s3://crop-spray-uploads/leads-cm-database/instagram/` | 2.45M | No → Fix #1 |
| Google Maps | `s3://crop-spray-uploads/leads-cm-database/googlemaps/` | PhantomBuster | Has address |
| PAN India | `s3://crop-spray-uploads/leads-cm-database/pan_india/` | leads.cm | Has city/state |
| YouTube | `s3://crop-spray-uploads/leads-cm-database/youtube/` | v3.5.26 | No |

---

## Search Architecture (v3.5.33)

```
search_database_hybrid()
├── Try Render API first (fast ~2-9s)
│   ├── POST /api/search with location param
│   ├── Fix #2: filter_leads_by_location() on results
│   └── Return if successful
│
└── Fallback: Direct S3 DuckDB queries
    └── _search_database_hybrid_inner()
        ├── Phase 1: LinkedIn (country-filtered at SQL level)
        ├── Phase 2: Instagram + Fix #1 (post-query location filter)
        ├── Phase 3: Supplementary (Google Maps, PAN India, YouTube)
        │   └── Fix #6: Auto-enabled when location detected
        └── Master timeout: 600s
```

---

## Dorking + Scraping Architecture (v3.5.32-33)

```
dorking_search()
├── Fix #4: build_location_aware_queries() (7 intents)
├── Serper API (primary, paid)
├── Multi-engine search (Brave/DDG/Startpage/etc.)
└── Patchright→DDG fallback (free)

run_enhanced_direct_scraping()
├── Fix #5: build_location_aware_urls() auto-added
├── Tier 1: curl_cffi parallel (static sites)
└── Tier 2: Patchright sequential (JS-heavy sites)
```

---

## Version History (Recent)

| Version | Date | Changes |
|---------|------|---------|
| v3.5.33 | Mar 15, 2026 | 6 location-aware filtering fixes |
| v3.5.32 | Mar 15, 2026 | Enhanced Google Dorking + Direct Scraping (7-module) |
| v3.5.31 | Mar 15, 2026 | Auto-Discovery Pipeline (5-stage adaptive) |
| v3.5.30 | Mar 14, 2026 | 5 Claude-recommended Facebook pipeline fixes |
| v3.5.29 | Mar 14, 2026 | Complete Facebook pipeline rewrite (10 sources) |
| v3.5.28 | Mar 13, 2026 | 3-bug fix (platform re-tagging, DDG, Patchright) |

---

## Test Keywords for v3.5.33

| Keyword | Expected Country | Signal Used |
|---------|-----------------|-------------|
| "Interior Designers in Kolkata" | India | City → Country |
| "Dentists in London" | United Kingdom | City → Country |
| "Real Estate Agents in Dubai" | UAE | City → Country |
| "Photographers in New York" | United States | City → Country |
| "Software Companies in Bangalore" | India | City → Country |
| "Restaurants in Tokyo" | Japan | City → Country |
| "Lawyers in Toronto" | Canada | City → Country |
| "Web Developers" (no location) | All countries | No filter applied |

---

## Files Changed in v3.5.33

| File | Lines Added | Purpose |
|------|-------------|---------|
| `backend/app/api/routes.py` | ~160 | Fix #3: `_infer_country_from_lead()` + lookup dicts |
| `backend/app/services/database_search.py` | ~170 | Fix #1, #2, #6: Location filter + auto-enable DBs |
| `backend/app/services/enhanced_direct_scraper.py` | ~90 | Fix #5: Location-aware URL builder |
| `frontend/src/lib/version.ts` | 1 | Version bump to 3.5.33 |
| `package.json` | 1 | Version bump to 3.5.33 |
