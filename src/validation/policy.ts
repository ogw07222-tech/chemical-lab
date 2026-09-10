export const VALIDATION_POLICY_SOURCE = "docs/contracts/REAL_EXPERIMENT_VALIDATION.md" as const;

export const CanonicalValidationPolicy = Object.freeze({
  source: VALIDATION_POLICY_SOURCE,
  tierA: Object.freeze({
    reactionClassificationMin: 0.95,
    dominantProductMin: 0.95,
    thermochemistrySignMin: 1,
    simplePhaseAwayFromBoundaryMin: 1,
    conditionResponseDirectionMin: 0.9,
  }),
  tierB: Object.freeze({
    productAmountMedianRelativeErrorMax: 0.15,
    selectivityAbsolutePercentagePointsMax: 15,
    selectivityRelativeErrorMax: 0.2,
    equilibriumMajorSpeciesMedianRelativeErrorMax: 0.15,
    equilibriumMajorSpeciesRelativeErrorNoteThreshold: 0.3,
    reactionEnthalpyRelativeErrorMax: 0.15,
    temperatureDeltaAbsoluteErrorKMax: 5,
    temperatureDeltaRelativeErrorMax: 0.15,
    gasPressureRelativeErrorMax: 0.1,
    outlierFractionMax: 0.1,
    outlierThresholdMultiplier: 2,
  }),
  tierC: Object.freeze({
    approximatedTimescaleFactorMax: 2,
    verifiedEmpiricalTimescaleRelativeErrorMax: 0.25,
    nrmseMax: 0.2,
    rateRankingMin: 0.9,
  }),
  tierD: Object.freeze({
    phaseAwayFromBoundaryMin: 0.98,
    verifiedTransitionAbsoluteErrorKMax: 5,
    approximatedTransitionAbsoluteErrorKMax: 15,
    boundaryRelativePressureErrorMax: 0.1,
    boundaryAbsoluteTemperatureErrorKMax: 10,
  }),
  minimumBenchmarkSet: Object.freeze({
    tierAIndependentCases: 10,
    tierBQuantitativeCases: 5,
  }),
});

export type PhysicalDimension =
  | "amount"
  | "charge"
  | "mass"
  | "energy"
  | "pressure"
  | "temperature"
  | "volume"
  | "concentration"
  | "time"
  | "power"
  | "dimensionless";

export interface ToleranceSpec {
  absTol: number;
  relTol: number;
  scaleFloor: number;
}

const EPS = Number.EPSILON;

/** Numerical representation tolerances only; these are not scientific acceptance thresholds. */
export const DeterministicTolerancePolicy: Readonly<Record<PhysicalDimension, ToleranceSpec>> = Object.freeze({
  amount: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  charge: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  mass: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  energy: { absTol: 0, relTol: 128 * EPS, scaleFloor: 1 },
  pressure: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  temperature: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  volume: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  concentration: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  time: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  power: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
  dimensionless: { absTol: 0, relTol: 64 * EPS, scaleFloor: 1 },
});

export function allowedError(
  dimension: PhysicalDimension,
  reference: number,
  observed: number,
  policy: Readonly<Record<PhysicalDimension, ToleranceSpec>> = DeterministicTolerancePolicy,
): number {
  const spec = policy[dimension];
  return spec.absTol + spec.relTol * Math.max(Math.abs(reference), Math.abs(observed), spec.scaleFloor);
}

export function withinTolerance(
  dimension: PhysicalDimension,
  reference: number,
  observed: number,
  policy: Readonly<Record<PhysicalDimension, ToleranceSpec>> = DeterministicTolerancePolicy,
): boolean {
  return Math.abs(observed - reference) <= allowedError(dimension, reference, observed, policy);
}
