import { sqlGet, sqlRun, type BillingPeriod } from "./db.ts";
import { defaultAttendedOn, getISOWeekMonday } from "./format.ts";

export type ActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

function parseStudentNames(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((name) => String(name).trim()).filter(Boolean);
  }
  return String(raw || "")
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function parseBillingPeriod(raw: unknown): BillingPeriod {
  return raw === "weekly" ? "weekly" : "monthly";
}

export async function createClass(input: {
  name?: unknown;
  monthly_fee?: unknown;
  billing_period?: unknown;
  students?: unknown;
}): Promise<ActionResult> {
  const name = String(input.name || "").trim();
  const monthlyFee = Number(input.monthly_fee || 0);
  const billingPeriod = parseBillingPeriod(input.billing_period);
  const studentNames = parseStudentNames(input.students);

  if (!name) return { ok: false, error: "Class name is required." };
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    return { ok: false, error: "Fee must be a valid amount." };
  }

  try {
    const result = await sqlRun(
      `INSERT INTO classes (name, monthly_fee, billing_period) VALUES (?, ?, ?)`,
      [name, Math.round(monthlyFee), billingPeriod],
    );
    const classId = result.lastInsertRowid;

    for (const studentName of studentNames) {
      await sqlRun(
        `INSERT INTO students (class_id, name, phone, active) VALUES (?, ?, NULL, 1)`,
        [classId, studentName],
      );
    }

    return { ok: true, id: classId };
  } catch {
    return { ok: false, error: "A class with this name already exists." };
  }
}

export async function updateClass(input: {
  id?: unknown;
  name?: unknown;
  monthly_fee?: unknown;
  billing_period?: unknown;
}): Promise<ActionResult> {
  const id = Number(input.id);
  const name = String(input.name || "").trim();
  const monthlyFee = Number(input.monthly_fee || 0);
  const billingPeriod = parseBillingPeriod(input.billing_period);

  if (!id || !name) return { ok: false, error: "Invalid class details." };
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    return { ok: false, error: "Fee must be a valid amount." };
  }

  try {
    await sqlRun(
      `UPDATE classes SET name = ?, monthly_fee = ?, billing_period = ? WHERE id = ?`,
      [name, Math.round(monthlyFee), billingPeriod, id],
    );
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not update class (name may be taken)." };
  }
}

export async function deleteClass(idRaw: unknown): Promise<ActionResult> {
  const id = Number(idRaw);
  if (!id) return { ok: false, error: "Invalid class." };

  await sqlRun(`DELETE FROM classes WHERE id = ?`, [id]);
  return { ok: true };
}

export async function createStudent(input: {
  class_id?: unknown;
  name?: unknown;
  phone?: unknown;
}): Promise<ActionResult> {
  const classId = Number(input.class_id);
  const names = parseStudentNames(input.name);
  const phone = String(input.phone || "").trim() || null;

  if (!classId || names.length === 0) {
    return { ok: false, error: "Student name and class are required." };
  }

  for (const name of names) {
    await sqlRun(
      `INSERT INTO students (class_id, name, phone, active) VALUES (?, ?, ?, 1)`,
      [classId, name, phone],
    );
  }

  return { ok: true };
}

export async function updateStudent(input: {
  id?: unknown;
  name?: unknown;
  phone?: unknown;
  active?: unknown;
}): Promise<ActionResult> {
  const id = Number(input.id);
  const name = String(input.name || "").trim();
  const phone = String(input.phone || "").trim() || null;
  const active = input.active === "1" || input.active === 1 || input.active === true ? 1 : 0;

  if (!id || !name) return { ok: false, error: "Invalid student details." };

  await sqlRun(
    `UPDATE students SET name = ?, phone = ?, active = ? WHERE id = ?`,
    [name, phone, active, id],
  );

  return { ok: true };
}

export async function deleteStudent(idRaw: unknown): Promise<ActionResult> {
  const id = Number(idRaw);
  if (!id) return { ok: false, error: "Invalid student." };

  await sqlRun(`DELETE FROM students WHERE id = ?`, [id]);
  return { ok: true };
}

export async function setAttendance(input: {
  student_id?: unknown;
  year?: unknown;
  week?: unknown;
  attended?: unknown;
  attended_on?: unknown;
}): Promise<ActionResult> {
  const studentId = Number(input.student_id);
  const year = Number(input.year);
  const week = Number(input.week);
  const attended =
    input.attended === false ||
    input.attended === 0 ||
    input.attended === "0"
      ? 0
      : 1;

  if (!studentId || !year || !Number.isFinite(week) || week < 1 || week > 53) {
    return { ok: false, error: "Student, year, and week are required." };
  }

  const student = await sqlGet<{ id: number }>(
    `SELECT id FROM students WHERE id = ?`,
    [studentId],
  );
  if (!student) return { ok: false, error: "Student not found." };

  if (!attended) {
    await sqlRun(
      `DELETE FROM attendance WHERE student_id = ? AND year = ? AND week = ?`,
      [studentId, year, week],
    );
    return { ok: true };
  }

  const attendedOn =
    String(input.attended_on || "").trim() || defaultAttendedOn(year, week);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendedOn)) {
    return { ok: false, error: "Attendance date must be YYYY-MM-DD." };
  }

  await sqlRun(
    `INSERT INTO attendance (student_id, year, week, attended, attended_on)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(student_id, year, week) DO UPDATE SET
       attended = 1,
       attended_on = excluded.attended_on`,
    [studentId, year, week, attendedOn],
  );
  return { ok: true };
}

