# ICT Class Fee Tracker

Simple responsive Next.js app to track ICT class student fees in **LKR**.

- Local development: SQLite file at `data/fees.db`
- Vercel production: hosted SQLite via [Turso](https://turso.tech) (`TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`)

## Features

- Add a class with students (one name per line)
- Mark paid with student name + paying date
- Dashboard: monthly income, paid/unpaid counts, outstanding
- Records page with paid/unpaid and class filters

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

Local SQLite **cannot** persist on Vercel. Use Turso:

1. Create a free database at [turso.tech](https://turso.tech)
2. Copy the database URL and create an auth token
3. In Vercel → Project → Settings → Environment Variables, add:
   - `TURSO_DATABASE_URL` = `libsql://...`
   - `TURSO_AUTH_TOKEN` = your token
4. Redeploy

Tables are created automatically on first request.
