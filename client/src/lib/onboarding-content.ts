/**
 * The words on the getting-started page, kept apart from its layout so the copy
 * can be edited (and tested) without touching a component. The numbers match
 * what the rest of the app assumes: an 18 g dose, a 1:2 ratio, and the dial-in
 * coach's 28 s target.
 */

export const STARTER = { doseG: 18, yieldG: 36, timeS: 28 } as const;

export interface Lesson {
  id: string;
  title: string;
  body: string;
  /** Short facts shown as tags under the body. */
  facts?: string[];
}

export const BASICS: Lesson[] = [
  {
    id: 'recipe',
    title: 'A shot is three numbers',
    body:
      'Dose is the dry coffee in the basket. Yield is the liquid espresso in the cup. Time is how long the pump runs. ' +
      'Weigh both dose and yield on a scale: volume lies, because crema is mostly air.',
    facts: [`${STARTER.doseG} g in`, `${STARTER.yieldG} g out`, '1:2 ratio'],
  },
  {
    id: 'time',
    title: 'Aim for 25 to 30 seconds',
    body:
      'With a 1:2 ratio, most coffees taste best when the shot takes about 25 to 30 seconds. ' +
      'Grind size controls the time: finer grounds slow the water down, coarser grounds let it rush through.',
    facts: ['finer = slower', 'coarser = faster'],
  },
  {
    id: 'taste',
    title: 'Let taste steer',
    body:
      'Sour, sharp or thin means the water did not pull enough out: grind finer. ' +
      'Bitter, dry or harsh means it pulled too much: grind coarser. ' +
      'Change one thing at a time, so you know which change did it.',
    facts: ['sour → finer', 'bitter → coarser', 'one change per shot'],
  },
  {
    id: 'prep',
    title: 'Even puck, even shot',
    body:
      'Water takes the easiest path. Break up clumps with a needle tool (WDT), level the bed, then tamp flat and firm. ' +
      'How hard matters less than how level.',
    facts: ['WDT', 'level', 'tamp flat'],
  },
];

export interface WalkthroughStep {
  title: string;
  body: string;
}

export const FIRST_SHOT: WalkthroughStep[] = [
  {
    title: 'Heat up',
    body: 'Turn the machine on with the portafilter locked in, so it warms too. Give it the time its manual asks for.',
  },
  {
    title: `Weigh ${STARTER.doseG} g of beans`,
    body: 'If your basket is a different size, use what it is rated for and keep the ratio at 1:2.',
  },
  {
    title: 'Grind fine',
    body: 'Start in the espresso range your grinder lists. Finer than table salt, a bit coarser than flour.',
  },
  {
    title: 'Prep the puck',
    body: 'Stir out clumps, level the bed, tamp flat. Wipe loose grounds off the rim before locking in.',
  },
  {
    title: 'Pull',
    body: `Put the cup on the scale, zero it, and start the shot and a timer together. Stop at about ${STARTER.yieldG} g.`,
  },
  {
    title: 'Taste and write it down',
    body: 'Note the time and how it tasted. The coach uses both to tell you the one thing to change next.',
  },
];

export const NO_GRINDER_NOTE =
  'Pre-ground coffee goes stale within days and is usually ground for filter, which runs through too fast for ' +
  'espresso. It will get you a first shot, but a grinder is the upgrade that matters most.';
