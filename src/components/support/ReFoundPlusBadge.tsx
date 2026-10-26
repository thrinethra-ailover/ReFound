import type { ReFoundPlusBadgeStyle } from '../../types/database';

interface ReFoundPlusBadgeProps {
  className?: string;
  style?: ReFoundPlusBadgeStyle | null;
  level?: string;
}

const PALETTES: Record<ReFoundPlusBadgeStyle, {
  outer: string; outerEdge: string; middle: string; middleEdge: string;
  core: string; coreEdge: string; gem: string; gemEdge: string; mark: string; glint: string;
}> = {
  CLASSIC: { outer: '#422006', outerEdge: '#FBBF24', middle: '#B45309', middleEdge: '#FDE68A', core: '#451A03', coreEdge: '#FDE68A', gem: '#F59E0B', gemEdge: '#FEF3C7', mark: '#FFF7D6', glint: '#FEF3C7' },
  PRISM: { outer: '#2e1065', outerEdge: '#c084fc', middle: '#7e22ce', middleEdge: '#f5d0fe', core: '#3b0764', coreEdge: '#e9d5ff', gem: '#d946ef', gemEdge: '#f5d0fe', mark: '#fff7ff', glint: '#e9d5ff' },
  EMBER: { outer: '#450a0a', outerEdge: '#fb7185', middle: '#be123c', middleEdge: '#fecdd3', core: '#4c0519', coreEdge: '#fda4af', gem: '#f97316', gemEdge: '#fff1e6', mark: '#fff7ed', glint: '#ffe4e6' },
  OCEAN: { outer: '#082f49', outerEdge: '#38bdf8', middle: '#0369a1', middleEdge: '#bae6fd', core: '#082f49', coreEdge: '#7dd3fc', gem: '#06b6d4', gemEdge: '#cffafe', mark: '#f0fdff', glint: '#e0f2fe' },
  EMERALD: { outer: '#052e16', outerEdge: '#4ade80', middle: '#15803d', middleEdge: '#bbf7d0', core: '#052e16', coreEdge: '#86efac', gem: '#10b981', gemEdge: '#d1fae5', mark: '#f0fdf4', glint: '#dcfce7' },
};

/** Scalable keepsake crest with selectable supporter colors and tenure label. */
export function ReFoundPlusBadge({ className = 'h-8 w-8', style = 'CLASSIC', level }: ReFoundPlusBadgeProps) {
  const palette = PALETTES[style ?? 'CLASSIC'];
  const rank = level === 'Legacy' ? 3 : level === 'Guardian' ? 2 : level === 'Beacon' ? 1 : 0;
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label={`ReFound+ ${level ? `${level} ` : ''}supporter badge`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>{`ReFound+ ${level ? `${level} ` : ''}supporter`}</title>
      <path d="M48 2 57 13 71 8 71 23 87 25 81 39 94 48 81 57 87 71 72 73 70 89 56 83 48 96 39 82 25 88 24 73 8 70 15 56 2 48 15 39 9 25 25 23 27 8 41 14 48 2Z" fill={palette.outer} stroke={palette.outerEdge} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M48 11 55 23 69 18 67 33 82 35 74 48 82 60 67 63 69 78 55 73 48 86 40 73 26 78 28 63 13 60 21 48 13 35 28 33 27 18 41 23 48 11Z" fill={palette.middle} stroke={palette.middleEdge} strokeWidth="1.6" strokeLinejoin="round" />
      {rank >= 1 && <circle cx="48" cy="48" r="38" stroke={palette.glint} strokeWidth="1.1" strokeDasharray={rank >= 2 ? '1 3' : '3 5'} opacity="0.86" />}
      {rank >= 2 && <path d="M48 0v5m0 91v-5M0 48h5m91 0h-5M13 13l4 4m62 62 4 4m0-70-4 4m-62 62-4 4" stroke={palette.gemEdge} strokeWidth="1.4" strokeLinecap="round" />}
      {rank >= 3 && <circle cx="48" cy="48" r="43" stroke={palette.gemEdge} strokeWidth="0.9" strokeDasharray="1 5" opacity="0.9" />}
      <circle cx="48" cy="48" r="32" stroke={palette.glint} strokeWidth="1.2" strokeDasharray="2 3" />
      <circle cx="48" cy="48" r="25" stroke={palette.gemEdge} strokeWidth="1.4" strokeDasharray="9 3" />
      <circle cx="48" cy="48" r="18" fill={palette.core} stroke={palette.coreEdge} strokeWidth="1.6" />
      <path d="M48 31c-7 0-12 5.3-12 12 0 9 12 22 12 22s12-13 12-22c0-6.7-5-12-12-12Z" fill={palette.gem} stroke={palette.gemEdge} strokeWidth="1.5" />
      <path d="M48 39v14m-7-7h14" stroke={palette.mark} strokeWidth="3" strokeLinecap="round" />
      <path d="M48 6v6m0 72v6M6 48h6m72 0h6M18 18l4 4m52 52 4 4m0-60-4 4m-52 52-4 4" stroke={palette.glint} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="48" cy="48" r="3" fill="#FFF" />
    </svg>
  );
}
