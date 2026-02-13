# TextShift

AI-powered content platform for text detection, humanization, plagiarism checking, and 14 writing tools.

**Live:** [https://textshift.org](https://textshift.org)

## Architecture

```
Frontend (React/Vite)  -->  Backend (FastAPI/Python)  -->  ML Models
     |                           |                          |
     v                           v                          v
  Nginx (443)            Gunicorn (8000)            Local + HF API + ONNX
  /opt/textshift/        /opt/textshift/            /opt/textshift/models/
  frontend/dist/         backend/                   
```

**Stack:** React 18 + TypeScript + Tailwind CSS | FastAPI + SQLite + Pydantic | PyTorch + ONNX Runtime + HuggingFace

**Droplet:** DigitalOcean 4GB RAM, 2 vCPU (143.110.183.71)

## Features

### Core Tools (3)
| Tool | Model | Tier |
|------|-------|------|
| AI Detector | RoBERTa-base (125M params) | Free (limited) |
| Humanizer | T5-base V3 + StealthWriter post-processor, 3 modes (Academic/Professional/Casual) | Starter+ |
| Plagiarism Checker | Sentence-BERT + Serper/DuckDuckGo web search | Starter+ |

### Writing Tools (14)
| Tool | Engine | Tier |
|------|--------|------|
| Grammar Checker | CoEdIT-large (770M params) + LanguageTool | Free |
| Tone Detector | RoBERTa (sentence-level + categories + consistency score) | Free |
| Tone Adjuster | CoEdIT-large (primary) + rule-based fallback | Starter+ |
| Readability Analyzer | Flesch/Kincaid/Gunning Fog + paragraph breakdown | Free |
| Summarizer | Flan-T5-base | Free |
| Paraphraser | CoEdIT-large (5 modes) | Free |
| Citation Generator | Serper API + formatting | Starter+ |
| Word Counter | Stats + keyword density + reading/speaking time | Free |
| Translator | Helsinki-NLP MarianMT (en-es, en-hi) | Free |
| Export | TXT (Free), HTML/Markdown/PDF (Starter+) | Tiered |
| Style Analysis | Rule-based POS + formality score + passive voice | Starter+ |
| Content Improver | CoEdIT-large (5 focus areas) | Starter+ |
| Bulk Processor | Any tool on multiple texts | Pro+ |

### Authentication
- Email/password (local JWT)
- Auth0 social login (Google, GitHub, Microsoft)
- Mailgun email verification

### ML Inference Pipeline
3-tier fallback: **HuggingFace Inference API** --> **ONNX INT8 local** --> **PyTorch local**

ONNX quantized models (75% smaller, 2-4x faster on CPU):
- `/opt/textshift/models/coedit-large-onnx/`
- `/opt/textshift/models/flan-t5-base-onnx/`

## Project Structure

```
textshift/
  backend/
    app/
      core/           # config.py, security.py (JWT + Auth0 validation)
      models/         # user.py (SQLAlchemy)
      routers/        # auth.py, scan.py, writing_tools.py, admin.py, credits.py
      schemas/        # Pydantic request/response models
      services/       # ml_service.py, writing_tools_service.py, hf_inference_client.py
    requirements.txt
  frontend/
    src/
      components/     # SocialLoginButtons, UI components
      lib/            # api.ts, auth0.ts, performance.ts
      pages/          # Dashboard, WritingTools, ApiDocsPage, LoginPage, etc.
    public/           # sitemap.xml, robots.txt, sw.js
```

## Development

### Prerequisites
- Python 3.10+ with virtualenv
- Node.js 18+ with npm
- PyTorch, ONNX Runtime, transformers, fpdf2

### Backend
```bash
cd textshift/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd textshift/frontend
npm install
npm run dev      # development
npm run build    # production build
```

### Environment Variables
Backend requires `.env` at `/opt/textshift/backend/.env`:
```
SECRET_KEY=<jwt-secret>
DATABASE_URL=sqlite:///./textshift.db
HUGGINGFACE_TOKEN=<hf-token>
MAILGUN_API_KEY=<mailgun-key>
PAYPAL_CLIENT_ID=<paypal-id>
PAYPAL_SECRET_KEY=<paypal-secret>
SERPER_API_KEY=<serper-key>
AUTH0_DOMAIN=<auth0-domain>
AUTH0_CLIENT_ID=<auth0-client-id>
AUTH0_CLIENT_SECRET=<auth0-secret>
AWS_ACCESS_KEY_ID=<aws-key>
AWS_SECRET_ACCESS_KEY=<aws-secret>
AWS_DEFAULT_REGION=us-east-1
```

## Deployment

The backend on the droplet is **not a git repo**. Deploy via file transfer:

```bash
# Backend
scp -r backend/app/ root@143.110.183.71:/opt/textshift/backend/app/
ssh root@143.110.183.71 "systemctl restart textshift-backend"

# Frontend
cd textshift/frontend && npm run build
scp -r dist/* root@143.110.183.71:/opt/textshift/frontend/dist/
```

**Never use `rsync --delete` without excluding `.env`** - it will wipe API keys.

## Pricing Tiers

| Tier | Words/Day | Features |
|------|-----------|----------|
| Free | 500 | AI Detection, basic writing tools |
| Starter | 5,000 | + Humanizer, Plagiarism, Tone Adjuster, PDF export |
| Pro | Unlimited | + Bulk processing |
| Enterprise | Unlimited | + API access |

## Monitoring with Datadog

Full observability via Datadog (Startup Plan, $100K credits). See [DATADOG.md](DATADOG.md) for complete setup details.

| Component | What It Monitors |
|-----------|-----------------|
| Infrastructure | CPU, memory, disk, network (Datadog Agent) |
| APM | Request traces, latency, errors (`ddtrace-run` wrapper) |
| Logs | systemd journal (backend, nginx, PostgreSQL) |
| Database | PostgreSQL queries, connections, table sizes |
| RUM | Frontend page loads, JS errors, user sessions |
| Session Replay | Full user interaction recordings |
| Synthetics | Homepage, API, Grammar Tool uptime + SSL expiry |
| Alerts | Disk >80%, CPU >90%, Memory >90%, Latency >10s, Errors >5% |
| Profiler | Continuous CPU/memory profiling |
| ASM | Application security / attack detection |

**Dashboard:** [app.datadoghq.com](https://app.datadoghq.com)

Configuration files in `backend/datadog/`:
- `agent-config.yaml` - Datadog Agent main config
- `journald.yaml` - Log collection from systemd
- `postgres.yaml` - PostgreSQL monitoring
- `nginx.yaml` - Nginx monitoring
- `textshift-backend.service` - systemd service with ddtrace

## External Services
- **Mailgun** - transactional email (verification, password reset)
- **PayPal** - subscription payments
- **Auth0** - social login (Google, GitHub, Microsoft)
- **Serper.dev** - web search for plagiarism + citations
- **HuggingFace** - inference API + model hosting
- **iDrive e2** - S3-compatible storage for model backups
- **Google Analytics 4** - cross-domain tracking (textshift.org + textshift.blog)
- **Datadog** - infrastructure monitoring, APM, RUM, synthetics, alerts

## Related
- **TextShift Blog:** [textshift.blog](https://textshift.blog) (separate repo, Sanity CMS + Next.js)
- **HuggingFace Spaces:** harryroger798/ai-text-detector, harryroger798/humanizer-v2, harryroger798/plagiarism-detector
