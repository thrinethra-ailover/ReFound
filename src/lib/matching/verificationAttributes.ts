export const ID_CARD_PRESENCE_ATTRIBUTE_KEY = 'ID card (or equivalent)';
export const ID_CARD_PRESENT_VALUE = 'present';
export const ID_CARD_ABSENT_VALUE = 'absent';

export function isIdCardPresenceAttribute(key: string) {
  return key.trim().toLowerCase() === ID_CARD_PRESENCE_ATTRIBUTE_KEY.toLowerCase();
}
