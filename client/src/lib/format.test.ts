import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysOffRoast, fmt, ratio, relativeDate, tempF } from './format';

describe('fmt', () => {
  it('renders a dash for missing values', () => {
    expect(fmt(null)).toBe('—');
    expect(fmt(undefined)).toBe('—');
  });

  it('drops a trailing .0 but keeps real decimals', () => {
    expect(fmt(18)).toBe('18');
    expect(fmt(18.04)).toBe('18');
    expect(fmt(18.25, 2)).toBe('18.25');
    expect(fmt(36.6)).toBe('36.6');
  });

  it('keeps zero rather than treating it as missing', () => {
    expect(fmt(0)).toBe('0');
  });
});

describe('ratio', () => {
  it('formats yield over dose to one decimal', () => {
    expect(ratio(18, 36)).toBe('1:2.0');
    expect(ratio(18, 40.5)).toBe('1:2.3');
  });
});

describe('tempF', () => {
  it('converts stored Celsius to a whole Fahrenheit label', () => {
    expect(tempF(93)).toBe('199 °F');
    expect(tempF(100)).toBe('212 °F');
  });

  it('renders a dash for missing values', () => {
    expect(tempF(null)).toBe('—');
  });
});

describe('dates', () => {
  // Pin "now" so day boundaries do not depend on when the suite runs.
  const NOW = new Date('2026-10-04T15:00:00');
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

  it('relativeDate shows the time for today', () => {
    expect(relativeDate(hoursAgo(2))).toMatch(/^Today, /);
  });

  it('relativeDate says Yesterday, then counts days, then shows a date', () => {
    expect(relativeDate(hoursAgo(24))).toBe('Yesterday');
    expect(relativeDate(hoursAgo(24 * 3))).toBe('3 days ago');
    expect(relativeDate(hoursAgo(24 * 10))).not.toMatch(/ago|Today|Yesterday/);
  });

  it('daysOffRoast counts whole days and handles a missing date', () => {
    expect(daysOffRoast(null)).toBeNull();
    expect(daysOffRoast(hoursAgo(24 * 12 + 5))).toBe(12);
  });
});
