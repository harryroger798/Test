# harryroger798/Test

This repository contains two separate projects:

## Projects

### 1. VedicStarAstro
Multilingual Vedic astrology platform supporting 10 languages.

- **Live:** [https://vedicstarastro.com](https://vedicstarastro.com)
- **Stack:** Next.js + TypeScript + Tailwind CSS + Express.js
- **Branch:** `setup-main` (default)
- **Code:** Root directory (`src/`, `server/`, `backend/vedicstarastro-api/`)

```bash
npm install && npm run dev
```

### 2. TextShift
AI-powered content platform with 14 writing tools, AI detection, humanization, and plagiarism checking.

- **Live:** [https://textshift.org](https://textshift.org)
- **Stack:** React/Vite + FastAPI + PyTorch/ONNX
- **Branch:** `textshift/main`
- **Code:** `textshift/` directory (`textshift/backend/`, `textshift/frontend/`)
- **Docs:** [textshift/README.md](textshift/README.md) | [textshift/CHANGELOG.md](textshift/CHANGELOG.md)

## Repository Structure

```
/                              # VedicStarAstro (Next.js)
  src/app/                     #   Pages and routes
  src/components/              #   React components
  src/lib/                     #   Utilities and i18n
  server/                      #   Express.js backend
  backend/vedicstarastro-api/  #   Python API
  .github/                     #   CI/CD, issue templates, contributing guide

textshift/                     # TextShift (separate project)
  backend/app/                 #   FastAPI backend + ML services
  frontend/src/                #   React/Vite frontend
  README.md                    #   TextShift documentation
  CHANGELOG.md                 #   TextShift changes
  CONTRIBUTING.md              #   TextShift dev guide
```

## Contributing

See [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) for setup, deployment, and branch guidelines for both projects.
