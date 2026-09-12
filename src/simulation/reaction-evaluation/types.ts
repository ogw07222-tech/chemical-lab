import type { Confidence } from "../../data/schema";
import type { PhaseKind, ScientificStatus } from "../molecular/types";

export type ThermodynamicDirection =
  | "FORWARD_FAVORED"
  | "REVERSE_FAVORED"
  | "NEAR_EQUILIBRIUM"
  | "INDETERMINATE";

export type Feasibility = "FEASIBLE" | "INFEASIBLE" | "UNCERTAIN";
export type RateClass = "NEGLIGIBLE" | "SLOW" | "MODERATE" | "FAST" | "VERY_FAST" | "UNKNOWN";
export type PressureRelevance = "NONE" | "POSSIBLE" | "RELEVANT" | "UNKNOWN";
export type PhaseAccessibilityClass = "GAS_GAS" | "SOLUTION" | "HETEROGENEOUS" | "SOLID_SOLID_LOW" | "UNKNOWN";
export type KineticSupportClass = "DIMENSIONED_RATE" | "RELATIVE_RATE" | "QUALITATIVE_ONLY" | "OPEN";
export type ReversibleChannelDirection = "FORWARD" | "REVERSE" | "UNSPECIFIED";

export interface KineticEnvironmentDependencies {
  temperature: boolean;
  activityOrConcentration: boolean;
  pressure: boolean;
  catalyst: boolean;
  phase: boolean;
}

export interface ReversibleChannelMetadata {
  pairKey?: string;
  direction: ReversibleChannelDirection;
  /** True only when provider/model evidence actually supports detailed balance. */
  detailedBalanceSupported: boolean;
}

export type ReasonCode =
  | "DIRECT_THERMO_DATA"
  | "FORMATION_THERMO_DATA"
  | "BOND_ENERGY_APPROXIMATION"
  | "STRUCTURAL_APPROXIMATION"
  | "MISSING_THERMO_DATA"
  | "MISSING_ENTROPY"
  | "THERMODYNAMICALLY_FAVORABLE"
  | "THERMODYNAMICALLY_UNFAVORABLE"
  | "THERMODYNAMIC_DIRECTION_UNKNOWN"
  | "ACTIVATION_BARRIER_KNOWN"
  | "ACTIVATION_BARRIER_UNKNOWN"
  | "DIMENSIONED_RATE_DATA"
  | "QUALITATIVE_RATE_DATA"
  | "CATALYST_APPLIED"
  | "PHASE_ACCESSIBILITY_LIMITED"
  | "PHASE_ACCESSIBILITY_UNKNOWN"
  | "OPEN_PROPAGATED";

export interface SourceMetadata {
  sourceIds: readonly string[];
  modelId?: string;
  note?: string;
}

export interface EvaluatedQuantity {
  value: number;
  status: ScientificStatus;
  confidence: Confidence;
  source: SourceMetadata;
}

/**
 * Read-only projection of the 01 ReactionCandidate contract.
 * 02 does not own candidate generation, product semantics, or stoichiometry.
 */
export interface CandidateSpeciesTerm {
  speciesKey: string;
  coefficient: number;
  phase: PhaseKind;
}

export interface ReactionCandidateEvaluationView {
  candidateId: string;
  family: string;
  reactants: readonly CandidateSpeciesTerm[];
  products: readonly CandidateSpeciesTerm[];
  accessMode: string;
  scientificStatus: ScientificStatus;
  bondChangeKey?: string;
  /** Optional 01-provided channel identity. 02 never invents a reverse channel. */
  reversible?: {
    pairKey?: string;
    direction: Exclude<ReversibleChannelDirection, "UNSPECIFIED">;
  };
}

export interface ReactionCandidateAdapter<TCandidate> {
  toEvaluationView(candidate: TCandidate): ReactionCandidateEvaluationView;
}

export interface ReactionEnvironment {
  temperatureK: number;
  pressurePa?: number;
  activityScale?: number;
  catalyst?: {
    id: string;
    barrierReduction_J_per_mol?: number;
    rateMultiplier?: number;
    status: ScientificStatus;
    confidence: Confidence;
  };
}

