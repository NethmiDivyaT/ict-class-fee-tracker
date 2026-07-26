import Link from "next/link";
import { ClassForm } from "@/components/ClassForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { deleteClass } from "@/lib/actions";
import { formatLKR } from "@/lib/format";
import { listClasses } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const classes = await listClasses();

  return (
    <div className="space-y-6">
      <section className="page-hero anim-fade-up">
        <p className="eyebrow">Classes</p>
        <h1
          className="mt-1 text-3xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Classes & students
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          Choose monthly or weekly billing per class, then mark paid with student
          name and paying date.
        </p>
      </section>

      <section className="panel p-4 sm:p-5">
        <h2 className="mb-1 font-semibold">Add class & students</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Enter class details and student names (one per line).
        </p>
        <ClassForm />
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="font-semibold">All classes</h2>
        </div>
        {classes.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            No classes yet. Add your first ICT class above.
          </p>
        ) : (
          <>
            <div className="mobile-card-list">
              {classes.map((c) => (
                <article key={c.id} className="mobile-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/classes/${c.id}`}
                        className="text-base font-semibold hover:text-[var(--accent)]"
                      >
                        {c.name}
                      </Link>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {formatLKR(c.monthly_fee)}
                        {c.billing_period === "weekly" ? " / week" : " / month"}
                        {" · "}
                        {c.active_count} active
                      </p>
                    </div>
                    <span
                      className={`badge ${
                        c.billing_period === "weekly"
                          ? "badge-unpaid"
                          : "badge-paid"
                      }`}
                    >
                      {c.billing_period === "weekly" ? "Weekly" : "Monthly"}
                    </span>
                  </div>
                  <div className="action-bar mt-3">
                    <Link href={`/classes/${c.id}`} className="btn-ghost">
                      Open
                    </Link>
                    <form>
                      <input type="hidden" name="id" value={c.id} />
                      <ConfirmSubmit
                        action={deleteClass}
                        label="Delete"
                        message={`Delete class "${c.name}" and all its students/payments?`}
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
                    <th>Class</th>
                    <th>Billing</th>
                    <th>Fee</th>
                    <th>Students</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          href={`/classes/${c.id}`}
                          className="font-medium hover:text-[var(--accent)]"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            c.billing_period === "weekly"
                              ? "badge-unpaid"
                              : "badge-paid"
                          }`}
                        >
                          {c.billing_period === "weekly" ? "Weekly" : "Monthly"}
                        </span>
                      </td>
                      <td>
                        {formatLKR(c.monthly_fee)}
                        <span className="text-xs text-[var(--muted)]">
                          {c.billing_period === "weekly" ? " / week" : " / month"}
                        </span>
                      </td>
                      <td>
                        {c.active_count} active
                        {c.student_count !== c.active_count
                          ? ` / ${c.student_count} total`
                          : ""}
                      </td>
                      <td>
                        <div className="action-bar">
                          <Link href={`/classes/${c.id}`} className="btn-ghost">
                            Open
                          </Link>
                          <form>
                            <input type="hidden" name="id" value={c.id} />
                            <ConfirmSubmit
                              action={deleteClass}
                              label="Delete"
                              message={`Delete class "${c.name}" and all its students/payments?`}
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
