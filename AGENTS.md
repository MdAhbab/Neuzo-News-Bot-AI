# Neuzo Agents

The Ollama model — **`gemma4:e4b`** — is scoped to **news-getting only**: the crawler's editorial curation and the category/source recommender. Everything else (Briefing, Lens, Copilot, Pulse graph) is **deterministic and dependency-free**, reading the per-article verification data the pipeline persists. The two model-backed agents are prompt-driven steps with a fixed set of **tools** (plain Python functions) whose side effects are logged to the job's `agent_actions` trail. **Every model-backed path degrades gracefully when Ollama is offline; the deterministic paths have no external dependency and always work.**

| # | Agent | Status | Engine | Surface |
|---|---|---|---|---|
| 1 | Editorial Curator | ✅ shipped | Ollama (optional) | Crawler pipeline (`backend/news_crawler.py`) |
| 2 | Category Architect | ✅ shipped | Ollama (503 if offline) | `POST /api/categories/suggest` |
| 3 | Briefing Composer | ✅ shipped | Deterministic | `GET /api/briefing`, `POST /api/briefing/generate` |
| 4 | Bias & Sentiment Analyst | ✅ shipped | Deterministic (stdlib `text_analysis.py`) | `GET /api/jobs/<id>/lens` |
| 5 | Report Copilot | ✅ shipped | Deterministic | `POST /api/jobs/<id>/copilot` |
| — | Pulse graph | ✅ shipped | Deterministic (derived from stored articles) | `GET /api/jobs/<id>/graph` |

Shared rules: model calls (curation, suggest) use structured output (`json_mode` where applicable), strict timeouts (60 s default), and small batches for an on-device model. Per-article data (confidence, cross-refs, excerpt, sentiment, tone) is computed once at job completion and persisted to `jobs.articles_json`, which every deterministic agent reads.

---

## 1. Editorial Curator (shipped)

Acts as a newsroom editor inside the local crawler. After RSS articles are fetched and deduped, the curator decides — per batch — which articles are genuinely relevant to the requested category and rewrites each keeper's summary into two clean sentences.

**Tools**

| Tool | Signature | Purpose |
|---|---|---|
| `discover_feeds` | `(source_url) -> [feed_urls]` | Find RSS/Atom feeds via `<link rel="alternate">` and common paths (`/feed`, `/rss.xml`); cached per domain |
| `fetch_feed` | `(feed_url, since) -> [articles]` | Concurrent, timeout-bounded feed fetch |
| `dedupe` | `([articles]) -> [articles]` | Drop URL/title duplicates before the model sees them |
| `judge_batch` | `(category, [articles]) -> {idx: {keep, summary}}` | The gemma call: relevance verdict + rewritten summary per article, JSON-validated |

**Loop:** discover → fetch → dedupe → batch → `judge_batch` → apply verdicts → hand off to the NLP verifier.
**Degradation:** Ollama offline ⇒ raw deduped articles pass through unfiltered; nothing breaks.

## 2. Category Architect (shipped)

Turns a free-text idea ("Bangladeshi tech startups") into a ready-to-use category: a clean display name, a `category_id` slug, a fitting icon from the frontend's `ICON_MAP`, and 3–6 recommended source outlets with URLs — which the user can accept per-source via checkboxes before anything is persisted.

**Tools**

| Tool | Signature | Purpose |
|---|---|---|
| `list_icons` | `() -> [icon_name]` | Valid frontend icon names so the model never invents one |
| `list_existing_categories` | `() -> [category]` | Avoid duplicate slugs/names |
| `propose_category` | `(prompt) -> {category_id, name, icon_name, recommended_sources[]}` | The gemma call, schema-validated before it reaches the UI |
| `validate_source_url` | `(url) -> {reachable, has_feed}` | Sanity-check recommended outlets before suggesting them |

**Degradation:** Ollama offline ⇒ endpoint returns a clear error and the modal's manual path (type a name, pick defaults) still works.

## 3. Briefing Composer (shipped, deterministic)

