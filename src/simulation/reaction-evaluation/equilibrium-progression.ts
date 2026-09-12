import type { ScientificStatus } from "../molecular/types";
import {
  evaluateReactionEquilibrium,
  type EquilibriumComposition,
  type EquilibriumDataProvider,
  type EquilibriumEvaluationOptions,
  type EquilibriumEvaluationResult,
} from "./equilibrium";
import type { ReactionCandidateEvaluationView } from "./types";

export type EquilibriumProgressionMode =
  | "FORWARD"
  | "REVERSE"
  | "NEAR_EQUILIBRIUM"
  | "INDETERMINATE";

export type EquilibriumProgressionReasonCode =
  | "THERMODYNAMIC_DRIVE_SUPPORTED"
  | "NEAR_EQUILIBRIUM_ZERO_NET_PROGRESS"
  | "EQUILIBRIUM_ARBITRATION_ABSTAINS"
  | "APPROXIMATED_DRIVING_MODULATION"
  | "EQUILIBRIUM_CROSSING_BOUND_SUPPORTED"
  | "EQUILIBRIUM_OUTSIDE_FEASIBLE_EXTENT"
  | "EQUILIBRIUM_CROSSING_BOUND_UNAVAILABLE"
  | "PROJECTION_EVALUATION_OPEN"
  | "INVALID_PROJECTION_RESULT";

export interface EquilibriumProgressionRecommendation {
  mode: EquilibriumProgressionMode;
  drivingStrength: number;
  maxNetProgressFraction: number;
  preventEquilibriumCrossing: boolean;
  maxExtentTowardEquilibriumMol?: number;
  scientificStatus: ScientificStatus;
  reasonCodes: readonly EquilibriumProgressionReasonCode[];
}

export interface EquilibriumExtentProjection {
  maxFeasibleExtentMol: number;
  projectComposition(netForwardExtentMol: number): EquilibriumComposition;
}

export interface EquilibriumProgressionOptions {
  maxBisectionIterations?: number;
  extentToleranceMol?: number;
}

const DEFAULT_MAX_BISECTION_ITERATIONS = 48;
const DEFAULT_EXTENT_TOLERANCE_MOL = 1e-12;

