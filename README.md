# Production Manager

Phone-first Progressive Web App (PWA) for furniture production management.
Tracks projects, jobs, a multi-stage production pipeline, QR clock-ins, and
cross-language notes (English / Russian / Spanish).

See [`SPEC.md`](./SPEC.md) for the full product spec (v2.0), [`BUILD_PLAN.md`](./BUILD_PLAN.md)
for the sprint-by-sprint build order, and [`CLAUDE.md`](./CLAUDE.md) for working conventions.

## Tech stack

- **React + Vite** (TypeScript)
- **Tailwind CSS v4**
- **PWA** via `vite-plugin-pwa` (installable, offline read cache)
- **Supabase** (PostgreSQL, Auth, Realtime, Storage, Edge Functions)

## Local setup

```bash
# Node is managed via nvm; this loads the right version
nvm use            # or: source ~/.zshrc

npm install        # install dependencies
cp .env.example .env   # then fill in your Supabase URL + anon key
npm run dev        # start the dev server (http://localhost:5173)
```

### Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run icons` | Regenerate PWA icons from `src/assets/icon-source.svg` |

### Testing on a phone

Run `npm run dev -- --host`, then open the printed network URL (e.g.
`http://192.168.x.x:5173`) on a phone connected to the same WiFi.

## Environment variables

Copy `.env.example` to `.env` and fill in values. `.env` is git-ignored — never
commit secrets. Only `VITE_`-prefixed variables are exposed to the browser.
