import { sqlAll, sqlGet, type ClassRow, type PaymentRow, type StudentRow } from "./db";

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

export async function listClasses(): Promise<ClassWithCounts[]> {
  return sqlAll<ClassWithCounts>(
    `SELECT c.*,
      COUNT(s.id) AS student_count,
      COALESCE(SUM(CASE WHEN s.active = 1 THEN 1 ELSE 0 END), 0) AS active_count
     FROM classes c
     LEFT JOIN students s ON s.class_id = c.id
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE`,
  );
}

export async function getClass(id: number): Promise<ClassRow | undefined> {
  return sqlGet<ClassRow>(`SELECT * FROM classes WHERE id = ?`, [id]);
}

export async function listStudentsByClass(
  classId: number,
  year: number,
  month: number,
): Promise<StudentWithPayment[]> {
  return sqlAll<StudentWithPayment>(
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
    [year, month, classId],
  );
}

export async function listStudentsForMonth(
  year: number,
  month: number,
  opts?: { classId?: number; status?: "paid" | "unpaid" | "all" },
): Promise<StudentWithPayment[]> {
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

  return sqlAll<StudentWithPayment>(
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
    params,
  );
}

export async function getMonthlyStats(
  year: number,
  month: number,
): Promise<MonthlyStats> {
  const row = (await sqlGet<{
    active_students: number;
    paid_students: number;
    unpaid_students: number;
    total_income: number;
    expected_income: number;
  }>(
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
    [year, month],
  )) ?? {
    active_students: 0,
    paid_students: 0,
    unpaid_students: 0,
    total_income: 0,
    expected_income: 0,
  };

  return {
    year,
    month,
    ...row,
    outstanding: Math.max(0, row.expected_income - row.total_income),
  };
}

export async function getClassMonthlyStats(
  year: number,
  month: number,
): Promise<ClassMonthlyStat[]> {
  return sqlAll<ClassMonthlyStat>(
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
    [year, month],
  );
}

export async function listRecentPayments(
  limit = 8,
): Promise<Array<PaymentRow & { student_name: string; class_name: string }>> {
  return sqlAll<PaymentRow & { student_name: string; class_name: string }>(
    `SELECT p.*,
      COALESCE(NULLIF(p.student_name, ''), s.name) AS student_name,
      c.name AS class_name
     FROM payments p
     JOIN students s ON s.id = p.student_id
     JOIN classes c ON c.id = s.class_id
     ORDER BY p.paid_on DESC, p.id DESC
     LIMIT ?`,
    [limit],
  );
}
