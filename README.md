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

Open [http://localhost:3000](http://localhost:3000). Local SQLite is always `apps/api/data/fees.db` — both the Next.js app and the optional API write to that file. Check `http://localhost:3000/api/health` to confirm the mode and row counts.

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
4. Redeploy the **code only**. Existing Turso classes, students, payments, attendance, and holidays stay in place. Schema upgrades copy old payment rows before they change the table, and abort if a row count would shrink.
5. Open `/api/health` on the deployed site. It should report `"mode": "remote"` plus class/student/payment counts. Those counts should not drop after deploy.

If a deploy says `.next` was not found, turn **off** Output Directory Override in Vercel, or set it to `apps/web/.next`.

Use Node.js 22 on Vercel (see `.nvmrc`). Tables are created automatically on first request.

Localhost (`apps/api/data/fees.db`) and production (Turso) are separate databases. A production deploy never copies localhost rows onto Turso. Do not run `scripts/push-local-to-turso.mjs` against a live school database.
