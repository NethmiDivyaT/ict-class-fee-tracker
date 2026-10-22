# ICT Class Fee Tracker

Simple responsive app to track ICT class student fees in **LKR**.

This is an npm workspaces monorepo:

- `apps/web` — Next.js UI (also runs the data layer on the server)
- `apps/api` — optional Express API
- `packages/core` — SQLite / Turso, queries, and mutations

## Features

- Weekly attendance (4 present days = 1 fee month)
- Late payments auto-fill unpaid months, with a paying date
- Dashboard, records, and annual reports

## Run locally

Needs Node.js 22 or newer (`node:sqlite`).

```bash
npm install
npm run dev:web
```

Open [http://localhost:3000](http://localhost:3000). Local SQLite is at `apps/api/data/fees.db`.

The Express API is optional:

```bash
npm run dev
```

- Web: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:4000](http://localhost:4000)

## Deploy on Vercel

Vercel hosts `apps/web`. The Next.js server talks to Turso directly — you do **not** need a separate API host or `API_URL`.

1. Create a free database at [turso.tech](https://turso.tech)
2. In Vercel → Project → Settings → Environment Variables, add:
   - `TURSO_DATABASE_URL` = `libsql://...`
   - `TURSO_AUTH_TOKEN` = your token
3. Keep the repo-root `vercel.json` (build `npm run build -w web`, output `apps/web/.next`)
4. Redeploy

If a deploy says `.next` was not found, turn **off** Output Directory Override in Vercel, or set it to `apps/web/.next`.

Tables are created automatically on first request.
