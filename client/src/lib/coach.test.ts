import type { Suggestion } from '@brewlab/shared';
import { describe, expect, it } from 'vitest';
import { baristaLine } from './coach';

const suggestion = (over: Partial<Suggestion>): Suggestion => ({
  direction: 'hold',
  steps: 0,
  headline: '',
  reason: '',
  confidence: 'medium',
  ...over,
});

describe('baristaLine', () => {
  it('pluralises grind steps', () => {
    expect(baristaLine(suggestion({ direction: 'finer', steps: 1 }))).toBe('Grind 1 step finer');
    expect(baristaLine(suggestion({ direction: 'coarser', steps: 3 }))).toBe('Grind 3 steps coarser');
  });

  it('carries the ratio target over from the shared headline', () => {
    const s = suggestion({ direction: 'more-yield', headline: 'Pull longer — try 1:2.4' });
    expect(baristaLine(s)).toBe('Let it run to 1:2.4');
    expect(baristaLine({ ...s, direction: 'less-yield' })).toBe('Stop it at 1:2.4');
  });

  it('falls back to plain words when the headline has no ratio', () => {
    expect(baristaLine(suggestion({ direction: 'more-yield' }))).toBe('Let it run a little longer');
    expect(baristaLine(suggestion({ direction: 'less-yield' }))).toBe('Stop it a little sooner');
  });

  it('hedges a hold when confidence is low', () => {
    expect(baristaLine(suggestion({ confidence: 'high' }))).toBe('Keep this grind');
    expect(baristaLine(suggestion({ confidence: 'low' }))).toBe('Keep it, and taste the next one');
  });
});
