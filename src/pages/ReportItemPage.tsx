import { ReportForm } from '../components/items/ReportForm';

export function ReportItemPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-bold text-ink">Report an item</h1>
      <p className="mt-1 text-sm text-slate">
        The more detail you provide, the better ReFound can find a match.
      </p>
      <div className="mt-8 rounded-card border border-border bg-white p-6 shadow-card sm:p-8">
        <ReportForm />
      </div>
    </div>
  );
}
