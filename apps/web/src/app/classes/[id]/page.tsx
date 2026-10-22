import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { ClassForm } from "@/components/ClassForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { PaymentToggle } from "@/components/PaymentToggle";
import { StudentForm } from "@/components/StudentForm";
import { WeekPicker } from "@/components/WeekPicker";
import { deleteStudent, updateStudent } from "@/lib/actions";
import { formatLKR, monthLabel, parseWeekPeriod, weekLabel } from "@/lib/format";
import { getClass, listStudentsByClass } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string; week?: string }>;
}) {
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) notFound();

  const cls = await getClass(id);
  if (!cls) notFound();

  const sp = await searchParams;
  const isWeekly = cls.billing_period === "weekly";
  const weekPeriod = parseWeekPeriod(sp);
  const year = weekPeriod.year;
  const month = weekPeriod.month;
  const week = weekPeriod.week;

  const students = await listStudentsByClass(id, year, month, week);
  const active = students.filter((s) => s.active === 1);
  const present = active.filter((s) => s.attended === 1).length;
  const paid = isWeekly
    ? active.filter((s) => s.is_paid === 1).length
    : active.filter((s) => (s.unpaid_months ?? 0) === 0).length;
  const unpaid = active.length - paid;
  const periodText = weekLabel(year, week);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-3">
        <Link href="/classes" className="text-sm text-[var(--accent)]">
          ← All classes
        </Link>
        <div className="page-hero anim-fade-up">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="eyebrow">
                  {isWeekly ? "Weekly class" : "Monthly class · 4 days = 1 month"}
                </p>
              </div>
              <h1
                className="mt-1 text-3xl font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                {cls.name}
              </h1>
              <p className="mt-1 text-[var(--muted)]">
                Fee {formatLKR(cls.monthly_fee)}
                {isWeekly ? " / week" : " / month"} · {periodText} · {present}{" "}
                present · {paid} paid / {unpaid} unpaid
              </p>
            </div>
            <Suspense fallback={null}>
              <WeekPicker year={year} week={week} />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-3 font-semibold">Edit class</h2>
        <ClassForm
          mode="edit"
          initial={{
            id: cls.id,
            name: cls.name,
            monthly_fee: cls.monthly_fee,
            billing_period: cls.billing_period,
          }}
        />
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-1 font-semibold">Add students</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Add one or more student names to this class.
        </p>
        <StudentForm classId={cls.id} />
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="font-semibold">Attendance & payments</h2>
          <p className="text-sm text-[var(--muted)]">
            Mark who was present this week. Late payments auto-fill unpaid months
            from every 4 present days.
          </p>
        </div>
        {students.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            No students in this class yet.
          </p>
        ) : (
          <>
            <div className="mobile-card-list">
              {students.map((s) => (
                <article
                  key={s.id}
                  className={`mobile-card ${s.active ? "" : "opacity-60"}`}
                >
                  <StudentSummary student={s} isWeekly={isWeekly} />
                  {s.active ? (
                    <div className="action-bar mt-3">
                      <AttendanceToggle
                        studentId={s.id}
                        studentName={s.name}
                        classId={cls.id}
                        year={year}
                        week={week}
                        attended={Boolean(s.attended)}
                      />
                      <PaymentToggle
                        studentId={s.id}
                        studentName={s.name}
                        classId={cls.id}
                        year={year}
                        month={month}
                        week={week}
                        isPaid={Boolean(s.is_paid)}
                        defaultAmount={cls.monthly_fee}
                        paidOn={s.paid_on}
                        periodLabel={isWeekly ? "this week" : "unpaid months"}
                        mode={isWeekly ? "weekly" : "monthly"}
                        unpaidSlots={s.unpaid_slots ?? []}
                      />
                    </div>
                  ) : null}
                  <StudentAdmin student={s} classId={cls.id} />
                </article>
              ))}
            </div>

            <div className="desktop-table table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>This week</th>
                    <th>Payment</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className={s.active ? "" : "opacity-60"}>
                      <td>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {s.phone || "No phone"}
                        </p>
                        {!isWeekly && s.active ? (
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {s.attendance_days ?? 0} present days
                            {(s.unpaid_months ?? 0) > 0
                              ? ` · ${s.unpaid_months} unpaid month${
                                  s.unpaid_months === 1 ? "" : "s"
                                }`
                              : ""}
                            {(s.leftover_days ?? 0) > 0
                              ? ` · ${s.leftover_days} toward next month`
                              : ""}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        {s.active ? (
                          <AttendanceToggle
                            studentId={s.id}
                            studentName={s.name}
                            classId={cls.id}
                            year={year}
                            week={week}
                            attended={Boolean(s.attended)}
                          />
                        ) : (
                          <span className="badge badge-inactive">Inactive</span>
                        )}
                      </td>
                      <td>
                        {s.active ? (
                          <div className="space-y-2">
                            <PaymentStatus student={s} isWeekly={isWeekly} />
                            <PaymentToggle
                              studentId={s.id}
                              studentName={s.name}
                              classId={cls.id}
                              year={year}
                              month={month}
                              week={week}
                              isPaid={Boolean(s.is_paid)}
                              defaultAmount={cls.monthly_fee}
                              paidOn={s.paid_on}
                              periodLabel={isWeekly ? "this week" : "unpaid months"}
                              mode={isWeekly ? "weekly" : "monthly"}
                              unpaidSlots={s.unpaid_slots ?? []}
                            />
                          </div>
                        ) : (
                          <span className="text-sm text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td>
                        <StudentAdmin student={s} classId={cls.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function PaymentStatus({
  student,
  isWeekly,
}: {
  student: {
    is_paid: number;
    paid_student_name: string | null;
    name: string;
    paid_on: string | null;
    paid_amount: number | null;
    unpaid_months?: number;
    unpaid_slots?: Array<{ year: number; month: number }>;
    active: number;
  };
  isWeekly: boolean;
}) {
  if (!student.active) {
    return <span className="badge badge-inactive">Inactive</span>;
  }
  if (isWeekly) {
    if (student.is_paid) {
      return (
        <div>
          <span className="badge badge-paid">Paid</span>
          <p className="mt-1.5 text-sm font-medium">
            {student.paid_student_name || student.name}
          </p>
          <p className="text-xs text-[var(--muted)]">
            Paid on {student.paid_on}
            {student.paid_amount != null ? ` · ${formatLKR(student.paid_amount)}` : ""}
          </p>
        </div>
      );
    }
    return <span className="badge badge-unpaid">Unpaid</span>;
  }

  const unpaid = student.unpaid_months ?? 0;
  if (unpaid === 0) {
    return <span className="badge badge-paid">Up to date</span>;
  }
  const labels = (student.unpaid_slots ?? [])
    .slice(0, 3)
    .map((slot) => monthLabel(slot.year, slot.month))
    .join(", ");
  return (
    <div>
      <span className="badge badge-unpaid">
        {unpaid} unpaid month{unpaid === 1 ? "" : "s"}
      </span>
      {labels ? (
        <p className="mt-1.5 text-xs text-[var(--muted)]">{labels}</p>
      ) : null}
    </div>
  );
}

function StudentSummary({
  student,
  isWeekly,
}: {
  student: {
    id: number;
    name: string;
    phone: string | null;
    active: number;
    attended?: number;
    attendance_days?: number;
    leftover_days?: number;
    unpaid_months?: number;
    unpaid_slots?: Array<{ year: number; month: number }>;
    is_paid: number;
    paid_on: string | null;
    paid_student_name: string | null;
    paid_amount: number | null;
  };
  isWeekly: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-semibold">{student.name}</p>
        <p className="text-xs text-[var(--muted)]">{student.phone || "No phone"}</p>
        {!isWeekly && student.active ? (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {student.attendance_days ?? 0} present days
            {(student.leftover_days ?? 0) > 0
              ? ` · ${student.leftover_days} toward next month`
              : ""}
          </p>
        ) : null}
        {student.active ? (
          <div className="mt-2">
            <PaymentStatus student={student} isWeekly={isWeekly} />
          </div>
        ) : null}
      </div>
      {student.active ? (
        student.attended ? (
          <span className="badge badge-weekly">Present</span>
        ) : (
          <span className="badge badge-inactive">Absent</span>
        )
      ) : (
        <span className="badge badge-inactive">Inactive</span>
      )}
    </div>
  );
}

function StudentAdmin({
  student,
  classId,
}: {
  student: {
    id: number;
    name: string;
    phone: string | null;
    active: number;
  };
  classId: number;
}) {
  return (
    <div className="action-bar mt-3">
      <form>
        <input type="hidden" name="id" value={student.id} />
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="name" value={student.name} />
        {student.phone ? (
          <input type="hidden" name="phone" value={student.phone} />
        ) : null}
        <input type="hidden" name="active" value={student.active ? "0" : "1"} />
        <ConfirmSubmit
          action={updateStudent}
          label={student.active ? "Deactivate" : "Activate"}
          message={
            student.active
              ? `Deactivate ${student.name}? They will be excluded from unpaid lists.`
              : `Activate ${student.name}?`
          }
          className="btn-ghost"
        />
      </form>
      <form>
        <input type="hidden" name="id" value={student.id} />
        <input type="hidden" name="class_id" value={classId} />
        <ConfirmSubmit
          action={deleteStudent}
          label="Delete"
          message={`Delete ${student.name} and their payment history?`}
          className="btn-danger"
        />
      </form>
    </div>
  );
}
