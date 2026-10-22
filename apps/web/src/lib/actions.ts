"use server";

import {
  createClass as createClassRecord,
  createStudent as createStudentRecord,
  deleteClass as deleteClassRecord,
  deleteStudent as deleteStudentRecord,
  getStudentBilling,
  markPaid as markPaidRecord,
  markUnpaid as markUnpaidRecord,
  setAttendance as setAttendanceRecord,
  updateClass as updateClassRecord,
  updateStudent as updateStudentRecord,
  type ActionResult,
  type StudentBilling,
} from "@ict/core";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/classes");
  revalidatePath("/records");
  revalidatePath("/reports");
}

export async function createClass(formData: FormData): Promise<ActionResult> {
  const result = await createClassRecord({
    name: String(formData.get("name") || ""),
    monthly_fee: Number(formData.get("monthly_fee") || 0),
    billing_period: String(formData.get("billing_period") || "monthly"),
    students: String(formData.get("students") || ""),
  });
  if (result.ok) {
    revalidateAll();
    if (result.id) revalidatePath(`/classes/${result.id}`);
  }
  return result;
}

export async function updateClass(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const result = await updateClassRecord({
    id,
    name: String(formData.get("name") || ""),
    monthly_fee: Number(formData.get("monthly_fee") || 0),
    billing_period: String(formData.get("billing_period") || "monthly"),
  });
  if (result.ok) {
    revalidateAll();
    if (id) revalidatePath(`/classes/${id}`);
  }
  return result;
}

export async function deleteClass(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const result = await deleteClassRecord(id);
  if (result.ok) revalidateAll();
  return result;
}

export async function createStudent(formData: FormData): Promise<ActionResult> {
  const classId = Number(formData.get("class_id"));
  const result = await createStudentRecord({
    class_id: classId,
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
  });
  if (result.ok) {
    revalidateAll();
    if (classId) revalidatePath(`/classes/${classId}`);
  }
  return result;
}

export async function updateStudent(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const classId = Number(formData.get("class_id"));
  const result = await updateStudentRecord({
    id,
    name: String(formData.get("name") || ""),
    phone: String(formData.get("phone") || ""),
    active: String(formData.get("active") || "0"),
  });
  if (result.ok) {
    revalidateAll();
    if (classId) revalidatePath(`/classes/${classId}`);
  }
  return result;
}

export async function deleteStudent(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const classId = Number(formData.get("class_id"));
  const result = await deleteStudentRecord(id);
  if (result.ok) {
    revalidateAll();
    if (classId) revalidatePath(`/classes/${classId}`);
  }
  return result;
}

export async function markPaid(formData: FormData): Promise<ActionResult> {
  const periodsRaw = String(formData.get("periods") || "").trim();
  const periods = periodsRaw
    ? (JSON.parse(periodsRaw) as Array<{
        year: number;
        month: number;
        slot?: number;
        week?: number;
      }>)
    : undefined;
  const result = await markPaidRecord({
    student_id: Number(formData.get("student_id")),
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    week: Number(formData.get("week") || 0),
    slot: Number(formData.get("slot") || 0),
    periods,
    amount: formData.get("amount"),
    note: String(formData.get("note") || ""),
    paid_on: String(formData.get("paid_on") || ""),
  });
  if (result.ok) {
    revalidateAll();
    const classId = Number(formData.get("class_id"));
    if (classId) revalidatePath(`/classes/${classId}`);
  }
  return result;
}

export async function markUnpaid(formData: FormData): Promise<ActionResult> {
  const periodsRaw = String(formData.get("periods") || "").trim();
  const periods = periodsRaw
    ? (JSON.parse(periodsRaw) as Array<{
        year: number;
        month: number;
        slot?: number;
        week?: number;
      }>)
    : undefined;
  const result = await markUnpaidRecord({
    student_id: Number(formData.get("student_id")),
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    week: Number(formData.get("week") || 0),
    slot: Number(formData.get("slot") || 0),
    periods,
  });
  if (result.ok) {
    revalidateAll();
    const classId = Number(formData.get("class_id"));
    if (classId) revalidatePath(`/classes/${classId}`);
  }
  return result;
}

export async function loadStudentBilling(
  studentId: number,
): Promise<StudentBilling> {
  return getStudentBilling(studentId);
}

export async function setAttendance(formData: FormData): Promise<ActionResult> {
  const classId = Number(formData.get("class_id"));
  const result = await setAttendanceRecord({
    student_id: Number(formData.get("student_id")),
    year: Number(formData.get("year")),
    week: Number(formData.get("week")),
    attended: formData.get("attended") === "1",
    attended_on: String(formData.get("attended_on") || ""),
  });
  if (result.ok) {
    revalidateAll();
    if (classId) revalidatePath(`/classes/${classId}`);
  }
  return result;
}
