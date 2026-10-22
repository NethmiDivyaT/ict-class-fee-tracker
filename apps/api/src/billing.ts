import { sqlAll, type PaymentRow } from "./db.ts";

export const DAYS_PER_FEE_MONTH = 4;

export type AttendanceDay = {
  year: number;
  week: number;
  attended_on: string;
};

export type FeeSlot = {
  key: string;
  slot: number;
  year: number;
  month: number;
  start_on: string | null;
  end_on: string | null;
  paid: boolean;
  payment_id: number | null;
  paid_on: string | null;
  amount: number | null;
  source: "attendance" | "manual";
};

export type StudentBilling = {
  student_id: number;
  attendance_days: number;
  leftover_days: number;
  billable_months: number;
  paid_months: number;
  unpaid_months: number;
  slots: FeeSlot[];
};

function periodKey(year: number, month: number, slot: number) {
  return `${year}-${String(month).padStart(2, "0")}-${slot}`;
}

export function buildFeeSlots(
  days: AttendanceDay[],
  payments: PaymentRow[],
): Omit<StudentBilling, "student_id"> {
  const attended = [...days].sort((a, b) =>
    a.attended_on.localeCompare(b.attended_on),
  );
  const slots: FeeSlot[] = [];

  for (let i = 0; i + DAYS_PER_FEE_MONTH <= attended.length; i += DAYS_PER_FEE_MONTH) {
    const chunk = attended.slice(i, i + DAYS_PER_FEE_MONTH);
    const last = chunk[DAYS_PER_FEE_MONTH - 1];
    const end = new Date(`${last.attended_on}T00:00:00`);
    const slot = slots.length + 1;
    const year = end.getFullYear();
    const month = end.getMonth() + 1;
    slots.push({
      key: periodKey(year, month, slot),
      slot,
      year,
      month,
      start_on: chunk[0].attended_on,
      end_on: last.attended_on,
      paid: false,
      payment_id: null,
      paid_on: null,
      amount: null,
      source: "attendance",
    });
  }

  const monthlyPayments = payments.filter((p) => p.week === 0);
  const usedPaymentIds = new Set<number>();

  for (const slot of slots) {
    const exact = monthlyPayments.find(
      (p) =>
        !usedPaymentIds.has(p.id) &&
        p.slot === slot.slot &&
        p.year === slot.year &&
        p.month === slot.month,
    );
    const byMonth =
      exact ??
      monthlyPayments.find(
        (p) =>
          !usedPaymentIds.has(p.id) &&
          p.year === slot.year &&
          p.month === slot.month,
      );
    if (byMonth) {
      usedPaymentIds.add(byMonth.id);
      slot.paid = true;
      slot.payment_id = byMonth.id;
      slot.paid_on = byMonth.paid_on;
      slot.amount = byMonth.amount;
    }
  }

  for (const payment of monthlyPayments) {
    if (usedPaymentIds.has(payment.id)) continue;
    slots.push({
      key: periodKey(payment.year, payment.month, payment.slot || 0),
      slot: payment.slot || 0,
      year: payment.year,
      month: payment.month,
      start_on: null,
      end_on: null,
      paid: true,
      payment_id: payment.id,
      paid_on: payment.paid_on,
      amount: payment.amount,
      source: "manual",
    });
  }

  slots.sort((a, b) => a.year - b.year || a.month - b.month || a.slot - b.slot);

  const billable_months = slots.filter((s) => s.source === "attendance").length;
  const paid_months = slots.filter((s) => s.paid).length;
  const unpaid_months = slots.filter((s) => !s.paid).length;

  return {
    attendance_days: attended.length,
    leftover_days: attended.length % DAYS_PER_FEE_MONTH,
    billable_months,
    paid_months,
    unpaid_months,
    slots,
  };
}

export async function getAttendanceDays(
  studentId: number,
): Promise<AttendanceDay[]> {
  return sqlAll<AttendanceDay>(
    `SELECT year, week, attended_on
     FROM attendance
     WHERE student_id = ? AND attended = 1
     ORDER BY attended_on, year, week`,
    [studentId],
  );
}

export async function getMonthlyPayments(
  studentId: number,
): Promise<PaymentRow[]> {
  return sqlAll<PaymentRow>(
    `SELECT * FROM payments WHERE student_id = ? AND week = 0 ORDER BY year, month, slot, id`,
    [studentId],
  );
}

export async function getStudentBilling(
  studentId: number,
): Promise<StudentBilling> {
  const [days, payments] = await Promise.all([
    getAttendanceDays(studentId),
    getMonthlyPayments(studentId),
  ]);
  return {
    student_id: studentId,
    ...buildFeeSlots(days, payments),
  };
}

export async function getClassWeekAttendance(
  classId: number,
  year: number,
  week: number,
): Promise<Array<{ student_id: number; attended: number; attended_on: string }>> {
  return sqlAll(
    `SELECT a.student_id, a.attended, a.attended_on
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     WHERE s.class_id = ? AND a.year = ? AND a.week = ?`,
    [classId, year, week],
  );
}
