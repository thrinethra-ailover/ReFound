import type { ReactNode } from 'react';

type BadgeTone = 'signal' | 'beacon' | 'coral' | 'slate';

const TONE_CLASSES: Record<BadgeTone, string> = {
  signal: 'bg-signal/10 text-signal-dark',
  beacon: 'bg-beacon/15 text-beacon-dark',
  coral: 'bg-coral/10 text-coral-dark',
  slate: 'bg-slate/10 text-slate',
};

export function Badge({ tone = 'slate', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
