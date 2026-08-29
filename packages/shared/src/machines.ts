/**
 * The machine registry.
 *
 * Same shape as the grinder registry next door: a catalogue that lives in code,
 * and per-user rows that snapshot a spec at the moment they are added. What a
 * machine *is* barely matters to this app; what matters is what it can do, so a
 * spec is mostly a capability descriptor.
 *
 * Two capabilities gate real features:
 *   - `profiling` decides whether the profile studio exists for you at all.
 *   - `cloud` decides whether there is an account to push profiles to.
 *
 * A machine that does neither still gets the whole logbook -- shots, grinders,
 * coffees and the dial-in coach were never ES1-specific.
 */

import { ES1_LIMITS } from './es1.ts';

/** How a machine runs a shot, and where its profiles can be sent. */
export interface MachineCapabilities {
  /**
   * `pressure` means the shot is a series of timed phases that each target a
   * pressure -- what the profile studio edits. `none` means the machine pulls
   * whatever its pump and your hand decide, and there is nothing to author.
   */
  profiling: 'none' | 'pressure';
  /** The vendor cloud a profile can be pushed to, if any. */
  cloud: 'fellow' | null;
}

/**
 * Bounds the logbook enforces. Deliberately thin: only the numbers a *shot*
 * needs. Everything a profile needs stays in ES1_LIMITS, because profiles only
 * exist for machines that profile.
 */
export interface MachineLimits {
  tempC: { min: number; max: number };
  maxPressureBar: number;
}

export interface MachineSpec {
  id: string;
  brand: string;
  model: string;
  capabilities: MachineCapabilities;
  limits: MachineLimits;
  notes?: string;
}

export const BUILT_IN_MACHINES: MachineSpec[] = [
  {
    id: 'fellow-es1',
    brand: 'Fellow',
    model: 'Espresso Series 1',
    capabilities: { profiling: 'pressure', cloud: 'fellow' },
    // Sourced from ES1_LIMITS rather than retyped, so the profile studio and the
    // shot log can never disagree about what the machine will accept.
    limits: {
      tempC: { min: ES1_LIMITS.tempC.min, max: ES1_LIMITS.tempC.max },
      maxPressureBar: ES1_LIMITS.pressureBar.max,
    },
    notes:
      'Profiles run as ordered, timed phases; each targets a pressure and the machine modulates flow to hold it.',
  },
  {
    id: 'generic-espresso',
    brand: 'Generic',
    model: 'Espresso machine',
    capabilities: { profiling: 'none', cloud: null },
    // Wide enough for anything from a lever pulled cool to a temperature-surfing
    // single boiler. The point is to not get in the way.
    limits: { tempC: { min: 80, max: 105 }, maxPressureBar: 15 },
    notes: 'Everything the logbook does, minus the profile studio. Pick this if your machine is not listed.',
  },
];

export const MACHINES_BY_ID: Record<string, MachineSpec> = Object.fromEntries(
  BUILT_IN_MACHINES.map((m) => [m.id, m]),
);

/** A machine as it sits on a user's bench: a spec, or a hand-rolled equivalent. */
export interface UserMachineLike {
  builtInId?: string | null;
  name: string;
  capabilities: MachineCapabilities;
  limits: MachineLimits;
}

export function specToUserMachine(spec: MachineSpec): UserMachineLike {
  return {
    builtInId: spec.id,
    name: `${spec.brand} ${spec.model}`,
    capabilities: { ...spec.capabilities },
    limits: { tempC: { ...spec.limits.tempC }, maxPressureBar: spec.limits.maxPressureBar },
  };
}

/** The capabilities of a user with no machine at all: the plain logbook. */
export const NO_MACHINE_CAPABILITIES: MachineCapabilities = { profiling: 'none', cloud: null };

/**
 * Which machine's rules apply. One default per user, same invariant as grinders;
 * falls back to the first on the bench so a user who deleted their default is
 * not left with a temperature field that rejects everything.
 */
export function activeMachine<T extends { isDefault: boolean }>(machines: T[]): T | null {
  return machines.find((m) => m.isDefault) ?? machines[0] ?? null;
}

export function capabilitiesOf(machine: UserMachineLike | null | undefined): MachineCapabilities {
  return machine?.capabilities ?? NO_MACHINE_CAPABILITIES;
}
