import Link from "next/link";
import { Suspense } from "react";
import { MonthPicker } from "@/components/MonthPicker";
import { PaymentToggle } from "@/components/PaymentToggle";
import { formatLKR, monthLabel, parsePeriod } from "@/lib/format";
import { listClasses, listStudentsForMonth } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    status?: string;
    classId?: string;
  }>;
}) {
  const params = await searchParams;
  const { year, month } = parsePeriod(params);
  const status =
    params.status === "paid" || params.status === "unpaid"
      ? params.status
      : "all";
  const classId = params.classId ? Number(params.classId) : undefined;
  const classes = listClasses();
  const students = listStudentsForMonth(year, month, {
    classId: Number.isFinite(classId) ? classId : undefined,
    status,
  });

  const paidCount = students.filter((s) => s.is_paid).length;
  const unpaidCount = students.length - paidCount;
  const income = students.reduce(
    (sum, s) => sum + (s.paid_amount ?? 0),
    0,
  );

  function hrefFor(next: {
    status?: string;
    classId?: string | number | null;
  }) {
    const q = new URLSearchParams();
    q.set("year", String(year));
    q.set("month", String(month));
    q.set("status", next.status ?? status);
    const nextClass =
      next.classId === null
        ? ""
        : next.classId !== undefined
          ? String(next.classId)
          : classId
            ? String(classId)
            : "";
    if (nextClass) q.set("classId", nextClass);
    return `/records?${q.toString()}`;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Payment records
          </h1>
          <p className="mt-1 text-[var(--muted)]">
            {monthLabel(year, month)} · {paidCount} paid · {unpaidCount} unpaid
            · {formatLKR(income)} collected
          </p>
        </div>
        <Suspense fallback={null}>
          <MonthPicker year={year} month={month} />
        </Suspense>
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
              All classes
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
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        {students.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No matching students for this filter.
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
                        href={`/classes/${s.class_id}?year=${year}&month=${month}`}
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
                        isPaid={Boolean(s.is_paid)}
                        defaultAmount={s.monthly_fee}
                        paidOn={s.paid_on}
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
