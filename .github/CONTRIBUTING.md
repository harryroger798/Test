# Contributing

This repository contains two separate projects. Please follow the guidelines for the project you're contributing to.

## Repository Structure

```
/                          # VedicStarAstro (Next.js frontend)
  src/                     # VedicStarAstro pages and components
  server/                  # VedicStarAstro Express backend
  backend/vedicstarastro-api/  # VedicStarAstro Python API
  .github/workflows/       # CI/CD workflows

textshift/                 # TextShift (separate project)
  backend/                 # TextShift FastAPI backend
  frontend/                # TextShift React/Vite frontend
  README.md                # TextShift-specific documentation
  CHANGELOG.md             # TextShift change history
```

## Branch Strategy

| Branch | Project | Purpose |
|--------|---------|---------|
| `setup-main` (default) | VedicStarAstro | Stable branch synced with live site |
| `textshift/main` | TextShift | Stable branch for TextShift platform |
| `devin/<timestamp>-<slug>` | Either | Feature branches |

## VedicStarAstro

**Live site:** https://vedicstarastro.com
**Droplet:** 139.59.15.76

### Setup
```bash
npm install
npm run dev
```

### Deployment
1. Build locally: `npm run build`
2. Transfer: `rsync -avz --delete -e "ssh -i ~/.ssh/droplet_key" .next/ root@139.59.15.76:/root/vedicstarastro/.next/`
3. Restart: `ssh root@139.59.15.76 "cd /root/vedicstarastro && pm2 restart all"`

Never build on the droplet — always build locally first.

### Languages
Supports 10 languages: en, hi, ta, te, bn, mr, gu, kn, ml, pa

## TextShift

**Live site:** https://textshift.org
**Droplet:** 143.110.183.71

See [textshift/README.md](../textshift/README.md) and [textshift/CONTRIBUTING.md](../textshift/CONTRIBUTING.md) for detailed setup, deployment, and code conventions.

### Key Rules
- The production backend at `/opt/textshift/backend/` is NOT a git repo — deploy via rsync/scp
- Never use `rsync --delete` without excluding `.env`
- Tier names capitalized: Free, Starter, Pro, Enterprise
- Brand name: "TextShift" (PascalCase)

## General Guidelines

- All PRs are reviewed by CodeRabbit automatically
- Wait for CodeRabbit approval before merging
- Never force push or rebase — use merge commits
- Never push directly to `setup-main` or `textshift/main`
- Test changes on the live site after deployment
