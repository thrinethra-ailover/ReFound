import { useState } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toDatetimeLocalValue } from '../../utils/date';

interface HandoffSchedulerProps {
  onSchedule: (scheduledAtIso: string, location: string) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}

export function HandoffScheduler({ onSchedule, onCancel, busy }: HandoffSchedulerProps) {
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalValue());
  const [location, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      setError('Enter a public, well-lit meeting location.');
      return;
    }
    setError(null);
    await onSchedule(new Date(scheduledAt).toISOString(), location.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Input
        label="Proposed date/time"
        type="datetime-local"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        required
      />
      <Input
        label="Meeting location"
        placeholder="e.g. Campus Library front desk"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        hint="Pick a public, well-lit campus location."
        error={error ?? undefined}
        required
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          Propose handoff
        </Button>
      </div>
    </form>
  );
}
