# Neuzo — Agentic News Bot

An intelligent news aggregation and verification system that fetches, verifies, and synthesizes news articles into professional Word reports — using NLP cross-referencing and, optionally, a fully on-device agentic crawler powered by a local LLM.

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Quick Start

```bash
# 1. Clone and run the automated setup
python run.py

# 2. Start the backend
.\.venv\Scripts\Activate.ps1      # Windows  (Linux/Mac: source .venv/bin/activate)
python backend/api_server.py

# 3. Start the frontend (new terminal)
cd frontend
npm run dev

# 4. Open http://localhost:3000 and log in with:
#    Email: test@neuzo.com | Password: test123
```

---

## 🎯 Overview

Neuzo is a full-stack application that:

- **Fetches** real-time news from NewsAPI **or** a self-hosted agentic crawler (no API quota)
- **Curates** crawled articles with a local Ollama LLM (relevance filtering + summaries)
- **Verifies** news authenticity using NLP semantic similarity analysis
- **Synthesizes** comprehensive reports with confidence scores
- **Generates** professional Word documents with verified articles
- **Provides** a modern React frontend with report history and live job progress

### News engines

| Engine | How it works | When to use |
|---|---|---|
| `newsapi` | NewsAPI top headlines (needs an API key, 100 req/day free) | Fast, broad coverage |
| `crawler` | Discovers RSS/Atom feeds on your selected sources, fetches concurrently, optionally curates with a local Ollama model | No quota, fully on-device |
| `auto` (default) | NewsAPI first; falls back to the crawler on quota errors, empty results, or a missing key | Best of both |

The engine can be chosen per-report in the UI, or set globally via `news_pipeline.provider` in [backend/config.yaml](backend/config.yaml).

### Local LLM (Ollama)

The crawler uses a locally hosted model (default `gemma4:e4b`) as an editorial agent: it filters articles for category relevance and writes clean two-sentence summaries. The same model also powers the **Daily Briefing** and **Report Copilot** agents (see [AGENTS.md](AGENTS.md)). Semantic verification does **not** use Ollama — it uses sentence-transformers (with a pure-numpy fallback). Every Ollama-backed feature degrades gracefully when the model is offline.

```bash
# Optional: install Ollama (https://ollama.com) and pull the model
ollama pull gemma4:e4b
```

If Ollama is not running, the crawler simply skips curation and returns raw articles — nothing breaks.

### Agents

Beyond crawler curation, `gemma4:e4b` powers a suite of tool-using agents (shipped and planned) — the Editorial Curator, Category Architect, Briefing Composer, Bias & Sentiment Analyst, and Report Copilot. Each agent's tools, loops, and endpoint contracts are documented in [AGENTS.md](AGENTS.md).

---

## ✨ The frontend

A from-scratch React 18 + Vite + TypeScript app styled with Tailwind CSS v4, animated with GSAP + ScrollTrigger, Lenis smooth scrolling, a Three.js / react-three-fiber hero scene, and framer-motion micro-interactions — in an editorial "Verified Press" theme with light/dark modes. All scroll/motion effects honor `prefers-reduced-motion`, and every Three.js canvas is wrapped in an error boundary. Routing is handled by react-router; the live backend is reached through `frontend/src/app/lib/api.ts` (set `VITE_API_URL`, default `http://localhost:5000/api`).

Four agentic features ship with it (all backed by real endpoints — see [AGENTS.md](AGENTS.md)):

