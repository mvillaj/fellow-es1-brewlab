/**
 * The ES1 is Fahrenheit-native: its screen shows whole degrees F, and the Celsius
 * numbers on Fellow's wire format are conversions of those — which is why a
 * captured profile reads 93.88 rather than a clean step.
 *
 * Storage, the schemas and the Fellow payload stay Celsius. Everything that talks
 * to a person converts at the edge — and that now includes the model, which is
 * given limits in Fahrenheit and answers in Fahrenheit, so its prose matches what
 * the editor shows.
 */
export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;

/** Whole degrees F, the way the machine displays them. */
export const roundF = (c: number) => Math.round(cToF(c));
