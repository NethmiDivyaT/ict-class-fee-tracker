"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "./db";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/classes");
  revalidatePath("/records");
}

function parseStudentNames(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export type ActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

export async function createClass(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") || "").trim();
  const monthlyFee = Number(formData.get("monthly_fee") || 0);
  const studentNames = parseStudentNames(
    String(formData.get("students") || ""),
  );

  if (!name) return { ok: false, error: "Class name is required." };
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    return { ok: false, error: "Monthly fee must be a valid amount." };
  }

  const db = getDb();

  try {
    const insertClass = db.prepare(
      `INSERT INTO classes (name, monthly_fee) VALUES (?, ?)`,
    );
    const result = insertClass.run(name, Math.round(monthlyFee));
    const classId = Number(result.lastInsertRowid);

    if (studentNames.length > 0) {
      const insertStudent = db.prepare(
        `INSERT INTO students (class_id, name, phone, active) VALUES (?, ?, NULL, 1)`,
      );
      for (const studentName of studentNames) {
        insertStudent.run(classId, studentName);
      }
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

  if (!id || !name) return { ok: false, error: "Invalid class details." };
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    return { ok: false, error: "Monthly fee must be a valid amount." };
  }

  try {
    getDb()
      .prepare(`UPDATE classes SET name = ?, monthly_fee = ? WHERE id = ?`)
      .run(name, Math.round(monthlyFee), id);
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

  getDb().prepare(`DELETE FROM classes WHERE id = ?`).run(id);
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

  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO students (class_id, name, phone, active) VALUES (?, ?, ?, 1)`,
  );

  for (const name of names) {
    insert.run(classId, name, phone);
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

  getDb()
    .prepare(
      `UPDATE students SET name = ?, phone = ?, active = ? WHERE id = ?`,
    )
    .run(name, phone, active, id);

  revalidateAll();
  if (classId) revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function deleteStudent(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const classId = Number(formData.get("class_id"));
  if (!id) return { ok: false, error: "Invalid student." };

  getDb().prepare(`DELETE FROM students WHERE id = ?`).run(id);
  revalidateAll();
  if (classId) revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function markPaid(formData: FormData): Promise<ActionResult> {
  const studentId = Number(formData.get("student_id"));
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const amountRaw = formData.get("amount");
  const note = String(formData.get("note") || "").trim() || null;
  const paidOn =
    String(formData.get("paid_on") || "").trim() ||
    new Date().toLocaleDateString("en-CA");

  if (!studentId || !year || !month) {
    return { ok: false, error: "Missing payment details." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
    return { ok: false, error: "Payment date must be YYYY-MM-DD." };
  }

  const db = getDb();
  const student = db
    .prepare(
      `SELECT s.id, s.name, s.class_id, c.monthly_fee
       FROM students s
       JOIN classes c ON c.id = s.class_id
       WHERE s.id = ?`,
    )
    .get(studentId) as
    | { id: number; name: string; class_id: number; monthly_fee: number }
    | undefined;

  if (!student) return { ok: false, error: "Student not found." };

  const amount =
    amountRaw !== null && String(amountRaw).trim() !== ""
      ? Number(amountRaw)
      : student.monthly_fee;

  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Invalid payment amount." };
  }

  db.prepare(
    `INSERT INTO payments (student_id, student_name, year, month, amount, paid_on, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id, year, month) DO UPDATE SET
       student_name = excluded.student_name,
       amount = excluded.amount,
       paid_on = excluded.paid_on,
       note = excluded.note`,
  ).run(
    studentId,
    student.name,
    year,
    month,
    Math.round(amount),
    paidOn,
    note,
  );

  revalidateAll();
  revalidatePath(`/classes/${student.class_id}`);
  return { ok: true };
}

export async function markUnpaid(formData: FormData): Promise<ActionResult> {
  const studentId = Number(formData.get("student_id"));
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const classId = Number(formData.get("class_id"));

  if (!studentId || !year || !month) {
    return { ok: false, error: "Missing payment details." };
  }

  getDb()
    .prepare(
      `DELETE FROM payments WHERE student_id = ? AND year = ? AND month = ?`,
    )
    .run(studentId, year, month);

  revalidateAll();
  if (classId) revalidatePath(`/classes/${classId}`);
  return { ok: true };
}
