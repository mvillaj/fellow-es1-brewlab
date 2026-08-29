export const fmt = (n: number | null | undefined, digits = 1) =>
  n == null ? '—' : Number(n).toFixed(digits).replace(/\.0$/, '');

export const ratio = (dose: number, out: number) => `1:${(out / dose).toFixed(1)}`;

// Storage stays Celsius and only the edges convert — see the note in
// packages/shared/src/temp.ts. Re-exported so the server can convert too.
import { roundF } from '@brewlab/shared';

export { cToF, fToC, roundF } from '@brewlab/shared';

export const tempF = (c: number | null | undefined) => (c == null ? '—' : `${roundF(c)} °F`);

export function relativeDate(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86400_000);
  if (days === 0) return `Today, ${then.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function daysOffRoast(roastDate: string | null): number | null {
  if (!roastDate) return null;
  return Math.floor((Date.now() - new Date(roastDate).getTime()) / 86400_000);
}

export const TASTE_LABELS: Record<number, string> = {
  [-2]: 'Sour / sharp',
  [-1]: 'Leaning sour',
  0: 'Balanced',
  1: 'Leaning bitter',
  2: 'Bitter / drying',
};

export const ROAST_LEVELS = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const;
export const PROCESSES = ['washed', 'natural', 'honey', 'anaerobic', 'experimental', 'other'] as const;
