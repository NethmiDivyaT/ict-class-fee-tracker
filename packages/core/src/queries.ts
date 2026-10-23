import {
  buildFeeSlots,
  getClassWeekAttendance,
  getStudentBilling,
  type AttendanceDay,
  type FeeSlot,
} from "./billing";
import {
  sqlAll,
  sqlGet,
  type BillingPeriod,
  type ClassHolidayRow,
  type ClassRow,
  type PaymentRow,
  type StudentRow,
} from "./db";

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

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
  attended: number;
  attendance_days: number;
  leftover_days: number;
  leftover_dates: string[];
  billable_months: number;
  unpaid_months: number;
  unpaid_slots: FeeSlot[];
  paid_slots: FeeSlot[];
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

export async function getClassHoliday(
  classId: number,
  year: number,
  week: number,
): Promise<ClassHolidayRow | undefined> {
  return sqlGet<ClassHolidayRow>(
    `SELECT * FROM class_holidays WHERE class_id = ? AND year = ? AND week = ?`,
    [classId, year, week],
  );
}

export type StudentAttendanceStat = {
  student_id: number;
  student_name: string;
  class_id: number;
  class_name: string;
  billing_period: BillingPeriod;
  active: number;
  present_weeks: number;
  holiday_weeks: number;
  leftover_days: number;
  billable_months: number;
  paid_months: number;
  unpaid_months: number;
};

export async function getAnnualAttendance(
  year: number,
): Promise<StudentAttendanceStat[]> {
  const [students, presentRows, holidayRows] = await Promise.all([
    sqlAll<{
      id: number;
      name: string;
      active: number;
      class_id: number;
      class_name: string;
      billing_period: BillingPeriod;
    }>(
      `SELECT s.id, s.name, s.active, s.class_id, c.name AS class_name, c.billing_period
       FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.active = 1
       ORDER BY c.name COLLATE NOCASE, s.name COLLATE NOCASE`,
    ),
    sqlAll<{ student_id: number; present_weeks: number }>(
      `SELECT a.student_id, COUNT(*) AS present_weeks
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN class_holidays h
         ON h.class_id = s.class_id AND h.year = a.year AND h.week = a.week
       WHERE a.attended = 1 AND a.year = ? AND h.id IS NULL
       GROUP BY a.student_id`,
      [year],
    ),
    sqlAll<{ class_id: number; holiday_weeks: number }>(
      `SELECT class_id, COUNT(*) AS holiday_weeks
       FROM class_holidays
       WHERE year = ?
       GROUP BY class_id`,
      [year],
    ),
  ]);

  const presentByStudent = new Map(
    presentRows.map((row) => [row.student_id, asNumber(row.present_weeks)]),
  );
  const holidaysByClass = new Map(
    holidayRows.map((row) => [row.class_id, asNumber(row.holiday_weeks)]),
  );

  return Promise.all(
    students.map(async (student) => {
      const billing =
        student.billing_period === "monthly"
          ? await getStudentBilling(student.id)
          : null;
      const yearSlots =
        billing?.slots.filter((slot) => slot.year === year) ?? [];
      return {
        student_id: student.id,
        student_name: student.name,
        class_id: student.class_id,
        class_name: student.class_name,
        billing_period: student.billing_period,
        active: student.active,
        present_weeks: presentByStudent.get(student.id) ?? 0,
        holiday_weeks: holidaysByClass.get(student.class_id) ?? 0,
        leftover_days: billing?.leftover_days ?? 0,
        billable_months: yearSlots.length,
        paid_months: yearSlots.filter((slot) => slot.paid).length,
        unpaid_months: yearSlots.filter((slot) => !slot.paid).length,
      };
    }),
  );
}

