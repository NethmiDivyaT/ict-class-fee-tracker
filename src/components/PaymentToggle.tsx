"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { markPaid, markUnpaid } from "@/lib/actions";

function todayLocal() {
  return new Date().toLocaleDateString("en-CA");
}

export function PaymentToggle({
  studentId,
  studentName,
  classId,
  year,
  month,
  week = 0,
  isPaid,
  defaultAmount,
  paidOn,
  periodLabel = "this month",
}: {
  studentId: number;
  studentName: string;
  classId: number;
  year: number;
  month: number;
  week?: number;
  isPaid: boolean;
  defaultAmount: number;
  paidOn?: string | null;
  periodLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [paidDate, setPaidDate] = useState(paidOn || todayLocal());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function close() {
    setOpen(false);
    setError(null);
  }

  function baseFormData() {
    const fd = new FormData();
    fd.set("student_id", String(studentId));
    fd.set("class_id", String(classId));
    fd.set("year", String(year));
    fd.set("month", String(month));
    fd.set("week", String(week));
    return fd;
  }

  const dialog =
    open && mounted
      ? createPortal(
          <div
            className="pay-modal-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              className="pay-modal-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`pay-title-${studentId}`}
            >
              <div className="pay-modal-handle" aria-hidden />
              <h3
                id={`pay-title-${studentId}`}
                className="text-lg font-semibold"
              >
                Save payment
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Student name and paying date will be stored for {periodLabel}.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Student name
                  </label>
                  <input
                    className="field bg-[var(--surface)]"
                    value={studentName}
                    readOnly
                  />
                </div>
                <div>
                  <label
                    htmlFor={`paid-on-${studentId}`}
                    className="mb-1 block text-sm font-medium"
                  >
                    Paying date
                  </label>
                  <input
                    id={`paid-on-${studentId}`}
                    type="date"
                    className="field pay-date-input"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Amount (LKR)
                  </label>
                  <input
                    className="field bg-[var(--surface)]"
                    value={defaultAmount}
                    readOnly
                  />
                </div>
              </div>

              {error ? (
                <p className="mt-3 text-sm text-red-600">{error}</p>
              ) : null}

              <div className="pay-modal-actions">
                <button type="button" className="btn-ghost" onClick={close}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={pending || !paidDate}
                  onClick={() => {
                    startTransition(async () => {
                      const fd = baseFormData();
                      fd.set("amount", String(defaultAmount));
                      fd.set("paid_on", paidDate);
                      const result = await markPaid(fd);
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      close();
                    });
                  }}
                >
                  {pending ? "Saving…" : "Save payment"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="w-full md:w-auto">
      <button
        type="button"
        disabled={pending}
        className={`inline-flex min-h-10 w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-60 md:w-auto ${
          isPaid
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
        }`}
        onClick={() => {
          if (isPaid) {
            if (
              !confirm(
                `Remove payment for ${studentName}? This deletes the saved payment date.`,
              )
            ) {
              return;
            }
            startTransition(async () => {
              await markUnpaid(baseFormData());
            });
            return;
          }
          setPaidDate(paidOn || todayLocal());
          setOpen(true);
        }}
      >
        {pending ? "Saving…" : isPaid ? "Paid" : "Mark paid"}
      </button>
      {dialog}
    </div>
  );
}
