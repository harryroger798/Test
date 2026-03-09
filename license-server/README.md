# GrabTube License Server — Cloudflare Workers + D1

## Baby Steps Setup (100% Free, No Domain Required)

### Step 1: Create Cloudflare Account
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up with email + password (no credit card required)
3. Verify your email

### Step 2: Install Wrangler CLI
```bash
npm install -g wrangler
```

### Step 3: Login to Cloudflare
```bash
wrangler login
```
This opens your browser — click "Allow" to authorize.

### Step 4: Create D1 Database
```bash
cd license-server
wrangler d1 create grabtube-licenses
```
This outputs a database_id. Copy it.

### Step 5: Update wrangler.toml
Replace `REPLACE_WITH_YOUR_D1_DATABASE_ID` in `wrangler.toml` with your actual database_id.

### Step 6: Initialize Database Schema
```bash
wrangler d1 execute grabtube-licenses --file=./schema.sql
```

### Step 7: Set Admin Secrets
```bash
wrangler secret put ADMIN_EMAIL
# Enter: harryroger798@gmail.com

wrangler secret put ADMIN_PASSWORD
# Enter: 007JamesBond@@
```

### Step 8: Deploy
```bash
wrangler deploy
```

Your license server is now live at:
`https://grabtube-license.<your-account>.workers.dev`

No domain needed — Cloudflare gives you a free `*.workers.dev` subdomain.

### Step 9: Update GrabTube App
Update the `LICENSE_SERVER_URL` in `src/main/license-manager.ts` with your Worker URL.

---

## API Endpoints

### Public (used by GrabTube app)
- `POST /activate` — `{ key, deviceId, deviceName }`
- `POST /validate` — `{ key, deviceId }`
- `POST /deactivate` — `{ key, deviceId }`
- `GET /health` — Health check

### Admin (requires Bearer token)
- `POST /admin/login` — `{ email, password }` → returns `{ token }`
- `POST /admin/generate` — `{ tier, count, buyerName, buyerContact, notes }` → returns keys
- `GET /admin/keys?page=1&limit=50&filter=all` — List all keys
- `POST /admin/revoke` — `{ key }` → Revoke a key
- `GET /admin/stats` — Dashboard statistics

## Admin Usage Example

```bash
# Login
TOKEN=$(curl -s -X POST https://YOUR-WORKER.workers.dev/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"harryroger798@gmail.com","password":"007JamesBond@@"}' | jq -r .token)

# Generate 5 Pro keys
curl -X POST https://YOUR-WORKER.workers.dev/admin/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tier":"pro","count":5,"buyerName":"WhatsApp Customer"}'

# Generate 1 Family key
curl -X POST https://YOUR-WORKER.workers.dev/admin/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"tier":"family","count":1,"buyerName":"Family Customer"}'

# View stats
curl https://YOUR-WORKER.workers.dev/admin/stats \
  -H "Authorization: Bearer $TOKEN"
```

## Pricing Tiers

| | Free | Pro ($14.99) | Family ($29.99) |
|--|------|-------------|-----------------|
| Downloads/day | 5 | Unlimited | Unlimited |
| Max quality | 1080p | 8K | 8K |
| Concurrent downloads | 1 | 3 | 3 |
| Batch/playlist | No | Yes | Yes |
| Devices | 1 | 1 | 3 |

## Cost
- **Free tier:** 100,000 requests/day, 5GB D1 storage
- **Zero cold starts**
- **No domain required** — uses `*.workers.dev`
