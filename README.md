# ICT Class Fee Tracker

Simple responsive Next.js app to track ICT class student fees in **LKR**, stored in a local **SQLite** database.

## Features

- Classes with monthly fee amounts
- Students grouped by class
- Mark paid / unpaid for each month
- Dashboard: monthly income, paid/unpaid counts, outstanding, by-class breakdown
- Records page with paid/unpaid and class filters

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite file is created at `data/fees.db` on first use.