function assertUnitInterval(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be finite and within [0, 1].`);
  }
}

export function equilibriumDrivingStrength(
  lnQOverK: number,
  epsilonLnQOverK: number,
): number {
  if (!Number.isFinite(lnQOverK)) throw new RangeError("lnQOverK must be finite.");
  if (!Number.isFinite(epsilonLnQOverK) || epsilonLnQOverK <= 0) {
    throw new RangeError("epsilonLnQOverK must be finite and > 0.");
  }
  const activeDrive = Math.max(0, Math.abs(lnQOverK) - epsilonLnQOverK);
  const value = -Math.expm1(-activeDrive);
  const bounded = Math.min(1, Math.max(0, value));
  assertUnitInterval(bounded, "drivingStrength");
  return bounded;
}

function indeterminateRecommendation(): EquilibriumProgressionRecommendation {
  return {
    mode: "INDETERMINATE",
    drivingStrength: 0,
    maxNetProgressFraction: 0,
    preventEquilibriumCrossing: false,
    scientificStatus: "OPEN",
    reasonCodes: ["EQUILIBRIUM_ARBITRATION_ABSTAINS"],
  };
}

function evaluateProjectedDrive(
  view: ReactionCandidateEvaluationView,
  projection: EquilibriumExtentProjection,
  signedNetForwardExtentMol: number,
  temperatureK: number,
  provider: EquilibriumDataProvider,
  equilibriumOptions: EquilibriumEvaluationOptions,
): EquilibriumEvaluationResult | undefined {
  let composition: EquilibriumComposition;
  try {
    composition = projection.projectComposition(signedNetForwardExtentMol);
  } catch {
    return undefined;
  }
  return evaluateReactionEquilibrium(view, composition, temperatureK, provider, equilibriumOptions);
}

function sideOfEquilibrium(evaluation: EquilibriumEvaluationResult): -1 | 0 | 1 | undefined {
  if (evaluation.direction === "OPEN") return undefined;
  if (evaluation.lnQOverK !== undefined && Number.isFinite(evaluation.lnQOverK)) {
    if (evaluation.lnQOverK === 0) return 0;
    return evaluation.lnQOverK < 0 ? -1 : 1;
  }
  if (evaluation.direction === "NEAR_EQUILIBRIUM") return 0;
  if (evaluation.direction === "FORWARD_FAVORED") return -1;
  if (evaluation.direction === "REVERSE_FAVORED") return 1;
  return undefined;
}

export function recommendEquilibriumProgression(
  view: ReactionCandidateEvaluationView,
  equilibrium: EquilibriumEvaluationResult,
  temperatureK: number,
  provider: EquilibriumDataProvider,
  equilibriumOptions: EquilibriumEvaluationOptions = {},
  projection?: EquilibriumExtentProjection,
  options: EquilibriumProgressionOptions = {},
): EquilibriumProgressionRecommendation {
  if (!Number.isFinite(temperatureK) || temperatureK <= 0) {
    throw new RangeError("temperatureK must be finite and > 0.");
  }

  if (
    equilibrium.direction === "OPEN" ||
    equilibrium.lnQOverK === undefined ||
    !Number.isFinite(equilibrium.lnQOverK)
  ) {
    return indeterminateRecommendation();
  }

  const epsilon = equilibrium.tolerance.epsilonLnQOverK;
  const strength = equilibriumDrivingStrength(equilibrium.lnQOverK, epsilon);

  if (equilibrium.nearEquilibrium || Math.abs(equilibrium.lnQOverK) <= epsilon) {
    return {
      mode: "NEAR_EQUILIBRIUM",
      drivingStrength: 0,
      maxNetProgressFraction: 0,
      preventEquilibriumCrossing: true,
      maxExtentTowardEquilibriumMol: 0,
      scientificStatus: "APPROXIMATED",
      reasonCodes: [
        "NEAR_EQUILIBRIUM_ZERO_NET_PROGRESS",
        "APPROXIMATED_DRIVING_MODULATION",
      ],
    };
  }

  const mode: EquilibriumProgressionMode = equilibrium.lnQOverK < 0 ? "FORWARD" : "REVERSE";
  const base: EquilibriumProgressionRecommendation = {
    mode,
    drivingStrength: strength,
    maxNetProgressFraction: strength,
    preventEquilibriumCrossing: false,
    scientificStatus: "APPROXIMATED",
    reasonCodes: ["THERMODYNAMIC_DRIVE_SUPPORTED", "APPROXIMATED_DRIVING_MODULATION"],
  };

  if (!projection) {
    return {
      ...base,
      reasonCodes: [...base.reasonCodes, "EQUILIBRIUM_CROSSING_BOUND_UNAVAILABLE"],
    };
  }

  if (!Number.isFinite(projection.maxFeasibleExtentMol) || projection.maxFeasibleExtentMol < 0) {
    throw new RangeError("maxFeasibleExtentMol must be finite and >= 0.");
  }
  if (projection.maxFeasibleExtentMol === 0) {
    return {
      ...base,
      preventEquilibriumCrossing: true,
      maxExtentTowardEquilibriumMol: 0,
      reasonCodes: [...base.reasonCodes, "EQUILIBRIUM_OUTSIDE_FEASIBLE_EXTENT"],
    };
  }

  const maxIterations = options.maxBisectionIterations ?? DEFAULT_MAX_BISECTION_ITERATIONS;
  const extentToleranceMol = options.extentToleranceMol ?? DEFAULT_EXTENT_TOLERANCE_MOL;
  if (!Number.isInteger(maxIterations) || maxIterations <= 0 || maxIterations > 128) {
    throw new RangeError("maxBisectionIterations must be an integer in [1, 128].");
  }
  if (!Number.isFinite(extentToleranceMol) || extentToleranceMol <= 0) {
    throw new RangeError("extentToleranceMol must be finite and > 0.");
  }

  const sign = mode === "FORWARD" ? 1 : -1;
  const endEvaluation = evaluateProjectedDrive(
    view,
    projection,
    sign * projection.maxFeasibleExtentMol,
    temperatureK,
    provider,
    equilibriumOptions,
  );
  if (!endEvaluation) {
    return {
      ...base,
      reasonCodes: [...base.reasonCodes, "PROJECTION_EVALUATION_OPEN", "EQUILIBRIUM_CROSSING_BOUND_UNAVAILABLE"],
    };
  }
  const endSide = sideOfEquilibrium(endEvaluation);
  if (endSide === undefined) {
    return {
      ...base,
      reasonCodes: [...base.reasonCodes, "PROJECTION_EVALUATION_OPEN", "EQUILIBRIUM_CROSSING_BOUND_UNAVAILABLE"],
    };
  }

  const crossesOrReaches = mode === "FORWARD" ? endSide >= 0 : endSide <= 0;
  if (!crossesOrReaches) {
    return {
      ...base,
      preventEquilibriumCrossing: true,
      maxExtentTowardEquilibriumMol: projection.maxFeasibleExtentMol,
      reasonCodes: [...base.reasonCodes, "EQUILIBRIUM_OUTSIDE_FEASIBLE_EXTENT"],
    };
  }

  let low = 0;
  let high = projection.maxFeasibleExtentMol;
  for (let iteration = 0; iteration < maxIterations && high - low > extentToleranceMol; iteration += 1) {
    const mid = low + (high - low) / 2;
    const evaluation = evaluateProjectedDrive(
      view,
      projection,
      sign * mid,
      temperatureK,
      provider,
      equilibriumOptions,
    );
    if (!evaluation) {
      return {
        ...base,
        reasonCodes: [...base.reasonCodes, "INVALID_PROJECTION_RESULT", "EQUILIBRIUM_CROSSING_BOUND_UNAVAILABLE"],
      };
    }
    const side = sideOfEquilibrium(evaluation);
    if (side === undefined) {
      return {
        ...base,
        reasonCodes: [...base.reasonCodes, "INVALID_PROJECTION_RESULT", "EQUILIBRIUM_CROSSING_BOUND_UNAVAILABLE"],
      };
    }
    const stillOriginalSide = mode === "FORWARD" ? side < 0 : side > 0;
    if (stillOriginalSide) low = mid;
    else high = mid;
  }

  const bound = Math.min(projection.maxFeasibleExtentMol, Math.max(0, high));
  if (!Number.isFinite(bound)) {
    return {
      ...base,
      reasonCodes: [...base.reasonCodes, "INVALID_PROJECTION_RESULT", "EQUILIBRIUM_CROSSING_BOUND_UNAVAILABLE"],
    };
  }

  return {
    ...base,
    preventEquilibriumCrossing: true,
    maxExtentTowardEquilibriumMol: bound,
    reasonCodes: [...base.reasonCodes, "EQUILIBRIUM_CROSSING_BOUND_SUPPORTED"],
  };
}
