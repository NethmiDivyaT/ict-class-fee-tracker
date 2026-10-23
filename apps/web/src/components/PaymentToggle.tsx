"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  loadStudentBilling,
  markPaid,
  markUnpaid,
} from "@/lib/actions";
import {
  formatAttendanceDay,
  formatLKR,
  monthLabel,
  SHORT_MONTHS,
  slotPresentWeeks,
  slotUpcomingWeeks,
  weekCountLabel,
  WEEKS_PER_FEE_MONTH,
} from "@/lib/format";
import type { FeeSlot, StudentBilling } from "@/lib/types";

function todayLocal() {
  return new Date().toLocaleDateString("en-CA");
}

function slotId(slot: Pick<FeeSlot, "year" | "month" | "slot">) {
  return `${slot.year}-${slot.month}-${slot.slot}`;
}

function slotWeekCount(_slot: FeeSlot) {
  return WEEKS_PER_FEE_MONTH;
}

function DayChips({
  days,
  tone = "default",
}: {
  days: string[];
  tone?: "default" | "due" | "paid" | "next";
}) {
  if (!days || days.length === 0) {
    return <p className="text-xs text-[var(--muted)]">No class dates on this month</p>;
  }
  const chip =
    tone === "due"
      ? "pay-day-chip pay-day-chip-due"
      : tone === "paid"
        ? "pay-day-chip pay-day-chip-paid"
        : tone === "next"
          ? "pay-day-chip pay-day-chip-next"
          : "pay-day-chip";
  return (
    <div className="pay-day-list">
      {days.map((day) => (
        <span key={day} className={chip}>
          {formatAttendanceDay(day)}
        </span>
      ))}
    </div>
  );
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
  paidSlots = [],
  leftoverDates: leftoverDatesProp = [],
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
  paidSlots?: FeeSlot[];
  leftoverDates?: string[];
}) {
  const router = useRouter();
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

  const slots = billing?.slots ?? [...paidSlots, ...unpaidSlots];
  const selectedSlots = useMemo(
    () => slots.filter((slot) => selected.includes(slotId(slot))),
    [slots, selected],
  );
  const payingSlots = selectedSlots.filter((slot) => !slot.paid);
  const payingDays = payingSlots.flatMap((slot) => slot.days ?? []);
  const payingWeeks = payingSlots.reduce((sum, slot) => sum + slotWeekCount(slot), 0);
  const unpaidWeeks = slots
    .filter((slot) => !slot.paid)
    .reduce((sum, slot) => sum + slotWeekCount(slot), 0);
  const paidWeeks = slots
    .filter((slot) => slot.paid)
    .reduce((sum, slot) => sum + slotWeekCount(slot), 0);
  const leftoverDates = billing?.leftover_dates ?? leftoverDatesProp;
  const leftoverWeeks = leftoverDates.length || billing?.leftover_days || 0;
  const remainingAfterPay = Math.max(0, unpaidWeeks - payingWeeks);
  const removingSlots = slots.filter(
    (slot) => slot.paid && !selected.includes(slotId(slot)),
  );
  const hasPaymentChange = payingSlots.length > 0 || removingSlots.length > 0;
  const amount = defaultAmount * Math.max(payingSlots.length, mode === "weekly" ? 1 : 0);

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
    setSelected([...paidSlots, ...unpaidSlots].map(slotId));
    startTransition(async () => {
      try {
        const data = await loadStudentBilling(studentId);
        setBilling(data);
        setSelected(data.slots.map(slotId));
      } catch {
        setError("Could not load unpaid weeks.");
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
                {mode === "monthly" ? `Pay ${studentName}` : "Save payment"}
              </h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {mode === "monthly"
                  ? "4 present weeks = 1 paying month. You can pay early — upcoming present weeks fill that paid month. Holiday and absent weeks are not included."
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
                  <div className="space-y-3">
                    <div className="pay-summary">
                      <div className="pay-summary-card">
                        <p className="text-xs text-[var(--muted)]">Unpaid now</p>
                        <strong>{weekCountLabel(unpaidWeeks)}</strong>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {`${slots.filter((slot) => !slot.paid).length} fee month${
                            slots.filter((slot) => !slot.paid).length === 1 ? "" : "s"
                          }`}
                        </p>
                      </div>
                      <div className="pay-summary-card">
                        <p className="text-xs text-[var(--muted)]">Already paid</p>
                        <strong>{weekCountLabel(paidWeeks)}</strong>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {remainingAfterPay === 0 && unpaidWeeks === 0
                            ? "Nothing remaining to pay"
                            : `${weekCountLabel(remainingAfterPay)} remaining after this`}
                        </p>
                      </div>
                    </div>

                    {payingWeeks > 0 ? (
                      <div className="rounded-xl border border-[var(--accent)] bg-[var(--accent-soft)] p-3">
                        <p className="text-sm font-semibold text-[var(--accent-strong)]">
                          Paying {weekCountLabel(payingWeeks)} now
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {payingSlots.some((slot) => slotUpcomingWeeks(slot) > 0)
                            ? "Present days so far. Upcoming present weeks will complete this month."
                            : "These are the class days covered by this payment"}
                        </p>
                        <div className="mt-2">
                          {payingDays.length > 0 ? (
                            <DayChips days={payingDays} tone="due" />
                          ) : (
                            <p className="text-xs text-[var(--muted)]">
                              Manual month — no attendance dates attached
                            </p>
                          )}
                        </div>
                        <p className="mt-2 text-sm font-medium">
                          Amount {formatLKR(amount || defaultAmount * payingSlots.length)}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          After save: {weekCountLabel(paidWeeks + payingWeeks)} paid
                          {" · "}
                          {weekCountLabel(remainingAfterPay)} remaining to pay
                          {payingSlots.some((slot) => slotUpcomingWeeks(slot) > 0)
                            ? ` · upcoming weeks complete this month`
                            : ""}
                        </p>
                      </div>
                    ) : billing ? (
                      <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]">
                        Select unpaid weeks below to pay them.
                      </p>
                    ) : null}

                    <div>
                      <p className="mb-1 text-sm font-medium">Fee months</p>
                      {billing ? (
                        <p className="mb-2 text-xs text-[var(--muted)]">
                          {weekCountLabel(billing.attendance_days)} present
                          {" · "}
                          {`${billing.billable_months} complete month${
                            billing.billable_months === 1 ? "" : "s"
                          }`}
                        </p>
                      ) : (
                        <p className="mb-2 text-xs text-[var(--muted)]">
                          Loading weeks…
                        </p>
                      )}
                      <div className="month-check-list">
                        {slots.length === 0 ? (
                          <p className="text-sm text-[var(--muted)]">
                            No payable weeks yet. Add a month below if they are
                            paying late or in advance.
                          </p>
                        ) : (
                          slots.map((slot) => {
                            const id = slotId(slot);
                            const weeks = slotWeekCount(slot);
                            const present = slotPresentWeeks(slot);
                            const upcoming = slotUpcomingWeeks(slot);
                            const details = (
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">
                                    {monthLabel(slot.year, slot.month)}
                                  </span>
                                  <span
                                    className={`badge ${slot.paid ? "badge-paid" : "badge-unpaid"}`}
                                  >
                                    {slot.paid
                                      ? "Paid"
                                      : upcoming > 0
                                        ? "Pay early"
                                        : "Unpaid"}
                                  </span>
                                  <span className="text-xs text-[var(--muted)]">
                                    {upcoming > 0
                                      ? `${present} of ${WEEKS_PER_FEE_MONTH} weeks`
                                      : weekCountLabel(weeks)}
                                  </span>
                                </span>
                                <span className="mt-1.5 block">
                                  {present > 0 ? (
                                    <DayChips
                                      days={slot.days ?? []}
                                      tone={slot.paid ? "paid" : "due"}
                                    />
                                  ) : (
                                    <p className="text-xs text-[var(--muted)]">
                                      Upcoming present weeks will complete this
                                      month
                                    </p>
                                  )}
                                </span>
                                {upcoming > 0 ? (
                                  <span className="mt-1 block text-xs text-[var(--muted)]">
                                    {slot.paid
                                      ? `${weekCountLabel(upcoming)} upcoming will be added to complete this month`
                                      : `Pay now · ${weekCountLabel(upcoming)} upcoming will complete this month`}
                                  </span>
                                ) : null}
                                {slot.paid && slot.paid_on ? (
                                  <span className="mt-1 block text-xs text-[var(--muted)]">
                                    Paid on {slot.paid_on}
                                    {slot.amount != null
                                      ? ` · ${formatLKR(slot.amount)}`
                                      : ""}
                                  </span>
                                ) : null}
                                {slot.source === "manual" && present === 0 ? (
                                  <span className="mt-1 block text-xs text-[var(--muted)]">
                                    Added manually
                                  </span>
                                ) : null}
                              </span>
                            );
                            if (slot.paid) {
                              return (
                                <div key={id} className="month-check month-check-paid">
                                  {details}
                                </div>
                              );
                            }
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
                                {details}
                              </label>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {leftoverDates.length > 0 &&
                    !slots.some((slot) => !slot.paid && slotUpcomingWeeks(slot) > 0) ? (
                      <div className="rounded-xl border border-[#f0d37a] bg-[var(--gold-soft)] p-3">
                        <p className="text-sm font-medium">
                          {weekCountLabel(leftoverWeeks)} toward next month
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          Upcoming present weeks will complete this fee month
                        </p>
                        <div className="mt-2">
                          <DayChips days={leftoverDates} tone="next" />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-1 flex flex-wrap items-end gap-2">
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
                            days: [],
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
                                leftover_dates: [],
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
                ) : (
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
                )}
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
                    (mode === "monthly" && !hasPaymentChange)
                  }
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const fd = baseFormData();
                        fd.set("paid_on", paidDate);
                        if (mode === "monthly") {
                          if (removingSlots.length) {
                            const remove = baseFormData();
                            remove.set(
                              "periods",
                              JSON.stringify(
                                removingSlots.map((slot) => ({
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
                          if (payingSlots.length) {
                            fd.set(
                              "periods",
                              JSON.stringify(
                                payingSlots.map((slot) => ({
                                  year: slot.year,
                                  month: slot.month,
                                  slot: slot.slot,
                                  week: 0,
                                })),
                              ),
                            );
                            fd.set(
                              "amount",
                              String(defaultAmount * payingSlots.length),
                            );
                            const result = await markPaid(fd);
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                          }
                          router.refresh();
                          close();
                          return;
                        }

                        fd.set("amount", String(defaultAmount));
                        const result = await markPaid(fd);
                        if (!result.ok) {
                          setError(result.error);
                          return;
                        }
                        router.refresh();
                        close();
                      } catch {
                        setError("Could not save the payment. Try again.");
                      }
                    });
                  }}
                >
                  {pending
                    ? "Saving…"
                    : mode === "monthly"
                      ? payingWeeks > 0
                        ? `Pay ${weekCountLabel(payingWeeks)}`
                        : "Save payment"
                      : "Save payment"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const monthlyUnpaid = unpaidSlots.length;
  const monthlyUnpaidWeeks = unpaidSlots.reduce(
    (sum, slot) => sum + slotWeekCount(slot),
    0,
  );
  const monthlyEarlyOnly =
    monthlyUnpaid > 0 &&
    unpaidSlots.every((slot) => slotUpcomingWeeks(slot) > 0);
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
              router.refresh();
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
            ? monthlyUnpaidWeeks > 0
              ? monthlyEarlyOnly
                ? "Pay early"
                : `Pay ${weekCountLabel(monthlyUnpaidWeeks)}`
              : "Paid · view weeks"
            : isPaid
              ? "Paid"
              : "Mark paid"}
      </button>
      {dialog}
    </div>
  );
}
