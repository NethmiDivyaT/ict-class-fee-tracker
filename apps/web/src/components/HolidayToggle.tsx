"use client";

import { useTransition } from "react";
import { setClassHoliday } from "@/lib/actions";

export function HolidayToggle({
  classId,
  year,
  week,
  isHoliday,
}: {
  classId: number;
  year: number;
  week: number;
  isHoliday: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={`inline-flex min-h-10 items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-60 ${
        isHoliday
          ? "bg-[var(--gold)] text-white hover:brightness-105"
          : "bg-[var(--gold-soft)] text-[#7a5a00] ring-1 ring-[var(--line)] hover:bg-[#ffe9a8]"
      }`}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("class_id", String(classId));
          fd.set("year", String(year));
          fd.set("week", String(week));
          fd.set("holiday", isHoliday ? "0" : "1");
          await setClassHoliday(fd);
        });
      }}
    >
      {pending
        ? "Saving…"
        : isHoliday
          ? "Remove holiday"
          : "Mark week as holiday"}
    </button>
  );
}
