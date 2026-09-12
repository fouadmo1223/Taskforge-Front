# Taskforge — Frontend

React 19 + Vite + Tailwind 4 (CSS-first tokens) + TanStack Query + Zustand + i18n (en/ar, RTL).

Split out of the original Taskforge monorepo so it can be deployed to Vercel on its own.
Still a small pnpm workspace under the hood because the app imports two shared packages:

```
apps/
  web/            the app itself
packages/
  types/          shared TS types (permission catalog, enums, realtime events, API envelopes)
  utils/          pure helpers used by the frontend (lexorank, text, etc.)
  config/         shared ESLint / tsconfig presets
```

## Local development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env   # set VITE_API_URL to your backend
pnpm dev                                  # → http://localhost:5173
```

By default (`VITE_API_URL` unset) the dev server proxies `/api/v1` to `http://localhost:4000` —
point that at wherever the Taskforge-Back API is running, or set `VITE_API_URL` to its full URL.

## Deploying to Vercel

This repo's root is a pnpm workspace, not the Vite project itself — the Vite project lives in
`apps/web`, and it depends on `packages/types` / `packages/utils` being **built** first (they
ship compiled `dist/` output, there's no source-level path mapping). Rather than fight Vercel's
"Root Directory" monorepo detection over that, just point it at the root repo directly. In the
Vercel project settings:

- **Root Directory**: leave blank (repo root)
- **Install Command**: `pnpm install`
- **Build Command**: `pnpm build` (the root script already builds `types`/`utils` before `web`)
- **Output Directory**: `apps/web/dist`
- **Environment Variables**: `VITE_API_URL` → your deployed backend's public URL (e.g.
  `https://api.yourdomain.com/api/v1`)

## Scripts

| Command | What |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm build` | typecheck + production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest |

## Origin

This is a split of the frontend half of the original Taskforge monorepo (paired with a
separate `Taskforge-Back` repo for the NestJS API). It carries a fresh git history starting
from that split — see `Taskforge-Back` for the API's own docs.
