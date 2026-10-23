"use client";

import { useState, useTransition } from "react";
import { setAttendanceByDate } from "@/lib/actions";

type StudentOption = {
  id: number;
  name: string;
  attended: boolean;
};

export function PresentByDateForm({
  classId,
  defaultDate,
  students,
  disabled,
}: {
  classId: number;
  defaultDate: string;
  students: StudentOption[];
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(defaultDate);
  const [selected, setSelected] = useState<number[]>(() =>
    students.filter((s) => s.attended).map((s) => s.id),
  );
  const [error, setError] = useState("");

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  if (students.length === 0) return null;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        startTransition(async () => {
          const fd = new FormData();
          fd.set("class_id", String(classId));
          fd.set("attended_on", date);
          for (const id of selected) fd.append("student_id", String(id));
          const result = await setAttendanceByDate(fd);
          if (!result.ok) setError(result.error);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <label className="block text-sm">
          <span className="mb-1 block text-[var(--muted)]">Class date</span>
          <input
            type="date"
            name="attended_on"
            className="field"
            value={date}
            disabled={disabled || pending}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <div>
          <p className="mb-1 text-sm text-[var(--muted)]">Present students</p>
          <div className="flex flex-wrap gap-2">
            {students.map((student) => {
              const checked = selected.includes(student.id);
              return (
                <label
                  key={student.id}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                    checked
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "border-[var(--line)] bg-white text-[var(--ink)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="student_id"
                    value={student.id}
                    className="accent-[var(--accent)]"
                    checked={checked}
                    disabled={disabled || pending}
                    onChange={() => toggle(student.id)}
                  />
                  {student.name}
                </label>
              );
            })}
          </div>
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--coral)]">{error}</p> : null}
      <button
        type="submit"
        className="btn-primary"
        disabled={disabled || pending || selected.length === 0}
      >
        {pending ? "Saving…" : "Save present students"}
      </button>
    </form>
  );
}
