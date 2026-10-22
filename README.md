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

1. Host `apps/api` on a Node host. Set `PORT` and, if you do not have a persistent disk, Turso:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
2. Host `apps/web` (Vercel is fine). Set:
   - `API_URL` = your API origin, for example `https://api.example.com`
3. Optionally set `WEB_ORIGIN` on the API to the frontend origin for CORS.

Tables are created automatically on first API request.
