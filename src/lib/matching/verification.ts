// Pure helpers for blind ownership verification comparisons.
// The authoritative comparison happens server-side inside a SECURITY DEFINER
// Postgres function (see supabase/migrations/0002_matching.sql) so a
// claimant's guess is never exposed to anyone but the check itself. This
// module mirrors that exact normalization/comparison logic so it can be
// unit-tested and kept in sync with the SQL implementation.
import { OPEN_ENGLISH_WORDNET_SYNSETS } from './openEnglishWordnetSynsets';
export { summarizeVerification } from './verificationSummary';
export type { VerificationAttempt, VerificationSummary } from './verificationSummary';

// Grammar and sentence framing should not make an otherwise correct detail
// fail verification. Keep descriptive words (including directions and colors),
// while removing common function words and sorting the remaining tokens.
const GRAMMAR_WORDS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'it', 'its',
  's', 're', 've', 'll', 'd', 'm',
  'there', 'here', 'who', 'what', 'which',
  'mine', 'yours', 'some', 'any', 'more', 'most', 'like', 'kind', 'sort', 'type', 'bit', 'piece', 'part', 'got',
  'am', 'is', 'are', 'was', 'were', 'be', 'being', 'been',
  'have', 'has', 'had', 'do', 'does', 'did',
  'can', 'could', 'would', 'should', 'will', 'may', 'might', 'must',
  'and', 'or', 'but', 'if', 'then', 'as', 'than',
  'on', 'in', 'at', 'to', 'of', 'with', 'by', 'for', 'from', 'into', 'onto',
  'near', 'about', 'around', 'through',
  'found', 'noticed', 'see', 'saw',
  'because', 'while', 'when', 'also', 'just', 'really', 'very', 'only', 'please',
  'think', 'thought', 'believe', 'seem', 'seems', 'seemed', 'look', 'looks', 'looked',
  'maybe', 'probably', 'item', 'object', 'something',
]);

const CONTRADICTIONS = [
  ['red', 'blue'], ['black', 'white'], ['green', 'red'], ['yellow', 'purple'],
  ['orange', 'blue'], ['pink', 'brown'], ['silver', 'gold'],
  ['left', 'right'], ['upper', 'lower'], ['top', 'bottom'], ['front', 'back'], ['inside', 'outside'],
  ['upper', 'lower'], ['north', 'south'], ['east', 'west'],
  ['small', 'large'], ['small', 'big'], ['new', 'old'],
];

