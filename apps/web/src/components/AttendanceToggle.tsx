"use client";

import { useTransition } from "react";
import { setAttendance } from "@/lib/actions";

export function AttendanceToggle({
  studentId,
  studentName,
  classId,
  year,
  week,
  attendedOn,
  attended,
  disabled,
}: {
  studentId: number;
  studentName: string;
  classId: number;
  year: number;
  week: number;
  attendedOn: string;
  attended: boolean;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending || disabled}
      aria-label={`${attended ? "Mark absent" : "Mark present"}: ${studentName}`}
      className={`inline-flex min-h-10 w-full items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition disabled:opacity-60 md:w-auto ${
        attended
          ? "bg-sky-600 text-white hover:bg-sky-700"
          : "bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--line)] hover:bg-[var(--accent-soft)]"
      }`}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("student_id", String(studentId));
          fd.set("class_id", String(classId));
          fd.set("year", String(year));
          fd.set("week", String(week));
          fd.set("attended_on", attendedOn);
          fd.set("attended", attended ? "0" : "1");
          await setAttendance(fd);
        });
      }}
    >
      {pending ? "Saving…" : disabled ? "Holiday" : attended ? "Present" : "Mark present"}
    </button>
  );
}
