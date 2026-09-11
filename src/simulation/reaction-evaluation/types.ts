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
 * A future executable 01 ReactionCandidate should be adapted into this view.
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

/**
 * 03-facing provider boundary. Values are already normalized to canonical SI.
 * Production data adapters may wrap src/data/schema.ts without coupling the
 * evaluator to storage/provenance implementation details.
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
  activationEnergy_J_per_mol?: number;
  rateClass: RateClass;
  relativeRate?: number;
  confidence: Confidence;
  approximationClass: ScientificStatus;
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
