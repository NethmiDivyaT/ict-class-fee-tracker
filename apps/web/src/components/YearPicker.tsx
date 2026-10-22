"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function YearPicker({ year }: { year: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const years = Array.from({ length: 6 }, (_, i) => year - 2 + i);

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="report-year">
        Year
      </label>
      <select
        id="report-year"
        className="field w-auto min-w-28"
        value={year}
        onChange={(e) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("year", e.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
