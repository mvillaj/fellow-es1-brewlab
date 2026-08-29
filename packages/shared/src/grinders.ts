/**
 * Grinder registry + grind-size normalisation.
 *
 * Every grinder speaks its own dialect: clicks, numbers, dial marks, rotations.
 * To compare a shot ground on an Opus with one ground on a J-Ultra we translate
 * every native setting into an *approximate* particle size in microns, using an
 * affine model:
 *
 *     microns = interceptUm + setting * umPerUnit
 *
 * The published numbers below are community estimates, not lab measurements.
 * They are good enough to land you in the right neighbourhood when switching
 * grinders; they are not good enough to be treated as truth. Every user grinder
 * can carry a two-point calibration that overrides the defaults — see
 * `calibrateFromTwoPoints`.
 */

export type BurrType = 'conical' | 'flat' | 'ghost' | 'unknown';
export type CalibrationSource = 'measured' | 'community' | 'estimated';

export interface GrinderScale {
  /** How the dial behaves in the user's hands. */
  kind: 'clicks' | 'stepped' | 'stepless';
  min: number;
  max: number;
  /** Smallest increment the user can actually select. */
  step: number;
  /** Shown next to the number in the UI: "clicks", "marks", "1.4" etc. */
  unitLabel: string;
}

export interface GrinderCalibration {
  umPerUnit: number;
  interceptUm: number;
  source: CalibrationSource;
}

export interface GrinderSpec {
  id: string;
  brand: string;
  model: string;
  burrType: BurrType;
  burrSizeMm?: number;
  handPowered: boolean;
  scale: GrinderScale;
  calibration: GrinderCalibration;
  /** Typical espresso window expressed in the grinder's own units. */
  espressoRange?: [number, number];
  notes?: string;
}

