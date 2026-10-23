import { sqlAll, type PaymentRow } from "./db";

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
  days: string[];
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
  leftover_dates: string[];
  billable_months: number;
  paid_months: number;
  unpaid_months: number;
  slots: FeeSlot[];
};

function periodKey(year: number, month: number, slot: number) {
  return `${year}-${String(month).padStart(2, "0")}-${slot}`;
}

function dateParts(iso: string) {
  const end = new Date(`${iso}T00:00:00`);
  return { year: end.getFullYear(), month: end.getMonth() + 1 };
}

function upcomingWeeks(days: string[]) {
  return Math.max(0, DAYS_PER_FEE_MONTH - days.length);
}

function attachPayment(slot: FeeSlot, payment: PaymentRow) {
  slot.paid = true;
  slot.payment_id = payment.id;
  slot.paid_on = payment.paid_on;
  slot.amount = payment.amount;
}

function takePayment(
  monthlyPayments: PaymentRow[],
  usedPaymentIds: Set<number>,
  slot: Pick<FeeSlot, "year" | "month" | "slot">,
) {
  const unused = () =>
    monthlyPayments.filter((payment) => !usedPaymentIds.has(payment.id));

  const exact = unused().find(
    (payment) =>
      payment.slot === slot.slot &&
      payment.year === slot.year &&
      payment.month === slot.month,
  );
  if (exact) return exact;

  const byMonth = unused().find(
    (payment) => payment.year === slot.year && payment.month === slot.month,
  );
  if (byMonth) return byMonth;

  if (slot.slot > 0) {
    const bySlot = unused().find((payment) => payment.slot === slot.slot);
    if (bySlot) return bySlot;
  }

  return unused()[0] ?? null;
}

function makeSlot(input: {
  slot: number;
  year: number;
  month: number;
  days: string[];
  paid: boolean;
  payment?: PaymentRow;
  source: FeeSlot["source"];
}): FeeSlot {
  return {
    key: periodKey(input.year, input.month, input.slot),
    slot: input.slot,
    year: input.year,
    month: input.month,
    start_on: input.days[0] ?? null,
    end_on: input.days[input.days.length - 1] ?? null,
    days: input.days,
    paid: input.paid,
    payment_id: input.payment?.id ?? null,
    paid_on: input.payment?.paid_on ?? null,
    amount: input.payment?.amount ?? null,
    source: input.source,
  };
}

export function buildFeeSlots(
  days: AttendanceDay[],
  payments: PaymentRow[],
): Omit<StudentBilling, "student_id"> {
  const attended = [...days].sort((a, b) =>
    a.attended_on.localeCompare(b.attended_on),
  );
  const slots: FeeSlot[] = [];
  const monthlyPayments = payments.filter((payment) => payment.week === 0);
  const usedPaymentIds = new Set<number>();

  let index = 0;
  while (index + DAYS_PER_FEE_MONTH <= attended.length) {
    const chunk = attended.slice(index, index + DAYS_PER_FEE_MONTH);
    const dates = chunk.map((day) => day.attended_on);
    const { year, month } = dateParts(dates[DAYS_PER_FEE_MONTH - 1]);
    slots.push(
      makeSlot({
        slot: slots.length + 1,
        year,
        month,
        days: dates,
        paid: false,
        source: "attendance",
      }),
    );
    index += DAYS_PER_FEE_MONTH;
  }

  for (const slot of slots) {
    const payment = takePayment(monthlyPayments, usedPaymentIds, slot);
    if (!payment) continue;
    usedPaymentIds.add(payment.id);
    attachPayment(slot, payment);
  }

  const leftoverDays = attended.slice(index);
  let leftoverDates = leftoverDays.map((day) => day.attended_on);
  const unmatched = monthlyPayments.filter(
    (payment) => !usedPaymentIds.has(payment.id),
  );

  for (const payment of unmatched) {
    usedPaymentIds.add(payment.id);
    const take = leftoverDates.slice(0, DAYS_PER_FEE_MONTH);
    leftoverDates = leftoverDates.slice(take.length);
    slots.push(
      makeSlot({
        slot: payment.slot || 0,
        year: payment.year,
        month: payment.month,
        days: take,
        paid: true,
        payment,
        source: take.length > 0 ? "attendance" : "manual",
      }),
    );
  }

  if (leftoverDates.length > 0) {
    const { year, month } = dateParts(leftoverDates[leftoverDates.length - 1]);
    const slot =
      Math.max(0, ...slots.map((item) => item.slot), slots.length) + 1;
    slots.push(
      makeSlot({
        slot,
        year,
        month,
        days: leftoverDates,
        paid: false,
        source: "attendance",
      }),
    );
    leftoverDates = [];
  }

  slots.sort((a, b) => a.year - b.year || a.month - b.month || a.slot - b.slot);

  const unpaidOpen = slots.find(
    (slot) => !slot.paid && upcomingWeeks(slot.days) > 0,
  );
  const leftover_dates = unpaidOpen?.days ?? [];
  const leftover_days = leftover_dates.length;
  const billable_months = slots.length;
  const paid_months = slots.filter((slot) => slot.paid).length;
  const unpaid_months = slots.filter((slot) => !slot.paid).length;

  return {
    attendance_days: attended.length,
    leftover_days,
    leftover_dates,
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
    `SELECT a.year, a.week, a.attended_on
     FROM attendance a
     JOIN students s ON s.id = a.student_id
     LEFT JOIN class_holidays h
       ON h.class_id = s.class_id
      AND h.year = a.year
      AND h.week = a.week
     WHERE a.student_id = ?
       AND a.attended = 1
       AND h.id IS NULL
     ORDER BY a.attended_on, a.year, a.week`,
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
