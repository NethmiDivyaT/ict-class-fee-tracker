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

/** ISO week-year and ISO week number (Monday-based). */
export function getISOWeekParts(date = new Date()): {
  year: number;
  week: number;
  month: number;
} {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const monday = getISOWeekMonday(utc.getUTCFullYear(), week);
  return {
    year: utc.getUTCFullYear(),
    week,
    month: monday.getUTCMonth() + 1,
  };
}

export function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - day + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

export function weekLabel(year: number, week: number): string {
  const monday = getISOWeekMonday(year, week);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-LK", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `Week ${week}, ${year} (${fmt(monday)} – ${fmt(sunday)})`;
}

export function shiftISOWeek(
  year: number,
  week: number,
  delta: number,
): { year: number; week: number; month: number } {
  const monday = getISOWeekMonday(year, week);
  monday.setUTCDate(monday.getUTCDate() + delta * 7);
  return getISOWeekParts(
    new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()),
  );
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

export function parseWeekPeriod(searchParams: {
  year?: string;
  week?: string;
}): { year: number; week: number; month: number } {
  const fallback = getISOWeekParts();
  const year = Number(searchParams.year);
  const week = Number(searchParams.week);
  if (
    Number.isFinite(year) &&
    year >= 2000 &&
    Number.isFinite(week) &&
    week >= 1 &&
    week <= 53
  ) {
    const monday = getISOWeekMonday(year, week);
    return { year, week, month: monday.getUTCMonth() + 1 };
  }
  return fallback;
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
