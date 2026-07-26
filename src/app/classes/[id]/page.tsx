import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ClassForm } from "@/components/ClassForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { MonthPicker } from "@/components/MonthPicker";
import { PaymentToggle } from "@/components/PaymentToggle";
import { StudentForm } from "@/components/StudentForm";
import { WeekPicker } from "@/components/WeekPicker";
import { deleteStudent, updateStudent } from "@/lib/actions";
import {
  formatLKR,
  monthLabel,
  parsePeriod,
  parseWeekPeriod,
  weekLabel,
} from "@/lib/format";
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
  const monthPeriod = parsePeriod(sp);
  const weekPeriod = parseWeekPeriod(sp);

  const year = isWeekly ? weekPeriod.year : monthPeriod.year;
  const month = isWeekly ? weekPeriod.month : monthPeriod.month;
  const week = isWeekly ? weekPeriod.week : 0;

  const students = await listStudentsByClass(id, year, month, week);
  const active = students.filter((s) => s.active === 1);
  const paid = active.filter((s) => s.is_paid === 1).length;
  const unpaid = active.length - paid;
  const periodText = isWeekly
    ? weekLabel(year, week)
    : monthLabel(year, month);

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
                <p className="eyebrow">{isWeekly ? "Weekly class" : "Monthly class"}</p>
              </div>
              <h1
                className="mt-1 text-3xl font-semibold tracking-tight"
                style={{ fontFamily: "var(--font-display), serif" }}
              >
                {cls.name}
              </h1>
              <p className="mt-1 text-[var(--muted)]">
                Fee {formatLKR(cls.monthly_fee)}
                {isWeekly ? " / week" : " / month"} · {periodText} · {paid} paid /{" "}
                {unpaid} unpaid
              </p>
            </div>
            <Suspense fallback={null}>
              {isWeekly ? (
                <WeekPicker year={year} week={week} />
              ) : (
                <MonthPicker year={year} month={month} />
              )}
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
          <h2 className="font-semibold">Students</h2>
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{s.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {s.phone || "No phone"}
                      </p>
                    </div>
                    {s.active ? (
                      s.is_paid ? (
                        <span className="badge badge-paid">Paid</span>
                      ) : (
                        <span className="badge badge-unpaid">Unpaid</span>
                      )
                    ) : (
                      <span className="badge badge-inactive">Inactive</span>
                    )}
                  </div>
                  {s.active && s.is_paid ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {s.paid_student_name || s.name} · Paid on {s.paid_on}
                      {s.paid_amount != null
                        ? ` · ${formatLKR(s.paid_amount)}`
                        : ""}
                    </p>
                  ) : null}
                  <div className="action-bar mt-3">
                    {s.active ? (
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
                        periodLabel={isWeekly ? "this week" : "this month"}
                      />
                    ) : null}
                    <form>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="class_id" value={cls.id} />
                      <input type="hidden" name="name" value={s.name} />
                      {s.phone ? (
                        <input type="hidden" name="phone" value={s.phone} />
                      ) : null}
                      <input
                        type="hidden"
                        name="active"
                        value={s.active ? "0" : "1"}
                      />
                      <ConfirmSubmit
                        action={updateStudent}
                        label={s.active ? "Deactivate" : "Activate"}
                        message={
                          s.active
                            ? `Deactivate ${s.name}? They will be excluded from unpaid lists.`
                            : `Activate ${s.name}?`
                        }
                        className="btn-ghost"
                      />
                    </form>
                    <form>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="class_id" value={cls.id} />
                      <ConfirmSubmit
                        action={deleteStudent}
                        label="Delete"
                        message={`Delete ${s.name} and their payment history?`}
                        className="btn-danger"
                      />
                    </form>
                  </div>
                </article>
              ))}
            </div>

            <div className="desktop-table table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Payment record</th>
                    <th>Action</th>
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
                      </td>
                      <td>
                        {s.active ? (
                          s.is_paid ? (
                            <div>
                              <span className="badge badge-paid">Paid</span>
                              <p className="mt-1.5 text-sm font-medium">
                                {s.paid_student_name || s.name}
                              </p>
                              <p className="text-xs text-[var(--muted)]">
                                Paid on {s.paid_on}
                                {s.paid_amount != null
                                  ? ` · ${formatLKR(s.paid_amount)}`
                                  : ""}
                              </p>
                            </div>
                          ) : (
                            <span className="badge badge-unpaid">Unpaid</span>
                          )
                        ) : (
                          <span className="badge badge-inactive">Inactive</span>
                        )}
                      </td>
                      <td>
                        {s.active ? (
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
                            periodLabel={isWeekly ? "this week" : "this month"}
                          />
                        ) : (
                          <span className="text-sm text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td>
                        <div className="action-bar">
                          <form>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="class_id" value={cls.id} />
                            <input type="hidden" name="name" value={s.name} />
                            {s.phone ? (
                              <input type="hidden" name="phone" value={s.phone} />
                            ) : null}
                            <input
                              type="hidden"
                              name="active"
                              value={s.active ? "0" : "1"}
                            />
                            <ConfirmSubmit
                              action={updateStudent}
                              label={s.active ? "Deactivate" : "Activate"}
                              message={
                                s.active
                                  ? `Deactivate ${s.name}? They will be excluded from unpaid lists.`
                                  : `Activate ${s.name}?`
                              }
                              className="btn-ghost"
                            />
                          </form>
                          <form>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="class_id" value={cls.id} />
                            <ConfirmSubmit
                              action={deleteStudent}
                              label="Delete"
                              message={`Delete ${s.name} and their payment history?`}
                              className="btn-danger"
                            />
                          </form>
                        </div>
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
