interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-card border border-border bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-light">{hint}</p>}
    </div>
  );
}
