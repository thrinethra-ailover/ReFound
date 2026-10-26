export type AmbientEffect = 'OFF' | 'AURORA' | 'STARDUST' | 'CIRCUIT' | 'EMBER' | 'PRISM' | 'NEON_GRID' | 'DEEP_SPACE' | 'SOLAR_FLARE' | 'PETALS' | 'ELECTRIC';
export type CustomCursor = 'OFF' | 'HALO' | 'GLOW' | 'ORBIT' | 'SPARK' | 'TRAIL' | 'DIAMOND' | 'PULSE' | 'CONSTELLATION' | 'CROSSHAIR' | 'COMET';

export type PlusPersonalization = {
  ambient: AmbientEffect;
  cursor: CustomCursor;
};

export const DEFAULT_PLUS_PERSONALIZATION: PlusPersonalization = {
  ambient: 'OFF',
  cursor: 'OFF',
};

const eventName = 'refound-plus-personalization-change';
const storageKey = (userId: string) => `refound-plus-personalization:${userId}`;

export function readPlusPersonalization(userId: string): PlusPersonalization {
  try {
    const value = localStorage.getItem(storageKey(userId));
    if (!value) return DEFAULT_PLUS_PERSONALIZATION;
    const parsed = JSON.parse(value) as Partial<PlusPersonalization>;
    return {
      ambient: ['AURORA', 'STARDUST', 'CIRCUIT', 'EMBER', 'PRISM', 'NEON_GRID', 'DEEP_SPACE', 'SOLAR_FLARE', 'PETALS', 'ELECTRIC'].includes(parsed.ambient ?? '')
        ? parsed.ambient as AmbientEffect
        : 'OFF',
      cursor: ['HALO', 'GLOW', 'ORBIT', 'SPARK', 'TRAIL', 'DIAMOND', 'PULSE', 'CONSTELLATION', 'CROSSHAIR', 'COMET'].includes(parsed.cursor ?? '')
        ? parsed.cursor as CustomCursor
        : 'OFF',
    };
  } catch {
    return DEFAULT_PLUS_PERSONALIZATION;
  }
}

export function savePlusPersonalization(userId: string, settings: PlusPersonalization) {
  localStorage.setItem(storageKey(userId), JSON.stringify(settings));
  window.dispatchEvent(new Event(eventName));
}

export function onPlusPersonalizationChange(listener: () => void) {
  window.addEventListener(eventName, listener);
  return () => window.removeEventListener(eventName, listener);
}
