# Neuzo Frontend

React 19 + TypeScript + Vite single-page app for the Neuzo agentic news bot. Dark glassmorphism UI with category selection, per-report news-engine choice (NewsAPI / local crawler / auto), live job progress, report history, and authenticated report downloads.

## Run locally

**Prerequisites:** Node.js 18+ and the Neuzo backend running at `http://localhost:5000` (see the [root README](../README.md)).

```bash
npm install
npm run dev        # http://localhost:3000
```

### Configuration

The API base URL defaults to `http://localhost:5000/api`. To point elsewhere, copy `.env.example` to `.env.local`:

```
VITE_API_URL=http://localhost:5000/api
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server on port 3000 |
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run preview` | Serve the production build locally |

## Structure

```
Frontend/
├── App.tsx                  # State machine: auth → selection → processing → report/history
├── index.css                # Tailwind v4 entry + theme (gradient, animations)
├── constants.ts             # Fallback categories + icon-name → component map
├── types.ts                 # Shared TypeScript types (Job, Category, NewsEngine, ...)
├── services/
│   └── neuzoApi.ts          # Typed API client, token handling, authenticated downloads
└── components/
    ├── AuthScreen.tsx       # Login / signup
    ├── CategoryCard.tsx     # Category tiles
    ├── ProcessingStatus.tsx # Step-by-step job progress
    ├── ReportView.tsx       # Completed report + download
    ├── JobHistory.tsx       # Past reports list
    ├── AddSourceModal.tsx   # Persist a news source to the database
    └── icons.tsx            # Inline SVG icon set
```

## Notes

- Tailwind CSS v4 is compiled at build time via `@tailwindcss/vite` — no CDN scripts.
- The auth token is stored in `localStorage` (`neuzo_auth_token`); the app restores the session on reload via `GET /api/auth/me`.
- Job status is polled every 2.5s while a report is being generated; up to three consecutive poll failures are tolerated before surfacing an error.
