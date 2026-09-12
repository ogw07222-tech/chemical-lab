import type { Confidence } from "../../data/schema";
import type { PhaseKind, ScientificStatus } from "../molecular/types";
import type {
  EvaluatedQuantity,
  ReactionCandidateEvaluationView,
  SourceMetadata,
} from "./types";

const GAS_CONSTANT_J_PER_MOL_K = 8.31446261815324;
const LOG_MAX_VALUE = Math.log(Number.MAX_VALUE);
const LOG_MIN_VALUE = Math.log(Number.MIN_VALUE);

export const DEFAULT_EQUILIBRIUM_STANDARD_STATE = Object.freeze({
  standardPressurePa: 100_000,
  standardConcentrationMolPerM3: 1_000,
});

export const DEFAULT_EQUILIBRIUM_TOLERANCE = Object.freeze({
  epsilonLnQOverK: 1e-6,
  scientificStatus: "APPROXIMATED" as ScientificStatus,
  basis: "ENGINEERING_DEFAULT" as const,
});

export type EquilibriumDirection =
  | "FORWARD_FAVORED"
  | "REVERSE_FAVORED"
  | "NEAR_EQUILIBRIUM"
  | "OPEN";

export type EquilibriumActivityModel =
  | "IDEAL_GAS_PARTIAL_PRESSURE"
  | "IDEAL_DILUTE_SOLUTION"
  | "PURE_PHASE_ACTIVITY_ONE"
  | "OPEN";

export type EquilibriumReasonCode =
  | "REFERENCE_K_DATA"
  | "STANDARD_GIBBS_TO_K"
  | "MISSING_EQUILIBRIUM_DATA"
  | "REFERENCE_TEMPERATURE_MISMATCH"
  | "STANDARD_STATE_MISMATCH"
  | "INCONSISTENT_K_REPRESENTATION"
  | "IDEAL_GAS_ACTIVITY"
  | "IDEAL_DILUTE_ACTIVITY"
  | "PURE_PHASE_ACTIVITY_ONE"
  | "UNSUPPORTED_ACTIVITY_MODEL"
  | "MISSING_ACTIVITY_INPUT"
  | "ZERO_PRODUCT_ACTIVITY"
  | "ZERO_REACTANT_ACTIVITY"
  | "INDETERMINATE_ZERO_ACTIVITIES"
  | "NUMERICAL_RANGE_EXCEEDED"
  | "DEFAULT_ENGINEERING_TOLERANCE"
  | "CONFIGURED_EQUILIBRIUM_TOLERANCE"
  | "NEAR_EQUILIBRIUM_BY_LOG_RATIO";

export interface EquilibriumStandardState {
  /** Ideal-gas standard pressure. Default: 1 bar = 100000 Pa. */
  standardPressurePa: number;
  /** Ideal-dilute concentration standard. Default: 1 mol/L = 1000 mol/m^3. */
  standardConcentrationMolPerM3: number;
}

export interface EquilibriumToleranceMetadata {
  /** Engineering decision boundary in dimensionless ln(Q/K), not a physical uncertainty claim. */
  epsilonLnQOverK: number;
  scientificStatus: ScientificStatus;
  basis: "ENGINEERING_DEFAULT" | "CONFIGURED";
}

export interface EquilibriumSpeciesState {
  speciesKey: string;
  phase: PhaseKind;
  amountMol?: number;
  /** Dimensionless activity supplied by a higher-fidelity model when available. */
  activityDimensionless?: number;
  /** Gas partial pressure used only by the ideal-gas activity approximation. */
  partialPressurePa?: number;
  /** Solute concentration used only by the ideal-dilute activity approximation. */
  concentrationMolPerM3?: number;
  /** Explicitly asserts this state is a present pure condensed phase for a≈1. */
  purePhaseActivityOne?: boolean;
}

export interface EquilibriumComposition {
  species: readonly EquilibriumSpeciesState[];
}

