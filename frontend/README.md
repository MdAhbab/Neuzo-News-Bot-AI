# Neuzo — Frontend

The Neuzo web client: a React 18 + Vite + TypeScript single-page app styled with Tailwind CSS v4 in the editorial **"Verified Press"** theme (light/dark). Motion is handled by GSAP + ScrollTrigger and Lenis smooth scroll; the hero and the Pulse verification graph use Three.js / react-three-fiber; framer-motion drives micro-interactions; routing is react-router.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The client talks to the Flask backend at `VITE_API_URL` (default `http://localhost:5000/api`). To override, copy `.env.example` to `.env` and edit it.

### Scripts
- `npm run dev` — Vite dev server on port **3000**
- `npm run build` — production build to `dist/`

## Routes

| Route | Page |
|---|---|
| `/` | Landing (scroll-driven, Three.js hero) |
| `/auth` | Sign in / sign up |
| `/app` | Desk — pick a category + sources + engine, generate a report |
| `/app/jobs/:jobId` | Live processing → Report View on completion |
| `/app/jobs/:jobId/pulse` | Neuzo Pulse 3D verification graph |
| `/app/history` | Archive — search + filter, multi-format export |
| `/app/briefing` | Daily Briefing |
| `/app/analytics` | Coverage analytics (recharts) |

Press **⌘K / Ctrl+K** anywhere in the app for the command palette.

## Structure

```
src/
  main.tsx
  app/
    App.tsx              # router + providers
    lib/
      api.ts             # the single backend integration point (fetch + adapters)
      types.ts · store.tsx · gsap.ts · mock.ts · images.ts
    pages/               # Landing, Auth, Dashboard, Job, History, Briefing, Pulse, Analytics
    components/
      AppShell.tsx       # nav + command palette
      report/ · canvas/ · three/   # Report View, Pulse graph, hero scene
      ui/                # shared primitives (Radix-based)
    hooks/               # useJobPolling, usePrefersReducedMotion
  styles/                # theme.css (tokens), fonts, tailwind entry
```

## Backend integration

Every network call goes through `src/app/lib/api.ts`. It attaches the bearer token from `localStorage`, parses error bodies, and on a `401` clears the token and routes to `/auth` (session restore via `me()` stays silent). Adapter functions map the backend's JSON shapes onto the UI's `types.ts` — so swapping endpoints never leaks into the pages.

## Performance & accessibility

- Heavy libraries (three.js, recharts, framer-motion + GSAP, Radix) are split into separate cacheable chunks via `manualChunks`; the Three.js hero is lazy-loaded, and recharts loads only on the Analytics route.
- `prefers-reduced-motion` disables Lenis, parallax, and 3D autorotation. Every Three.js canvas is wrapped in an error boundary so a WebGL failure never blanks the app.
