"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createClass, updateClass, type ActionResult } from "@/lib/actions";

export function ClassForm({
  mode = "create",
  initial,
}: {
  mode?: "create" | "edit";
  initial?: { id: number; name: string; monthly_fee: number };
}) {
  const router = useRouter();
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
          const result: ActionResult =
            mode === "edit" ? await updateClass(fd) : await createClass(fd);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setError(null);
          if (mode === "create") {
            formRef.current?.reset();
            if (result.id) {
              router.push(`/classes/${result.id}`);
              return;
            }
          }
          router.refresh();
        });
      }}
    >
      {mode === "edit" && initial ? (
        <input type="hidden" name="id" value={initial.id} />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <input
          className="field"
          name="name"
          placeholder="Class name (e.g. Grade 10 ICT)"
          defaultValue={initial?.name}
          required
        />
        <input
          className="field"
          name="monthly_fee"
          type="number"
          min={0}
          step={1}
          placeholder="Fee LKR"
          defaultValue={initial?.monthly_fee ?? ""}
          required
        />
      </div>

      {mode === "create" ? (
        <div>
          <label
            htmlFor="students"
            className="mb-1.5 block text-sm font-medium text-[var(--ink)]"
          >
            Students (one name per line)
          </label>
          <textarea
            id="students"
            name="students"
            className="field min-h-32 resize-y"
            placeholder={"Amal Perera\nNimal Silva\nKamal Fernando"}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">
            You can add more students later from the class page.
          </p>
        </div>
      ) : null}

      <div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "edit"
              ? "Update class"
              : "Save class & students"}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
