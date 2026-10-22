# ICT Class Fee Tracker

Simple responsive app to track ICT class student fees in **LKR**.

This is an npm workspaces monorepo:

- `apps/web` — Next.js frontend
- `apps/api` — Express API (SQLite / Turso)

## Features

- Add a class with students (one name per line)
- Mark paid with student name + paying date
- Dashboard: monthly income, paid/unpaid counts, outstanding
- Records page with paid/unpaid and class filters

## Run locally

Needs Node.js 22 or newer (`node:sqlite`).

```bash
npm install
npm run dev
```

- API: [http://localhost:4000](http://localhost:4000)
- Web: [http://localhost:3000](http://localhost:3000)

Local SQLite is stored at `apps/api/data/fees.db`. The web app talks to the API using `API_URL` (default `http://localhost:4000`).

Run one app at a time:

```bash
npm run dev:api
npm run dev:web
```

## Deploy

The frontend and API are separate services.

### Vercel (web app)

This repo is a monorepo. The Next.js app lives in `apps/web`, so Vercel must use that build output (`apps/web/.next`), not a root `.next` folder.

`vercel.json` at the repo root already sets:

- Build command: `npm run build -w web`
- Output directory: `apps/web/.next`

If a deploy still fails with `.next` was not found:

1. Vercel → Project → Settings → Build and Deployment
2. Turn **off** Output Directory Override, or set it to `apps/web/.next`
3. Leave Root Directory empty (repo root), **or** set Root Directory to `apps/web` and then remove `outputDirectory` from `vercel.json`

Set this environment variable on the Vercel project:

- `API_URL` = your API origin, for example `https://api.example.com`

### API host

Host `apps/api` on a Node 22+ host. Set `PORT` and, if you do not have a persistent disk, Turso:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

Optionally set `WEB_ORIGIN` on the API to the frontend origin for CORS.

Tables are created automatically on first API request.