/** Canonicalizes an answer to its distinctive words, ignoring grammar/framing. */
export function normalizeAttributeValue(value: string): string {
  const variants: Record<string, string> = {
    decal: 'sticker', decals: 'sticker', stickers: 'sticker',
    zip: 'zipper', zips: 'zipper', zippers: 'zipper',
    rucksack: 'backpack', rucksacks: 'backpack', backpacks: 'backpack',
    scratches: 'scratch', scratched: 'scratch', scratching: 'scratch',
    scuff: 'scratch', scuffs: 'scratch', scuffed: 'scratch', scuffing: 'scratch',
    dents: 'dent', dented: 'dent',
    marks: 'mark', marked: 'mark',
    stars: 'star', corners: 'corner', pockets: 'pocket',
    straps: 'strap', buttons: 'button', keys: 'key',
    cracks: 'crack', cracked: 'crack', cracking: 'crack',
    tears: 'tear', tore: 'tear', torn: 'tear',
    stains: 'stain', stained: 'stain', staining: 'stain',
    folds: 'fold', folded: 'fold', folding: 'fold',
    stripes: 'stripe', labels: 'label', colours: 'color', colour: 'color', grey: 'gray',
    centres: 'center', centre: 'center',
    little: 'small', tiny: 'small', big: 'large', huge: 'large',
    top: 'upper', uppermost: 'upper', bottom: 'lower', lower: 'lower', lowermost: 'lower',
    crimson: 'red', scarlet: 'red', navy: 'blue',
    cannot: 'not',
    knapsack: 'backpack',
    scrape: 'scratch',
    ding: 'dent', blemish: 'mark',
    maroon: 'red', azure: 'blue', miniature: 'small', giant: 'large',
    glass: 'glasses', spectacle: 'glasses', spectacles: 'glasses', eyeglass: 'glasses', eyeglasses: 'glasses',
    handbag: 'bag', purse: 'bag', tote: 'bag',
    cellphone: 'phone', mobile: 'phone', smartphone: 'phone',
    sneaker: 'shoe', sneakers: 'shoe', trainer: 'shoe', trainers: 'shoe',
    sweatshirt: 'hoodie', jumper: 'sweater', flask: 'bottle', thermos: 'bottle',
    soiled: 'dirty', filthy: 'dirty', spot: 'stain',
    abrasion: 'scratch', scratchmark: 'scratch', smudge: 'stain', streak: 'mark',
    notch: 'chip', nick: 'chip', chip: 'chip', fracture: 'crack', rip: 'tear',
    discoloration: 'stain', discolouration: 'stain', crease: 'crease', fold: 'crease',
    satchel: 'bag', billfold: 'wallet', handset: 'phone', footwear: 'shoe',
    canteen: 'bottle', notepad: 'notebook', journal: 'notebook', exercisebook: 'notebook',
    markerpen: 'marker', highlighterpen: 'highlighter', pullover: 'sweater',
    coat: 'jacket', parka: 'jacket', windbreaker: 'jacket', tee: 'shirt', tshirt: 'shirt',
    earphone: 'earbud', earbuds: 'earbud', headphones: 'headphone', keyring: 'keychain', keyfob: 'keychain',
    beneath: 'under', underneath: 'under', below: 'under', above: 'over',
    rear: 'back', backside: 'back', reverse: 'back', opposite: 'back',
    rim: 'edge', border: 'edge', outline: 'edge', middle: 'center', central: 'center',
    circular: 'round', rounded: 'round', rectangular: 'rectangle',
    compact: 'small', enormous: 'large', slim: 'thin', skinny: 'thin', narrow: 'thin',
    thick: 'wide', broad: 'wide', shiny: 'glossy', lustrous: 'glossy', matte: 'dull', matt: 'dull',
    wornout: 'worn', weathered: 'worn', charcoal: 'gray', burgundy: 'red',
    turquoise: 'teal', violet: 'purple', lilac: 'purple', lavender: 'purple',
    tan: 'brown', beige: 'brown', cream: 'white', ivory: 'white',
    leathery: 'leather', jean: 'denim', metallic: 'metal', steel: 'metal',
    aluminium: 'metal', aluminum: 'metal', cloth: 'fabric', wooden: 'wood',
  };

  const stem = (word: string): string => {
    if (/^[a-z]{5,}ies$/u.test(word)) return word.replace(/ies$/u, 'y');
    if (/^[a-z]{5,}(?:sses|xes|ches|shes)$/u.test(word)) return word.replace(/es$/u, '');
    if (/^[a-z]{5,}s$/u.test(word) && !/(?:ss|us|is)$/u.test(word)) return word.slice(0, -1);
    if (/^[a-z]{6,}ing$/u.test(word)) {
      const base = word.replace(/ing$/u, '');
      return /(.)\1$/u.test(base) ? base.slice(0, -1) : base;
    }
    if (/^[a-z]{5,}ed$/u.test(word)) {
      const base = word.replace(/ed$/u, '');
      return /(.)\1$/u.test(base) ? base.slice(0, -1) : base;
    }
    return word;
  };

  const tokens = value
    .toLowerCase()
    .replace(/\bcell\s+phone\b/gu, 'cellphone')
    .replace(/\bt\s+shirt\b/gu, 'tshirt')
    .replace(/\bworn\s+out\b/gu, 'wornout')
    .replace(/\bkey\s+chain\b/gu, 'keychain')
    .replace(/\b(?:isn|aren|wasn|weren|don|doesn|didn|couldn|wouldn|shouldn|hasn|haven|hadn|mustn|can|won|shan|ain)(?:'|’)t\b/gu, ' not ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word && !GRAMMAR_WORDS.has(word))
    .map(stem)
    .map((word) => variants[word] ?? word);

  return [...new Set(tokens)].sort().join(' ');
}

/** True if two attribute values should be considered a verification match. */
export function attributeValuesMatch(claimed: string, actual: string): boolean {
  const claimedTokens = normalizeAttributeValue(claimed).split(' ').filter(Boolean);
  const actualTokens = normalizeAttributeValue(actual).split(' ').filter(Boolean);
  if (claimedTokens.length === 0 || actualTokens.length === 0) return false;

  const claimedSet = new Set(claimedTokens);
  const actualSet = new Set(actualTokens);
  const exact = claimedTokens.length === actualTokens.length
    && claimedTokens.every((token) => actualSet.has(token));
  if (exact) return true;

  if (CONTRADICTIONS.some(([a, b]) => (claimedSet.has(a) && actualSet.has(b)) || (claimedSet.has(b) && actualSet.has(a)))) {
    return false;
  }

  const actualUsed = new Array(actualTokens.length).fill(false) as boolean[];
  const claimedMatched = new Array(claimedTokens.length).fill(false) as boolean[];
  let shared = 0;

  // Reserve literal matches first, then pair remaining tokens only when the
  // Open English Wordnet places them in at least one shared synonym synset.
  for (let i = 0; i < claimedTokens.length; i += 1) {
    const j = actualTokens.findIndex((token, index) => !actualUsed[index] && token === claimedTokens[i]);
    if (j >= 0) {
      actualUsed[j] = true;
      claimedMatched[i] = true;
      shared += 1;
    }
  }

  for (let i = 0; i < claimedTokens.length; i += 1) {
    if (claimedMatched[i]) continue;
    const claimedSynsets = OPEN_ENGLISH_WORDNET_SYNSETS[claimedTokens[i]];
    if (!claimedSynsets?.length) continue;
    const claimedSynsetSet = new Set(claimedSynsets);
    const j = actualTokens.findIndex((token, index) => {
      if (actualUsed[index]) return false;
      return OPEN_ENGLISH_WORDNET_SYNSETS[token]?.some((synset) => claimedSynsetSet.has(synset)) ?? false;
    });
    if (j >= 0) {
      actualUsed[j] = true;
      claimedMatched[i] = true;
      shared += 1;
    }
  }

  if (claimedTokens.length === actualTokens.length && shared === claimedTokens.length) return true;

  // Keep at least two distinctive words in common, but allow a paraphrase to
  // omit or add a word as long as most of the longer description still agrees.
  return claimedTokens.length > 1 && actualTokens.length > 1
    && claimedSet.size > 1 && actualSet.size > 1
    && shared
      / Math.max(claimedSet.size, actualSet.size) >= 2 / 3;
}

