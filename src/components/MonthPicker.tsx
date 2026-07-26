"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function MonthPicker({
  year,
  month,
}: {
  year: number;
  month: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(nextYear: number, nextMonth: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(nextYear));
    params.set("month", String(nextMonth));
    router.push(`${pathname}?${params.toString()}`);
  }

  const years = Array.from({ length: 6 }, (_, i) => year - 2 + i);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="month">
        Month
      </label>
      <select
        id="month"
        className="field"
        value={month}
        onChange={(e) => update(year, Number(e.target.value))}
      >
        {months.map((label, index) => (
          <option key={label} value={index + 1}>
            {label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="year">
        Year
      </label>
      <select
        id="year"
        className="field"
        value={year}
        onChange={(e) => update(Number(e.target.value), month)}
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
