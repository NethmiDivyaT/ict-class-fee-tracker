import { apiGet, apiGetOptional } from "./api";
import type {
  AnnualStats,
  BillingPeriod,
  ClassAnnualStat,
  ClassMonthlyStat,
  ClassRow,
  ClassWithCounts,
  MonthIncome,
  MonthlyStats,
  PaymentRow,
  StudentBilling,
  StudentWithPayment,
} from "./types";

export type {
  AnnualStats,
  BillingPeriod,
  ClassAnnualStat,
  ClassMonthlyStat,
  ClassRow,
  ClassWithCounts,
  MonthIncome,
  MonthlyStats,
  PaymentRow,
  StudentWithPayment,
};

export async function listClasses(): Promise<ClassWithCounts[]> {
  return apiGet<ClassWithCounts[]>("/api/classes");
}

export async function getClass(id: number): Promise<ClassRow | undefined> {
  return apiGetOptional<ClassRow>(`/api/classes/${id}`);
}

export async function listStudentsByClass(
  classId: number,
  year: number,
  month: number,
  week = 0,
): Promise<StudentWithPayment[]> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    week: String(week),
  });
  return apiGet<StudentWithPayment[]>(
    `/api/classes/${classId}/students?${params}`,
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
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    week: String(week),
  });
  if (opts?.classId) params.set("classId", String(opts.classId));
  if (opts?.status) params.set("status", opts.status);
  if (opts?.billingPeriod) params.set("billingPeriod", opts.billingPeriod);
  return apiGet<StudentWithPayment[]>(`/api/records?${params}`);
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
  return apiGet<MonthlyStats>(`/api/stats/monthly?year=${year}&month=${month}`);
}

export async function getClassMonthlyStats(
  year: number,
  month: number,
): Promise<ClassMonthlyStat[]> {
  return apiGet<ClassMonthlyStat[]>(
    `/api/stats/monthly/classes?year=${year}&month=${month}`,
  );
}

export async function listRecentPayments(
  limit = 8,
): Promise<Array<PaymentRow & { student_name: string; class_name: string }>> {
  return apiGet(`/api/payments/recent?limit=${limit}`);
}

export async function getAnnualStats(year: number): Promise<AnnualStats> {
  return apiGet<AnnualStats>(`/api/stats/annual?year=${year}`);
}

export async function getMonthlyIncomeForYear(
  year: number,
): Promise<MonthIncome[]> {
  return apiGet<MonthIncome[]>(`/api/stats/annual/months?year=${year}`);
}

export async function getClassAnnualStats(
  year: number,
): Promise<ClassAnnualStat[]> {
  return apiGet<ClassAnnualStat[]>(`/api/stats/annual/classes?year=${year}`);
}

export async function getStudentBilling(
  studentId: number,
): Promise<StudentBilling> {
  return apiGet<StudentBilling>(`/api/students/${studentId}/billing`);
}
