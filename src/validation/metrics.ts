export interface RelativeErrorResult {
  readonly kind: "RELATIVE" | "UNDEFINED_ZERO_REFERENCE";
  readonly value?: number;
}

export function absoluteError(observed: number, reference: number): number {
  return Math.abs(observed - reference);
}

export function relativeError(observed: number, reference: number): RelativeErrorResult {
  if (!Number.isFinite(observed) || !Number.isFinite(reference)) throw new Error("relativeError requires finite values");
  if (reference === 0) return { kind: "UNDEFINED_ZERO_REFERENCE" };
  return { kind: "RELATIVE", value: Math.abs(observed - reference) / Math.abs(reference) };
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error("median requires at least one value");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) throw new Error("percentile requires at least one value");
  if (p < 0 || p > 1) throw new Error("percentile p must be within [0, 1]");
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function p90(values: readonly number[]): number {
  return percentile(values, 0.9);
}

export function signedBias(observed: readonly number[], reference: readonly number[]): number {
  if (observed.length === 0 || observed.length !== reference.length) throw new Error("signedBias requires equal non-empty arrays");
  return observed.reduce((sum, value, index) => sum + (value - reference[index]), 0) / observed.length;
}

export function nrmse(observed: readonly number[], reference: readonly number[]): number {
  if (observed.length === 0 || observed.length !== reference.length) throw new Error("nrmse requires equal non-empty arrays");
  const mse = observed.reduce((sum, value, index) => sum + (value - reference[index]) ** 2, 0) / observed.length;
  const min = Math.min(...reference);
  const max = Math.max(...reference);
  const range = max - min;
  if (range === 0) throw new Error("nrmse requires non-zero reference range");
  return Math.sqrt(mse) / range;
}
