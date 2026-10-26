interface ConfidenceMeterProps {
  score: number;
}

function getConfidence(score: number): { label: string; barColor: string; textColor: string } {
  if (score >= 80) return { label: 'Strong match', barColor: 'bg-signal', textColor: 'text-signal-dark' };
  if (score >= 60) return { label: 'Possible match', barColor: 'bg-beacon', textColor: 'text-beacon-dark' };
  return { label: 'Low confidence', barColor: 'bg-slate-light', textColor: 'text-slate' };
}

export function ConfidenceMeter({ score }: ConfidenceMeterProps) {
  const { label, barColor, textColor } = getConfidence(score);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${textColor}`}>{label}</span>
        <span className="font-mono text-sm text-ink">{score}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}, ${score} percent confidence`}
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}
