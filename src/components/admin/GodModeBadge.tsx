import type { ReFoundPlusBadgeStyle } from '../../types/database';

interface GodModeBadgeProps {
  className?: string;
  style?: ReFoundPlusBadgeStyle | null;
}

/** Ornate, non-text admin emblem in a divine-violet and infernal-red palette. */
export function GodModeBadge({ className = 'h-7 w-7', style = 'PRISM' }: GodModeBadgeProps) {
  const palette: Record<ReFoundPlusBadgeStyle, { outer: string; outerEdge: string; middle: string; middleEdge: string; core: string; coreEdge: string; crown: string; crownEdge: string; jewel: string; jewelEdge: string }> = {
    CLASSIC: { outer: '#1c1305', outerEdge: '#fbbf24', middle: '#a16207', middleEdge: '#fde68a', core: '#451a03', coreEdge: '#fcd34d', crown: '#78350f', crownEdge: '#fef3c7', jewel: '#f59e0b', jewelEdge: '#fff7d6' },
    PRISM: { outer: '#08060d', outerEdge: '#c084fc', middle: '#32104d', middleEdge: '#f0abfc', core: '#09050d', coreEdge: '#fb3155', crown: '#790b35', crownEdge: '#fecdd3', jewel: '#d91e50', jewelEdge: '#e9d5ff' },
    EMBER: { outer: '#350712', outerEdge: '#fb7185', middle: '#9f1239', middleEdge: '#fda4af', core: '#4c0519', coreEdge: '#fb7185', crown: '#881337', crownEdge: '#ffe4e6', jewel: '#f43f5e', jewelEdge: '#fff1f2' },
    OCEAN: { outer: '#06243a', outerEdge: '#38bdf8', middle: '#075985', middleEdge: '#7dd3fc', core: '#082f49', coreEdge: '#38bdf8', crown: '#0c4a6e', crownEdge: '#e0f2fe', jewel: '#06b6d4', jewelEdge: '#cffafe' },
    EMERALD: { outer: '#052e16', outerEdge: '#4ade80', middle: '#166534', middleEdge: '#86efac', core: '#052e16', coreEdge: '#4ade80', crown: '#14532d', crownEdge: '#dcfce7', jewel: '#10b981', jewelEdge: '#d1fae5' },
  };
  const colors = palette[style ?? 'PRISM'];
  return (
    <svg
      viewBox="0 0 96 96"
      className={className}
      role="img"
      aria-label="The Creator admin insignia"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>The Creator</title>
      <path className="creator-insignia-outer" d="M48 3 56 17 70 9 69 26 86 23 80 39 94 47 80 56 88 71 71 71 68 88 53 80 44 94 36 79 21 87 22 70 5 68 13 53 2 43 18 35 10 20 27 22 29 5 43 14 48 3Z" fill={colors.outer} stroke={colors.outerEdge} strokeWidth="1.8" strokeLinejoin="round" />
      <path className="creator-insignia-inner" d="M48 11 54 25 68 17 66 33 82 33 74 46 87 55 71 60 76 76 60 71 53 86 44 72 29 80 30 64 14 61 23 48 10 38 26 33 21 17 37 23 48 11Z" fill={colors.middle} stroke={colors.middleEdge} strokeWidth="1.5" strokeLinejoin="round" />
      <circle className="creator-insignia-orbit creator-insignia-orbit-slow" cx="48" cy="48" r="34" stroke={colors.crownEdge} strokeWidth="1.2" strokeDasharray="1.5 4" />
      <circle className="creator-insignia-orbit creator-insignia-orbit-fast" cx="48" cy="48" r="28" stroke={colors.jewelEdge} strokeWidth="1.3" strokeDasharray="13 3 4 3" />
      <path d="m48 20 4.5 9.5 10 1.3-7.3 7.2 1.7 10-8.9-4.8-8.9 4.8 1.7-10-7.3-7.2 10-1.3L48 20Z" fill={colors.crown} stroke={colors.crownEdge} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="48" cy="50" r="18" fill={colors.core} stroke={colors.coreEdge} strokeWidth="1.8" />
      <path d="M36 54 38 43 45 49 48 39 52 49 59 43 61 54 57 61H40L36 54Z" fill={colors.jewel} stroke={colors.jewelEdge} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M42 56h12l-6 8-6-8Z" fill={colors.jewel} stroke={colors.jewelEdge} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="48" cy="52" r="2.3" fill="#FFF" />
      <path d="M48 6v7m0 70v7M6 48h7m70 0h7M18 18l5 5m50 50 5 5m0-60-5 5m-50 50-5 5" stroke={colors.jewelEdge} strokeWidth="1.4" strokeLinecap="round" />
      <path d="m31 8 2.2 5.5L39 16l-5.8 2.2L31 24l-2.2-5.8L23 16l5.8-2.5L31 8Zm34 64 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" fill={colors.jewelEdge} />
    </svg>
  );
}
