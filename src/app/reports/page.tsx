import Link from "next/link";
import { Suspense } from "react";
import { IncomeChart } from "@/components/IncomeChart";
import { StatCard } from "@/components/StatCard";
import { YearPicker } from "@/components/YearPicker";
import { formatLKR, monthLabel, parseYear, SHORT_MONTHS } from "@/lib/format";
import {
  getAnnualStats,
  getClassAnnualStats,
  getMonthlyIncomeForYear,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const year = parseYear(await searchParams);
  const [annual, months, byClass] = await Promise.all([
    getAnnualStats(year),
    getMonthlyIncomeForYear(year),
    getClassAnnualStats(year),
  ]);

  const averageMonthly =
    months.filter((m) => m.income > 0).length > 0
      ? Math.round(
          annual.total_income / months.filter((m) => m.income > 0).length,
        )
      : 0;

  return (
    <div className="space-y-6">
      <section className="page-hero anim-fade-up">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Annual report</p>
            <h1
              className="mt-1 text-3xl font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-display), serif" }}
            >
              Income for {year}
            </h1>
            <p className="mt-1 text-[var(--muted)]">
              Full-year fee collection across all ICT classes
            </p>
          </div>
          <Suspense fallback={<div className="field w-28 animate-pulse" />}>
            <YearPicker year={year} />
          </Suspense>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="anim-fade-up delay-1">
          <StatCard
            label="Annual income"
            value={formatLKR(annual.total_income)}
            hint={`${annual.payment_count} payments`}
            tone="accent"
          />
        </div>
        <div className="anim-fade-up delay-2">
          <StatCard
            label="Students paid"
            value={String(annual.students_paid)}
            hint="Unique students this year"
            tone="good"
          />
        </div>
        <div className="anim-fade-up delay-3">
          <StatCard
            label="Best month"
            value={
              annual.best_month
                ? SHORT_MONTHS[annual.best_month - 1]
                : "—"
            }
            hint={
              annual.best_month
                ? formatLKR(annual.best_month_income)
                : "No payments yet"
            }
            tone="gold"
          />
        </div>
        <div className="anim-fade-up delay-4">
          <StatCard
            label="Avg / active month"
            value={formatLKR(averageMonthly)}
            hint="Average of months with income"
            tone="coral"
          />
        </div>
      </section>

      <section className="panel overflow-hidden anim-fade-up delay-2">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="font-semibold">Monthly income</h2>
          <p className="text-sm text-[var(--muted)]">
            Collected fees by month in {year}
          </p>
        </div>
        <div className="p-4 sm:p-5">
          {annual.total_income === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              No payments recorded for {year} yet.
            </p>
          ) : (
            <IncomeChart months={months} />
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel overflow-hidden anim-fade-up delay-3">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="font-semibold">Income by class</h2>
          </div>
          {byClass.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[var(--muted)]">
              No classes yet.{" "}
              <Link href="/classes" className="text-[var(--accent)]">
                Add a class
              </Link>
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Payments</th>
                    <th>Students</th>
                    <th>Income</th>
                  </tr>
                </thead>
                <tbody>
                  {byClass.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link
                          href={`/classes/${row.id}`}
                          className="font-medium hover:text-[var(--accent)]"
                        >
                          {row.name}
                        </Link>
                      </td>
                      <td>{row.payment_count}</td>
                      <td>{row.students_paid}</td>
                      <td className="font-medium text-[var(--accent-strong)]">
                        {formatLKR(row.income)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel overflow-hidden anim-fade-up delay-4">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="font-semibold">Month breakdown</h2>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Payments</th>
                  <th>Income</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td>
                      <Link
                        href={`/?year=${year}&month=${m.month}`}
                        className="hover:text-[var(--accent)]"
                      >
                        {monthLabel(year, m.month)}
                      </Link>
                    </td>
                    <td>{m.payment_count}</td>
                    <td>{formatLKR(m.income)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
