export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate" role="status">
      <span className="h-8 w-8 rounded-full border-[3px] border-border border-t-signal animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
