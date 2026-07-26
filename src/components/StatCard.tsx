export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "accent" | "coral" | "gold";
}) {
  const tones = {
    default: "stat-default",
    good: "stat-good",
    warn: "stat-warn",
    accent: "stat-accent",
    coral: "stat-coral",
    gold: "stat-gold",
  };

  return (
    <div className={`stat-card ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-sm opacity-75">{hint}</p> : null}
    </div>
  );
}
