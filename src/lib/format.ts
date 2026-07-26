export function formatLKR(amount: number): string {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en-LK", {
    month: "long",
    year: "numeric",
  });
}

export function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function parsePeriod(searchParams: {
  year?: string;
  month?: string;
}): { year: number; month: number } {
  const fallback = currentPeriod();
  const year = Number(searchParams.year);
  const month = Number(searchParams.month);
  return {
    year: Number.isFinite(year) && year >= 2000 ? year : fallback.year,
    month:
      Number.isFinite(month) && month >= 1 && month <= 12
        ? month
        : fallback.month,
  };
}

export function parseYear(searchParams: { year?: string }): number {
  const year = Number(searchParams.year);
  const fallback = currentPeriod().year;
  return Number.isFinite(year) && year >= 2000 ? year : fallback;
}

export const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