export interface DirectReactionThermoData {
  deltaH_J_per_mol?: EvaluatedQuantity;
  deltaS_J_per_mol_K?: EvaluatedQuantity;
  deltaG_J_per_mol?: EvaluatedQuantity;
}

export interface SpeciesThermoData {
  enthalpyOfFormation_J_per_mol?: EvaluatedQuantity;
  standardMolarEntropy_J_per_mol_K?: EvaluatedQuantity;
  gibbsEnergyOfFormation_J_per_mol?: EvaluatedQuantity;
}

export interface KineticBarrierData {
  activationEnergy_J_per_mol: EvaluatedQuantity;
  preExponentialFactor?: EvaluatedQuantity;
}

export interface DimensionedExtentRateData {
  /** Authoritative extent rate for this candidate/channel in mol/s at the queried environment. */
  extentRateMolPerS: EvaluatedQuantity;
  dependencies: KineticEnvironmentDependencies;
}

export interface QualitativeRateData {
  rateClass: RateClass;
  status: ScientificStatus;
  confidence: Confidence;
  source: SourceMetadata;
  dependencies?: Partial<KineticEnvironmentDependencies>;
}

/**
 * 03-facing provider boundary. Values are normalized to canonical SI.
 * Missing data remains missing; no fallback may fabricate an activation energy or physical rate.
 */
export interface ReactionEvaluationDataProvider {
  getDirectReactionThermo?(
    candidateId: string,
    environment: ReactionEnvironment,
  ): DirectReactionThermoData | undefined;
  getSpeciesThermo(speciesKey: string, phase: PhaseKind): SpeciesThermoData | undefined;
  getBondEnergyApproximation?(view: ReactionCandidateEvaluationView): EvaluatedQuantity | undefined;
  getStructuralEnthalpyApproximation?(view: ReactionCandidateEvaluationView): EvaluatedQuantity | undefined;
  getActivationBarrier?(view: ReactionCandidateEvaluationView): KineticBarrierData | undefined;
  getDimensionedExtentRate?(
    view: ReactionCandidateEvaluationView,
    environment: ReactionEnvironment,
  ): DimensionedExtentRateData | undefined;
  getQualitativeRate?(
    view: ReactionCandidateEvaluationView,
    environment: ReactionEnvironment,
  ): QualitativeRateData | undefined;
  supportsDetailedBalance?(pairKey: string, environment: ReactionEnvironment): boolean;
}

export interface ThermodynamicEvaluationResult {
  deltaH_J_per_mol?: number;
  deltaS_J_per_mol_K?: number;
  deltaG_J_per_mol?: number;
  direction: ThermodynamicDirection;
  confidence: Confidence;
  approximationClass: ScientificStatus;
  source: SourceMetadata;
}

export interface KineticEvaluationResult {
  supportClass: KineticSupportClass;
  activationEnergy_J_per_mol?: number;
  /** Physical extent rate only when supportClass === DIMENSIONED_RATE. */
  extentRateMolPerS?: number;
  /** Dimensionless progression/ranking signal only; never display as mol/s. */
  relativeRate?: number;
  rateClass: RateClass;
  confidence: Confidence;
  approximationClass: ScientificStatus;
  dependencies: KineticEnvironmentDependencies;
}

export interface EnvironmentEvaluationResult {
  /** Dimensionless Arrhenius contribution exp(-Ea/RT), not an absolute rate. */
  temperatureContribution: number;
  pressureRelevance: PressureRelevance;
  /** Placeholder dimensionless activity/concentration contribution. */
  activityContribution: number;
  catalystModifier: number;
  phaseAccessibility: {
    class: PhaseAccessibilityClass;
    factor: number;
    status: ScientificStatus;
  };
}

export interface ReactionEvaluation {
  candidateId: string;
  thermo: ThermodynamicEvaluationResult;
  kinetics: KineticEvaluationResult;
  environment: EnvironmentEvaluationResult;
  reversibility: ReversibleChannelMetadata;
  feasible: Feasibility;
  /** Stable dimensionless ranking score. null means unavailable/OPEN. */
  rankScore: number | null;
  status: ScientificStatus;
  reasonCodes: readonly ReasonCode[];
}

export interface RankedReactionEvaluation extends ReactionEvaluation {
  rank: number | null;
  tie: boolean;
}
