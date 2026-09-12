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
  /** New Phase 3A metadata. Optional for backward-compatible manually-built fixtures. */
  supportClass?: KineticSupportClass;
  activationEnergy_J_per_mol?: number;
  extentRateMolPerS?: number;
  relativeRate?: number;
  rateClass: RateClass;
  confidence: Confidence;
  approximationClass: ScientificStatus;
  dependencies?: KineticEnvironmentDependencies;
}

export interface EnvironmentEvaluationResult {
  temperatureContribution: number;
  pressureRelevance: PressureRelevance;
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
  /** New Phase 3A metadata; omitted by legacy/manual fixtures. */
  reversibility?: ReversibleChannelMetadata;
  feasible: Feasibility;
  rankScore: number | null;
  status: ScientificStatus;
  reasonCodes: readonly ReasonCode[];
}

export interface RankedReactionEvaluation extends ReactionEvaluation {
  rank: number | null;
  tie: boolean;
}
