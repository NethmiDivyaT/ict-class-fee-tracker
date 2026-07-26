"use server";

import { revalidatePath } from "next/cache";
import { sqlGet, sqlRun, type BillingPeriod } from "./db";
import { getISOWeekMonday } from "./format";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/classes");
  revalidatePath("/records");
  revalidatePath("/reports");
}

function parseStudentNames(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function parseBillingPeriod(raw: FormDataEntryValue | null): BillingPeriod {
  return raw === "weekly" ? "weekly" : "monthly";
}

export type ActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

export async function createClass(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const monthlyFee = Number(formData.get("monthly_fee") || 0);
  const billingPeriod = parseBillingPeriod(formData.get("billing_period"));
  const studentNames = parseStudentNames(
    String(formData.get("students") || ""),
  );

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

    revalidateAll();
    revalidatePath(`/classes/${classId}`);
    return { ok: true, id: classId };
  } catch {
    return { ok: false, error: "A class with this name already exists." };
  }
}

export async function updateClass(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const monthlyFee = Number(formData.get("monthly_fee") || 0);
  const billingPeriod = parseBillingPeriod(formData.get("billing_period"));

  if (!id || !name) return { ok: false, error: "Invalid class details." };
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    return { ok: false, error: "Fee must be a valid amount." };
  }

  try {
    await sqlRun(
      `UPDATE classes SET name = ?, monthly_fee = ?, billing_period = ? WHERE id = ?`,
      [name, Math.round(monthlyFee), billingPeriod, id],
    );
    revalidateAll();
    revalidatePath(`/classes/${id}`);
    return { ok: true, id };
  } catch {
    return { ok: false, error: "Could not update class (name may be taken)." };
  }
}

export async function deleteClass(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  if (!id) return { ok: false, error: "Invalid class." };

  await sqlRun(`DELETE FROM classes WHERE id = ?`, [id]);
  revalidateAll();
  return { ok: true };
}

export async function createStudent(formData: FormData): Promise<ActionResult> {
  const classId = Number(formData.get("class_id"));
  const names = parseStudentNames(String(formData.get("name") || ""));
  const phone = String(formData.get("phone") || "").trim() || null;

  if (!classId || names.length === 0) {
    return { ok: false, error: "Student name and class are required." };
  }

  for (const name of names) {
    await sqlRun(
      `INSERT INTO students (class_id, name, phone, active) VALUES (?, ?, ?, 1)`,
      [classId, name, phone],
    );
  }

  revalidateAll();
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function updateStudent(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  const active = formData.get("active") === "1" ? 1 : 0;
  const classId = Number(formData.get("class_id"));

  if (!id || !name) return { ok: false, error: "Invalid student details." };

  await sqlRun(
    `UPDATE students SET name = ?, phone = ?, active = ? WHERE id = ?`,
    [name, phone, active, id],
  );

  revalidateAll();
  if (classId) revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function deleteStudent(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const classId = Number(formData.get("class_id"));
  if (!id) return { ok: false, error: "Invalid student." };

  await sqlRun(`DELETE FROM students WHERE id = ?`, [id]);
  revalidateAll();
  if (classId) revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function markPaid(formData: FormData): Promise<ActionResult> {
  const studentId = Number(formData.get("student_id"));
  const year = Number(formData.get("year"));
  const monthRaw = Number(formData.get("month"));
  const weekRaw = Number(formData.get("week") || 0);
  const amountRaw = formData.get("amount");
  const note = String(formData.get("note") || "").trim() || null;
  const paidOn =
    String(formData.get("paid_on") || "").trim() ||
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

  let month = monthRaw;
  let week = 0;

  if (student.billing_period === "weekly") {
    week = weekRaw;
    if (!Number.isFinite(week) || week < 1 || week > 53) {
      return { ok: false, error: "Valid week is required for weekly classes." };
    }
    const monday = getISOWeekMonday(year, week);
    month = monday.getUTCMonth() + 1;
  } else {
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return { ok: false, error: "Valid month is required." };
    }
    week = 0;
  }

  const amount =
    amountRaw !== null && String(amountRaw).trim() !== ""
      ? Number(amountRaw)
      : student.monthly_fee;

  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Invalid payment amount." };
  }

  await sqlRun(
    `INSERT INTO payments (student_id, student_name, year, month, week, amount, paid_on, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, year, month, week) DO UPDATE SET
       student_name = excluded.student_name,
       amount = excluded.amount,
       paid_on = excluded.paid_on,
       note = excluded.note`,
    [
      studentId,
      student.name,
      year,
      month,
      week,
      Math.round(amount),
      paidOn,
      note,
    ],
  );

  revalidateAll();
  revalidatePath(`/classes/${student.class_id}`);
  return { ok: true };
}

export async function markUnpaid(formData: FormData): Promise<ActionResult> {
  const studentId = Number(formData.get("student_id"));
  const year = Number(formData.get("year"));
  const monthRaw = Number(formData.get("month"));
  const weekRaw = Number(formData.get("week") || 0);
  const classId = Number(formData.get("class_id"));

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

  let month = monthRaw;
  let week = 0;

  if (student.billing_period === "weekly") {
    week = weekRaw;
    if (!Number.isFinite(week) || week < 1 || week > 53) {
      return { ok: false, error: "Valid week is required." };
    }
    const monday = getISOWeekMonday(year, week);
    month = monday.getUTCMonth() + 1;
  } else {
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return { ok: false, error: "Valid month is required." };
    }
  }

  await sqlRun(
    `DELETE FROM payments
     WHERE student_id = ? AND year = ? AND month = ? AND week = ?`,
    [studentId, year, month, week],
  );

  revalidateAll();
  if (classId) revalidatePath(`/classes/${classId}`);
  return { ok: true };
}
