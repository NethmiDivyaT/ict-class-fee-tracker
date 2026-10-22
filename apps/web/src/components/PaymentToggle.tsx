"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  loadStudentBilling,
  markPaid,
  markUnpaid,
} from "@/lib/actions";
import { monthLabel, SHORT_MONTHS } from "@/lib/format";
import type { FeeSlot, StudentBilling } from "@/lib/types";

function todayLocal() {
  return new Date().toLocaleDateString("en-CA");
}

function slotId(slot: Pick<FeeSlot, "year" | "month" | "slot">) {
  return `${slot.year}-${slot.month}-${slot.slot}`;
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
  mode = "weekly",
  unpaidSlots = [],
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
  mode?: "weekly" | "monthly";
  unpaidSlots?: FeeSlot[];
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [paidDate, setPaidDate] = useState(paidOn || todayLocal());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [billing, setBilling] = useState<StudentBilling | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [addYear, setAddYear] = useState(year);
  const [addMonth, setAddMonth] = useState(month);

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

  const slots = billing?.slots ?? unpaidSlots;
  const selectedSlots = useMemo(
    () => slots.filter((slot) => selected.includes(slotId(slot))),
    [slots, selected],
  );
  const amount = defaultAmount * Math.max(selectedSlots.length, mode === "weekly" ? 1 : 0);

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

  function openMonthly() {
    setPaidDate(todayLocal());
    setError(null);
    setOpen(true);
    startTransition(async () => {
      try {
        const data = await loadStudentBilling(studentId);
        setBilling(data);
        const auto = data.slots.filter((slot) => !slot.paid).map(slotId);
        setSelected(auto.length ? auto : []);
      } catch {
        setError("Could not load unpaid months.");
      }
    });
  }

  const years = Array.from({ length: 6 }, (_, i) => year - 2 + i);

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
                {mode === "monthly"
                  ? "Four present days count as one month. Unpaid months are selected automatically — edit them if needed."
                  : `Student name and paying date will be stored for ${periodLabel}.`}
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

                {mode === "monthly" ? (
                  <div>
                    <p className="mb-1 text-sm font-medium">Months being paid</p>
                    {billing ? (
                      <p className="mb-2 text-xs text-[var(--muted)]">
                        {billing.attendance_days} present days ·{" "}
                        {billing.billable_months} billable months ·{" "}
                        {billing.leftover_days} extra day
                        {billing.leftover_days === 1 ? "" : "s"}
                      </p>
                    ) : (
                      <p className="mb-2 text-xs text-[var(--muted)]">
                        Loading months…
                      </p>
                    )}
                    <div className="month-check-list">
                      {slots.length === 0 ? (
                        <p className="text-sm text-[var(--muted)]">
                          No attendance months yet. Add a month below if they are
                          paying late or in advance.
                        </p>
                      ) : (
                        slots.map((slot) => {
                          const id = slotId(slot);
                          return (
                            <label key={id} className="month-check">
                              <input
                                type="checkbox"
                                checked={selected.includes(id)}
                                onChange={() => {
                                  setSelected((current) =>
                                    current.includes(id)
                                      ? current.filter((value) => value !== id)
                                      : [...current, id],
                                  );
                                }}
                              />
                              <span>
                                {monthLabel(slot.year, slot.month)}
                                {slot.source === "attendance" && slot.end_on
                                  ? ` · 4 days to ${slot.end_on}`
                                  : " · added manually"}
                                {slot.paid ? " · already paid" : ""}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <select
                        className="field w-auto"
                        value={addMonth}
                        onChange={(e) => setAddMonth(Number(e.target.value))}
                      >
                        {SHORT_MONTHS.map((label, index) => (
                          <option key={label} value={index + 1}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="field w-auto"
                        value={addYear}
                        onChange={(e) => setAddYear(Number(e.target.value))}
                      >
                        {years.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          const next: FeeSlot = {
                            key: `${addYear}-${addMonth}-0`,
                            slot: 0,
                            year: addYear,
                            month: addMonth,
                            start_on: null,
                            end_on: null,
                            paid: false,
                            payment_id: null,
                            paid_on: null,
                            amount: null,
                            source: "manual",
                          };
                          setBilling((current) => {
                            const base =
                              current ??
                              ({
                                student_id: studentId,
                                attendance_days: 0,
                                leftover_days: 0,
                                billable_months: 0,
                                paid_months: 0,
                                unpaid_months: 0,
                                slots: [],
                              } satisfies StudentBilling);
                            if (
                              base.slots.some(
                                (slot) =>
                                  slot.year === addYear &&
                                  slot.month === addMonth &&
                                  slot.slot === 0,
                              )
                            ) {
                              return base;
                            }
                            return { ...base, slots: [...base.slots, next] };
                          });
                          setSelected((current) =>
                            current.includes(slotId(next))
                              ? current
                              : [...current, slotId(next)],
                          );
                        }}
                      >
                        Add month
                      </button>
                    </div>
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Amount (LKR)
                  </label>
                  <input
                    className="field bg-[var(--surface)]"
                    value={
                      mode === "monthly"
                        ? amount || defaultAmount * Math.max(selected.length, 0)
                        : defaultAmount
                    }
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
                  disabled={
                    pending ||
                    !paidDate ||
                    (mode === "monthly" &&
                      selected.length === 0 &&
                      !slots.some(
                        (slot) => slot.paid && !selected.includes(slotId(slot)),
                      ))
                  }
                  onClick={() => {
                    startTransition(async () => {
                      const fd = baseFormData();
                      fd.set("paid_on", paidDate);
                      if (mode === "monthly") {
                        const pay = selectedSlots.filter((slot) => !slot.paid);
                        const unpay = slots.filter(
                          (slot) => slot.paid && !selected.includes(slotId(slot)),
                        );
                        if (unpay.length) {
                          const remove = baseFormData();
                          remove.set(
                            "periods",
                            JSON.stringify(
                              unpay.map((slot) => ({
                                year: slot.year,
                                month: slot.month,
                                slot: slot.slot,
                                week: 0,
                              })),
                            ),
                          );
                          const removed = await markUnpaid(remove);
                          if (!removed.ok) {
                            setError(removed.error);
                            return;
                          }
                        }
                        if (pay.length) {
                          fd.set(
                            "periods",
                            JSON.stringify(
                              pay.map((slot) => ({
                                year: slot.year,
                                month: slot.month,
                                slot: slot.slot,
                                week: 0,
                              })),
                            ),
                          );
                          fd.set("amount", String(defaultAmount * pay.length));
                          const result = await markPaid(fd);
                          if (!result.ok) {
                            setError(result.error);
                            return;
                          }
                        }
                        close();
                        return;
                      }

                      fd.set("amount", String(defaultAmount));
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

  const monthlyUnpaid = unpaidSlots.length;
  const monthlyPaidLook = mode === "monthly" ? monthlyUnpaid === 0 : isPaid;

  return (
    <div className="w-full md:w-auto">
      <button
        type="button"
        disabled={pending}
        className={`inline-flex min-h-10 w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-60 md:w-auto ${
          monthlyPaidLook
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
        }`}
        onClick={() => {
          if (mode === "monthly") {
            openMonthly();
            return;
          }
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
        {pending
          ? "Saving…"
          : mode === "monthly"
            ? monthlyUnpaid > 0
              ? `Pay ${monthlyUnpaid} month${monthlyUnpaid === 1 ? "" : "s"}`
              : "Pay / edit"
            : isPaid
              ? "Paid"
              : "Mark paid"}
      </button>
      {dialog}
    </div>
  );
}