async function withAttendanceAndBilling(
  rows: StudentWithPayment[],
  classId: number,
  year: number,
  week: number,
): Promise<StudentWithPayment[]> {
  const weekAttendance =
    week > 0 ? await getClassWeekAttendance(classId, year, week) : [];
  const byStudent = new Map(weekAttendance.map((row) => [row.student_id, row]));

  return Promise.all(
    rows.map(async (row) => {
      const billing =
        row.billing_period === "monthly"
          ? await getStudentBilling(row.id)
          : null;
      const present = byStudent.get(row.id);
      const unpaid = billing?.slots.filter((slot) => !slot.paid) ?? [];
      const paid = billing?.slots.filter((slot) => slot.paid) ?? [];
      return {
        ...row,
        attended: present?.attended ? 1 : 0,
        attendance_days: billing?.attendance_days ?? 0,
        leftover_days: billing?.leftover_days ?? 0,
        leftover_dates: billing?.leftover_dates ?? [],
        billable_months: billing?.billable_months ?? 0,
        unpaid_months: billing?.unpaid_months ?? unpaid.length,
        unpaid_slots: unpaid,
        paid_slots: paid,
      };
    }),
  );
}

export async function listStudentsByClass(
  classId: number,
  year: number,
  month: number,
  week = 0,
): Promise<StudentWithPayment[]> {
  const rows = await sqlAll<StudentWithPayment>(
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
  return withAttendanceAndBilling(rows, classId, year, week);
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

  const rows = await sqlAll<StudentWithPayment>(
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

  const classId = opts?.classId;
  if (!classId) {
    return Promise.all(
      rows.map(async (row) => {
        const billing =
          row.billing_period === "monthly"
            ? await getStudentBilling(row.id)
            : null;
        const unpaid = billing?.slots.filter((slot) => !slot.paid) ?? [];
        const paid = billing?.slots.filter((slot) => slot.paid) ?? [];
        return {
          ...row,
          attended: 0,
          attendance_days: billing?.attendance_days ?? 0,
          leftover_days: billing?.leftover_days ?? 0,
          leftover_dates: billing?.leftover_dates ?? [],
          billable_months: billing?.billable_months ?? 0,
          unpaid_months: billing?.unpaid_months ?? 0,
          unpaid_slots: unpaid,
          paid_slots: paid,
        };
      }),
    );
  }

  return withAttendanceAndBilling(rows, classId, year, week);
}

type MonthlyStudent = {
  id: number;
  class_id: number;
  monthly_fee: number;
};

async function listMonthlySlotStats(year: number, month: number) {
  const [students, days, holidays, payments] = await Promise.all([
    sqlAll<MonthlyStudent>(
      `SELECT s.id, s.class_id, c.monthly_fee
       FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.active = 1 AND c.billing_period = 'monthly'`,
    ),
    sqlAll<AttendanceDay & { student_id: number; class_id: number }>(
      `SELECT a.student_id, s.class_id, a.year, a.week, a.attended_on
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.attended = 1`,
    ),
    sqlAll<{ class_id: number; year: number; week: number }>(
      `SELECT class_id, year, week FROM class_holidays`,
    ),
    sqlAll<PaymentRow>(
      `SELECT * FROM payments WHERE week = 0`,
    ),
  ]);

  const holidayKeys = new Set(
    holidays.map((row) => `${row.class_id}-${row.year}-${row.week}`),
  );
  const daysByStudent = new Map<number, AttendanceDay[]>();
  for (const day of days) {
    if (holidayKeys.has(`${day.class_id}-${day.year}-${day.week}`)) continue;
    const list = daysByStudent.get(day.student_id) ?? [];
    list.push(day);
    daysByStudent.set(day.student_id, list);
  }

  const paymentsByStudent = new Map<number, PaymentRow[]>();
  for (const payment of payments) {
    const list = paymentsByStudent.get(payment.student_id) ?? [];
    list.push(payment);
    paymentsByStudent.set(payment.student_id, list);
  }

  return students.map((student) => {
    const billing = buildFeeSlots(
      daysByStudent.get(student.id) ?? [],
      paymentsByStudent.get(student.id) ?? [],
    );
    const slots = billing.slots.filter(
      (slot) => slot.year === year && slot.month === month,
    );
    const due = slots.length > 0;
    const unpaid = slots.some((slot) => !slot.paid);
    return {
      student,
      slots,
      due,
      paid: due && !unpaid,
      unpaid: due && unpaid,
      expected: slots.length * asNumber(student.monthly_fee),
      income: slots.reduce((sum, slot) => sum + asNumber(slot.amount), 0),
    };
  });
}

export async function getMonthlyStats(
  year: number,
  month: number,
): Promise<MonthlyStats> {
  const [rows, incomeRow] = await Promise.all([
    listMonthlySlotStats(year, month),
    sqlGet<{ income: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS income
       FROM payments
       WHERE year = ? AND month = ?`,
      [year, month],
    ),
  ]);

  const active_students = rows.length;
  const paid_students = rows.filter((row) => row.paid).length;
  const unpaid_students = rows.filter((row) => row.unpaid).length;
  const expected_income = rows.reduce((sum, row) => sum + row.expected, 0);
  const total_income = asNumber(incomeRow?.income);

  return {
    year,
    month,
    active_students,
    paid_students,
    unpaid_students,
    total_income,
    expected_income,
    outstanding: Math.max(0, expected_income - total_income),
  };
}

export async function getClassMonthlyStats(
  year: number,
  month: number,
): Promise<ClassMonthlyStat[]> {
  const [classes, rows, monthlyIncome] = await Promise.all([
    sqlAll<ClassRow>(
      `SELECT * FROM classes WHERE billing_period = 'monthly' ORDER BY name COLLATE NOCASE`,
    ),
    listMonthlySlotStats(year, month),
    sqlAll<{ class_id: number; income: number }>(
      `SELECT s.class_id, COALESCE(SUM(p.amount), 0) AS income
       FROM payments p
       JOIN students s ON s.id = p.student_id
       JOIN classes c ON c.id = s.class_id
       WHERE p.year = ? AND p.month = ? AND p.week = 0 AND c.billing_period = 'monthly'
       GROUP BY s.class_id`,
      [year, month],
    ),
  ]);

  const incomeByClass = new Map(
    monthlyIncome.map((row) => [row.class_id, asNumber(row.income)]),
  );

  const monthly = classes.map((cls) => {
    const classRows = rows.filter((row) => row.student.class_id === cls.id);
    return {
      id: cls.id,
      name: cls.name,
      monthly_fee: asNumber(cls.monthly_fee),
      billing_period: cls.billing_period,
      active_students: classRows.length,
      paid_students: classRows.filter((row) => row.paid).length,
      unpaid_students: classRows.filter((row) => row.unpaid).length,
      income: incomeByClass.get(cls.id) ?? 0,
      expected: classRows.reduce((sum, row) => sum + row.expected, 0),
    };
  });

  const weekly = await sqlAll<ClassMonthlyStat>(
    `SELECT
      c.id,
      c.name,
      c.monthly_fee,
      c.billing_period,
      COUNT(DISTINCT s.id) AS active_students,
      COUNT(DISTINCT pay.student_id) AS paid_students,
      0 AS unpaid_students,
      COALESCE(SUM(pay.income), 0) AS income,
      0 AS expected
     FROM classes c
     LEFT JOIN students s ON s.class_id = c.id AND s.active = 1
     LEFT JOIN (
       SELECT student_id, SUM(amount) AS income
       FROM payments
       WHERE year = ? AND month = ? AND week > 0
       GROUP BY student_id
     ) pay ON pay.student_id = s.id
     WHERE c.billing_period = 'weekly'
     GROUP BY c.id
     ORDER BY c.name COLLATE NOCASE`,
    [year, month],
  );

  const weeklyAdjusted = weekly.map((row) => {
    const active_students = asNumber(row.active_students);
    const paid_students = asNumber(row.paid_students);
    return {
      ...row,
      monthly_fee: asNumber(row.monthly_fee),
      active_students,
      paid_students,
      unpaid_students: Math.max(0, active_students - paid_students),
      income: asNumber(row.income),
      expected: asNumber(row.expected),
    };
  });

  return [
    ...monthly.map((row) => ({
      ...row,
      monthly_fee: asNumber(row.monthly_fee),
      active_students: asNumber(row.active_students),
      paid_students: asNumber(row.paid_students),
      unpaid_students: asNumber(row.unpaid_students),
      income: asNumber(row.income),
      expected: asNumber(row.expected),
    })),
    ...weeklyAdjusted,
  ].sort((a, b) =>
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
    total_income: asNumber(summary.total_income),
    payment_count: asNumber(summary.payment_count),
    students_paid: asNumber(summary.students_paid),
    best_month: best?.month ?? null,
    best_month_income: asNumber(best?.income),
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
