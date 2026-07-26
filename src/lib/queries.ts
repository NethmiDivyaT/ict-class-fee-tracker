import {
  sqlAll,
  sqlGet,
  type BillingPeriod,
  type ClassRow,
  type PaymentRow,
  type StudentRow,
} from "./db";

export type ClassWithCounts = ClassRow & {
  student_count: number;
  active_count: number;
};

export type StudentWithPayment = StudentRow & {
  class_name: string;
  monthly_fee: number;
  billing_period: BillingPeriod;
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
  billing_period: BillingPeriod;
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
  week = 0,
): Promise<StudentWithPayment[]> {
  return sqlAll<StudentWithPayment>(
    `SELECT s.*,
      c.name AS class_name,
      c.monthly_fee,
      c.billing_period,
      p.id AS payment_id,
      p.amount AS paid_amount,
      p.paid_on,
      COALESCE(NULLIF(p.student_name, ''), s.name) AS paid_student_name,
      CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS is_paid
     FROM students s
     JOIN classes c ON c.id = s.class_id
     LEFT JOIN payments p
       ON p.student_id = s.id
      AND p.year = ?
      AND p.month = ?
      AND p.week = ?
     WHERE s.class_id = ?
     ORDER BY s.active DESC, s.name COLLATE NOCASE`,
    [year, month, week, classId],
  );
}