| Feature | What it does |
|---|---|
| **Neuzo Pulse** | Interactive 3D verification graph (Three.js) — sources, articles, and cross-corroboration links for each report, colored by confidence |
| **Daily Briefing** | A gemma-composed morning digest across your categories: top verified stories with summaries and "why it matters" lines |
| **Bias & Sentiment Lens** | Per-article sentiment and tone analysis plus a report-level coverage-balance meter, toggleable inside Report View |
| **Report Copilot ("Ask Neuzo")** | Chat with a tool-using agent about any completed report — answers cite articles and show their reasoning trace |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       NEUZO ARCHITECTURE                         │
│                                                                  │
│  ┌──────────────┐       ┌──────────────┐      ┌────────────┐    │
│  │   Frontend   │──────▶│  Flask API   │─────▶│   MySQL    │    │
│  │ React 18+TS  │       │   Backend    │      │  Database  │    │
│  └──────────────┘       └──────┬───────┘      └────────────┘    │
│                                │                                 │
│                 ┌──────────────┼──────────────┐                  │
│                 ▼              ▼              ▼                  │
│        ┌──────────────┐ ┌────────────┐ ┌───────────────┐        │
│        │ News Fetcher │ │   Local    │ │   Models      │        │
│        │  (NewsAPI)   │ │  Crawler   │ │  (Database)   │        │
│        └──────┬───────┘ └─────┬──────┘ └───────────────┘        │
│               │               │ RSS discovery + Ollama          │
│               └───────┬───────┘   (gemma4:e4b, optional)        │
│                       ▼                                          │
│              ┌────────────────┐      ┌─────────────────┐        │
│              │ News Verifier  │─────▶│    Document     │        │
│              │  (NLP + ML)    │      │    Generator    │        │
│              └────────────────┘      └─────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend** — Python 3.13+, Flask 3 (REST API), MySQL 8 (connection-pooled), NewsAPI + RSS crawler, Sentence-Transformers (`all-MiniLM-L6-v2`, with a pure-numpy fallback), Ollama (optional, for curation/briefing/copilot), a stdlib sentiment/tone analyzer, bcrypt, python-docx.

**Frontend** — React 18, TypeScript, Vite 6, Tailwind CSS v4 (built, not CDN), GSAP + ScrollTrigger, Lenis, Three.js (react-three-fiber), framer-motion, react-router, Radix UI, recharts, sonner.

---

## 🤖 How It Works

### 1. News fetching

`backend/news_fetcher.py` (NewsAPI) and `backend/news_crawler.py` (local crawler):

- **NewsAPI path**: one `top_headlines` request per job (page_size 100), sorted and trimmed locally. Quota errors are detected and trigger the crawler fallback in `auto` mode.
- **Crawler path**: for each of the user's selected source URLs, the crawler discovers RSS/Atom feeds (`<link rel="alternate">` tags, then common paths like `/feed`, `/rss.xml`), fetches them concurrently with strict timeouts, dedupes by URL/title, and — when Ollama is available — asks the local model to keep only category-relevant articles and rewrite their summaries. Discovered feeds are cached per domain for the life of the process.

### 2. News verification

`backend/news_verifier.py`:

1. Load the NLP model lazily on first use (cached process-wide afterwards)
2. Embed `title + description` into 384-dim vectors
3. Compute a cosine-similarity matrix (pure numpy)
4. Score each article: 60% base confidence for well-formed content, boosted by up to 40% based on how strongly other outlets corroborate it
5. Mark verified when confidence ≥ the configured threshold (default 0.7)

**Model:** `sentence-transformers/all-MiniLM-L6-v2` — 22.7M params, ~90MB, ~3000 sentences/sec on CPU, no GPU required. If `sentence-transformers`/`torch` aren't installed, the verifier transparently falls back to a pure-numpy hashing encoder so the pipeline still completes (lower-quality scores, no crash).

Per-article results (confidence, cross-references, excerpt, plus a sentiment score and tone label from `backend/text_analysis.py`) are persisted as JSON on the job row, which is what powers the Report View, Pulse graph, Lens, Briefing, and Copilot.

### 3. Document generation

`backend/document_generator.py` builds a Word document with an executive summary (verification rate, average confidence, top stories, coverage analysis), every verified article with its confidence score and cross-references, and a references/methodology section. Reports are saved to `backend/output/`.

### 4. Job lifecycle

