"use client";

import { useTransition } from "react";

export function ConfirmSubmit({
  action,
  message,
  label,
  className,
}: {
  action: (formData: FormData) => Promise<unknown>;
  message: string;
  label: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) return;
        const form = e.currentTarget.closest("form");
        if (!form) return;
        const fd = new FormData(form);
        startTransition(async () => {
          await action(fd);
        });
      }}
    >
      {pending ? "…" : label}
    </button>
  );
}
