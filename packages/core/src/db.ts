import {
  createClient,
  type Client,
  type InArgs,
  type Row,
} from "@libsql/client/web";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ENV_KEYS = [
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
  "SQLITE_DATA_DIR",
  "VERCEL",
  "VERCEL_ENV",
] as const;

function searchRoots(): string[] {
  const roots = [process.cwd()];
  try {
    roots.push(path.dirname(fileURLToPath(import.meta.url)));
  } catch {
    // Bundlers may not expose import.meta.url.
  }
  return roots;
}

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
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
    if (key) out[key] = value;
  }
  return out;
}

function loadLocalEnvFiles() {
  if (globalThis.__feeEnvLoaded) return;
  globalThis.__feeEnvLoaded = true;

  const candidates: string[] = [];
  for (const start of searchRoots()) {
    let dir = start;
    for (let i = 0; i < 10; i++) {
      candidates.push(
        path.join(dir, ".env"),
        path.join(dir, ".env.local"),
        path.join(dir, "apps", "web", ".env"),
        path.join(dir, "apps", "web", ".env.local"),
        path.join(dir, "apps", "api", ".env"),
        path.join(dir, "apps", "api", ".env.local"),
      );
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  const seen = new Set<string>();
  for (const file of candidates) {
    const resolved = path.resolve(file);
    if (seen.has(resolved) || !fs.existsSync(resolved)) continue;
    seen.add(resolved);
    let parsed: Record<string, string>;
    try {
      parsed = parseEnvFile(fs.readFileSync(resolved, "utf8"));
    } catch {
      continue;
    }
    for (const key of ENV_KEYS) {
      if (process.env[key] === undefined && parsed[key]) {
        process.env[key] = parsed[key];
      }
    }
  }
}

function resolveRepoRoot(): string | null {
  for (const start of searchRoots()) {
    let dir = start;
    for (let i = 0; i < 10; i++) {
      if (
        fs.existsSync(path.join(dir, "apps", "api")) &&
        fs.existsSync(path.join(dir, "apps", "web"))
      ) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return null;
}

function resolveDataDir(): string {
  loadLocalEnvFiles();
  if (process.env.SQLITE_DATA_DIR) {
    return path.resolve(process.env.SQLITE_DATA_DIR);
  }

  const repoRoot = resolveRepoRoot();
  if (repoRoot) return path.join(repoRoot, "apps", "api", "data");

  const fallbacks = [
    path.join(process.cwd(), "apps", "api", "data"),
    path.join(process.cwd(), "..", "api", "data"),
  ];
  for (const dir of fallbacks) {
    if (fs.existsSync(path.join(dir, "fees.db"))) return dir;
  }
  return fallbacks[0];
}

function getDbPath() {
  return path.join(resolveDataDir(), "fees.db");
}

declare global {
  var __feeLocalDb: DatabaseSync | undefined;
  var __feeLocalDbPath: string | undefined;
  var __feeRemoteDb: Client | undefined;
  var __feeSchemaReady: boolean | undefined;
  var __feeEnvLoaded: boolean | undefined;
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
  loadLocalEnvFiles();
  if (isRemoteUrl(process.env.TURSO_DATABASE_URL)) return "remote";
  if (isVercel()) {
    throw new DatabaseConfigError(
      "Local SQLite cannot run on Vercel. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on the web project.",
    );
  }
  return "local";
}

function getLocalDb(): DatabaseSync {
  const dbPath = getDbPath();
  if (!globalThis.__feeLocalDb || globalThis.__feeLocalDbPath !== dbPath) {
    if (globalThis.__feeLocalDb) {
      try {
        globalThis.__feeLocalDb.close();
      } catch {
        // Replace a stale connection opened against a different file.
      }
    }
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    globalThis.__feeLocalDb = new DatabaseSync(dbPath);
    globalThis.__feeLocalDbPath = dbPath;
    globalThis.__feeSchemaReady = false;
  }
  return globalThis.__feeLocalDb;
}

function persistLocalWrites() {
  try {
    getLocalDb().exec("PRAGMA wal_checkpoint(FULL);");
  } catch {
    // Another reader may hold the WAL; the write is still durable.
  }
}

function getRemoteDb(): Client {
  loadLocalEnvFiles();
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

function normalizeRow<T>(row: Record<string, unknown> | Row): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    out[key] = normalizeValue((row as Record<string, unknown>)[key]);
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
    slot INTEGER NOT NULL DEFAULT 0 CHECK (slot >= 0),
    amount INTEGER NOT NULL CHECK (amount >= 0),
    paid_on TEXT NOT NULL DEFAULT (date('now', 'localtime')),
    note TEXT,
    UNIQUE (student_id, year, month, week, slot)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    year INTEGER NOT NULL CHECK (year >= 2000),
    week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 53),
    attended INTEGER NOT NULL DEFAULT 1 CHECK (attended IN (0, 1)),
    attended_on TEXT NOT NULL,
    UNIQUE (student_id, year, week)
  );

  CREATE TABLE IF NOT EXISTS class_holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    year INTEGER NOT NULL CHECK (year >= 2000),
    week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 53),
    note TEXT,
    UNIQUE (class_id, year, week)
  );

  CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
  CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(year, month, week);
  CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_week ON attendance(year, week);
  CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
  CREATE INDEX IF NOT EXISTS idx_class_holidays_week ON class_holidays(class_id, year, week);
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

async function tableExists(
  mode: "remote" | "local",
  table: string,
): Promise<boolean> {
  if (mode === "local") {
    const row = getLocalDb()
      .prepare(
        `SELECT 1 AS n FROM sqlite_master WHERE type = 'table' AND name = ?`,
      )
      .get(table) as { n?: number } | undefined;
    return Boolean(row);
  }
  const result = await getRemoteDb().execute({
    sql: `SELECT 1 AS n FROM sqlite_master WHERE type = 'table' AND name = ?`,
    args: [table],
  });
  return result.rows.length > 0;
}

async function rawCount(
  mode: "remote" | "local",
  table: string,
): Promise<number> {
  if (!(await tableExists(mode, table))) return 0;
  if (mode === "local") {
    const row = getLocalDb()
      .prepare(`SELECT COUNT(*) AS n FROM ${table}`)
      .get() as { n: number };
    return Number(row.n || 0);
  }
  const result = await getRemoteDb().execute(
    `SELECT COUNT(*) AS n FROM ${table}`,
  );
  return Number(result.rows[0]?.n || 0);
}

async function snapshotCoreCounts(mode: "remote" | "local") {
  return {
    classes: await rawCount(mode, "classes"),
    students: await rawCount(mode, "students"),
    payments: await rawCount(mode, "payments"),
    attendance: await rawCount(mode, "attendance"),
    holidays: await rawCount(mode, "class_holidays"),
  };
}

function assertCountsPreserved(
  before: Record<string, number>,
  after: Record<string, number>,
) {
  for (const [table, count] of Object.entries(before)) {
    const next = after[table] ?? 0;
    if (next < count) {
      throw new DatabaseConfigError(
        `Refusing to finish migration: ${table} went from ${count} to ${next} rows.`,
      );
    }
  }
}

async function recoverPaymentsStaging(
  mode: "remote" | "local",
  staging: string,
) {
  const hasPayments = await tableExists(mode, "payments");
  const hasStaging = await tableExists(mode, staging);
  if (!hasPayments && hasStaging) {
    await execSql(mode, `ALTER TABLE ${staging} RENAME TO payments`);
    return;
  }
  if (hasPayments && hasStaging) {
    await execSql(mode, `DROP TABLE ${staging}`);
  }
}

async function rebuildPaymentsTable(
  mode: "remote" | "local",
  staging: string,
  createSql: string,
  copySql: string,
) {
  await recoverPaymentsStaging(mode, staging);
  const before = await rawCount(mode, "payments");
  await execSql(mode, createSql);
  await execSql(mode, copySql);
  const copied = await rawCount(mode, staging);
  if (copied !== before) {
    await execSql(mode, `DROP TABLE ${staging}`);
    throw new DatabaseConfigError(
      `Payment migration refused: copied ${copied} of ${before} rows. Existing payments were left unchanged.`,
    );
  }

  const finalize = [
    `DROP TABLE payments`,
    `ALTER TABLE ${staging} RENAME TO payments`,
    `CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(year, month, week)`,
    `CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)`,
  ];

  if (mode === "local") {
    const db = getLocalDb();
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const sql of finalize) db.exec(sql);
      db.exec("COMMIT");
    } catch (error) {
      try {
        db.exec("ROLLBACK");
      } catch {
        // Keep the original error.
      }
      throw error;
    }
    return;
  }

  await getRemoteDb().batch(
    finalize.map((sql) => ({ sql })),
    "write",
  );
}