Builds the **Daily Briefing**: on load or on demand, it sweeps the user's completed reports from the last 7 days, pulls their persisted articles, selects the top ~6 by confidence across categories, and assembles a digest — a short summary (the stored excerpt) plus a one-line "why it matters" citing the source and corroboration count, with the verifier's confidence carried through untouched. An honest tool trace (with real counts) is returned alongside. No model call — gemma is reserved for news-getting, so the briefing is fast and offline-safe.

**Tools**

| Tool | Signature | Purpose |
|---|---|---|
| `list_jobs` | `(user_id) -> [job]` | Recent completed jobs for the user |
| `load_articles` | `(job) -> [article]` | Read persisted `articles_json` (no re-crawl, no re-verify) |
| `rank_stories` | `([articles]) -> [article]` | Sort by confidence across categories, take top ~6 |
| `compose_digest` | `(article) -> {summary, whyItMatters}` | Excerpt summary + templated "why it matters" line |

**Degradation:** none required — no external dependency. The briefing renders fully even with Ollama offline; no caching layer is needed (recompute is cheap).

## 4. Bias & Sentiment Analyst (shipped, deterministic)

Annotates each article in a completed report with a sentiment score (−1…+1), a tone label (`factual | analytical | emotive`), and computes a report-level **coverage-balance meter** (`balance` = mean sentiment, `spread` = std-dev). Powers the "Lens" toggle in Report View. This agent is **dependency-free** — it uses the stdlib lexicon analyzer in `backend/text_analysis.py`, not the LLM, so it is deterministic and always available.

**Tools**

| Tool | Signature | Purpose |
|---|---|---|
| `get_report_articles` | `(job_id) -> [article]` | Articles from the stored job |
| `score` | `(text) -> {sentiment, tone}` | Lexicon sentiment + tone classification |
| `aggregate_balance` | `([scores]) -> {balance, spread}` | Mean + std-dev across the report |
| `persist_lens` | `(job_id, lens) -> ok` | Cache to `jobs.lens_json`; computed once per report |

**Degradation:** none required — no external dependency. Returns a `balance:0, spread:0, articles:[]` shell if the job has no articles.

## 5. Report Copilot (shipped, deterministic)

A conversational agent over a single completed report ("which story had the weakest corroboration?"). It answers **only** from the report's persisted articles via lexical retrieval (no model call — gemma is reserved for news-getting), and every tool step is returned so the frontend can render the reasoning trace; answers cite article titles inline.

**Tools**

| Tool | Signature | Purpose |
|---|---|---|
| `search_archive` | `(job_id, query) -> [article]` | Lexical-overlap ranking of the report's articles against the question |
| `get_article` | `(article) -> article` | The top-ranked stored article: title, source, confidence, cross-refs |
| `compare_sources` | `([article]) -> comparison` | Contrast the strongest vs. weakest corroboration among hits |

**Loop:** question → `search_archive` → `get_article` (top hit) → `compare_sources` (if ≥2 hits) → compose answer with citations → return `{steps[], answer}`.
**Degradation:** none required — the answer is composed deterministically from the retrieved articles (it names the strongest/weakest source by confidence and the cross-reference count), so the drawer always responds.

---

## Endpoint contracts (as implemented)

```
GET  /api/briefing                     -> {greeting, date, stories:[{id, category, headline, summary, whyItMatters, confidence}], toolTrace:[{ts, tool, detail}]}
POST /api/briefing/generate            -> same shape, forces regeneration
GET  /api/jobs/<id>/graph              -> {nodes:[{id, label, type:"source"|"article", weight, confidence?, articleId?}], edges:[{from, to, strength}]}
GET  /api/jobs/<id>/lens               -> {balance:-1..1, spread:0..1, articles:[{id, sentiment, tone}]}
POST /api/jobs/<id>/copilot {message}  -> {steps:[{tool:"search_archive"|"get_article"|"compare_sources", detail}], answer}
```

All four are `@require_auth` and owner-checked (404 if the job is missing, 403 if it isn't yours). `/graph` and `/lens` are assembled from the persisted `articles_json` — no model call needed.
