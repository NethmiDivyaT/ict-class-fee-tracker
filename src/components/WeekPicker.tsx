"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { shiftISOWeek, weekLabel } from "@/lib/format";

export function WeekPicker({ year, week }: { year: number; week: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(nextYear: number, nextWeek: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(nextYear));
    params.set("week", String(nextWeek));
    params.delete("month");
    router.push(`${pathname}?${params.toString()}`);
  }

  const prev = shiftISOWeek(year, week, -1);
  const next = shiftISOWeek(year, week, 1);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-ghost" onClick={() => go(prev.year, prev.week)}>
        ← Prev
      </button>
      <div className="rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm font-medium">
        {weekLabel(year, week)}
      </div>
      <button type="button" className="btn-ghost" onClick={() => go(next.year, next.week)}>
        Next →
      </button>
    </div>
  );
}
