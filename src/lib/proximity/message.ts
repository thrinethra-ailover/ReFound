export interface ProximityAlertMessage {
  title: string;
  body: string;
}

/**
 * Builds the anonymized "keep an eye out" alert copy. Deliberately takes
 * only a category — never a title, description, reporter name, or exact
 * location — so it is structurally impossible for this function to leak
 * anything beyond the item's general kind.
 */
export function buildProximityAlertMessage(category: string): ProximityAlertMessage {
  return {
    title: '\uD83D\uDD0E Keep an eye out!',
    body: `A student recently reported a ${category} item lost around this area. If you spot something matching the description, you can report it.`,
  };
}
