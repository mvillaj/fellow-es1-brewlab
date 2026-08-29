/**
 * Shapes for the two model-backed features.
 *
 * These are deliberately *not* the storage schemas. `coffeeInputSchema` and
 * `es1ProfileSchema` carry defaults, unions, refinements and `.strict()`, none of
 * which express cleanly as JSON Schema. So generation is shaped by the simple
 * schemas below, and the result is then validated by the real ones before it is
 * allowed anywhere near the database or the machine.
 *
 * That two-step is the safety property worth keeping: a model that invents a
 * 15-bar stage or a 300-second shot fails `es1ProfileSchema` and never reaches
 * the editor, let alone the ES1.
 */

import { z } from 'zod';
import type { Es1Profile } from './es1.ts';
import { fToC } from './temp.ts';

export const PROCESS_VALUES = [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'experimental',
  'other',
] as const;

export const ROAST_VALUES = ['light', 'medium-light', 'medium', 'medium-dark', 'dark'] as const;

/** What we can usually read off a roaster's bag copy. Everything but the two
 *  headline fields is nullable, because plenty of bags simply don't say. */
export const coffeeExtractionSchema = z.object({
  name: z.string(),
  roaster: z.string(),
  origin: z.string().nullable(),
  region: z.string().nullable(),
  producer: z.string().nullable(),
  varietal: z.string().nullable(),
  process: z.enum(PROCESS_VALUES).nullable(),
  roastLevel: z.enum(ROAST_VALUES).nullable(),
  altitudeMasl: z.number().nullable(),
  tastingNotes: z.array(z.string()),
  /** Fields the text did not cover, so the UI can say so rather than imply certainty. */
  notFound: z.array(z.string()),
  /**
   * Fields filled from world knowledge rather than the text -- resolving "San
   * Adolfo" to Colombia, say. Useful, but the user is told which fields those
   * were so they can check rather than discover it later.
   */
  derived: z.array(z.string()),
});

export type CoffeeExtraction = z.infer<typeof coffeeExtractionSchema>;

/** A generated shot, before ids are attached and the real schema validates it. */
export const profileSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  doseG: z.number(),
  ratio: z.number(),
  /**
   * Whole degrees Fahrenheit, because that is what the machine displays and what
   * the rest of the app shows. Converted to the Celsius the schema and the wire
   * format expect in `suggestionToProfile`.
   */
  brewTempF: z.number(),
  stages: z
    .array(
      z.object({
        kind: z.enum(['preinfusion', 'infusion', 'rampdown']),
        label: z.string(),
        durationS: z.number(),
        pressureBar: z.number(),
        endPressureBar: z.number(),
        flowLimitMlS: z.number(),
      }),
    )
    .min(1)
    .max(12),
  /** Why this shape, in the user's terms. Shown above the curve. */
  rationale: z.string(),
});

export type ProfileSuggestion = z.infer<typeof profileSuggestionSchema>;

export interface AiStatus {
  enabled: boolean;
  /** Shown next to the disabled controls so the reason is never a mystery. */
  reason?: string;
}

/**
 * Turn a generated suggestion into a real profile. Kept pure and here rather than
 * in the route so the safety property -- that an out-of-limits generation is
 * caught by `es1ProfileSchema` and never reaches the editor -- is testable
 * without a model or an API key.
 */
export function suggestionToProfile(s: ProfileSuggestion, stageId: (i: number) => string): Es1Profile {
  return {
    id: 'suggested',
    name: s.name,
    description: s.description,
    doseG: s.doseG,
    ratio: s.ratio,
    // The one conversion. A whole degree F rarely lands on a clean degree C,
    // which is exactly what real captured profiles look like (93.88, not 94).
    brewTempC: fToC(s.brewTempF),
    stages: s.stages.map((st, i) => ({ ...st, id: stageId(i) })),
  };
}

/**
 * Is the pasted box a bare link rather than copy? Shared because the server needs
 * it to decide whether to fetch a page, and the form needs it to know whether the
 * paste doubles as the coffee's Link.
 */
export function asUrl(input: string): string | null {
  const trimmed = input.trim();
  if (/\s/.test(trimmed)) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    new URL(trimmed);
    return trimmed;
  } catch {
    return null;
  }
}
