# Contributing to TextShift

## Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git

### Backend
```bash
cd textshift/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env with required variables (see README.md for the full list)
touch .env

# Run development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend
```bash
cd textshift/frontend
npm install
npm run dev
```

The frontend dev server runs on port 5173 and proxies API requests to port 8000.

## Deployment

**The production backend at `/opt/textshift/backend/` is NOT a git repository.** You cannot use `git pull` to deploy.

### Deploy Backend
```bash
# 1. Backup current state
ssh root@143.110.183.71 "cp -r /opt/textshift/backend/app /opt/textshift/backend/app.bak"

# 2. Transfer files (NEVER use --delete without excluding .env)
rsync -avz --exclude='.env' --exclude='*.db' --exclude='venv/' --exclude='__pycache__/' \
  textshift/backend/app/ root@143.110.183.71:/opt/textshift/backend/app/

# 3. Install any new dependencies
ssh root@143.110.183.71 "cd /opt/textshift/backend && source venv/bin/activate && pip install -r requirements.txt"

# 4. Restart service
ssh root@143.110.183.71 "systemctl restart textshift-backend"

# 5. Verify
ssh root@143.110.183.71 "systemctl status textshift-backend"
```

### Deploy Frontend
```bash
# 1. Build
cd textshift/frontend && npm run build

# 2. Transfer
rsync -avz dist/ root@143.110.183.71:/opt/textshift/frontend/dist/
```

### Rollback
```bash
# Backend rollback
ssh root@143.110.183.71 "cp -r /opt/textshift/backend/app.bak /opt/textshift/backend/app && systemctl restart textshift-backend"
```

## Branch Strategy

- `textshift/main` - stable branch for TextShift platform
- Feature branches: `devin/<timestamp>-<feature-name>`
- All PRs target `textshift/main`
- CodeRabbit reviews all PRs automatically

## Code Conventions

### Backend (Python)
- FastAPI with Pydantic models for request/response validation
- SQLAlchemy ORM for database models
- Service layer pattern: routers -> services -> models
- ML inference in `ml_service.py` and `writing_tools_service.py`
- Tier names are always capitalized: Free, Starter, Pro, Enterprise

### Frontend (TypeScript/React)
- Vite build tool with React 18
- Tailwind CSS for styling
- API client in `src/lib/api.ts`
- Pages in `src/pages/`, components in `src/components/`
- Brand name always written as "TextShift" (PascalCase)

## ML Models

Models are stored on the droplet at `/opt/textshift/models/` and backed up to iDrive e2 (`s3://crop-spray-uploads/`).

### Inference Priority
1. HuggingFace Inference API (free, fast, no local resources)
2. ONNX INT8 local inference (quantized, 2-4x faster than PyTorch)
3. PyTorch local inference (full precision fallback)

### Adding a New Model
1. Download/train model locally
2. Convert to ONNX if applicable (`optimum-cli export onnx`)
3. Upload to droplet `/opt/textshift/models/<model-name>/`
4. Back up to iDrive e2
5. Add inference code to `ml_service.py` or `writing_tools_service.py`
6. Add HuggingFace Inference API support in `hf_inference_client.py`

## Monitoring and Observability

TextShift uses Datadog for full-stack observability. See [DATADOG.md](DATADOG.md) for complete details.

### Key Components
- **Datadog Agent** runs on the droplet collecting system metrics, logs, and database stats
- **APM** via `ddtrace-run` wrapping gunicorn (zero application code changes)
- **RUM** via browser SDK in `index.html` for frontend performance
- **Synthetic monitors** check uptime every 5 minutes
- **Alerts** fire for disk/CPU/memory/latency/error thresholds

### After Deploying Changes
1. Check APM traces at [app.datadoghq.com/apm/traces](https://app.datadoghq.com/apm/traces)
2. Check logs at [app.datadoghq.com/logs](https://app.datadoghq.com/logs)
3. Verify no new errors in monitors at [app.datadoghq.com/monitors/manage](https://app.datadoghq.com/monitors/manage)

### Datadog Config Files
Configuration references are in `backend/datadog/`:
- `agent-config.yaml` - Main agent config
- `journald.yaml` - Log collection
- `postgres.yaml` - Database monitoring
- `nginx.yaml` - Web server monitoring
- `textshift-backend.service` - systemd service with ddtrace

## Environment Variables

Required environment variables are documented in the README. Store them in `/opt/textshift/backend/.env` on the droplet. Never commit `.env` files to the repository.
