import type { ScientificStatus } from "../molecular";
import type { KineticEvaluationResult, KineticSupportClass } from "./types";

export interface KineticExtentInputOptions {
  /** Existing Phase 2E fallback timescale for dimensionless relativeRate. */
  coarseRateTimescaleS?: number;
  /** Hard normalized cap for relative-rate progress over one step. */
  maxRelativeProgressFraction?: number;
}

export interface KineticExtentInput {
  supportClass: KineticSupportClass;
  /** Physical unbounded extent request before 01 stoichiometric limiting. */
  requestedExtentMol?: number;
  /** Dimensionless progress request before 01 stoichiometric limiting. */
  relativeProgressFraction?: number;
  scientificStatus: ScientificStatus;
  reason: "DIMENSIONED_RATE_DT" | "RELATIVE_RATE_DT" | "NO_NUMERIC_EXTENT";
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be finite and > 0.`);
}

/**
 * Converts 02 kinetic evidence into a dt-dependent extent input without reading
 * or mutating species inventory. 01 remains responsible for stoichiometric
 * availability, shared-reactant competition and the final applied extent.
 */
export function kineticExtentInputOverDt(
  kinetics: KineticEvaluationResult,
  dtS: number,
  options: KineticExtentInputOptions = {},
): KineticExtentInput {
  assertFinitePositive(dtS, "dtS");
  const supportClass = kinetics.supportClass ?? (kinetics.relativeRate === undefined ? "OPEN" : "RELATIVE_RATE");

  if (supportClass === "DIMENSIONED_RATE") {
    const rate = kinetics.extentRateMolPerS;
    if (rate === undefined || !Number.isFinite(rate) || rate < 0) {
      return { supportClass: "OPEN", scientificStatus: "OPEN", reason: "NO_NUMERIC_EXTENT" };
    }
    return {
      supportClass,
      requestedExtentMol: rate * dtS,
      scientificStatus: kinetics.approximationClass,
      reason: "DIMENSIONED_RATE_DT",
    };
  }

  if (supportClass === "RELATIVE_RATE") {
    const relativeRate = kinetics.relativeRate;
    if (relativeRate === undefined || !Number.isFinite(relativeRate) || relativeRate < 0) {
      return { supportClass: "OPEN", scientificStatus: "OPEN", reason: "NO_NUMERIC_EXTENT" };
    }
    const timescaleS = options.coarseRateTimescaleS ?? 1;
    const maxFraction = options.maxRelativeProgressFraction ?? 0.25;
    assertFinitePositive(timescaleS, "coarseRateTimescaleS");
    if (!Number.isFinite(maxFraction) || maxFraction <= 0 || maxFraction > 1) {
      throw new RangeError("maxRelativeProgressFraction must be in (0, 1].");
    }
    const rawFraction = 1 - Math.exp(-(relativeRate * dtS) / timescaleS);
    return {
      supportClass,
      relativeProgressFraction: Math.min(maxFraction, Math.max(0, rawFraction)),
      scientificStatus: kinetics.approximationClass === "VERIFIED" ? "APPROXIMATED" : kinetics.approximationClass,
      reason: "RELATIVE_RATE_DT",
    };
  }

  return {
    supportClass,
    scientificStatus: supportClass === "OPEN" ? "OPEN" : kinetics.approximationClass,
    reason: "NO_NUMERIC_EXTENT",
  };
}
