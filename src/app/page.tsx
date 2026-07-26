import Link from "next/link";
import { Suspense } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { StatCard } from "@/components/StatCard";
import { formatLKR, monthLabel, parsePeriod } from "@/lib/format";
import {
  getClassMonthlyStats,
  getMonthlyStats,
  listRecentPayments,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const { year, month } = parsePeriod(params);
  const [stats, byClass, recent] = await Promise.all([
    getMonthlyStats(year, month),
    getClassMonthlyStats(year, month),
    listRecentPayments(),
  ]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-3xl font-semibold tracking-tight text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Monthly overview
          </h1>
          <p className="mt-1 text-[var(--muted)]">
            Income and payment status for {monthLabel(year, month)}
          </p>
        </div>
        <Suspense fallback={<div className="field w-48 animate-pulse" />}>
          <MonthPicker year={year} month={month} />
        </Suspense>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total income"
          value={formatLKR(stats.total_income)}
          hint={`Expected ${formatLKR(stats.expected_income)}`}
          tone="accent"
        />
        <StatCard
          label="Paid students"
          value={String(stats.paid_students)}
          hint={`of ${stats.active_students} active`}
          tone="good"
        />
        <StatCard
          label="Unpaid students"
          value={String(stats.unpaid_students)}
          hint="Still due this month"
          tone="warn"
        />
        <StatCard
          label="Outstanding"
          value={formatLKR(stats.outstanding)}
          hint="Expected minus collected"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3">
            <h2 className="font-semibold">By class</h2>
            <Link href="/classes" className="text-sm text-[var(--accent)]">
              Manage classes
            </Link>
          </div>
          {byClass.length === 0 ? (
            <EmptyState
              title="No classes yet"
              body="Create a class, add students, then mark monthly fees as paid."
              href="/classes"
              cta="Add a class"
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Paid</th>
                    <th>Unpaid</th>
                    <th>Income</th>
                  </tr>
                </thead>
                <tbody>
                  {byClass.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link
                          href={`/classes/${row.id}?year=${year}&month=${month}`}
                          className="font-medium text-[var(--ink)] hover:text-[var(--accent)]"
                        >
                          {row.name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          Fee {formatLKR(row.monthly_fee)} · {row.active_students}{" "}
                          active
                        </p>
                      </td>
                      <td>{row.paid_students}</td>
                      <td>{row.unpaid_students}</td>
                      <td>{formatLKR(row.income)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] px-4 py-3">
            <h2 className="font-semibold">Recent payments</h2>
          </div>
          {recent.length === 0 ? (
            <p className="px-4 py-8 text-sm text-[var(--muted)]">
              No payments recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {recent.map((p) => (
                <li key={p.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{p.student_name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {p.class_name} · {monthLabel(p.year, p.month)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatLKR(p.amount)}</p>
                      <p className="text-xs text-[var(--muted)]">
                        Paid on {p.paid_on}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Need the unpaid list?</h2>
            <p className="text-sm text-[var(--muted)]">
              Open records to filter paid and unpaid students for this month.
            </p>
          </div>
          <Link
            href={`/records?year=${year}&month=${month}&status=unpaid`}
            className="btn-primary inline-flex justify-center"
          >
            View unpaid
          </Link>
        </div>
      </section>
    </div>
  );
}

function EmptyState({
  title,
  body,
  href,
  cta,
}: {
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--muted)]">{body}</p>
      <Link href={href} className="btn-primary mt-4 inline-flex">
        {cta}
      </Link>
    </div>
  );
}