export interface EquilibriumConstantData {
  /** Optional direct K. Must be positive, finite, and dimensionless under the supplied standard state. */
  equilibriumConstantK?: number;
  /** Preferred representation for very large/small K. Must be finite. */
  lnEquilibriumConstantK?: number;
  referenceTemperatureK: number;
  standardState: EquilibriumStandardState;
  status: ScientificStatus;
  confidence: Confidence;
  source: SourceMetadata;
}

export interface StandardReactionGibbsData {
  deltaGStandard_J_per_mol: EvaluatedQuantity;
  referenceTemperatureK: number;
  standardState: EquilibriumStandardState;
}

export interface EquilibriumDataProvider {
  getEquilibriumConstant?(
    view: ReactionCandidateEvaluationView,
    temperatureK: number,
  ): EquilibriumConstantData | undefined;
  getStandardReactionGibbs?(
    view: ReactionCandidateEvaluationView,
    temperatureK: number,
  ): StandardReactionGibbsData | undefined;
}

export interface EquilibriumEvaluationOptions {
  standardState?: EquilibriumStandardState;
  tolerance?: Partial<EquilibriumToleranceMetadata>;
  /** K/ΔG° at another temperature is not silently extrapolated. */
  referenceTemperatureToleranceK?: number;
}

export interface EquilibriumEvaluationResult {
  direction: EquilibriumDirection;
  nearEquilibrium: boolean;
  activityModel: EquilibriumActivityModel;
  reactionQuotientQ?: number;
  equilibriumConstantK?: number;
  lnReactionQuotientQ?: number;
  lnEquilibriumConstantK?: number;
  /** Dimensionless thermodynamic driving coordinate. Negative favors forward reaction as written. */
  lnQOverK?: number;
  /** Current reaction Gibbs energy RT ln(Q/K), only when finite and supported. */
  deltaG_J_per_mol?: number;
  scientificStatus: ScientificStatus;
  confidence: Confidence;
  reasonCodes: readonly EquilibriumReasonCode[];
  referenceTemperatureK?: number;
  standardState: EquilibriumStandardState;
  tolerance: EquilibriumToleranceMetadata;
  source?: SourceMetadata;
}

export interface ExactReverseStandardThermoEvidence {
  reversiblePairId: string;
  channelDirection: "FORWARD" | "REVERSE";
  referenceTemperatureK: number;
  deltaGStandard_J_per_mol?: EvaluatedQuantity;
  deltaHStandard_J_per_mol?: EvaluatedQuantity;
}

export interface ExactReversePairProof {
  reversiblePairId: string;
  exactReverseConfirmed: true;
  sourceIds: readonly string[];
  note?: string;
}

const STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

const CONFIDENCE_ORDER: Record<Confidence, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
  UNASSESSED: 3,
};

function worstStatus(values: readonly ScientificStatus[]): ScientificStatus {
  return values.reduce(
    (worst, value) => STATUS_ORDER[value] > STATUS_ORDER[worst] ? value : worst,
    "VERIFIED",
  );
}

function worstConfidence(values: readonly Confidence[]): Confidence {
  return values.reduce(
    (worst, value) => CONFIDENCE_ORDER[value] > CONFIDENCE_ORDER[worst] ? value : worst,
    "HIGH",
  );
}

function validPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function sameStandardState(a: EquilibriumStandardState, b: EquilibriumStandardState): boolean {
  return a.standardPressurePa === b.standardPressurePa &&
    a.standardConcentrationMolPerM3 === b.standardConcentrationMolPerM3;
}

