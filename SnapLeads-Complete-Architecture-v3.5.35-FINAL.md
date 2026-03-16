# SnapLeads v3.5.35 — Complete Architecture Document

## Release: v3.5.35 (One-Click Automated Testing Button)
**Date**: March 15, 2026
**PR**: [#122](https://github.com/harryroger798/social-lead-extractor-pro/pull/122)
**Focus**: One-click automated testing button with full log collection and ZIP bundle aggregation

---

## Changes Overview

v3.5.35 adds a developer/QA testing button in Settings that runs a full test matrix (320 cases) across all keyword × platform × toggle combinations, collects backend + frontend logs, and bundles everything into a downloadable ZIP file. Includes all v3.5.34 reliability improvements (backend-ready gate, retry, splash).

---

## Test Matrix Architecture

### Test Matrix Generation
**File**: `frontend/src/lib/testMatrix.ts`

Generates 320 test cases from the cartesian product of:

| Dimension | Count | Values |
|-----------|-------|--------|
| Keywords | 16 | "Interior Designers in Kolkata", "Dentists in London", "Photographers in New York", etc. |
| Platform Groups | 5 | LinkedIn, Instagram, Facebook, Google Maps, All Platforms |
| Toggle Combos | 4 | {dorking: on/off} × {direct_scraping: on/off} |

**Total**: 16 × 5 × 4 = **320 test cases**

Each test case is a `TestCase` object:
```typescript
interface TestCase {
  id: string;           // "test-001"
  keyword: string;      // "Interior Designers in Kolkata"
  platforms: string[];  // ["linkedin"]
  dorking: boolean;
  directScraping: boolean;
  expectedCountry?: string;  // "India"
}
```

### Test Runner Hook
**File**: `frontend/src/hooks/useTestRunner.ts`

React hook `useTestRunner()` that manages test execution:

```
useTestRunner()
├── State: { running, progress, results[], currentTest, logs[] }
├── startTestRun()
│   ├── For each TestCase (sequential):
│   │   ├── POST /api/extract with test params
│   │   ├── Poll GET /api/extract/status every 3s
│   │   ├── Collect results + timing
│   │   ├── Log success/failure
│   │   └── Update progress (currentIndex / totalTests)
│   └── When complete: trigger ZIP bundle
├── stopTestRun() — abort current test
└── getTestReport() — summary statistics
```

### Test Runner UI
**File**: `frontend/src/components/settings/TestRunner.tsx`

Renders in the Settings page:
- **Start/Stop button** with progress bar
- **Live log viewer** showing real-time test output
- **Results table** with pass/fail per test case
- **Download ZIP** button when complete

---

## Backend Test Endpoints

### POST /api/test/start
**File**: `backend/app/api/test_runner.py`

Starts a test session. Creates a background task that:
1. Receives the test matrix from frontend
2. Executes each test case sequentially via the extraction pipeline
3. Collects backend logs per test case
4. Stores results in a session-scoped dictionary

### GET /api/test/status
Returns current test progress, results so far, and any errors.

### GET /api/test/logs
Returns collected backend logs for the current test session.

### GET /api/test/bundle
Generates and returns a ZIP file containing:
- `test-results.json` — structured test results
- `test-summary.txt` — human-readable summary
- `backend-logs.txt` — backend logs during test run
- `frontend-logs.txt` — frontend logs (sent from client)

---

## Electron IPC for Test Runner

### Log Relay
**File**: `electron/main.js`, `electron/preload.js`

The test runner sends frontend logs to Electron main process via IPC:
```
Renderer → preload.js → main.js → file system
                                 → backend /api/test/logs
```

### Bundle Folder Opening
When the ZIP bundle is downloaded, Electron opens the containing folder:
```javascript
electronAPI.openBundleFolder(zipPath)
// → shell.showItemInFolder(zipPath)
```

---

## Reliability Improvements (from v3.5.34)

All v3.5.34 improvements are included:

### Backend Readiness Gate
- `waitForBackend()` polls health check every 2s for 30s
- Three resolution paths: IPC signal, poll success, timeout fallback
- `_backendReadyResolve` callback pattern for immediate promise settlement

### Network Retry
- `fetchWithRetry()` with exponential backoff (2s, 4s, 6s)
- Only retries idempotent methods (GET/HEAD/OPTIONS)
- POST/PUT/DELETE throw immediately (no duplicate writes)

### Splash Screen
- Loading splash during backend boot window (2-5s)

---

## Bug Fixes (CodeRabbit Review)

### Bug #1: fetchWithRetry Retrying Mutating Methods
**Severity**: Critical

POST/PUT/DELETE were retried on network errors → duplicate writes possible.
**Fix**: Only GET/HEAD/OPTIONS are retried.

### Bug #2: IPC Signal Not Settling waitForBackend() Promise
**Severity**: Major

IPC `backend-ready` didn't resolve pending `waitForBackend()` promise.
**Fix**: `_backendReadyResolve` callback called by IPC handler.

### Bug #3: markBackendReady() Not Settling Pending Promise
**Severity**: Major

`markBackendReady()` set the flag but didn't resolve awaiting promises.
**Fix**: Now calls `_backendReadyResolve()` if pending.

---

## Data Flow: Test Run Lifecycle

```
User clicks "Run Tests" in Settings
              │
              ▼
    ┌─────────────────────┐
    │  testMatrix.ts      │
    │  Generate 320 cases │
    └─────────┬───────────┘
              │
              ▼
    ┌─────────────────────┐
    │  useTestRunner.ts   │
    │  Sequential runner  │
    └─────────┬───────────┘
              │
    ┌─────────┼──────────────┐
    │         │              │
    ▼         ▼              ▼
┌────────┐ ┌──────────┐ ┌──────────┐
│Frontend│ │ Backend   │ │ Electron │
│logs    │ │ POST /api │ │ IPC log  │
│collect │ │ /extract  │ │ relay    │
└───┬────┘ └────┬──────┘ └────┬─────┘
    │           │              │
    └───────────┼──────────────┘
                │
                ▼
    ┌─────────────────────┐
    │  GET /api/test/     │
    │  bundle             │
    │  → ZIP file with:   │
    │    - results.json   │
    │    - summary.txt    │
    │    - backend-logs   │
    │    - frontend-logs  │
    └─────────────────────┘
```

---

## Files Changed in v3.5.35

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `frontend/src/lib/testMatrix.ts` | ~120 new | Test matrix generation (320 cases) |
| `frontend/src/hooks/useTestRunner.ts` | ~180 new | React hook for test execution |
| `frontend/src/components/settings/TestRunner.tsx` | ~150 new | Test runner UI component |
| `frontend/src/components/settings/Settings.tsx` | ~10 | Integrate TestRunner into Settings |
| `backend/app/api/test_runner.py` | ~200 new | Backend test endpoints |
| `backend/app/main.py` | ~5 | Register test router |
| `electron/main.js` | ~20 | IPC log relay + folder opening |
| `electron/preload.js` | ~10 | IPC bridge for test runner |
| `frontend/src/lib/api.ts` | ~120 | waitForBackend + fetchWithRetry + IPC handler |
| `frontend/src/App.tsx` | ~20 | Splash screen |
| `frontend/src/lib/version.ts` | 1 | Version bump to 3.5.35 |
| `package.json` | 1 | Version bump to 3.5.35 |

---

## Version History (Recent)

| Version | Date | Changes |
|---------|------|---------|
| v3.5.35 | Mar 15, 2026 | One-click automated testing button + ZIP bundle + 3 bug fixes |
| v3.5.34 | Mar 15, 2026 | Backend-ready preload + retry + splash |
| v3.5.33 | Mar 15, 2026 | 6 location-aware filtering fixes |
| v3.5.32 | Mar 15, 2026 | Enhanced Google Dorking + Direct Scraping (7-module) |
| v3.5.31 | Mar 15, 2026 | Auto-Discovery Pipeline (5-stage adaptive) |
| v3.5.30 | Mar 14, 2026 | 5 Claude-recommended Facebook pipeline fixes |

---

## Download

**Windows**: [SnapLeads Setup 3.5.35.exe](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.35.exe)
