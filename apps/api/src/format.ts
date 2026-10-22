export function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - day + 1);
  const monday = new Date(mondayWeek1);
  monday.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  return monday;
}

export function toISODateUTC(date: Date): string {
  return date.toISOString().slice(0, 10);
}

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
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  const monday = getISOWeekMonday(utc.getUTCFullYear(), week);
  return {
    year: utc.getUTCFullYear(),
    week,
    month: monday.getUTCMonth() + 1,
  };
}

export function defaultAttendedOn(year: number, week: number): string {
  const today = new Date();
  const current = getISOWeekParts(today);
  if (current.year === year && current.week === week) {
    return today.toLocaleDateString("en-CA");
  }
  return toISODateUTC(getISOWeekMonday(year, week));
}