export const BUILT_IN_GRINDERS: GrinderSpec[] = [
  {
    id: 'fellow-opus',
    brand: 'Fellow',
    model: 'Opus',
    burrType: 'conical',
    burrSizeMm: 40,
    handPowered: false,
    scale: { kind: 'clicks', min: 1, max: 41, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 30, interceptUm: 170, source: 'community' },
    espressoRange: [1, 8],
    notes:
      'Settings 1-11 are the "espresso" micro range on the inner dial. Retention is real — single-dose and give it a bang.',
  },
  {
    id: 'fellow-opus-2',
    brand: 'Fellow',
    model: 'Opus 2',
    burrType: 'conical',
    burrSizeMm: 40,
    handPowered: false,
    scale: { kind: 'clicks', min: 1, max: 41, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 28, interceptUm: 150, source: 'estimated' },
    espressoRange: [1, 9],
    notes:
      'Same 41-step dial as the original Opus, tightened burr alignment. Calibration here is an estimate — worth dialling in with the two-point calibrator.',
  },
  {
    id: 'fellow-ode-2',
    brand: 'Fellow',
    model: 'Ode Gen 2',
    burrType: 'flat',
    burrSizeMm: 64,
    handPowered: false,
    scale: { kind: 'stepped', min: 1, max: 11, step: 0.1, unitLabel: 'marks' },
    calibration: { umPerUnit: 95, interceptUm: 155, source: 'community' },
    espressoRange: [1, 2.5],
    notes:
      'Brew-focused grinder: it will pull espresso at the very bottom of the range but it is not its job.',
  },
  {
    id: 'df64',
    brand: 'DF',
    model: 'DF64 / DF64 Gen 2',
    burrType: 'flat',
    burrSizeMm: 64,
    handPowered: false,
    scale: { kind: 'stepless', min: 0, max: 10, step: 0.1, unitLabel: 'turns' },
    calibration: { umPerUnit: 100, interceptUm: 120, source: 'community' },
    espressoRange: [0.8, 2.4],
    notes: 'Stepless collar measured in rotations from zero point. Zero it after any burr swap.',
  },
  {
    id: 'niche-zero',
    brand: 'Niche',
    model: 'Zero',
    burrType: 'conical',
    burrSizeMm: 63,
    handPowered: false,
    scale: { kind: 'stepless', min: 0, max: 50, step: 0.5, unitLabel: 'numbers' },
    calibration: { umPerUnit: 15, interceptUm: 80, source: 'community' },
    espressoRange: [10, 25],
    notes: 'Single-dose, effectively zero retention. Most people live between 12 and 20 for espresso.',
  },
  {
    id: 'eureka-specialita',
    brand: 'Eureka',
    model: 'Mignon Specialita',
    burrType: 'flat',
    burrSizeMm: 55,
    handPowered: false,
    scale: { kind: 'stepless', min: 0, max: 90, step: 1, unitLabel: 'marks' },
    calibration: { umPerUnit: 6.5, interceptUm: 140, source: 'estimated' },
    espressoRange: [10, 45],
    notes: 'Worm-gear micrometric adjustment — very fine control, no detents.',
  },
  {
    id: 'baratza-encore-esp',
    brand: 'Baratza',
    model: 'Encore ESP',
    burrType: 'conical',
    burrSizeMm: 40,
    handPowered: false,
    scale: { kind: 'clicks', min: 1, max: 40, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 26, interceptUm: 190, source: 'community' },
    espressoRange: [1, 9],
    notes: 'Settings 1-20 are the espresso half of the range.',
  },
  {
    id: 'turin-df83',
    brand: 'Turin',
    model: 'DF83',
    burrType: 'flat',
    burrSizeMm: 83,
    handPowered: false,
    scale: { kind: 'stepless', min: 0, max: 10, step: 0.1, unitLabel: 'turns' },
    calibration: { umPerUnit: 105, interceptUm: 110, source: 'estimated' },
    espressoRange: [0.7, 2.2],
  },
  {
    id: '1zpresso-j-ultra',
    brand: '1Zpresso',
    model: 'J-Ultra',
    burrType: 'conical',
    burrSizeMm: 48,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 120, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 8.0, interceptUm: 0, source: 'measured' },
    espressoRange: [24, 48],
    notes: '8.0 µm per click, 30 clicks per rotation. Published by 1Zpresso.',
  },
  {
    id: '1zpresso-j-max',
    brand: '1Zpresso',
    model: 'J-Max',
    burrType: 'conical',
    burrSizeMm: 48,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 90, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 8.8, interceptUm: 0, source: 'measured' },
    espressoRange: [22, 44],
    notes: '8.8 µm per click, 90 clicks per rotation. Espresso-first hand grinder.',
  },
  {
    id: '1zpresso-jx-pro',
    brand: '1Zpresso',
    model: 'JX-Pro',
    burrType: 'conical',
    burrSizeMm: 48,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 120, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 12.5, interceptUm: 0, source: 'measured' },
    espressoRange: [16, 32],
  },
  {
    id: '1zpresso-k-ultra',
    brand: '1Zpresso',
    model: 'K-Ultra',
    burrType: 'conical',
    burrSizeMm: 48,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 100, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 12.5, interceptUm: 0, source: 'measured' },
    espressoRange: [16, 32],
  },
  {
    id: 'comandante-c40',
    brand: 'Comandante',
    model: 'C40 MK4',
    burrType: 'conical',
    burrSizeMm: 39,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 50, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 30, interceptUm: 0, source: 'community' },
    espressoRange: [7, 14],
    notes: 'Roughly 30 µm per click. Espresso is possible but the range is coarse for it.',
  },
  {
    id: 'kingrinder-k6',
    brand: 'Kingrinder',
    model: 'K6',
    burrType: 'conical',
    burrSizeMm: 48,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 240, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 16, interceptUm: 0, source: 'measured' },
    espressoRange: [12, 25],
    notes: '16 µm per click, external adjustment.',
  },
  {
    id: 'timemore-c3-esp',
    brand: 'Timemore',
    model: 'C3 ESP Pro',
    burrType: 'conical',
    burrSizeMm: 38,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 36, step: 1, unitLabel: 'clicks' },
    calibration: { umPerUnit: 25, interceptUm: 0, source: 'community' },
    espressoRange: [8, 16],
  },
];