export async function listStudentsForPeriod(
  year: number,
  month: number,
  week: number,
  opts?: {
    classId?: number;
    status?: "paid" | "unpaid" | "all";
    billingPeriod?: BillingPeriod;
  },
): Promise<StudentWithPayment[]> {
  const filters: string[] = ["s.active = 1"];
  const params: Array<number | string> = [year, month, week];

  if (opts?.classId) {
    filters.push("s.class_id = ?");
    params.push(opts.classId);
  }

  if (opts?.billingPeriod) {
    filters.push("c.billing_period = ?");
    params.push(opts.billingPeriod);
  } else if (week > 0) {
    filters.push("c.billing_period = 'weekly'");
  } else {
    filters.push("c.billing_period = 'monthly'");
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
      c.billing_period,
      p.id AS payment_id,
      p.amount AS paid_amount,
      p.paid_on,
      COALESCE(NULLIF(p.student_name, ''), s.name) AS paid_student_name,
      CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END AS is_paid
     FROM students s
     JOIN classes c ON c.id = s.class_id
     LEFT JOIN payments p
       ON p.student_id = s.id
      AND p.year = ?
      AND p.month = ?
      AND p.week = ?
     WHERE ${filters.join(" AND ")}
     ORDER BY c.name COLLATE NOCASE, s.name COLLATE NOCASE`,
    params,
  );
}

/** @deprecated use listStudentsForPeriod */
export async function listStudentsForMonth(
  year: number,
  month: number,
  opts?: { classId?: number; status?: "paid" | "unpaid" | "all" },
): Promise<StudentWithPayment[]> {
  return listStudentsForPeriod(year, month, 0, {
    ...opts,
    billingPeriod: "monthly",
  });
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
       ON p.student_id = s.id
      AND p.year = ?
      AND p.month = ?
      AND p.week = 0
     WHERE s.active = 1 AND c.billing_period = 'monthly'`,
    [year, month],
  )) ?? {
    active_students: 0,
    paid_students: 0,
    unpaid_students: 0,
    total_income: 0,
    expected_income: 0,
  };

  const weeklyIncome = (await sqlGet<{ income: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS income
     FROM payments
     WHERE year = ? AND month = ? AND week > 0`,
    [year, month],
  )) ?? { income: 0 };

  const total_income = row.total_income + weeklyIncome.income;

  return {
    year,
    month,
    ...row,
    total_income,
    outstanding: Math.max(0, row.expected_income - row.total_income),
  };
}

export async function getClassMonthlyStats(
  year: number,
  month: number,
): Promise<ClassMonthlyStat[]> {
  const monthly = await sqlAll<ClassMonthlyStat>(
    `SELECT
      c.id,
      c.name,
      c.monthly_fee,
      c.billing_period,
      COUNT(s.id) AS active_students,
      COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END), 0) AS paid_students,
      COALESCE(SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END), 0) AS unpaid_students,
      COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN p.amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(c.monthly_fee), 0) AS expected
     FROM classes c
     LEFT JOIN students s ON s.class_id = c.id AND s.active = 1
     LEFT JOIN payments p
       ON p.student_id = s.id
      AND p.year = ?
      AND p.month = ?
      AND p.week = 0
     WHERE c.billing_period = 'monthly'
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE`,
    [year, month],
  );

  const weekly = await sqlAll<ClassMonthlyStat>(
    `SELECT
      c.id,
      c.name,
      c.monthly_fee,
      c.billing_period,
      COUNT(DISTINCT s.id) AS active_students,
      COUNT(DISTINCT p.student_id) AS paid_students,
      0 AS unpaid_students,
      COALESCE(SUM(p.amount), 0) AS income,
      0 AS expected
     FROM classes c
     LEFT JOIN students s ON s.class_id = c.id AND s.active = 1
     LEFT JOIN payments p
       ON p.student_id = s.id
      AND p.year = ?
      AND p.month = ?
      AND p.week > 0
     WHERE c.billing_period = 'weekly'
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE`,
    [year, month],
  );

  const weeklyAdjusted = weekly.map((row) => ({
    ...row,
    unpaid_students: Math.max(0, row.active_students - row.paid_students),
  }));

  return [...monthly, ...weeklyAdjusted].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
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

export type AnnualStats = {
  year: number;
  total_income: number;
  payment_count: number;
  students_paid: number;
  best_month: number | null;
  best_month_income: number;
};

export type MonthIncome = {
  month: number;
  income: number;
  payment_count: number;
};

export type ClassAnnualStat = {
  id: number;
  name: string;
  income: number;
  payment_count: number;
  students_paid: number;
};

export async function getAnnualStats(year: number): Promise<AnnualStats> {
  const summary = (await sqlGet<{
    total_income: number;
    payment_count: number;
    students_paid: number;
  }>(
    `SELECT
      COALESCE(SUM(amount), 0) AS total_income,
      COUNT(*) AS payment_count,
      COUNT(DISTINCT student_id) AS students_paid
     FROM payments
     WHERE year = ?`,
    [year],
  )) ?? {
    total_income: 0,
    payment_count: 0,
    students_paid: 0,
  };

  const best = await sqlGet<{ month: number; income: number }>(
    `SELECT month, COALESCE(SUM(amount), 0) AS income
     FROM payments
     WHERE year = ?
     GROUP BY month
     ORDER BY income DESC
     LIMIT 1`,
    [year],
  );

  return {
    year,
    ...summary,
    best_month: best?.month ?? null,
    best_month_income: best?.income ?? 0,
  };
}

export async function getMonthlyIncomeForYear(
  year: number,
): Promise<MonthIncome[]> {
  const rows = await sqlAll<MonthIncome>(
    `SELECT month,
      COALESCE(SUM(amount), 0) AS income,
      COUNT(*) AS payment_count
     FROM payments
     WHERE year = ?
     GROUP BY month
     ORDER BY month`,
    [year],
  );

  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return (
      byMonth.get(month) ?? {
        month,
        income: 0,
        payment_count: 0,
      }
    );
  });
}

export async function getClassAnnualStats(
  year: number,
): Promise<ClassAnnualStat[]> {
  return sqlAll<ClassAnnualStat>(
    `SELECT
      c.id,
      c.name,
      COALESCE(SUM(p.amount), 0) AS income,
      COUNT(p.id) AS payment_count,
      COUNT(DISTINCT p.student_id) AS students_paid
     FROM classes c
     LEFT JOIN students s ON s.class_id = c.id
     LEFT JOIN payments p ON p.student_id = s.id AND p.year = ?
     GROUP BY c.id
     ORDER BY income DESC, c.name COLLATE NOCASE`,
    [year],
  );
}
