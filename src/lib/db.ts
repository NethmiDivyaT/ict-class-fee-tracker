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
  var __feeMigrated: boolean | undefined;
}

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
    amount INTEGER NOT NULL CHECK (amount >= 0),
    paid_on TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    note TEXT,
    UNIQUE (student_id, year, month)
  );

  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
  CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(year, month);
  CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
`;

async function ensureStudentNameColumn(mode: "remote" | "local") {
  if (mode === "local") {
    const db = getLocalDb();
    const cols = db.prepare(`PRAGMA table_info(payments)`).all() as Array<{
      name: string;
    }>;
    if (!cols.some((c) => c.name === "student_name")) {
      db.exec(
        `ALTER TABLE payments ADD COLUMN student_name TEXT NOT NULL DEFAULT ''`,
      );
      db.exec(`
        UPDATE payments
        SET student_name = COALESCE(
          (SELECT name FROM students WHERE students.id = payments.student_id),
          ''
        )
        WHERE student_name = '' OR student_name IS NULL
      `);
    }
    return;
  }

  const client = getRemoteDb();
  const info = await client.execute(`PRAGMA table_info(payments)`);
  const hasColumn = info.rows.some((row) => row.name === "student_name");
  if (!hasColumn) {
    await client.execute(
      `ALTER TABLE payments ADD COLUMN student_name TEXT NOT NULL DEFAULT ''`,
    );
    await client.execute(`
      UPDATE payments
      SET student_name = COALESCE(
        (SELECT name FROM students WHERE students.id = payments.student_id),
        ''
      )
      WHERE student_name = '' OR student_name IS NULL
    `);
  }
}

async function migrate() {
  if (globalThis.__feeMigrated) return;

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

  await ensureStudentNameColumn(mode);
  globalThis.__feeMigrated = true;
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
  amount: number;
  paid_on: string;
  note: string | null;
};
