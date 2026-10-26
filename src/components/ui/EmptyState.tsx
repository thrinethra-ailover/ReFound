import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center gap-3 rounded-card border border-dashed border-border bg-white/60 px-6 py-14">
      {icon && <div className="text-slate-light">{icon}</div>}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="text-sm text-slate max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
