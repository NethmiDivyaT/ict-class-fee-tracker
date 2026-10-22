export type BillingPeriod = "monthly" | "weekly";

export type ActionResult =
  | { ok: true; id?: number }
  | { ok: false; error: string };

export type ClassRow = {
  id: number;
  name: string;
  monthly_fee: number;
  billing_period: BillingPeriod;
  created_at: string;
};

export type StudentRow = {
  id: number;
  class_id: number;
  name: string;
  phone: string | null;
  active: number;
  created_at: string;
};

export type PaymentRow = {
  id: number;
  student_id: number;
  student_name: string;
  year: number;
  month: number;
  week: number;
  slot: number;
  amount: number;
  paid_on: string;
  note: string | null;
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
  attended?: number;
  attendance_days?: number;
  leftover_days?: number;
  billable_months?: number;
  unpaid_months?: number;
  unpaid_slots?: FeeSlot[];
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
