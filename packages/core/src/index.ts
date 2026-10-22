export {
  DatabaseConfigError,
  getDatabaseMode,
  sqlAll,
  sqlGet,
  sqlRun,
  type AttendanceRow,
  type BillingPeriod,
  type ClassRow,
  type PaymentRow,
  type StudentRow,
} from "./db";

export {
  getAnnualStats,
  getClass,
  getClassAnnualStats,
  getClassMonthlyStats,
  getMonthlyIncomeForYear,
  getMonthlyStats,
  listClasses,
  listRecentPayments,
  listStudentsByClass,
  listStudentsForPeriod,
  type AnnualStats,
  type ClassAnnualStat,
  type ClassMonthlyStat,
  type ClassWithCounts,
  type MonthIncome,
  type MonthlyStats,
  type StudentWithPayment,
} from "./queries";

export {
  createClass,
  createStudent,
  deleteClass,
  deleteStudent,
  markPaid,
  markUnpaid,
  setAttendance,
  updateClass,
  updateStudent,
  type ActionResult,
} from "./mutations";

export {
  DAYS_PER_FEE_MONTH,
  getStudentBilling,
  type FeeSlot,
  type StudentBilling,
} from "./billing";