async function ensureSchemaUpgrades(mode: "remote" | "local") {
  const before = await snapshotCoreCounts(mode);
  await recoverPaymentsStaging(mode, "payments_v2");
  await recoverPaymentsStaging(mode, "payments_v3");

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
    await rebuildPaymentsTable(
      mode,
      "payments_v2",
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
      )
      `,
      `
      INSERT INTO payments_v2 (id, student_id, student_name, year, month, week, amount, paid_on, note)
      SELECT id, student_id, COALESCE(student_name, ''), year, month, 0, amount, paid_on, note
      FROM payments
      `,
    );
  }

  const paymentColsAfter = await tableColumns(mode, "payments");
  if (!paymentColsAfter.includes("slot")) {
    await rebuildPaymentsTable(
      mode,
      "payments_v3",
      `
      CREATE TABLE IF NOT EXISTS payments_v3 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        student_name TEXT NOT NULL DEFAULT '',
        year INTEGER NOT NULL CHECK (year >= 2000),
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        week INTEGER NOT NULL DEFAULT 0 CHECK (week BETWEEN 0 AND 53),
        slot INTEGER NOT NULL DEFAULT 0 CHECK (slot >= 0),
        amount INTEGER NOT NULL CHECK (amount >= 0),
        paid_on TEXT NOT NULL DEFAULT (date('now', 'localtime')),
        note TEXT,
        UNIQUE (student_id, year, month, week, slot)
      )
      `,
      `
      INSERT INTO payments_v3 (id, student_id, student_name, year, month, week, slot, amount, paid_on, note)
      SELECT id, student_id, COALESCE(student_name, ''), year, month, week, 0, amount, paid_on, note
      FROM payments
      `,
    );
  }

  await execSql(
    mode,
    `CREATE TABLE IF NOT EXISTS class_holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      year INTEGER NOT NULL CHECK (year >= 2000),
      week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 53),
      note TEXT,
      UNIQUE (class_id, year, week)
    )`,
  );
  await execSql(
    mode,
    `CREATE INDEX IF NOT EXISTS idx_class_holidays_week ON class_holidays(class_id, year, week)`,
  );

  assertCountsPreserved(before, await snapshotCoreCounts(mode));
}

async function migrate() {
  const mode = getDatabaseMode();
  if (globalThis.__feeSchemaReady) {
    await execSql(
      mode,
      `CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        year INTEGER NOT NULL CHECK (year >= 2000),
        week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 53),
        attended INTEGER NOT NULL DEFAULT 1 CHECK (attended IN (0, 1)),
        attended_on TEXT NOT NULL,
        UNIQUE (student_id, year, week)
      )`,
    );
    await execSql(
      mode,
      `CREATE TABLE IF NOT EXISTS class_holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        year INTEGER NOT NULL CHECK (year >= 2000),
        week INTEGER NOT NULL CHECK (week BETWEEN 1 AND 53),
        note TEXT,
        UNIQUE (class_id, year, week)
      )`,
    );
    return;
  }

  if (mode === "local") {
    const db = getLocalDb();
    db.exec(
      "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL;",
    );
    db.exec(MIGRATION_SQL);
    persistLocalWrites();
  } else {
    const client = getRemoteDb();
    const statements = MIGRATION_SQL.split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sql) => ({ sql }));
    await client.batch(statements, "write");
  }

  await ensureSchemaUpgrades(mode);
  if (mode === "local") persistLocalWrites();
  globalThis.__feeSchemaReady = true;
}

export async function sqlAll<T>(sql: string, args: InArgs = []): Promise<T[]> {
  await migrate();
  if (getDatabaseMode() === "local") {
    const stmt = getLocalDb().prepare(sql);
    const values = (Array.isArray(args) ? args : []) as Array<
      string | number | bigint | null | Buffer
    >;
    return stmt
      .all(...values)
      .map((row) => normalizeRow<T>(row as Record<string, unknown>));
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
    persistLocalWrites();
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

export type StorageInfo = {
  mode: "local" | "remote";
  path?: string;
  counts: {
    classes: number;
    students: number;
    payments: number;
    attendance: number;
    holidays: number;
  };
};

async function countRows(table: string): Promise<number> {
  const row = await sqlGet<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return Number(row?.n || 0);
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const mode = getDatabaseMode();
  return {
    mode,
    path: mode === "local" ? getDbPath() : undefined,
    counts: {
      classes: await countRows("classes"),
      students: await countRows("students"),
      payments: await countRows("payments"),
      attendance: await countRows("attendance"),
      holidays: await countRows("class_holidays"),
    },
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
  slot: number;
  amount: number;
  paid_on: string;
  note: string | null;
};

export type AttendanceRow = {
  id: number;
  student_id: number;
  year: number;
  week: number;
  attended: number;
  attended_on: string;
};

export type ClassHolidayRow = {
  id: number;
  class_id: number;
  year: number;
  week: number;
  note: string | null;
};
