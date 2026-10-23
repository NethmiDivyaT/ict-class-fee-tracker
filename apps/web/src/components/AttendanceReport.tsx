import Link from "next/link";
import type { StudentAttendanceStat } from "@/lib/queries";
import { weekCountLabel } from "@/lib/format";

type ViewMode = "class" | "student";

function chipClass(active: boolean, tone: "accent" | "ink" = "accent") {
  if (active && tone === "ink") {
    return "rounded-md px-3 py-1.5 text-sm bg-[var(--ink)] text-white";
  }
  if (active) {
    return "rounded-md px-3 py-1.5 text-sm bg-[var(--accent-soft)] font-medium text-[var(--accent)]";
  }
  return "rounded-md px-3 py-1.5 text-sm bg-[var(--surface)] text-[var(--muted)]";
}

function reportsHref(
  year: number,
  view: ViewMode,
  classId?: number,
) {
  const q = new URLSearchParams();
  q.set("year", String(year));
  q.set("view", view);
  if (classId) q.set("classId", String(classId));
  return `/reports?${q.toString()}`;
}

function groupByClass(rows: StudentAttendanceStat[]) {
  const groups = new Map<
    number,
    {
      class_id: number;
      class_name: string;
      billing_period: StudentAttendanceStat["billing_period"];
      students: StudentAttendanceStat[];
    }
  >();

  for (const row of rows) {
    const current = groups.get(row.class_id);
    if (current) {
      current.students.push(row);
      continue;
    }
    groups.set(row.class_id, {
      class_id: row.class_id,
      class_name: row.class_name,
      billing_period: row.billing_period,
      students: [row],
    });
  }

  return [...groups.values()];
}

function classTotals(rows: StudentAttendanceStat[]) {
  return {
    students: rows.length,
    present_weeks: rows.reduce((sum, row) => sum + row.present_weeks, 0),
    holiday_weeks: rows[0]?.holiday_weeks ?? 0,
    billable_months: rows.reduce((sum, row) => sum + row.billable_months, 0),
    paid_months: rows.reduce((sum, row) => sum + row.paid_months, 0),
    unpaid_months: rows.reduce((sum, row) => sum + row.unpaid_months, 0),
    leftover_days: rows.reduce((sum, row) => sum + row.leftover_days, 0),
    monthly: rows.some((row) => row.billing_period === "monthly"),
  };
}

function FeeMonthCell({
  monthly,
  paid,
  billable,
}: {
  monthly: boolean;
  paid: number;
  billable: number;
}) {
  if (!monthly) return "—";
  return `${paid}/${billable}`;
}

function UnpaidCell({ monthly, unpaid }: { monthly: boolean; unpaid: number }) {
  if (!monthly) return "—";
  return unpaid > 0 ? (
    <span className="badge badge-unpaid">{unpaid}</span>
  ) : (
    <span className="badge badge-paid">0</span>
  );
}

