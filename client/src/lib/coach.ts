import type { Suggestion } from '@brewlab/shared';

/**
 * The coach's answer in a barista's voice: one instruction you could say across
 * the counter. The shared suggestion keeps its own headline for logs and tests;
 * this only rewrites how the app says it, never what it says.
 */
export function baristaLine(s: Suggestion): string {
  const steps = `${s.steps} step${s.steps === 1 ? '' : 's'}`;
  // The ratio targets live in the shared headline ("try 1:2.4"); keep them.
  const ratio = s.headline.match(/1:\d+(\.\d+)?/)?.[0];
  switch (s.direction) {
    case 'finer':
      return `Grind ${steps} finer`;
    case 'coarser':
      return `Grind ${steps} coarser`;
    case 'more-yield':
      return ratio ? `Let it run to ${ratio}` : 'Let it run a little longer';
    case 'less-yield':
      return ratio ? `Stop it at ${ratio}` : 'Stop it a little sooner';
    case 'hold':
      return s.confidence === 'low' ? 'Keep it, and taste the next one' : 'Keep this grind';
  }
}

export const CONFIDENCE_LABEL: Record<Suggestion['confidence'], string> = {
  high: 'Confident',
  medium: 'Fairly sure',
  low: 'A guess until you taste it',
};
