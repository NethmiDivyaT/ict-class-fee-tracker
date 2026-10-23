"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  defaultAttendedOn,
  getISOWeekParts,
  shiftISOWeek,
  weekLabel,
} from "@/lib/format";

export function WeekPicker({
  year,
  week,
  date,
}: {
  year: number;
  week: number;
  date: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function go(nextYear: number, nextWeek: number, nextDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(nextYear));
    params.set("week", String(nextWeek));
    params.set("date", nextDate);
    params.delete("month");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
      router.refresh();
    });
  }

  const prev = shiftISOWeek(year, week, -1);
  const next = shiftISOWeek(year, week, 1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-ghost"
        onClick={() => go(prev.year, prev.week, defaultAttendedOn(prev.year, prev.week))}
      >
        ← Prev
      </button>
      <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium">
        {weekLabel(year, week)}
      </div>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => go(next.year, next.week, defaultAttendedOn(next.year, next.week))}
      >
        Next →
      </button>
      <label className="sr-only" htmlFor="class-date">
        Class date
      </label>
      <input
        id="class-date"
        type="date"
        className="field w-auto min-w-40"
        value={date}
        onChange={(e) => {
          const nextDate = e.target.value;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
          const parts = getISOWeekParts(new Date(`${nextDate}T00:00:00`));
          go(parts.year, parts.week, nextDate);
        }}
      />
    </div>
  );
}