```
POST /api/jobs/start  →  job row created  →  background thread:
  fetch (newsapi | crawler | auto) → verify (NLP) → tag sentiment/tone → generate .docx
  → job marked Complete with articles_json / avg_confidence / articles_count / verified_count

Frontend polls GET /api/jobs/<id>/status every 2.5s (tolerating 3 failures); on
Complete the status payload carries the full per-article ledger, then the report
downloads via GET /api/jobs/<id>/download (Bearer auth, ownership-checked)
```

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | — | Register (rate-limited 5/min) |
| POST | `/api/auth/login` | — | Login (rate-limited 10/min) |
| POST | `/api/auth/logout` | ✅ | Invalidate session |
| GET | `/api/auth/me` | ✅ | Current user (session restore) |
| GET | `/api/categories` | ✅ | Categories + sources (`{id, url, name}`) |
| POST | `/api/categories` | ✅ | Create custom category |
| POST | `/api/categories/suggest` | ✅ | AI-suggest a category + sources (Ollama; 503 if offline) |
| GET/POST | `/api/sources/<category_id>` | ✅ | List / add news sources |
| DELETE | `/api/sources/by-id/<id>` | ✅ | Remove a source (soft delete) |
| POST | `/api/jobs/start` | ✅ | Start report job (`{category, sources, engine}`) |
| GET | `/api/jobs/<id>/status` | ✅ | Poll job progress (carries the article ledger on Complete) |
| GET | `/api/jobs/<id>/download` | ✅ | Download .docx (owner only) |
| GET | `/api/jobs/<id>/graph` | ✅ | Pulse graph — sources, articles, corroboration edges |
| GET | `/api/jobs/<id>/lens` | ✅ | Bias & sentiment lens (balance, spread, per-article tone) |
| POST | `/api/jobs/<id>/copilot` | ✅ | Ask a question about the report (retrieval + optional Ollama) |
| GET | `/api/jobs/history` | ✅ | User's past reports |
| GET/POST | `/api/briefing` · `/api/briefing/generate` | ✅ | Daily Briefing across the user's recent reports |
| GET | `/api/health` | — | Health check |

---

## 🗄️ Database Schema

MySQL database `neuzo_db` (see [backend/database_schema.sql](backend/database_schema.sql)):

- **users** — id, email (unique), password_hash (bcrypt), full_name, timestamps
- **categories** — category_id, name, icon_name, is_custom, created_by
- **news_sources** — category FK, source_url, source_type (web/rss/api), reliability_score
- **user_categories** — user ↔ category preferences
- **jobs** — job_id, user FK, category FK, status, current_step, report path/name, sources_used, agent_actions, error_message, articles_count, verified_count, **articles_json**, **avg_confidence**, **lens_json**, **engine**, timestamps

Older databases are migrated automatically at server start (missing columns are added idempotently).

---

## 🔧 Setup

### Prerequisites

