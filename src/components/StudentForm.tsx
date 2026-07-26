"use client";

import { useRef, useState, useTransition } from "react";
import { createStudent, type ActionResult } from "@/lib/actions";

export function StudentForm({ classId }: { classId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const result: ActionResult = await createStudent(fd);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setError(null);
          formRef.current?.reset();
        });
      }}
    >
      <input type="hidden" name="class_id" value={classId} />
      <div>
        <label
          htmlFor="student-names"
          className="mb-1.5 block text-sm font-medium"
        >
          Student names (one per line)
        </label>
        <textarea
          id="student-names"
          className="field min-h-28 resize-y"
          name="name"
          placeholder={"Amal Perera\nNimal Silva"}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          className="field"
          name="phone"
          placeholder="Phone for all above (optional)"
        />
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Add students"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
