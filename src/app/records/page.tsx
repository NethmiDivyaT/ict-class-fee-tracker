import Link from "next/link";
import { Suspense } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { PaymentToggle } from "@/components/PaymentToggle";
import { WeekPicker } from "@/components/WeekPicker";
import {
  formatLKR,
  getISOWeekParts,
  monthLabel,
  parsePeriod,
  parseWeekPeriod,
  weekLabel,
} from "@/lib/format";
import { listClasses, listStudentsForPeriod } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    week?: string;
    status?: string;
    classId?: string;
  }>;
}) {
  const params = await searchParams;
  const status =
    params.status === "paid" || params.status === "unpaid"
      ? params.status
      : "all";
  const classId = params.classId ? Number(params.classId) : undefined;
  const classes = await listClasses();
  const selectedClass = Number.isFinite(classId)
    ? classes.find((c) => c.id === classId)
    : undefined;
  const isWeeklyView = selectedClass?.billing_period === "weekly";

  const monthPeriod = parsePeriod(params);
  const weekPeriod = params.week
    ? parseWeekPeriod(params)
    : getISOWeekParts();

  const year = isWeeklyView ? weekPeriod.year : monthPeriod.year;
  const month = isWeeklyView ? weekPeriod.month : monthPeriod.month;
  const week = isWeeklyView ? weekPeriod.week : 0;

  const students = await listStudentsForPeriod(year, month, week, {
    classId: Number.isFinite(classId) ? classId : undefined,
    status,
    billingPeriod: isWeeklyView ? "weekly" : "monthly",
  });

  const paidCount = students.filter((s) => s.is_paid).length;
  const unpaidCount = students.length - paidCount;
  const income = students.reduce((sum, s) => sum + (s.paid_amount ?? 0), 0);
  const periodText = isWeeklyView
    ? weekLabel(year, week)
    : monthLabel(year, month);

  function hrefFor(next: {
    status?: string;
    classId?: string | number | null;
  }) {
    const q = new URLSearchParams();
    const nextClassId =
      next.classId === null
        ? null
        : next.classId !== undefined
          ? Number(next.classId)
          : classId;
    const nextClass =
      nextClassId != null && Number.isFinite(nextClassId)
        ? classes.find((c) => c.id === nextClassId)
        : undefined;

    if (nextClass?.billing_period === "weekly") {
      const w = week > 0 ? { year, week } : getISOWeekParts();
      q.set("year", String(w.year));
      q.set("week", String(w.week));
      q.set("classId", String(nextClass.id));
    } else {
      q.set("year", String(monthPeriod.year));
      q.set("month", String(monthPeriod.month));
      if (nextClassId != null && Number.isFinite(nextClassId)) {
        q.set("classId", String(nextClassId));
      }
    }

    q.set("status", next.status ?? status);
    return `/records?${q.toString()}`;
  }

  return (
    <div className="space-y-6">
      <section className="page-hero anim-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Records</p>
            <h1
              className="mt-1 text-3xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Payment records
            </h1>
            <p className="mt-1 text-[var(--muted)]">
              {periodText} · {paidCount} paid · {unpaidCount} unpaid ·{" "}
              {formatLKR(income)} collected
              {isWeeklyView ? " · weekly class" : " · monthly classes"}
            </p>
          </div>
          <Suspense fallback={null}>
            {isWeeklyView ? (
              <WeekPicker year={year} week={week} />
            ) : (
              <MonthPicker year={year} month={month} />
            )}
          </Suspense>
        </div>
      </section>

      <section className="panel p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["paid", "Paid"],
                ["unpaid", "Unpaid"],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={hrefFor({ status: value })}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  status === value
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                    : "bg-[var(--surface)] text-[var(--muted)]"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={hrefFor({ classId: null })}
              className={`rounded-md px-3 py-1.5 text-sm ${
                !classId
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              Monthly classes
            </Link>
            {classes.map((c) => (
              <Link
                key={c.id}
                href={hrefFor({ classId: c.id })}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  classId === c.id
                    ? "bg-[var(--ink)] text-white"
                    : "bg-[var(--surface)] text-[var(--muted)]"
                }`}
              >
                {c.name}
                {c.billing_period === "weekly" ? " · W" : ""}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        {students.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No matching students for this filter.
            {!isWeeklyView
              ? " Select a weekly class to view week-by-week payments."
              : ""}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Fee</th>
                  <th>Payment record</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {s.phone || "No phone"}
                      </p>
                    </td>
                    <td>
                      <Link
                        href={
                          s.billing_period === "weekly"
                            ? `/classes/${s.class_id}?year=${year}&week=${week}`
                            : `/classes/${s.class_id}?year=${year}&month=${month}`
                        }
                        className="hover:text-[var(--accent)]"
                      >
                        {s.class_name}
                      </Link>
                    </td>
                    <td>
                      {s.is_paid && s.paid_amount != null
                        ? formatLKR(s.paid_amount)
                        : formatLKR(s.monthly_fee)}
                    </td>
                    <td>
                      {s.is_paid ? (
                        <div>
                          <span className="badge badge-paid">Paid</span>
                          <p className="mt-1.5 text-sm font-medium">
                            {s.paid_student_name || s.name}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            Paid on {s.paid_on}
                          </p>
                        </div>
                      ) : (
                        <span className="badge badge-unpaid">Unpaid</span>
                      )}
                    </td>
                    <td className="text-right">
                      <PaymentToggle
                        studentId={s.id}
                        studentName={s.name}
                        classId={s.class_id}
                        year={year}
                        month={month}
                        week={week}
                        isPaid={Boolean(s.is_paid)}
                        defaultAmount={s.monthly_fee}
                        paidOn={s.paid_on}
                        periodLabel={isWeeklyView ? "this week" : "this month"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
