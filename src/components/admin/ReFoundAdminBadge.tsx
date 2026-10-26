import type { ReFoundPlusBadgeStyle } from '../../types/database';

const ACCENTS: Record<ReFoundPlusBadgeStyle, { fill: string; edge: string; detail: string }> = {
  CLASSIC: { fill: '#273343', edge: '#9aaabd', detail: '#e6edf5' },
  PRISM: { fill: '#241638', edge: '#d8a5ff', detail: '#f5ddff' },
  EMBER: { fill: '#3b1d25', edge: '#fb7185', detail: '#ffe4e6' },
  OCEAN: { fill: '#12303a', edge: '#22d3ee', detail: '#cffafe' },
  EMERALD: { fill: '#173329', edge: '#34d399', detail: '#d1fae5' },
};

export function ReFoundAdminBadge({ className = 'h-8 w-8', style = 'CLASSIC' }: { className?: string; style?: ReFoundPlusBadgeStyle }) {
  const colors = ACCENTS[style] ?? ACCENTS.CLASSIC;
  return <svg className={className} viewBox="0 0 48 48" role="img" aria-label="ReFound Admin badge">
    <circle cx="24" cy="24" r="21" fill={colors.fill} stroke={colors.edge} strokeWidth="2" />
    <circle cx="24" cy="24" r="16" fill="none" stroke={colors.edge} strokeOpacity=".7" strokeWidth="1" />
    <path d="M24 9c-6 0-10 4.4-10 10.1 0 7.1 10 18 10 18s10-10.9 10-18C34 13.4 30 9 24 9Z" fill="none" stroke={colors.detail} strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="19" r="3" fill="none" stroke={colors.detail} strokeWidth="2" />
  </svg>;
}
