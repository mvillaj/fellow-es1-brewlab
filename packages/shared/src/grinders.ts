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
 * Manufacturer "µm per click" figures (1Zpresso, Kingrinder) describe burr
 * travel, not particle size, so they can't be used as the slope directly. Where
 * we have a community espresso window we fit the line so that window lands at
 * roughly 200-400 µm, which keeps every grinder on the same axis.
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
    // The outer ring is labelled 1-11 with four clicks per number, so click n
    // here is dial 1 + (n - 1) / 4. Click 5 is dial 2; click 41 is dial 11.
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
    burrSizeMm: 48,
    handPowered: false,
    scale: { kind: 'stepless', min: 0, max: 10, step: 0.1, unitLabel: 'dial' },
    // Fitted so Fellow's espresso window (dial 0-2) maps to 200-400 µm. Stepless
    // dials are rarely linear end to end, so filter conversions drift coarse.
    calibration: { umPerUnit: 100, interceptUm: 200, source: 'estimated' },
    espressoRange: [0, 2],
    notes:
      'Not the original Opus dial: a stepless side dial marked 0-10, with new 48 mm burrs. Fellow puts most espresso around 0-2. Calibrate it if you convert filter settings.',
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
    notes:
      'Single-dose, effectively zero retention. Most people live between 12 and 20 for espresso.',
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
    scale: { kind: 'clicks', min: 0, max: 500, step: 1, unitLabel: 'clicks' },
    // Fitted so the community espresso window (74-154 clicks) maps to 200-400 µm.
    calibration: { umPerUnit: 2.5, interceptUm: 15, source: 'community' },
    espressoRange: [74, 154],
    notes:
      '100 clicks per rotation, 5 rotations. 1Zpresso publishes 8 µm of burr travel per click; that is burr movement, not particle size. Espresso range from the Honest Coffee Guide chart.',
  },
  {
    id: '1zpresso-j-max',
    brand: '1Zpresso',
    model: 'J-Max',
    burrType: 'conical',
    burrSizeMm: 48,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 405, step: 1, unitLabel: 'clicks' },
    // Fitted so the community espresso window (69-143 clicks) maps to 200-400 µm.
    calibration: { umPerUnit: 2.7, interceptUm: 14, source: 'community' },
    espressoRange: [69, 143],
    notes:
      '90 clicks per rotation, 4.5 rotations. 1Zpresso publishes 8.8 µm of burr travel per click. Espresso range from the Honest Coffee Guide chart.',
  },
  {
    id: '1zpresso-jx-pro',
    brand: '1Zpresso',
    model: 'JX-Pro',
    burrType: 'conical',
    burrSizeMm: 48,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 120, step: 1, unitLabel: 'clicks' },
    // Fitted so the community espresso window (40-83 clicks) maps to 200-400 µm.
    calibration: { umPerUnit: 4.65, interceptUm: 14, source: 'community' },
    espressoRange: [40, 83],
    notes:
      '40 clicks per rotation. 1Zpresso publishes 12.5 µm of burr travel per click. Espresso range from the Honest Coffee Guide chart; other guides disagree, so calibrate.',
  },
  {
    id: '1zpresso-k-ultra',
    brand: '1Zpresso',
    model: 'K-Ultra',
    burrType: 'conical',
    burrSizeMm: 48,
    handPowered: true,
    scale: { kind: 'clicks', min: 0, max: 100, step: 1, unitLabel: 'clicks' },
    // Fitted so the community espresso window (24-49 clicks) maps to 200-400 µm.
    calibration: { umPerUnit: 8, interceptUm: 8, source: 'community' },
    espressoRange: [24, 49],
    notes:
      '100 clicks per rotation. 1Zpresso publishes 20 µm of burr travel per click. Espresso range from the Honest Coffee Guide chart.',
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

/**
 * Why a setting can't be dialled on this grinder, or null if it can. Clicked
 * and stepped dials must land on a step; stepless dials only need to be in
 * range, since `step` there is just the UI's resolution.
 */
export function grindSettingError(g: UserGrinderLike, setting: number): string | null {
  const { kind, min, max, step } = g.scale;
  if (!Number.isFinite(setting)) return 'Grind setting must be a number';
  if (setting < min || setting > max) return `${g.name} goes from ${min} to ${max}`;
  if (kind !== 'stepless') {
    const steps = (setting - min) / step;
    if (Math.abs(steps - Math.round(steps)) > 1e-6) {
      return `${g.name} moves in steps of ${step}`;
    }
  }
  return null;
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