type PaymentPeriod = { year: number; month: number; slot: number; week: number };

function parsePeriods(input: {
  year?: unknown;
  month?: unknown;
  week?: unknown;
  slot?: unknown;
  periods?: unknown;
}): PaymentPeriod[] {
  if (Array.isArray(input.periods)) {
    return input.periods
      .map((raw) => {
        const row = raw as Record<string, unknown>;
        return {
          year: Number(row.year),
          month: Number(row.month),
          slot: Number(row.slot || 0),
          week: Number(row.week || 0),
        };
      })
      .filter(
        (row) =>
          Number.isFinite(row.year) &&
          row.year >= 2000 &&
          Number.isFinite(row.month) &&
          row.month >= 1 &&
          row.month <= 12,
      );
  }

  const year = Number(input.year);
  const month = Number(input.month);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];
  return [
    {
      year,
      month,
      slot: Number(input.slot || 0),
      week: Number(input.week || 0),
    },
  ];
}

export async function markPaid(input: {
  student_id?: unknown;
  year?: unknown;
  month?: unknown;
  week?: unknown;
  slot?: unknown;
  periods?: unknown;
  amount?: unknown;
  note?: unknown;
  paid_on?: unknown;
}): Promise<ActionResult> {
  const studentId = Number(input.student_id);
  const year = Number(input.year);
  const monthRaw = Number(input.month);
  const weekRaw = Number(input.week || 0);
  const amountRaw = input.amount;
  const note = String(input.note || "").trim() || null;
  const paidOn =
    String(input.paid_on || "").trim() ||
    new Date().toLocaleDateString("en-CA");

  if (!studentId || !year) {
    return { ok: false, error: "Missing payment details." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
    return { ok: false, error: "Payment date must be YYYY-MM-DD." };
  }

  const student = await sqlGet<{
    id: number;
    name: string;
    class_id: number;
    monthly_fee: number;
    billing_period: BillingPeriod;
  }>(
    `SELECT s.id, s.name, s.class_id, c.monthly_fee, c.billing_period
     FROM students s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = ?`,
    [studentId],
  );

  if (!student) return { ok: false, error: "Student not found." };

  let periods = parsePeriods({
    year,
    month: monthRaw,
    week: weekRaw,
    slot: input.slot,
    periods: input.periods,
  });

  if (student.billing_period === "weekly") {
    const week = weekRaw;
    if (!Number.isFinite(week) || week < 1 || week > 53) {
      return { ok: false, error: "Valid week is required for weekly classes." };
    }
    const monday = getISOWeekMonday(year, week);
    periods = [
      {
        year,
        month: monday.getUTCMonth() + 1,
        week,
        slot: 0,
      },
    ];
  } else {
    periods = periods.map((period) => ({ ...period, week: 0 }));
    if (periods.length === 0) {
      return { ok: false, error: "Select at least one month to pay." };
    }
  }

  const amount =
    amountRaw !== null &&
    amountRaw !== undefined &&
    String(amountRaw).trim() !== ""
      ? Number(amountRaw)
      : student.monthly_fee * (student.billing_period === "weekly" ? 1 : periods.length);

  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Invalid payment amount." };
  }

  const perPeriod =
    student.billing_period === "weekly"
      ? Math.round(amount)
      : Math.round(amount / periods.length);

  for (const period of periods) {
    await sqlRun(
      `INSERT INTO payments (student_id, student_name, year, month, week, slot, amount, paid_on, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(student_id, year, month, week, slot) DO UPDATE SET
         student_name = excluded.student_name,
         amount = excluded.amount,
         paid_on = excluded.paid_on,
         note = excluded.note`,
      [
        studentId,
        student.name,
        period.year,
        period.month,
        period.week,
        period.slot,
        perPeriod,
        paidOn,
        note,
      ],
    );
  }

  return { ok: true };
}

export async function markUnpaid(input: {
  student_id?: unknown;
  year?: unknown;
  month?: unknown;
  week?: unknown;
  slot?: unknown;
  periods?: unknown;
}): Promise<ActionResult> {
  const studentId = Number(input.student_id);
  const year = Number(input.year);
  const monthRaw = Number(input.month);
  const weekRaw = Number(input.week || 0);

  if (!studentId || !year) {
    return { ok: false, error: "Missing payment details." };
  }

  const student = await sqlGet<{ billing_period: BillingPeriod }>(
    `SELECT c.billing_period
     FROM students s
     JOIN classes c ON c.id = s.class_id
     WHERE s.id = ?`,
    [studentId],
  );

  if (!student) return { ok: false, error: "Student not found." };

  let periods = parsePeriods({
    year,
    month: monthRaw,
    week: weekRaw,
    slot: input.slot,
    periods: input.periods,
  });

  if (student.billing_period === "weekly") {
    const week = weekRaw;
    if (!Number.isFinite(week) || week < 1 || week > 53) {
      return { ok: false, error: "Valid week is required." };
    }
    const monday = getISOWeekMonday(year, week);
    periods = [
      {
        year,
        month: monday.getUTCMonth() + 1,
        week,
        slot: 0,
      },
    ];
  } else {
    periods = periods.map((period) => ({ ...period, week: 0 }));
    if (periods.length === 0) {
      return { ok: false, error: "Select at least one month to remove." };
    }
  }

  for (const period of periods) {
    await sqlRun(
      `DELETE FROM payments
       WHERE student_id = ? AND year = ? AND month = ? AND week = ? AND slot = ?`,
      [studentId, period.year, period.month, period.week, period.slot],
    );
  }

  return { ok: true };
}