export const GRINDERS_BY_ID: Record<string, GrinderSpec> = Object.fromEntries(
  BUILT_IN_GRINDERS.map((g) => [g.id, g]),
);

/** A grinder as it exists on a user's shelf: a spec plus optional personal calibration. */
export interface UserGrinderLike {
  builtInId?: string | null;
  name: string;
  scale: GrinderScale;
  calibration: GrinderCalibration;
}

export function specToUserGrinder(spec: GrinderSpec): UserGrinderLike {
  return {
    builtInId: spec.id,
    name: `${spec.brand} ${spec.model}`,
    scale: spec.scale,
    calibration: spec.calibration,
  };
}

export function settingToMicrons(g: UserGrinderLike, setting: number): number {
  return g.calibration.interceptUm + setting * g.calibration.umPerUnit;
}

export function micronsToSetting(g: UserGrinderLike, microns: number): number {
  const { interceptUm, umPerUnit } = g.calibration;
  if (umPerUnit === 0) return g.scale.min;
  return (microns - interceptUm) / umPerUnit;
}

export function snapToScale(g: UserGrinderLike, setting: number): number {
  const { min, max, step } = g.scale;
  const clamped = Math.min(max, Math.max(min, setting));
  const snapped = Math.round((clamped - min) / step) * step + min;
  // Kill floating-point dust from 0.1-size steps.
  const decimals = (String(step).split('.')[1] ?? '').length;
  return Number(snapped.toFixed(decimals));
}

export interface ConversionResult {
  microns: number;
  rawSetting: number;
  setting: number;
  /** True when the equivalent setting falls outside the target grinder's dial. */
  outOfRange: boolean;
  confidence: CalibrationSource;
}

/**
 * Translate a setting on one grinder to the closest equivalent on another.
 * Confidence is the weaker of the two calibrations — a conversion is only as
 * trustworthy as its shakiest end.
 */
export function convertSetting(
  from: UserGrinderLike,
  setting: number,
  to: UserGrinderLike,
): ConversionResult {
  const microns = settingToMicrons(from, setting);
  const raw = micronsToSetting(to, microns);
  const snapped = snapToScale(to, raw);
  const rank: Record<CalibrationSource, number> = { measured: 2, community: 1, estimated: 0 };
  const confidence =
    rank[from.calibration.source] <= rank[to.calibration.source]
      ? from.calibration.source
      : to.calibration.source;
  return {
    microns: Math.round(microns),
    rawSetting: raw,
    setting: snapped,
    outOfRange: raw < to.scale.min || raw > to.scale.max,
    confidence,
  };
}

/**
 * Build a personal calibration from two known reference points, e.g. "click 12
 * gave me roughly 250 µm and click 30 gave me roughly 500 µm". This is how a
 * user turns our estimate into their own measurement.
 */
export function calibrateFromTwoPoints(
  a: { setting: number; microns: number },
  b: { setting: number; microns: number },
): GrinderCalibration {
  if (a.setting === b.setting) {
    throw new Error('Calibration points must use two different settings');
  }
  const umPerUnit = (b.microns - a.microns) / (b.setting - a.setting);
  const interceptUm = a.microns - a.setting * umPerUnit;
  return { umPerUnit, interceptUm, source: 'measured' };
}

/** Human-readable bucket for a micron value, used for chips and filters. */
export function grindBucket(microns: number): string {
  if (microns < 200) return 'Turkish / ultra-fine';
  if (microns < 330) return 'Espresso';
  if (microns < 450) return 'Fine (moka / AeroPress)';
  if (microns < 700) return 'Medium (pour over)';
  if (microns < 1000) return 'Coarse (French press)';
  return 'Extra coarse (cold brew)';
}
