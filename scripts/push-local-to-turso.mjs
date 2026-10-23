/**
 * Manual copy of localhost SQLite rows into Turso.
 * Never run this as part of a normal production deploy — that would
 * overwrite live school data with the local test database.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createClient } from "@libsql/client";

const TABLES = [
  {
    name: "classes",
    columns: ["id", "name", "monthly_fee", "billing_period", "created_at"],
  },
  {
    name: "students",
    columns: ["id", "class_id", "name", "phone", "active", "created_at"],
  },
  {
    name: "payments",
    columns: [
      "id",
      "student_id",
      "student_name",
      "year",
      "month",
      "week",
      "slot",
      "amount",
      "paid_on",
      "note",
    ],
  },
  {
    name: "attendance",
    columns: ["id", "student_id", "year", "week", "attended", "attended_on"],
  },
  {
    name: "class_holidays",
    columns: ["id", "class_id", "year", "week", "note"],
  },
];

function parseEnvFile(contents) {
  const out = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && out[key] === undefined) out[key] = value;
  }
  return out;
}

function loadEnv() {
  for (const file of [
    ".env.local",
    ".env",
    "apps/web/.env.local",
    "apps/api/.env",
    "apps/api/.env.local",
  ]) {
    if (!fs.existsSync(file)) continue;
    const parsed = parseEnvFile(fs.readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnv();

const url = process.env.TURSO_DATABASE_URL || "";
const token = process.env.TURSO_AUTH_TOKEN || "";
if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
  throw new Error(
    "Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before pushing local data.",
  );
}
if (!token) {
  throw new Error("TURSO_AUTH_TOKEN is missing.");
}

const localPath = path.resolve("apps/api/data/fees.db");
if (!fs.existsSync(localPath)) {
  throw new Error(`Local database not found at ${localPath}`);
}

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const local = new DatabaseSync(localPath, { readOnly: true });
const remote = createClient({ url, authToken: token });

const before = {};
for (const table of TABLES) {
  const result = await remote.execute(`SELECT COUNT(*) AS n FROM ${table.name}`);
  before[table.name] = Number(result.rows[0]?.n || 0);
}

const force = process.argv.includes("--force");
const remoteRows = before.classes + before.students + before.payments;
if (!force && remoteRows > 0) {
  throw new Error(
    `Production already has data (classes ${before.classes}, students ${before.students}, payments ${before.payments}). Refusing to copy localhost over it. This script is not used when deploying.`,
  );
}

for (const table of TABLES) {
  const rows = local.prepare(`SELECT ${table.columns.join(", ")} FROM ${table.name}`).all();
  const placeholders = table.columns.map(() => "?").join(", ");
  const sql = `INSERT OR REPLACE INTO ${table.name} (${table.columns.join(", ")}) VALUES (${placeholders})`;
  for (const row of rows) {
    const args = table.columns.map((column) => row[column] ?? null);
    await remote.execute({ sql, args });
  }
  console.log(`synced ${table.name}: ${rows.length} local rows`);
}

local.close();

const after = {};
for (const table of TABLES) {
  const result = await remote.execute(`SELECT COUNT(*) AS n FROM ${table.name}`);
  after[table.name] = Number(result.rows[0]?.n || 0);
}

console.log(JSON.stringify({ remoteBefore: before, remoteAfter: after }, null, 2));
console.log("turso-sync-ok");
