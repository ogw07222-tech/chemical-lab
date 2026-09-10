import { allowedError, type PhysicalDimension } from "./policy";

export type ValidationVerdict = "PASS" | "FAIL" | "OPEN";
export type ScientificModelStatus =
  | "VERIFIED"
  | "APPROXIMATED"
  | "EMPIRICAL"
  | "GAMEPLAY_SIMPLIFICATION"
  | "OPEN";

export interface ValidationResult<T = unknown> {
  readonly id: string;
  readonly verdict: ValidationVerdict;
  readonly scientificStatus?: ScientificModelStatus;
  readonly reason?: string;
  readonly value?: T;
  readonly deterministicKey?: string;
}

export function pass<T>(id: string, value?: T, scientificStatus?: ScientificModelStatus): ValidationResult<T> {
  return { id, verdict: "PASS", value, scientificStatus };
}

export function fail<T>(id: string, reason: string, value?: T, scientificStatus?: ScientificModelStatus): ValidationResult<T> {
  return { id, verdict: "FAIL", reason, value, scientificStatus };
}

export function open<T>(id: string, reason: string, value?: T, scientificStatus?: ScientificModelStatus): ValidationResult<T> {
  return { id, verdict: "OPEN", reason, value, scientificStatus };
}

export function applyAbsoluteGates(
  base: ValidationResult,
  gates: readonly { id: string; violated: boolean; reason: string }[],
): ValidationResult {
  const violation = gates.find((gate) => gate.violated);
  return violation ? fail(violation.id, violation.reason) : base;
}

export function assertFiniteNumber(id: string, value: number): ValidationResult<number> {
  return Number.isFinite(value) ? pass(id, value) : fail(id, "authoritative numeric state must be finite", value);
}

export function assertNonNegative(
  id: string,
  value: number,
  dimension: PhysicalDimension,
): ValidationResult<number> {
  if (!Number.isFinite(value)) return fail(id, "authoritative numeric state must be finite", value);
  const tolerance = allowedError(dimension, 0, value);
  return value < -tolerance ? fail(id, "negative authoritative physical state", value) : pass(id, value);
}

export interface AuthoritativeSIState {
  temperatureK?: number;
  pressurePa?: number;
  volumeM3?: number;
  amountMol?: number;
  concentrationMolPerM3?: number;
  energyJ?: number;
  molarEnergyJPerMol?: number;
  timeS?: number;
  powerW?: number;
}

export function validateAuthoritativeSIState(id: string, state: AuthoritativeSIState): ValidationResult<AuthoritativeSIState> {
  for (const [key, value] of Object.entries(state)) {
    if (value !== undefined && !Number.isFinite(value)) return fail(id, `${key} must be finite`, state);
  }
  if (state.temperatureK !== undefined && state.temperatureK <= 0) return fail(id, "temperatureK must be > 0 K", state);
  const nonNegative: Array<[keyof AuthoritativeSIState, PhysicalDimension]> = [
    ["pressurePa", "pressure"],
    ["volumeM3", "volume"],
    ["amountMol", "amount"],
    ["concentrationMolPerM3", "concentration"],
    ["timeS", "time"],
  ];
  for (const [key, dimension] of nonNegative) {
    const value = state[key];
    if (value !== undefined && assertNonNegative(String(key), value, dimension).verdict === "FAIL") {
      return fail(id, `${String(key)} must be non-negative`, state);
    }
  }
  return pass(id, state);
}

export function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

export function deterministicResult<T>(result: ValidationResult<T>): ValidationResult<T> {
  return { ...result, deterministicKey: stableSerialize({ id: result.id, verdict: result.verdict, reason: result.reason, value: result.value, scientificStatus: result.scientificStatus }) };
}
