/**
 * The getting-started shopping guide.
 *
 * A short, hand-picked list for someone who has no machine yet, not a catalogue
 * of everything worth buying. Prices are rounded US street prices, checked by
 * hand on RECOMMENDATIONS_AS_OF; they drift, so the UI always shows them as
 * approximate and dated. The `why` lines state what a thing is, not how good it
 * is -- no ratings, no endorsements, no links to a shop.
 *
 * Grinders point at their BUILT_IN_GRINDERS entry, so "I have this" can put the
 * real spec on the bench. Machines other than the ES1 have no spec of their own
 * and go on the bench as the generic machine under their own name.
 */

export type RecommendationKind = 'machine' | 'grinder';
export type PriceTier = '$' | '$$' | '$$$';

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  brand: string;
  model: string;
  /** Approximate US street price, rounded. */
  priceUsd: number;
  /** One factual line: what it is and what it does. */
  why: string;
  /** The built-in machine or grinder spec this maps onto, if there is one. */
  builtInId?: string;
  /** Grinder ids from this list that suit a machine at a similar spend. */
  pairsWith?: string[];
}

/** Month the prices below were last checked. */
export const RECOMMENDATIONS_AS_OF = '2026-10';

export const RECOMMENDED_MACHINES: Recommendation[] = [
  {
    id: 'gaggia-classic-pro',
    kind: 'machine',
    brand: 'Gaggia',
    model: 'Classic Pro',
    priceUsd: 450,
    why: 'Single boiler with a commercial-size 58 mm portafilter. Simple, repairable, widely modded.',
    builtInId: 'generic-espresso',
    pairsWith: ['kingrinder-k6', 'baratza-encore-esp'],
  },
  {
    id: 'breville-bambino-plus',
    kind: 'machine',
    brand: 'Breville',
    model: 'Bambino Plus',
    priceUsd: 500,
    why: 'Heats up in seconds and steams milk automatically. Small footprint, 54 mm portafilter.',
    builtInId: 'generic-espresso',
    pairsWith: ['timemore-c3-esp', 'baratza-encore-esp'],
  },
  {
    id: 'breville-barista-express',
    kind: 'machine',
    brand: 'Breville',
    model: 'Barista Express',
    priceUsd: 700,
    why: 'Machine and grinder in one body, so there is nothing else to buy to get started.',
    builtInId: 'generic-espresso',
  },
  {
    id: 'profitec-go',
    kind: 'machine',
    brand: 'Profitec',
    model: 'Go',
    priceUsd: 750,
    why: 'Single boiler with a PID for steady brew temperature, and a 58 mm portafilter.',
    builtInId: 'generic-espresso',
    pairsWith: ['1zpresso-j-ultra', 'df64'],
  },
  {
    id: 'rancilio-silvia',
    kind: 'machine',
    brand: 'Rancilio',
    model: 'Silvia',
    priceUsd: 900,
    why: 'Heavy, long-lived single boiler built from commercial parts. Temperature takes some learning.',
    builtInId: 'generic-espresso',
    pairsWith: ['df64', 'niche-zero'],
  },
  {
    id: 'fellow-es1',
    kind: 'machine',
    brand: 'Fellow',
    model: 'Espresso Series 1',
    priceUsd: 1500,
    why: 'Runs pressure profiles you can build in this app and send to the machine.',
    builtInId: 'fellow-es1',
    pairsWith: ['fellow-opus-2', 'niche-zero'],
  },
  {
    id: 'lelit-bianca',
    kind: 'machine',
    brand: 'Lelit',
    model: 'Bianca',
    priceUsd: 3000,
    why: 'Dual boiler with a manual flow-control paddle. Brew and steam at the same time.',
    builtInId: 'generic-espresso',
    pairsWith: ['niche-zero', 'df64'],
  },
];

export const RECOMMENDED_GRINDERS: Recommendation[] = [
  {
    id: 'timemore-c3-esp',
    kind: 'grinder',
    brand: 'Timemore',
    model: 'C3 ESP',
    priceUsd: 90,
    why: 'Hand grinder with an espresso-range dial. The cheapest way to grind fine enough.',
    builtInId: 'timemore-c3-esp',
  },
  {
    id: 'kingrinder-k6',
    kind: 'grinder',
    brand: 'Kingrinder',
    model: 'K6',
    priceUsd: 100,
    why: 'Hand grinder with fine external adjustment, easy to step one notch at a time.',
    builtInId: 'kingrinder-k6',
  },
  {
    id: '1zpresso-j-ultra',
    kind: 'grinder',
    brand: '1Zpresso',
    model: 'J-Ultra',
    priceUsd: 190,
    why: 'Hand grinder built for espresso, with very small steps between settings.',
    builtInId: '1zpresso-j-ultra',
  },
  {
    id: 'baratza-encore-esp',
    kind: 'grinder',
    brand: 'Baratza',
    model: 'Encore ESP',
    priceUsd: 200,
    why: 'Electric, with a dedicated espresso range on the dial. No arm workout.',
    builtInId: 'baratza-encore-esp',
  },
  {
    id: 'fellow-opus-2',
    kind: 'grinder',
    brand: 'Fellow',
    model: 'Opus 2',
    priceUsd: 250,
    why: 'Electric conical grinder that covers espresso through to filter on one stepless dial.',
    builtInId: 'fellow-opus-2',
  },
  {
    id: 'df64',
    kind: 'grinder',
    brand: 'DF64',
    model: 'Gen 2',
    priceUsd: 400,
    why: 'Electric single-dose grinder with 64 mm flat burrs and stepless adjustment.',
    builtInId: 'df64',
  },
  {
    id: 'niche-zero',
    kind: 'grinder',
    brand: 'Niche',
    model: 'Zero',
    priceUsd: 700,
    why: 'Electric single-dose grinder with 63 mm conical burrs and almost nothing left behind.',
    builtInId: 'niche-zero',
  },
];

export const RECOMMENDATIONS_BY_ID: Record<string, Recommendation> = Object.fromEntries(
  [...RECOMMENDED_MACHINES, ...RECOMMENDED_GRINDERS].map((r) => [r.id, r]),
);

/**
 * A rough spend band. Machines and grinders cost different amounts, so each has
 * its own thresholds: a $400 grinder is not entry-level just because a $400
 * machine would be.
 */
export function priceTier(r: Pick<Recommendation, 'kind' | 'priceUsd'>): PriceTier {
  const [mid, high] = r.kind === 'machine' ? [600, 1200] : [150, 400];
  if (r.priceUsd < mid) return '$';
  if (r.priceUsd < high) return '$$';
  return '$$$';
}

/** A sorted copy. Ties keep their original order, so the list never shuffles. */
export function sortByPrice<T extends { priceUsd: number }>(list: readonly T[], dir: 'asc' | 'desc'): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => sign * (a.item.priceUsd - b.item.priceUsd) || a.i - b.i)
    .map(({ item }) => item);
}
