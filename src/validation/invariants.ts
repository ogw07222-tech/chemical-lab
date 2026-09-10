import { fail, pass, type ValidationResult } from "./core";
import { withinTolerance, type PhysicalDimension } from "./policy";

export function assertExactInvariant<T>(id: string, before: T, after: T): ValidationResult {
  return Object.is(before, after) ? pass(id) : fail(id, "exact invariant violated", { before, after });
}

export function assertNumericInvariant(
  id: string,
  before: number,
  after: number,
  dimension: PhysicalDimension,
): ValidationResult {
  if (!Number.isFinite(before) || !Number.isFinite(after)) return fail(id, "invariant inputs must be finite", { before, after });
  return withinTolerance(dimension, before, after)
    ? pass(id)
    : fail(id, "numeric invariant exceeded deterministic tolerance", { before, after, dimension });
}

export function assertElementInventory(
  id: string,
  before: Readonly<Record<string, number>>,
  after: Readonly<Record<string, number>>,
): ValidationResult {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  for (const key of keys) {
    if ((before[key] ?? 0) !== (after[key] ?? 0)) return fail(id, `element count changed for ${key}`, { before, after });
  }
  return pass(id);
}
