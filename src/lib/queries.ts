import { getDb, type ClassRow, type PaymentRow, type StudentRow } from "./db";

export type ClassWithCounts = ClassRow & {
  student_count: number;
  active_count: number;
};

export type StudentWithPayment = StudentRow & {
  class_name: string;
  monthly_fee: number;
  payment_id: number | null;
  paid_amount: number | null;
  paid_on: string | null;
  paid_student_name: string | null;
  is_paid: number;
};

export type MonthlyStats = {
  year: number;
  month: number;
  active_students: number;
  paid_students: number;
  unpaid_students: number;
  total_income: number;
  expected_income: number;
  outstanding: number;
};

export type ClassMonthlyStat = {
  id: number;
  name: string;
  monthly_fee: number;
  active_students: number;
  paid_students: number;
  unpaid_students: number;
  income: number;
  expected: number;
};

export function listClasses(): ClassWithCounts[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT c.*,
        COUNT(s.id) AS student_count,
        COALESCE(SUM(CASE WHEN s.active = 1 THEN 1 ELSE 0 END), 0) AS active_count
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all() as ClassWithCounts[];
}

export function getClass(id: number): ClassRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM classes WHERE id = ?`)
    .get(id) as ClassRow | undefined;
}

export function listStudentsByClass(
  classId: number,
  year: number,
  month: number,
): StudentWithPayment[] {
  return getDb()
    .prepare(
      `SELECT s.*,
        c.name AS class_name,
        c.monthly_fee,
        p.id AS payment_id,
        p.amount AS paid_amount,
        p.paid_on,
        COALESCE(NULLIF(p.student_name, ''), s.name) AS paid_student_name,
        CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS is_paid
       FROM students s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN payments p
         ON p.student_id = s.id AND p.year = ? AND p.month = ?
       WHERE s.class_id = ?
       ORDER BY s.active DESC, s.name COLLATE NOCASE`,
    )
    .all(year, month, classId) as StudentWithPayment[];
}

export function listStudentsForMonth(
  year: number,
  month: number,
  opts?: { classId?: number; status?: "paid" | "unpaid" | "all" },
): StudentWithPayment[] {
  const filters: string[] = ["s.active = 1"];
  const params: Array<number | string> = [year, month];

  if (opts?.classId) {
    filters.push("s.class_id = ?");
    params.push(opts.classId);
  }

  if (opts?.status === "paid") {
    filters.push("p.id IS NOT NULL");
  } else if (opts?.status === "unpaid") {
    filters.push("p.id IS NULL");
  }

  return getDb()
    .prepare(
      `SELECT s.*,
        c.name AS class_name,
        c.monthly_fee,
        p.id AS payment_id,
        p.amount AS paid_amount,
        p.paid_on,
        COALESCE(NULLIF(p.student_name, ''), s.name) AS paid_student_name,
        CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS is_paid
       FROM students s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN payments p
         ON p.student_id = s.id AND p.year = ? AND p.month = ?
       WHERE ${filters.join(" AND ")}
       ORDER BY c.name COLLATE NOCASE, s.name COLLATE NOCASE`,
    )
    .all(...params) as StudentWithPayment[];
}

export function getMonthlyStats(year: number, month: number): MonthlyStats {
  const row = getDb()
    .prepare(
      `SELECT
        COUNT(s.id) AS active_students,
        COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS paid_students,
        COALESCE(SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END), 0) AS unpaid_students,
        COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN p.amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(c.monthly_fee), 0) AS expected_income
       FROM students s
       JOIN classes c ON c.id = s.class_id
       LEFT JOIN payments p
         ON p.student_id = s.id AND p.year = ? AND p.month = ?
       WHERE s.active = 1`,
    )
    .get(year, month) as {
    active_students: number;
    paid_students: number;
    unpaid_students: number;
    total_income: number;
    expected_income: number;
  };

  return {
    year,
    month,
    ...row,
    outstanding: Math.max(0, row.expected_income - row.total_income),
  };
}

export function getClassMonthlyStats(
  year: number,
  month: number,
): ClassMonthlyStat[] {
  return getDb()
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.monthly_fee,
        COUNT(s.id) AS active_students,
        COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS paid_students,
        COALESCE(SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END), 0) AS unpaid_students,
        COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN p.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(c.monthly_fee), 0) AS expected
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id AND s.active = 1
       LEFT JOIN payments p
         ON p.student_id = s.id AND p.year = ? AND p.month = ?
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`,
    )
    .all(year, month) as ClassMonthlyStat[];
}

export function listRecentPayments(limit = 8): Array<
  PaymentRow & { student_name: string; class_name: string }
> {
  return getDb()
    .prepare(
      `SELECT p.*,
        COALESCE(NULLIF(p.student_name, ''), s.name) AS student_name,
        c.name AS class_name
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN classes c ON c.id = s.class_id
       ORDER BY p.paid_on DESC, p.id DESC
       LIMIT ?`,
    )
    .all(limit) as Array<
    PaymentRow & { student_name: string; class_name: string }
  >;
}
