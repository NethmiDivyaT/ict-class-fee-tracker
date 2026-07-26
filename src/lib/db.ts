import {
  createClient,
  type Client,
  type InArgs,
  type Row,
} from "@libsql/client/web";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "fees.db");

declare global {
  // eslint-disable-next-line no-var
  var __feeLocalDb: DatabaseSync | undefined;
  // eslint-disable-next-line no-var
  var __feeRemoteDb: Client | undefined;
  // eslint-disable-next-line no-var
  var __feeSchemaReady: boolean | undefined;
}

export type BillingPeriod = "monthly" | "weekly";

export class DatabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConfigError";
  }
}

function isRemoteUrl(url: string | undefined): url is string {
  return Boolean(
    url &&
      (url.startsWith("libsql://") ||
        url.startsWith("https://") ||
        url.startsWith("http://")),
  );
}

function isVercel() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

export function getDatabaseMode(): "remote" | "local" {
  if (isRemoteUrl(process.env.TURSO_DATABASE_URL)) return "remote";
  if (isVercel()) {
    throw new DatabaseConfigError(
      "Local SQLite cannot run on Vercel. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the Vercel project environment variables.",
    );
  }
  return "local";
}

function getLocalDb(): DatabaseSync {
  if (!globalThis.__feeLocalDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    globalThis.__feeLocalDb = new DatabaseSync(DB_PATH);
  }
  return globalThis.__feeLocalDb;
}

function getRemoteDb(): Client {
  if (!globalThis.__feeRemoteDb) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!isRemoteUrl(url)) {
      throw new DatabaseConfigError(
        "TURSO_DATABASE_URL is missing or invalid.",
      );
    }
    globalThis.__feeRemoteDb = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return globalThis.__feeRemoteDb;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === "bigint") return Number(value);
  return value;
}

function normalizeRow<T>(row: Row): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    out[key] = normalizeValue(row[key]);
  }
  return out as T;
}

const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    monthly_fee INTEGER NOT NULL DEFAULT 0 CHECK (monthly_fee >= 0),
    billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'weekly')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL DEFAULT '',
    year INTEGER NOT NULL CHECK (year >= 2000),
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    week INTEGER NOT NULL DEFAULT 0 CHECK (week BETWEEN 0 AND 53),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    paid_on TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    note TEXT,
    UNIQUE (student_id, year, month, week)
  );

  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
  CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(year, month, week);
  CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
`;

async function tableColumns(
  mode: "remote" | "local",
  table: string,
): Promise<string[]> {
  if (mode === "local") {
    const cols = getLocalDb()
      .prepare(`PRAGMA table_info(${table})`)
      .all() as Array<{ name: string }>;
    return cols.map((c) => c.name);
  }
  const info = await getRemoteDb().execute(`PRAGMA table_info(${table})`);
  return info.rows.map((row) => String(row.name));
}

async function execSql(mode: "remote" | "local", sql: string) {
  if (mode === "local") {
    getLocalDb().exec(sql);
    return;
  }
  await getRemoteDb().execute(sql);
}

async function ensureSchemaUpgrades(mode: "remote" | "local") {
  const classCols = await tableColumns(mode, "classes");
  if (!classCols.includes("billing_period")) {
    await execSql(
      mode,
      `ALTER TABLE classes ADD COLUMN billing_period TEXT NOT NULL DEFAULT 'monthly'`,
    );
  }

  const paymentCols = await tableColumns(mode, "payments");
  if (!paymentCols.includes("student_name")) {
    await execSql(
      mode,
      `ALTER TABLE payments ADD COLUMN student_name TEXT NOT NULL DEFAULT ''`,
    );
    await execSql(
      mode,
      `UPDATE payments
       SET student_name = COALESCE(
         (SELECT name FROM students WHERE students.id = payments.student_id),
         ''
       )
       WHERE student_name = '' OR student_name IS NULL`,
    );
  }

  if (!paymentCols.includes("week")) {
    // Rebuild payments so UNIQUE(student_id, year, month, week) replaces old unique.
    await execSql(
      mode,
      `
      CREATE TABLE IF NOT EXISTS payments_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        student_name TEXT NOT NULL DEFAULT '',
        year INTEGER NOT NULL CHECK (year >= 2000),
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        week INTEGER NOT NULL DEFAULT 0 CHECK (week BETWEEN 0 AND 53),
        amount INTEGER NOT NULL CHECK (amount >= 0),
        paid_on TEXT NOT NULL DEFAULT (date('now', 'localtime')),
        note TEXT,
        UNIQUE (student_id, year, month, week)
      );
      `,
    );
    await execSql(
      mode,
      `
      INSERT INTO payments_v2 (id, student_id, student_name, year, month, week, amount, paid_on, note)
      SELECT id, student_id, COALESCE(student_name, ''), year, month, 0, amount, paid_on, note
      FROM payments;
      `,
    );
    await execSql(mode, `DROP TABLE payments;`);
    await execSql(mode, `ALTER TABLE payments_v2 RENAME TO payments;`);
    await execSql(
      mode,
      `CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(year, month, week);`,
    );
    await execSql(
      mode,
      `CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);`,
    );
  }
}

async function migrate() {
  if (globalThis.__feeSchemaReady) return;

  const mode = getDatabaseMode();
  if (mode === "local") {
    const db = getLocalDb();
    db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    db.exec(MIGRATION_SQL);
  } else {
    const client = getRemoteDb();
    const statements = MIGRATION_SQL.split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sql) => ({ sql }));
    await client.batch(statements, "write");
  }

  await ensureSchemaUpgrades(mode);
  globalThis.__feeSchemaReady = true;
}

export async function sqlAll<T>(sql: string, args: InArgs = []): Promise<T[]> {
  await migrate();
  if (getDatabaseMode() === "local") {
    const stmt = getLocalDb().prepare(sql);
    const values = (Array.isArray(args) ? args : []) as Array<
      string | number | bigint | null | Buffer
    >;
    return stmt.all(...values) as T[];
  }

  const result = await getRemoteDb().execute({ sql, args });
  return result.rows.map((row) => normalizeRow<T>(row));
}

export async function sqlGet<T>(
  sql: string,
  args: InArgs = [],
): Promise<T | undefined> {
  const rows = await sqlAll<T>(sql, args);
  return rows[0];
}

export async function sqlRun(
  sql: string,
  args: InArgs = [],
): Promise<{ lastInsertRowid: number; changes: number }> {
  await migrate();
  if (getDatabaseMode() === "local") {
    const stmt = getLocalDb().prepare(sql);
    const values = (Array.isArray(args) ? args : []) as Array<
      string | number | bigint | null | Buffer
    >;
    const result = stmt.run(...values);
    return {
      lastInsertRowid: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  }

  const result = await getRemoteDb().execute({ sql, args });
  return {
    lastInsertRowid: Number(result.lastInsertRowid),
    changes: Number(result.rowsAffected),
  };
}

export type ClassRow = {
  id: number;
  name: string;
  monthly_fee: number;
  billing_period: BillingPeriod;
  created_at: string;
};

export type StudentRow = {
  id: number;
  class_id: number;
  name: string;
  phone: string | null;
  active: number;
  created_at: string;
};

export type PaymentRow = {
  id: number;
  student_id: number;
  student_name: string;
  year: number;
  month: number;
  week: number;
  amount: number;
  paid_on: string;
  note: string | null;
};
