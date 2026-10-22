import { listStudentsForPeriod } from "@ict/core";
import type { StudentWithPayment } from "@ict/core";

export {
  getAnnualStats,
  getClass,
  getClassAnnualStats,
  getClassMonthlyStats,
  getMonthlyIncomeForYear,
  getMonthlyStats,
  getStudentBilling,
  listClasses,
  listRecentPayments,
  listStudentsByClass,
  listStudentsForPeriod,
  type AnnualStats,
  type BillingPeriod,
  type ClassAnnualStat,
  type ClassMonthlyStat,
  type ClassRow,
  type ClassWithCounts,
  type MonthIncome,
  type MonthlyStats,
  type PaymentRow,
  type StudentWithPayment,
} from "@ict/core";

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
