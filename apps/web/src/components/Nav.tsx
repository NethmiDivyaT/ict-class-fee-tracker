"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/classes", label: "Classes" },
  { href: "/records", label: "Records" },
  { href: "/reports", label: "Reports" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="nav-shell">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="nav-brand-mark shrink-0" aria-hidden />
          <span className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight text-[var(--ink)]">
              ICT Class Fee Tracker
            </p>
            <p className="text-xs text-[var(--muted)]">Fees · LKR · Reports</p>
          </span>
        </Link>

        <button
          type="button"
          className="rounded-md border border-[var(--line)] bg-white px-3 py-1.5 text-sm text-[var(--ink)] sm:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation"
        >
          Menu
        </button>

        <nav
          className={`${
            open ? "flex" : "hidden"
          } absolute left-0 right-0 top-[4.4rem] z-20 flex-col gap-1 border-b border-[var(--line)] bg-white/95 px-4 py-3 shadow-sm sm:static sm:flex sm:flex-row sm:items-center sm:gap-1 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
        >
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-full px-3.5 py-2 text-sm transition ${
                  active
                    ? "bg-[var(--accent)] font-semibold text-white shadow-sm"
                    : "text-[var(--muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
