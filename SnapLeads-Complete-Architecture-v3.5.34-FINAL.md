# SnapLeads v3.5.34 — Complete Architecture Document

## Release: v3.5.34 (Backend-Ready Preload + Retry + Splash)
**Date**: March 15, 2026
**PR**: [#121](https://github.com/harryroger798/social-lead-extractor-pro/pull/121)
**Focus**: 5 location-aware fixes + backend-ready preload + network retry + splash screen

---

## Changes Overview

v3.5.34 adds critical Electron desktop app reliability improvements: a backend readiness gate that prevents the UI from making API calls before the Python backend is running, network retry with exponential backoff for transient failures, and a splash screen during startup.

---

## 5 Key Changes

### 1. Backend Readiness Gate (`waitForBackend()`)
**File**: `frontend/src/lib/api.ts`

The Electron app spawns the Python backend as a child process, but the React UI loads faster than the backend boots. Previously, API calls would fail silently during the ~2-5s startup window.

**Solution**: `waitForBackend()` polls `GET /api/dashboard/stats` every 2s for up to 30s. Three resolution paths:
- **IPC signal**: Electron main process sends `backend-ready` via IPC when the backend health check passes
- **Poll success**: Health check returns 2xx
- **Timeout fallback**: After 30s, proceeds anyway (graceful degradation for desktop app)

**Key implementation details**:
- `_backendReadyResolve` callback pattern ensures IPC signal immediately settles pending `waitForBackend()` awaiters
- `markBackendReady()` also settles the promise (for UI-triggered resolution after splash)
- Interval guard checks `_backendReady` flag to stop redundant polling after external resolution

### 2. Network Retry with Exponential Backoff (`fetchWithRetry()`)
**File**: `frontend/src/lib/api.ts`

**Safety**: Only retries **idempotent methods** (GET/HEAD/OPTIONS) on **network errors** (TypeError). POST/PUT/DELETE throw immediately to prevent duplicate writes.

```
fetchWithRetry(url, options, maxRetries=3)
├── Extract method from options (default: GET)
├── Check idempotency (GET/HEAD/OPTIONS only)
├── For each attempt:
│   ├── Try fetch(url, options)
│   ├── On TypeError (network error):
│   │   ├── If NOT idempotent → throw immediately
│   │   └── If idempotent → backoff 2s, 4s, 6s
│   └── On other error (AbortError, DOMException) → throw immediately
└── After max retries → throw last error
```

### 3. Electron IPC Backend-Ready Signal
**File**: `electron/main.js`, `electron/preload.js`

The Electron main process:
1. Spawns the Python backend as a child process
2. Monitors stdout/stderr for `"Application startup complete"` or `"Uvicorn running"` messages
3. When detected, sets `backendReady = true` and sends `backend-ready` IPC message to renderer
4. Renderer's `onBackendReady` handler immediately resolves `waitForBackend()`

**Note**: The frontend's `waitForBackend()` polls `GET /api/dashboard/stats` as a fallback — the IPC signal from Electron is the primary (faster) path.

**Preload bridge** (`preload.js`):
```javascript
contextBridge.exposeInMainWorld('electronAPI', {
  onBackendReady: (callback) => ipcRenderer.on('backend-ready', callback),
  // ... other IPC methods
});
```

### 4. Splash Screen During Backend Startup
**File**: `frontend/src/App.tsx`

Shows a loading splash while `waitForBackend()` is pending. Prevents users from interacting with a broken UI during the 2-5s backend boot window.

### 5. Location-Aware Fixes (carried from v3.5.33)
Additional refinements to location filtering for country-targeted lead extraction.

---

## Bug Fixes (CodeRabbit Review)

### Bug #1: fetchWithRetry Retrying Mutating Methods
**Severity**: Critical
**Commit**: `cb9c751`

POST/PUT/DELETE requests were being retried on network errors, which could cause duplicate writes (e.g., creating duplicate leads, sending duplicate outreach emails).

**Fix**: Added method detection — only GET/HEAD/OPTIONS are retried.

### Bug #2: IPC Signal Not Settling waitForBackend() Promise
**Severity**: Major
**Commit**: `ab6b1a0`

When the IPC `backend-ready` signal fired while `waitForBackend()` was polling, the promise wasn't resolved. The splash screen would linger until the next poll success or 30s timeout.

**Fix**: Added `_backendReadyResolve` callback that IPC handler calls to immediately settle the promise.

### Bug #3: markBackendReady() Not Settling Pending Promise
**Severity**: Major
**Commit**: `cda37f3`

If `markBackendReady()` was called (from UI after splash) while `waitForBackend()` was pending, awaiters would hang because the promise wasn't resolved.

**Fix**: `markBackendReady()` now calls `_backendReadyResolve()` if a pending promise exists.

---

## Backend Readiness State Machine

```
                    ┌──────────────┐
                    │ _backendReady│
                    │   = false    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │IPC signal│ │Poll 2xx  │ │markBackend   │
        │(Electron)│ │(health   │ │Ready() (UI)  │
        │          │ │check OK) │ │              │
        └────┬─────┘ └────┬─────┘ └──────┬───────┘
             │            │              │
             └────────────┼──────────────┘
                          │
                          ▼
              ┌────────────────────┐
              │_backendReadyResolve│
              │ → sets flag true   │
              │ → resolves promise │
              │ → clears callback  │
              └────────────────────┘
                          │
                          ▼
              ┌────────────────────┐
              │ _backendReady      │
              │   = true           │
              │ API calls proceed  │
              └────────────────────┘
```

---

## Files Changed in v3.5.34

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `frontend/src/lib/api.ts` | ~120 added | waitForBackend(), fetchWithRetry(), IPC handler |
| `frontend/src/App.tsx` | ~20 | Splash screen during backend boot |
| `electron/main.js` | ~30 | Backend health polling + IPC signal |
| `electron/preload.js` | ~10 | IPC bridge for onBackendReady |
| `frontend/src/lib/version.ts` | 1 | Version bump to 3.5.34 |
| `package.json` | 1 | Version bump to 3.5.34 |

---

## Version History (Recent)

| Version | Date | Changes |
|---------|------|---------|
| v3.5.34 | Mar 15, 2026 | Backend-ready preload + retry + splash + 3 bug fixes |
| v3.5.33 | Mar 15, 2026 | 6 location-aware filtering fixes |
| v3.5.32 | Mar 15, 2026 | Enhanced Google Dorking + Direct Scraping (7-module) |
| v3.5.31 | Mar 15, 2026 | Auto-Discovery Pipeline (5-stage adaptive) |
| v3.5.30 | Mar 14, 2026 | 5 Claude-recommended Facebook pipeline fixes |
| v3.5.29 | Mar 14, 2026 | Complete Facebook pipeline rewrite (10 sources) |

---

## Download

**Windows**: [SnapLeads Setup 3.5.35.exe](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads%20Setup%203.5.35.exe) (657 MB) — v3.5.35 includes all v3.5.34 fixes
**Mac (ARM64)**: [SnapLeads-3.5.35-arm64-mac.zip](https://f005.backblazeb2.com/file/snapleads-downloads/SnapLeads-3.5.35-arm64-mac.zip) (278 MB)
