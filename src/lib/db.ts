import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "fees.db");

declare global {
  // eslint-disable-next-line no-var
  var __feeDb: DatabaseSync | undefined;
}

function hasColumn(db: DatabaseSync, table: string, column: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return cols.some((c) => c.name === column);
}

function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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
  `);

  if (!hasColumn(db, "payments", "student_name")) {
    db.exec(`ALTER TABLE payments ADD COLUMN student_name TEXT NOT NULL DEFAULT ''`);
    db.exec(`
      UPDATE payments
      SET student_name = COALESCE(
        (SELECT name FROM students WHERE students.id = payments.student_id),
        ''
      )
      WHERE student_name = '' OR student_name IS NULL
    `);
  }
}

export function getDb(): DatabaseSync {
  if (!globalThis.__feeDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    globalThis.__feeDb = new DatabaseSync(DB_PATH);
  }

  // Re-run on every get so hot-reloads still apply schema updates.
  migrate(globalThis.__feeDb);
  return globalThis.__feeDb;
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
