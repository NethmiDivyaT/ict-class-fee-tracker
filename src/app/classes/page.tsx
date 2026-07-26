import Link from "next/link";
import { ClassForm } from "@/components/ClassForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { deleteClass } from "@/lib/actions";
import { formatLKR } from "@/lib/format";
import { listClasses } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function ClassesPage() {
  const classes = listClasses();

  return (
    <div className="space-y-6">
      <section>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Classes
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          Add a class with its students, then mark paid with student name and paying date.
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
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Monthly fee</th>
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
                    <td>{formatLKR(c.monthly_fee)}</td>
                    <td>
                      {c.active_count} active
                      {c.student_count !== c.active_count
                        ? ` / ${c.student_count} total`
                        : ""}
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/classes/${c.id}`} className="btn-ghost">
                          Open
                        </Link>
                        <form>
                          <input type="hidden" name="id" value={c.id} />
                          <ConfirmSubmit
                            action={deleteClass}
                            label="Delete"
                            message={`Delete class "${c.name}" and all its students/payments?`}
                            className="btn-ghost text-red-700"
                          />
                        </form>
                      </div>
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
