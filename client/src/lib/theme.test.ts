import { afterEach, describe, expect, it } from 'vitest';
import { storedPref } from './theme';

describe('storedPref', () => {
  afterEach(() => localStorage.clear());

  it('gives a first-time visitor light', () => {
    expect(storedPref()).toBe('light');
  });

  it('keeps a choice once made, including auto', () => {
    for (const pref of ['light', 'dark', 'auto'] as const) {
      localStorage.setItem('brewlab.theme', pref);
      expect(storedPref()).toBe(pref);
    }
  });

  it('treats an unknown value as no choice', () => {
    localStorage.setItem('brewlab.theme', 'sepia');
    expect(storedPref()).toBe('light');
  });
});