function safeExp(logValue: number): number | undefined {
  if (!Number.isFinite(logValue) || logValue > LOG_MAX_VALUE || logValue < LOG_MIN_VALUE) return undefined;
  const value = Math.exp(logValue);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeTolerance(
  value: Partial<EquilibriumToleranceMetadata> | undefined,
): EquilibriumToleranceMetadata {
  const epsilon = value?.epsilonLnQOverK ?? DEFAULT_EQUILIBRIUM_TOLERANCE.epsilonLnQOverK;
  if (!Number.isFinite(epsilon) || epsilon <= 0) {
    throw new RangeError("epsilonLnQOverK must be finite and > 0.");
  }
  return {
    epsilonLnQOverK: epsilon,
    scientificStatus: value?.scientificStatus ?? "APPROXIMATED",
    basis: value?.basis ?? (value ? "CONFIGURED" : "ENGINEERING_DEFAULT"),
  };
}

function openResult(
  standardState: EquilibriumStandardState,
  tolerance: EquilibriumToleranceMetadata,
  reasonCodes: readonly EquilibriumReasonCode[],
  activityModel: EquilibriumActivityModel = "OPEN",
): EquilibriumEvaluationResult {
  return {
    direction: "OPEN",
    nearEquilibrium: false,
    activityModel,
    scientificStatus: "OPEN",
    confidence: "UNASSESSED",
    reasonCodes,
    standardState,
    tolerance,
  };
}

interface ActivityEvaluation {
  model: EquilibriumActivityModel;
  lnQ?: number;
  zeroProductActivity: boolean;
  zeroReactantActivity: boolean;
  status: ScientificStatus;
  confidence: Confidence;
  reasons: EquilibriumReasonCode[];
}

function evaluateActivities(
  view: ReactionCandidateEvaluationView,
  composition: EquilibriumComposition,
  standardState: EquilibriumStandardState,
): ActivityEvaluation | undefined {
  const states = new Map(composition.species.map((state) => [state.speciesKey, state] as const));
  if (states.size !== composition.species.length) return undefined;

  const signedNu = new Map<string, number>();
  for (const term of view.products) {
    signedNu.set(term.speciesKey, (signedNu.get(term.speciesKey) ?? 0) + term.coefficient);
  }
  for (const term of view.reactants) {
    signedNu.set(term.speciesKey, (signedNu.get(term.speciesKey) ?? 0) - term.coefficient);
  }

  let hasGas = false;
  let hasAqueous = false;
  let hasPureCondensed = false;
  let lnQ = 0;
  let zeroProductActivity = false;
  let zeroReactantActivity = false;
  const reasons = new Set<EquilibriumReasonCode>();

  for (const [speciesKey, nu] of signedNu) {
    if (nu === 0) continue;
    if (!Number.isFinite(nu)) return undefined;
    const state = states.get(speciesKey);
    if (!state) return undefined;

    let activity: number | undefined;
    if (state.activityDimensionless !== undefined) {
      if (!Number.isFinite(state.activityDimensionless) || state.activityDimensionless < 0) return undefined;
      activity = state.activityDimensionless;
      if (state.phase === "gas") {
        hasGas = true;
        reasons.add("IDEAL_GAS_ACTIVITY");
      } else if (state.phase === "aqueous") {
        hasAqueous = true;
        reasons.add("IDEAL_DILUTE_ACTIVITY");
      } else if ((state.phase === "solid" || state.phase === "liquid") && state.purePhaseActivityOne) {
        hasPureCondensed = true;
        reasons.add("PURE_PHASE_ACTIVITY_ONE");
      } else {
        return undefined;
      }
    } else if (state.phase === "gas") {
      hasGas = true;
      reasons.add("IDEAL_GAS_ACTIVITY");
      if (state.partialPressurePa === undefined || !Number.isFinite(state.partialPressurePa) || state.partialPressurePa < 0) return undefined;
      activity = state.partialPressurePa / standardState.standardPressurePa;
    } else if (state.phase === "aqueous") {
      hasAqueous = true;
      reasons.add("IDEAL_DILUTE_ACTIVITY");
      if (state.concentrationMolPerM3 === undefined || !Number.isFinite(state.concentrationMolPerM3) || state.concentrationMolPerM3 < 0) return undefined;
      activity = state.concentrationMolPerM3 / standardState.standardConcentrationMolPerM3;
    } else if (
      (state.phase === "solid" || state.phase === "liquid") &&
      state.purePhaseActivityOne === true &&
      state.amountMol !== undefined &&
      Number.isFinite(state.amountMol) &&
      state.amountMol > 0
    ) {
      hasPureCondensed = true;
      reasons.add("PURE_PHASE_ACTIVITY_ONE");
      activity = 1;
    } else {
      return undefined;
    }

    if (activity === 0) {
      if (nu > 0) zeroProductActivity = true;
      else zeroReactantActivity = true;
      continue;
    }
    if (!validPositive(activity)) return undefined;
    const contribution = nu * Math.log(activity);
    if (!Number.isFinite(contribution) || !Number.isFinite(lnQ + contribution)) return undefined;
    lnQ += contribution;
  }

  if (hasGas && hasAqueous) return undefined;
  const model: EquilibriumActivityModel = hasGas
    ? "IDEAL_GAS_PARTIAL_PRESSURE"
    : hasAqueous
      ? "IDEAL_DILUTE_SOLUTION"
      : hasPureCondensed
        ? "PURE_PHASE_ACTIVITY_ONE"
        : "OPEN";

  if (model === "OPEN") return undefined;
  return {
    model,
    lnQ,
    zeroProductActivity,
    zeroReactantActivity,
    status: model === "PURE_PHASE_ACTIVITY_ONE" ? "VERIFIED" : "APPROXIMATED",
    confidence: model === "PURE_PHASE_ACTIVITY_ONE" ? "HIGH" : "MEDIUM",
    reasons: [...reasons],
  };
}

interface ResolvedK {
  lnK: number;
  referenceTemperatureK: number;
  status: ScientificStatus;
  confidence: Confidence;
  source: SourceMetadata;
  reason: "REFERENCE_K_DATA" | "STANDARD_GIBBS_TO_K";
}

function resolveK(
  view: ReactionCandidateEvaluationView,
  temperatureK: number,
  standardState: EquilibriumStandardState,
  provider: EquilibriumDataProvider,
  referenceTemperatureToleranceK: number,
): ResolvedK | EquilibriumReasonCode {
  const direct = provider.getEquilibriumConstant?.(view, temperatureK);
  if (direct) {
    if (!validPositive(direct.referenceTemperatureK)) return "REFERENCE_TEMPERATURE_MISMATCH";
    if (Math.abs(direct.referenceTemperatureK - temperatureK) > referenceTemperatureToleranceK) {
      return "REFERENCE_TEMPERATURE_MISMATCH";
    }
    if (!sameStandardState(direct.standardState, standardState)) return "STANDARD_STATE_MISMATCH";

    let lnK = direct.lnEquilibriumConstantK;
    if (lnK !== undefined && !Number.isFinite(lnK)) return "NUMERICAL_RANGE_EXCEEDED";
    if (direct.equilibriumConstantK !== undefined) {
      if (!validPositive(direct.equilibriumConstantK)) return "NUMERICAL_RANGE_EXCEEDED";
      const directLnK = Math.log(direct.equilibriumConstantK);
      if (lnK !== undefined && Math.abs(lnK - directLnK) > 1e-10 * Math.max(1, Math.abs(lnK), Math.abs(directLnK))) {
        return "INCONSISTENT_K_REPRESENTATION";
      }
      lnK ??= directLnK;
    }
    if (lnK === undefined) return "MISSING_EQUILIBRIUM_DATA";
    return {
      lnK,
      referenceTemperatureK: direct.referenceTemperatureK,
      status: direct.status,
      confidence: direct.confidence,
      source: direct.source,
      reason: "REFERENCE_K_DATA",
    };
  }

  const standardGibbs = provider.getStandardReactionGibbs?.(view, temperatureK);
  if (!standardGibbs) return "MISSING_EQUILIBRIUM_DATA";
  if (!validPositive(standardGibbs.referenceTemperatureK) ||
      Math.abs(standardGibbs.referenceTemperatureK - temperatureK) > referenceTemperatureToleranceK) {
    return "REFERENCE_TEMPERATURE_MISMATCH";
  }
  if (!sameStandardState(standardGibbs.standardState, standardState)) return "STANDARD_STATE_MISMATCH";
  const deltaGStandard = standardGibbs.deltaGStandard_J_per_mol.value;
  if (!Number.isFinite(deltaGStandard)) return "NUMERICAL_RANGE_EXCEEDED";
  const lnK = -deltaGStandard / (GAS_CONSTANT_J_PER_MOL_K * temperatureK);
  if (!Number.isFinite(lnK)) return "NUMERICAL_RANGE_EXCEEDED";
  return {
    lnK,
    referenceTemperatureK: standardGibbs.referenceTemperatureK,
    status: standardGibbs.deltaGStandard_J_per_mol.status,
    confidence: standardGibbs.deltaGStandard_J_per_mol.confidence,
    source: standardGibbs.deltaGStandard_J_per_mol.source,
    reason: "STANDARD_GIBBS_TO_K",
  };
}

/**
 * Evaluates thermodynamic direction only. It never mutates composition and never
 * creates reaction extent. Kinetics/network code may consume the returned
 * driving signal separately.
 */
export function evaluateReactionEquilibrium(
  view: ReactionCandidateEvaluationView,
  composition: EquilibriumComposition,
  temperatureK: number,
  provider: EquilibriumDataProvider,
  options: EquilibriumEvaluationOptions = {},
): EquilibriumEvaluationResult {
  if (!validPositive(temperatureK)) throw new RangeError("temperatureK must be finite and > 0.");
  const standardState = options.standardState ?? DEFAULT_EQUILIBRIUM_STANDARD_STATE;
  if (!validPositive(standardState.standardPressurePa) || !validPositive(standardState.standardConcentrationMolPerM3)) {
    throw new RangeError("equilibrium standard-state scales must be finite and > 0.");
  }
  const referenceTemperatureToleranceK = options.referenceTemperatureToleranceK ?? 1e-9;
  if (!Number.isFinite(referenceTemperatureToleranceK) || referenceTemperatureToleranceK < 0) {
    throw new RangeError("referenceTemperatureToleranceK must be finite and >= 0.");
  }
  const tolerance = normalizeTolerance(options.tolerance);
  const toleranceReason: EquilibriumReasonCode = tolerance.basis === "ENGINEERING_DEFAULT"
    ? "DEFAULT_ENGINEERING_TOLERANCE"
    : "CONFIGURED_EQUILIBRIUM_TOLERANCE";

  const activities = evaluateActivities(view, composition, standardState);
  if (!activities) {
    return openResult(standardState, tolerance, ["UNSUPPORTED_ACTIVITY_MODEL", toleranceReason]);
  }

  if (activities.zeroProductActivity && activities.zeroReactantActivity) {
    return openResult(
      standardState,
      tolerance,
      [...activities.reasons, "ZERO_PRODUCT_ACTIVITY", "ZERO_REACTANT_ACTIVITY", "INDETERMINATE_ZERO_ACTIVITIES", toleranceReason],
      activities.model,
    );
  }

  const kResult = resolveK(view, temperatureK, standardState, provider, referenceTemperatureToleranceK);
  if (typeof kResult === "string") {
    return openResult(
      standardState,
      tolerance,
      [...activities.reasons, kResult, toleranceReason],
      activities.model,
    );
  }

  const reasons: EquilibriumReasonCode[] = [...activities.reasons, kResult.reason, toleranceReason];
  const reactionQuotientQ = activities.zeroProductActivity ? 0 : safeExp(activities.lnQ ?? 0);
  const equilibriumConstantK = safeExp(kResult.lnK);

  if (activities.zeroProductActivity) {
    reasons.push("ZERO_PRODUCT_ACTIVITY");
    return {
      direction: "FORWARD_FAVORED",
      nearEquilibrium: false,
      activityModel: activities.model,
      reactionQuotientQ: 0,
      ...(equilibriumConstantK === undefined ? {} : { equilibriumConstantK }),
      lnEquilibriumConstantK: kResult.lnK,
      scientificStatus: worstStatus([activities.status, kResult.status, tolerance.scientificStatus]),
      confidence: worstConfidence([activities.confidence, kResult.confidence]),
      reasonCodes: reasons,
      referenceTemperatureK: kResult.referenceTemperatureK,
      standardState,
      tolerance,
      source: kResult.source,
    };
  }

  if (activities.zeroReactantActivity) {
    reasons.push("ZERO_REACTANT_ACTIVITY");
    return {
      direction: "REVERSE_FAVORED",
      nearEquilibrium: false,
      activityModel: activities.model,
      ...(equilibriumConstantK === undefined ? {} : { equilibriumConstantK }),
      lnEquilibriumConstantK: kResult.lnK,
      scientificStatus: worstStatus([activities.status, kResult.status, tolerance.scientificStatus]),
      confidence: worstConfidence([activities.confidence, kResult.confidence]),
      reasonCodes: reasons,
      referenceTemperatureK: kResult.referenceTemperatureK,
      standardState,
      tolerance,
      source: kResult.source,
    };
  }

  const lnQ = activities.lnQ;
  if (lnQ === undefined || !Number.isFinite(lnQ)) {
    return openResult(standardState, tolerance, [...reasons, "NUMERICAL_RANGE_EXCEEDED"], activities.model);
  }
  const lnQOverK = lnQ - kResult.lnK;
  if (!Number.isFinite(lnQOverK)) {
    return openResult(standardState, tolerance, [...reasons, "NUMERICAL_RANGE_EXCEEDED"], activities.model);
  }

  const nearEquilibrium = Math.abs(lnQOverK) <= tolerance.epsilonLnQOverK;
  const direction: EquilibriumDirection = nearEquilibrium
    ? "NEAR_EQUILIBRIUM"
    : lnQOverK < 0
      ? "FORWARD_FAVORED"
      : "REVERSE_FAVORED";
  if (nearEquilibrium) reasons.push("NEAR_EQUILIBRIUM_BY_LOG_RATIO");

  const deltaG = GAS_CONSTANT_J_PER_MOL_K * temperatureK * lnQOverK;
  const finiteDeltaG = Number.isFinite(deltaG) ? deltaG : undefined;
  if (finiteDeltaG === undefined) reasons.push("NUMERICAL_RANGE_EXCEEDED");

  return {
    direction,
    nearEquilibrium,
    activityModel: activities.model,
    ...(reactionQuotientQ === undefined ? {} : { reactionQuotientQ }),
    ...(equilibriumConstantK === undefined ? {} : { equilibriumConstantK }),
    lnReactionQuotientQ: lnQ,
    lnEquilibriumConstantK: kResult.lnK,
    lnQOverK,
    ...(finiteDeltaG === undefined ? {} : { deltaG_J_per_mol: finiteDeltaG }),
    scientificStatus: worstStatus([activities.status, kResult.status, tolerance.scientificStatus]),
    confidence: worstConfidence([activities.confidence, kResult.confidence]),
    reasonCodes: reasons,
    referenceTemperatureK: kResult.referenceTemperatureK,
    standardState,
    tolerance,
    source: kResult.source,
  };
}

function negateQuantity(quantity: EvaluatedQuantity | undefined, proof: ExactReversePairProof): EvaluatedQuantity | undefined {
  if (!quantity) return undefined;
  return {
    ...quantity,
    value: -quantity.value,
    source: {
      ...quantity.source,
      sourceIds: [...new Set([...quantity.source.sourceIds, ...proof.sourceIds])].sort(),
      note: proof.note ?? `Exact reverse of reversible pair ${proof.reversiblePairId}.`,
    },
  };
}

/**
 * Reverse standard thermochemistry may be sign-derived only with explicit
 * provenance confirming an exact reverse physical process.
 */
export function deriveExactReverseStandardThermo(
  forward: ExactReverseStandardThermoEvidence,
  proof: ExactReversePairProof,
): ExactReverseStandardThermoEvidence {
  if (forward.channelDirection !== "FORWARD") {
    throw new Error("Exact reverse derivation requires FORWARD source evidence.");
  }
  if (forward.reversiblePairId !== proof.reversiblePairId) {
    throw new Error("Reversible-pair provenance mismatch.");
  }
  return {
    reversiblePairId: forward.reversiblePairId,
    channelDirection: "REVERSE",
    referenceTemperatureK: forward.referenceTemperatureK,
    ...(forward.deltaGStandard_J_per_mol
      ? { deltaGStandard_J_per_mol: negateQuantity(forward.deltaGStandard_J_per_mol, proof)! }
      : {}),
    ...(forward.deltaHStandard_J_per_mol
      ? { deltaHStandard_J_per_mol: negateQuantity(forward.deltaHStandard_J_per_mol, proof)! }
      : {}),
  };
}
