import { formatLKR, SHORT_MONTHS } from "@/lib/format";
import type { MonthIncome } from "@/lib/queries";

export function IncomeChart({ months }: { months: MonthIncome[] }) {
  const max = Math.max(...months.map((m) => m.income), 1);

  return (
    <div className="space-y-4">
      <div className="flex h-52 items-end gap-1.5 sm:gap-2.5">
        {months.map((m, index) => {
          const height = Math.max((m.income / max) * 100, m.income > 0 ? 6 : 2);
          return (
            <div
              key={m.month}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <div className="relative w-full flex-1 flex items-end">
                <div
                  className="chart-bar mx-auto w-full max-w-10 rounded-t-lg"
                  style={{ height: `${height}%` }}
                  title={`${SHORT_MONTHS[m.month - 1]}: ${formatLKR(m.income)}`}
                />
                {m.income > 0 ? (
                  <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--ink)] px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                    {formatLKR(m.income)}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] font-medium text-[var(--muted)] sm:text-xs">
                {SHORT_MONTHS[m.month - 1]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
