import { describe, expect, it } from 'vitest';
import { STOCK_PROFILES } from '@brewlab/shared';
import { pressureEaser, smoothPressurePoints } from './curve';

const arc = STOCK_PROFILES.find((p) => p.name === 'Modern Arc')!;

describe('pressureEaser', () => {
  const at = pressureEaser(arc);

  it('starts from 0 bar and settles on each stage', () => {
    expect(at(0)).toBe(0);
    expect(at(5)).toBeCloseTo(3);
    expect(at(20)).toBeCloseTo(9);
    expect(at(35)).toBeCloseTo(6);
  });

  it('never overshoots the profile', () => {
    for (const profile of STOCK_PROFILES) {
      const max = Math.max(...profile.stages.flatMap((s) => [s.pressureBar, s.endPressureBar]));
      for (const p of smoothPressurePoints(profile)) {
        expect(p.bar).toBeGreaterThanOrEqual(0);
        expect(p.bar).toBeLessThanOrEqual(max + 1e-9);
      }
    }
  });

  it('has no steps between samples', () => {
    for (const profile of STOCK_PROFILES) {
      const pts = smoothPressurePoints(profile, 2000);
      for (let i = 1; i < pts.length; i++) {
        expect(Math.abs(pts[i].bar - pts[i - 1].bar)).toBeLessThan(0.25);
      }
    }
  });

  it('copes with an empty profile', () => {
    expect(pressureEaser({ stages: [] })(3)).toBe(0);
  });
});