- Python 3.13+, Node.js 18+, MySQL 8+
- Optional: a [NewsAPI key](https://newsapi.org/) (free) and/or [Ollama](https://ollama.com) with `gemma4:e4b` for the local crawler

### Automated

```bash
python run.py
```

Checks prerequisites, creates the venv, installs backend + frontend dependencies, writes `backend/config.yaml`, imports the schema, creates the `test@neuzo.com` test user, and starts both servers.

### Manual

```bash
# Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1            # or: source .venv/bin/activate
pip install -r backend/requirements.txt

# Database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS neuzo_db;"
mysql -u root -p neuzo_db < backend/database_schema.sql

# Frontend
cd frontend && npm install
```

### Configuration

Defaults live in [backend/config.yaml](backend/config.yaml). **Every secret can be overridden via environment variables** (recommended for anything beyond local development) — copy [backend/.env.example](backend/.env.example) to `backend/.env`:

| Variable | Overrides |
|---|---|
| `DATABASE_PASSWORD` (+ HOST/PORT/NAME/USER) | `database.*` |
| `NEWSAPI_KEY` | `news_api.api_key` |
| `NEWS_PROVIDER` (`auto`/`newsapi`/`crawler`) | `news_pipeline.provider` |
| `OLLAMA_HOST`, `OLLAMA_MODEL` | `ollama.*` |
| `SECRET_KEY`, `SESSION_EXPIRY_HOURS`, `REDIS_URL`, `PORT`, `FLASK_DEBUG` | Flask runtime |

---

## 🔒 Security

- **bcrypt password hashing** (with SHA-256 pre-hash for >72-byte passwords; legacy SHA-256 hashes verify and can be migrated)
- **Expiring sessions** — 24h TTL, in-memory with periodic cleanup, or Redis (`REDIS_URL`) for production
- **Rate limiting** on auth endpoints (flask-limiter)
- **Ownership checks** on job status/downloads; report paths never leave the server
- **Parameterized SQL** everywhere; input validation on email, password length, source type, reliability score
- **Debug off by default** — the server binds localhost unless `FLASK_DEBUG=true`

---

## 🧪 Testing

```bash
cd backend
..\.venv\Scripts\python.exe -m pytest tests -v
```

Covers password hashing, the similarity math, crawler JSON-decision parsing and deduplication, config env overrides, and the API auth/validation surface.

---

## 📁 Project Structure

```
Neuzo-News-Bot-AI/
├── run.py                     # Automated installer + server launcher
├── AGENTS.md                  # gemma4:e4b agents, tools, and endpoint contracts
├── backend/
│   ├── api_server.py          # Flask REST API (auth, jobs, graph/lens/copilot/briefing)
│   ├── config.py              # Config loader (.env + env overrides)
│   ├── config.yaml            # Default configuration
│   ├── database.py            # MySQL pool + idempotent migrations
│   ├── models.py              # User / Category / NewsSource / Job
│   ├── news_fetcher.py        # NewsAPI + RSS fetching
│   ├── news_crawler.py        # Local agentic crawler (+ Ollama curation)
│   ├── news_verifier.py       # NLP verification (sentence-transformers + numpy fallback)
│   ├── text_analysis.py       # Stdlib sentiment + tone analyzer
│   ├── document_generator.py  # Word document generator
│   ├── database_schema.sql    # MySQL schema + seed data
│   ├── requirements.txt       # Python dependencies (lean)
│   ├── .env.example           # Environment variable template
│   ├── output/                # Generated reports (gitignored)
│   └── tests/                 # Pytest suite
└── frontend/                  # React 18 + Vite + Tailwind v4 app
    ├── index.html
    ├── vite.config.ts         # Dev server on :3000
    ├── .env.example           # VITE_API_URL
    └── src/app/
        ├── lib/api.ts         # Backend client + adapters (single integration point)
        ├── pages/             # Landing, Auth, Dashboard, Job, History, Briefing, Pulse
        └── components/        # UI, three.js hero, Pulse graph, Copilot, Report view
```

---

## 🐛 Troubleshooting

| Problem | Fix |
|---|---|
| Backend won't start | Activate the venv; `pip install -r backend/requirements.txt`; check MySQL is running |
| Database connection failed | Verify password in `backend/config.yaml` or `DATABASE_PASSWORD`; `Get-Service MySQL80` |
| NewsAPI returns 0 articles / quota errors | Free tier is 100 req/day — switch the engine to **Local AI** in the UI, or set `NEWS_PROVIDER=crawler` |
| Crawler finds nothing | Your sources may not expose RSS; it falls back to curated category feeds automatically |
| Ollama curation skipped | Ensure `ollama serve` is running and `ollama pull gemma4:e4b` is installed — the crawler logs why it skipped |
| Session expired | Sessions live in memory by default and reset when the server restarts; log in again (or configure `REDIS_URL`) |

---

## 📝 License

MIT License — free for personal and commercial use.

---

**Built by Ahbab using Python, React, and Machine Learning**