export function AttendanceReport({
  year,
  view,
  classId,
  attendance,
}: {
  year: number;
  view: ViewMode;
  classId?: number;
  attendance: StudentAttendanceStat[];
}) {
  const classes = groupByClass(attendance);
  const selected = classId
    ? attendance.filter((row) => row.class_id === classId)
    : attendance;
  const selectedGroups = groupByClass(selected);
  const totals = classTotals(selected);
  const selectedClass = classes.find((item) => item.class_id === classId);

  return (
    <section className="panel overflow-hidden anim-fade-up anim-delay-2">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <h2 className="font-semibold">Attendance report</h2>
        <p className="text-sm text-[var(--muted)]">
          Present weeks in {year}, class-wise or student-wise. Holiday weeks
          and absences are not counted toward fee months.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            View
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={reportsHref(year, "class", classId)}
              className={chipClass(view === "class")}
            >
              By class
            </Link>
            <Link
              href={reportsHref(year, "student", classId)}
              className={chipClass(view === "student")}
            >
              By student
            </Link>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Class
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={reportsHref(year, view)}
              className={chipClass(!classId, "ink")}
            >
              All classes
            </Link>
            {classes.map((item) => (
              <Link
                key={item.class_id}
                href={reportsHref(year, view, item.class_id)}
                className={chipClass(classId === item.class_id, "ink")}
              >
                {item.class_name}
                {item.billing_period === "weekly" ? " · W" : ""}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-b border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">
        {selectedClass ? selectedClass.class_name : "All classes"}
        {" · "}
        {totals.students} student{totals.students === 1 ? "" : "s"}
        {" · "}
        {weekCountLabel(totals.present_weeks)} present
        {totals.monthly
          ? ` · ${totals.unpaid_months} unpaid fee month${
              totals.unpaid_months === 1 ? "" : "s"
            }`
          : ""}
      </div>

      {selected.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[var(--muted)]">
          No students match this attendance filter.
        </p>
      ) : view === "class" ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Class</th>
                <th>Students</th>
                <th>Present weeks</th>
                <th>Holidays</th>
                <th>Fee months</th>
                <th>Unpaid</th>
                <th>Open month</th>
              </tr>
            </thead>
            <tbody>
              {selectedGroups.map((group) => {
                const row = classTotals(group.students);
                return (
                  <tr key={group.class_id}>
                    <td>
                      <Link
                        href={reportsHref(year, "student", group.class_id)}
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {group.class_name}
                      </Link>
                      <p className="text-xs text-[var(--muted)]">
                        {group.billing_period === "weekly"
                          ? "Weekly class"
                          : "Monthly class"}
                      </p>
                    </td>
                    <td>{row.students}</td>
                    <td>{weekCountLabel(row.present_weeks)}</td>
                    <td>{row.holiday_weeks}</td>
                    <td>
                      <FeeMonthCell
                        monthly={row.monthly}
                        paid={row.paid_months}
                        billable={row.billable_months}
                      />
                    </td>
                    <td>
                      <UnpaidCell monthly={row.monthly} unpaid={row.unpaid_months} />
                    </td>
                    <td>
                      {row.monthly && row.leftover_days > 0
                        ? weekCountLabel(row.leftover_days)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Student</th>
                {!classId ? <th>Class</th> : null}
                <th>Present weeks</th>
                <th>Class holidays</th>
                <th>Fee months</th>
                <th>Unpaid</th>
                <th>Open month</th>
              </tr>
            </thead>
            <tbody>
              {selectedGroups.flatMap((group) => {
                const heading =
                  !classId && selectedGroups.length > 1 ? (
                    <tr key={`class-${group.class_id}`}>
                      <td
                        colSpan={classId ? 6 : 7}
                        className="bg-[var(--surface)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
                      >
                        {group.class_name}
                        {group.billing_period === "weekly" ? " · Weekly" : ""}
                      </td>
                    </tr>
                  ) : null;

                const students = group.students.map((row) => (
                  <tr key={row.student_id}>
                    <td>
                      <Link
                        href={`/classes/${row.class_id}?year=${year}`}
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        {row.student_name}
                      </Link>
                    </td>
                    {!classId ? (
                      <td className="text-sm text-[var(--muted)]">
                        {row.class_name}
                        {row.billing_period === "weekly" ? " · W" : ""}
                      </td>
                    ) : null}
                    <td>{weekCountLabel(row.present_weeks)}</td>
                    <td>{row.holiday_weeks}</td>
                    <td>
                      <FeeMonthCell
                        monthly={row.billing_period === "monthly"}
                        paid={row.paid_months}
                        billable={row.billable_months}
                      />
                    </td>
                    <td>
                      <UnpaidCell
                        monthly={row.billing_period === "monthly"}
                        unpaid={row.unpaid_months}
                      />
                    </td>
                    <td>
                      {row.billing_period === "monthly" && row.leftover_days > 0
                        ? weekCountLabel(row.leftover_days)
                        : "—"}
                    </td>
                  </tr>
                ));

                return heading ? [heading, ...students] : students;
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
