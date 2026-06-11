# Neuzo Hardening Build — shared contract (temporary)

Senior production-readiness pass. Backend `http://localhost:5000/api`, Bearer auth, frontend dev :3000. **No AI attribution anywhere** (no "Co-Authored-By", "Generated with AI", or model self-credit in code/comments/docs/commits). Preserve project intent; precise high-impact changes, not noisy rewrites. Keep builds green.

## Gemma scope rule (IMPORTANT — changed)
`gemma4:e4b` (via `OllamaClient`) is now allowed **only** for *news-getting*: the crawler's editorial curation, and the existing `POST /categories/suggest` source recommender. It must be **removed** from Briefing and Copilot — those become fully deterministic. Lens is already deterministic. Everything degrades gracefully when Ollama is offline.

---

## New HTTP endpoints (both tracks must agree)

```
GET /api/jobs/<id>/export/<fmt>     fmt ∈ md | json   -> attachment (text/markdown | application/json)
                                     owner-checked (404 missing, 403 not owner, 404 if not Complete/no data)
GET /api/analytics/coverage         -> {
  totals:{ jobs, articles, verified, avgConfidence },
  categories:[ { category, jobs, articles, verified, avgConfidence } ],
  timeline:[ { date:"YYYY-MM-DD", jobs, articles, verified } ]   # last ~30 days, user-scoped
}
```
`.docx` stays at the existing `GET /jobs/<id>/download`. Export payloads are built from the persisted `articles_json` + job meta (no model calls). `/analytics/coverage` aggregates the user's own jobs only.

---

## Track A — Backend (`backend/` only) 

1. **Gemma scope correction** (`api_server.py`): in `_build_briefing`, remove all `OllamaClient` use → `summary` = stored excerpt, `whyItMatters` = templated line citing source + crossRefs; keep honest `toolTrace`. In `job_copilot`, remove the Ollama branch → always use the deterministic retrieval answer (keep `steps`). Leave crawler curation and `categories/suggest` gemma usage intact.
2. **On-device crawler upgrade** (`news_crawler.py`): 
   - Add an **HTML extraction fallback** `_extract_html_articles(source_url, max_items)` using `bs4.BeautifulSoup` (already a dep): fetch the page (existing `REQUEST_HEADERS`, strict timeout), pull candidate headline links (anchors inside `article`/`h2`/`h3`/headline-class containers), build `NewsArticle(title=link_text, url=abs_url, source=domain, description="")`, dedupe, bound to a sane cap. Use it in `fetch_news` for any source whose `discover_feeds` returns nothing, **before** the curated-category fallback. Gemma curation still runs on the combined list.
   - Keep everything on-device, bounded `ThreadPoolExecutor`, timeouts, dedupe by url/title.
3. **`auto` engine merges sources** (`api_server.py _fetch_articles`): in `auto`, when NewsAPI returns fewer than `max_items//2` articles (or has no key/quota), also run the crawler and **merge + dedupe** results (cap at `max_items`). `newsapi` and `crawler` explicit modes stay pure. Provider label becomes e.g. `newsapi+crawler` when merged.
4. **Move `seed_bd_news.py` → `backend/seed_bd_news.py`** and fix its path logic so it works from the new location (it currently does `sys.path.append(str(Path("backend").resolve()))` assuming repo-root CWD — make it resolve relative to its own file dir, e.g. `sys.path.insert(0, str(Path(__file__).resolve().parent))`). Confirm no other backend `.py` lives outside `backend/`.
5. **Export endpoint** `GET /jobs/<id>/export/<fmt>` (`md`|`json`): build from `articles_json`. `md` = a clean Markdown brief (H1 title, verification summary line, per-article `## title` + source/confidence/crossRefs + excerpt). `json` = `{job:{id,category,engine,createdAt,verifiedCount,articleCount,avgConfidence}, articles:[...]}`. Return as an attachment with a sensible filename; 404 if no articles. Reject unknown `fmt` with 400.
6. **Analytics endpoint** `GET /analytics/coverage` (`@require_auth`): aggregate `Job.get_user_jobs(user_id, 200)` — totals, per-category rollup, and a last-30-day daily timeline (group by `created_at` date). Use stored `articles_count`/`verified_count`/`avg_confidence`. JSON-serializable (dates as `YYYY-MM-DD`).
7. Reliability: keep owner checks on every job-scoped route; tighten obvious broad-excepts only where safe; don't regress existing behavior.
8. Verify: `python -m py_compile backend/*.py` and report. Do NOT touch `frontend/` or root docs (README/AGENTS).

## Track B — Frontend (`frontend/` only)

1. **Dependency prune (memory/supply-chain):** grep `src/` for imports; remove from `package.json` every dependency **not imported anywhere reachable from the app** — likely: `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `@popperjs/core`, `react-popper`, `react-slick`, `react-dnd`, `react-dnd-html5-backend`, `embla-carousel-react`, `react-responsive-masonry`, `canvas-confetti`, `input-otp`, `vaul`, `react-day-picker`, `cmdk` (KEEP cmdk — needed for the command palette below), `react-resizable-panels`, `react-hook-form` (verify each!). If a `src/app/components/ui/*.tsx` file imports a pruned dep **and is never imported by app code**, delete that ui file too. Then run `npm install` and `npm run build` — **must stay green**; re-add anything actually needed.
2. **Code-split three.js:** lazy-load `HeroScene` (Landing + Auth) via `React.lazy` + `Suspense` fallback; add `build.rollupOptions.output.manualChunks` splitting `three`/`@react-three` and a `vendor` chunk. Keep `dpr` capped. Report before/after bundle sizes.
3. **New features** (add `api.ts` fns with consistent style; add types to `lib/types.ts`):
   - **History search & filter** (`pages/History.tsx`, client-side over `getHistory()`): text search (category/engine), status filter chips (All/Complete/Processing/Error), and a category dropdown. Debounced, with a clear empty state.
   - **Multi-format export**: `exportReport(jobId, fmt:'md'|'json')` (blob download, Bearer, filename from Content-Disposition) calling `/jobs/<id>/export/<fmt>`. Add a small export menu (MD / JSON / .docx) to Report View's right rail and to History rows.
   - **Coverage analytics**: new route `/app/analytics` + nav link in `AppShell`. `getCoverage()` → `/analytics/coverage`; render with **recharts** (already installed): a line/area timeline (reports & verified over time) + a bar chart per category (avg confidence / verified rate) + total tiles. Loading skeletons + empty state.
   - **Command palette (⌘K / Ctrl+K)** using `cmdk` (installed): global listener in `AppShell`; actions = navigate (Desk, Briefing, Archive, Analytics), New report, Toggle theme, Sign out. Accessible (focus trap, Esc to close).
4. **Reliability/UX polish:** add `.catch` to floating promises (`getLens`, `getGraph`, `getBriefing`, etc. — surface a toast/empty state, never an unhandled rejection); verify every async surface has loading + empty states; quick a11y pass (labels, focus-visible) and light/dark parity. No new heavy deps; no flashy additions.
5. Verify: `npm run build` green; report bundle delta. Do NOT touch `backend/` or root docs.

Both: small, modular, production-quality. Report each file changed + rationale + impact, and flag anything unverified.
