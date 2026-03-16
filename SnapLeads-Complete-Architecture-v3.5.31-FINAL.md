# SnapLeads v3.5.31 — Auto-Discovery Pipeline Architecture

## Release Summary

**Version:** 3.5.31
**Date:** March 15, 2026
**PR:** [#118](https://github.com/harryroger798/social-lead-extractor-pro/pull/118)
**Type:** Major Feature — Auto-Discovery Pipeline

## What's New

v3.5.31 introduces the **Auto-Discovery Pipeline** — a 5-stage adaptive directory scraping system that can find leads for ANY keyword without hardcoded sources. Instead of relying on platform-specific scrapers (Facebook, LinkedIn, etc.), this pipeline uses search engines as a discovery layer to find directory listing pages, then extracts contacts from arbitrary HTML.

### Key Capabilities
- Works for **any keyword**: wedding photographers, plumbers, dentists, gym instructors, restaurants, real estate agents, etc.
- **Zero API keys** required — uses DuckDuckGo HTML, Bing, Yahoo (all free)
- **Zero browser automation** — pure HTTP via curl_cffi TLS impersonation
- **4-layer extraction**: JSON-LD > Microdata > Heuristic DOM > Regex fallback
- **Auto-pagination**: detects and follows pagination links (up to 5 pages)
- **Smart deduplication**: by phone (last 10 digits) and email
- Expected yields: **60-200 leads per query**, 8-15 minutes runtime

---

## 5-Stage Architecture

### Stage 1: Source Discovery Engine
**File:** `backend/app/services/auto_discovery.py` — `discover_sources()`

Generates search queries designed to surface directory listing pages, then queries three search engines:

**Query Generation** (`_build_discovery_queries()`):
```
{keyword} {location} directory
{keyword} {location} listings
{keyword} {location} contact details phone email
{keyword} {location} reviews
best {keyword} in {location}
top {keyword} {location}
{keyword} {location} yellowpages OR justdial OR sulekha OR yelp OR manta
{keyword} {location} phone number address
{keyword} {location} business list
```

**Search Engines:**
1. **DuckDuckGo HTML** (`_search_ddg_html()`) — POST to `html.duckduckgo.com/html/`, parse result links, unwrap DDG redirect URLs (`uddg=` parameter)
2. **Bing HTML** (`_search_bing_html()`) — GET `bing.com/search`, parse `#b_results .b_algo h2 a` links
3. **Yahoo HTML** (`_search_yahoo_html()`) — GET `search.yahoo.com/search`, unwrap Yahoo redirect URLs (`RU=` parameter)

**Output:** Deduplicated list of candidate URLs (one per domain)

---

### Stage 2: Directory Fingerprinter
**File:** `auto_discovery.py` — `score_url()`, `lightweight_probe()`

Scores each discovered URL to filter out non-directory pages:

| Signal | Score | Example |
|--------|-------|---------|
| Known directory domain | +40 | yelp.com, justdial.com, yellowpages.com |
| Listing path pattern | +20 | /search, /find, /listing, /directory, /results |
| Has query parameters | +15 | ?q=plumbers&location=mumbai |
| Single business page | -30 | /biz/acme-plumbing, /profile/john-doe |
| Social media / e-commerce | -50 | facebook.com, amazon.com, wikipedia.org |

**Threshold:** Score >= 10 = `fetch_recommended`
**Fallback:** If no URLs pass threshold, top 5 are used regardless

**Known Directories (47 domains):**
- Global: Yelp, YellowPages, Manta, BBB, Foursquare, MapQuest
- India: JustDial, Sulekha, IndiaMart, TradeIndia, UrbanCompany
- UK: Yell, ThomsonLocal, Scoot
- Australia: TrueLocal, YellowPages.com.au
- Canada: YellowPages.ca, Canada411
- Wedding: WedMeGood, ShaadiSaga, WeddingWire, TheKnot, Zola
- Real Estate: 99acres, MagicBricks, Housing, Zillow, Realtor, Trulia
- Jobs: Glassdoor, Indeed, Naukri, LinkedIn

---

### Stage 3: Adaptive Contact Extractor
**File:** `auto_discovery.py` — `extract_leads_from_html()`

4-layer extraction cascade, each more aggressive than the last:

#### Layer 1: JSON-LD (Highest Quality)
- Parses `<script type="application/ld+json">` blocks
- Recognizes Schema.org types: LocalBusiness, Organization, Person, Physician, RealEstateAgent, Restaurant, Store, ProfessionalService, etc.
- Extracts: name, telephone, email, address (streetAddress, locality, region, postalCode, country), url

#### Layer 2: Microdata
- Parses `itemtype="schema.org/..."` and `itemprop="..."` attributes
- Skips honeypot elements (display:none, visibility:hidden, opacity:0)
- Extracts same fields as JSON-LD from HTML attributes

#### Layer 3: Heuristic DOM Pattern Recognition
- **Container detection** (`_find_listing_containers()`):
  - Strategy 1: Find elements with listing-related class names (result, listing, business, card, item, entry, etc.)
  - Strategy 2: Find most repeated tag+class combo (directories always use identical containers)
- **Per-container extraction** (`_extract_from_container()`):
  - Name: from h2/h3/h4 or `[class*='name']`, `[class*='title']`
  - Phone: from `tel:` links (most reliable), then regex patterns
  - Email: from `mailto:` links, then regex (skips honeypots)
  - Website: from external `<a>` links (skips directory self-links and social media)
  - Address: from `[class*='address']`, `[itemprop='address']`, `<address>` tags

#### Layer 4: Full-Page Regex Fallback
- Extracts all phone numbers from page text using 7 regex patterns (international, Indian mobile, US/Canada, UK, etc.)
- Deduplicates by raw digits
- Looks at surrounding lines for business names
- Searches nearby context for email addresses

---

### Stage 4: Anti-Bot Handling & Pagination
**File:** `auto_discovery.py` — `_is_blocked()`, `_detect_pagination()`

**Bot Detection:**
- Checks first 5KB of HTML for block indicators: "just a moment", "checking your browser", "access denied", "captcha", "ray id", etc.
- Skips blocked pages without wasting extraction time

**Auto-Pagination:**
- Detects "Next" links (text matching next/>>)
- Detects numbered page links (?page=N, /page/N patterns)
- Scrapes up to 5 additional pages per source
- Only triggers pagination if initial page yields < 20 leads

**Rate Limiting:**
- Uses existing AdSession with per-domain rate limiting (2.5s base delay)
- Exponential backoff on 429/503 responses
- TLS fingerprint impersonation via curl_cffi

---

### Stage 5: Pipeline Orchestrator
**File:** `auto_discovery.py` — `run_auto_discovery()`

Ties all stages together:

```
1. discover_sources(keyword, location)
   → 4 random queries × 3 engines → deduplicated URLs

2. score_url() for each URL
   → Sort by score, take top 15 with fetch_recommended=True

3. For each top URL:
   a. Fetch with AdSession (timeout=15s, retries=2)
   b. Check for bot blocks
   c. extract_leads_from_html() — 4-layer cascade
   d. If leads < 20, detect and scrape pagination
   e. Tag leads with source metadata

4. Final deduplication by phone (last 10 digits) and email
   → Return up to max_leads results
```

---

## Integration Points

### As Platform Scraper
- Registered as 13th platform (`auto_discovery`) in `_PLATFORM_SCRAPERS` dict
- `scrape_auto_discovery(query, location, max_results)` — wrapper function in `live_scrapers.py`
- Callable via existing `live_scrape_platform("auto_discovery", query, location)`

### Dedicated API Endpoint
- `POST /api/auto-discovery`
- Body: `{"keyword": "...", "location": "...", "max_leads": 200}`
- Response: `{"keyword", "location", "total_leads", "leads": [...]}`
- Runs in thread pool (`_LIVE_SCRAPE_POOL`) to avoid blocking async event loop

### Lead Format
Each lead dict contains:
```json
{
  "name": "Business Name",
  "phone": "+91-9876543210",
  "email": "info@business.com",
  "website": "https://business.com",
  "address": "123 Main St, Mumbai, MH 400001",
  "source": "justdial.com",
  "source_url": "https://justdial.com/Mumbai/Plumbers",
  "keyword": "plumbers",
  "location": "Mumbai",
  "platform": "auto_discovery"
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/app/services/auto_discovery.py` | **NEW** — Full 5-stage pipeline (~550 lines) |
| `backend/app/services/live_scrapers.py` | Added `scrape_auto_discovery()` wrapper + platform registration |
| `backend/app/api/routes.py` | Added `POST /api/auto-discovery` endpoint |
| `.github/workflows/build-release.yml` | Added `--hidden-import=app.services.auto_discovery` |
| `package.json` | Version bump to 3.5.31 |
| `frontend/src/lib/version.ts` | Version bump to 3.5.31 |

---

## Test Keywords

Try these keyword + location combinations to test the pipeline:

| Keyword | Location | Expected Sources |
|---------|----------|-----------------|
| wedding photographers | Mumbai | WedMeGood, JustDial, Sulekha |
| plumbers | London | Yell, ThomsonLocal, YellowPages |
| dentists | New York | Yelp, YellowPages, Manta |
| real estate agents | Delhi | 99acres, MagicBricks, JustDial |
| gym instructors | Bangalore | JustDial, Sulekha, UrbanCompany |
| restaurants | Sydney | TrueLocal, YellowPages.com.au |
| electricians | Toronto | YellowPages.ca, Canada411 |
| yoga studios | San Francisco | Yelp, Google Maps directories |
| chartered accountants | Pune | JustDial, Sulekha, IndiaMart |
| pet groomers | Chicago | Yelp, YellowPages, Manta |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v3.5.31 | Mar 15, 2026 | Auto-Discovery Pipeline (5-stage adaptive directory scraping) |
| v3.5.30 | Mar 15, 2026 | 5 Claude-recommended fixes, 14-source Facebook pipeline |
| v3.5.29 | Mar 15, 2026 | Complete Facebook pipeline rewrite with 10 sources |
| v3.5.28 | Mar 14, 2026 | 3-bug fix (platform tagging, Facebook, dorking CAPTCHA) |
