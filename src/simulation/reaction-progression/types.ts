import type { ElementProvider, MoleculeRecord, ScientificStatus, SpeciesId, SpeciesState } from "../molecular";
import type { ReactionCandidate } from "../reaction";
import type { RankedReactionEvaluation } from "../reaction-evaluation";
import type { ThermalState, ThermalStepInput } from "../thermal";

export type ReactionResolutionReasonCode =
  | "SELECTED"
  | "INFEASIBLE"
  | "UNCERTAIN_DEFERRED"
  | "UNRANKED_DEFERRED"
  | "MISSING_KINETIC_SIGNAL"
  | "NEGLIGIBLE_KINETICS"
  | "ZERO_INITIAL_REACTANT"
  | "ZERO_EXTENT"
  | "UNRESOLVED_PRODUCT_IDENTITY"
  | "PRODUCT_IDENTITY_MISMATCH"
  | "PRODUCT_REGISTRATION_FAILED"
  | "SHARED_REACTANT_SCALED"
  | "MAX_FRACTION_BOUNDED"
  | "COARSE_RELATIVE_RATE_EXTENT"
  | "DIMENSIONED_RATE_EXTENT"
  | "MISSING_REACTION_ENTHALPY"
  | "REACTION_HEAT_APPLIED";

export interface ReactionProductStateResolution {
  speciesId: SpeciesId;
}

export interface ReactionProductStateResolver {
  resolveProductState(
    candidate: ReactionCandidate,
    productIndex: number,
    product: MoleculeRecord,
    currentSpecies: readonly SpeciesState[],
  ): ReactionProductStateResolution | undefined;
}

export interface ReactionResolutionOptions {
  maxFractionalConsumptionPerStep?: number;
  coarseRateTimescaleS?: number;
  amountToleranceMol?: number;
  conservationTolerance?: number;
  allowUncertainEvaluations?: boolean;
}

export interface ReactionResolutionInput {
  species: readonly SpeciesState[];
  elements: ElementProvider;
  candidates: readonly ReactionCandidate[];
  rankedEvaluations: readonly RankedReactionEvaluation[];
  productStateResolver: ReactionProductStateResolver;
  dtS: number;
  timestepId: string;
  startTimeS: number;
  temperatureK: number;
  pressurePa?: number;
  volumeM3?: number;
  options?: ReactionResolutionOptions;
}

export interface SpeciesAmountDelta {
  speciesId: SpeciesId;
  deltaMol: number;
}

export interface ResolvedReaction {
  candidateId: string;
  rank: number;
  requestedExtentMol: number;
  maxAvailableExtentMol: number;
  appliedExtentMol: number;
  limitingReactantIds: readonly SpeciesId[];
  evaluation: RankedReactionEvaluation;
  scientificStatus: ScientificStatus;
  reasonCodes: readonly ReactionResolutionReasonCode[];
  speciesAmountDeltas: readonly SpeciesAmountDelta[];
}

export interface DeferredReaction {
  candidateId: string;
  reasonCodes: readonly ReactionResolutionReasonCode[];
  evaluation?: RankedReactionEvaluation;
}

export interface ReactionProgressEvent {
  id: string;
  timestepId: string;
  candidateId: string;
  sequence: number;
  startTimeS: number;
  endTimeS: number;
  dtS: number;
  extentMol: number;
  reactantDeltasMol: Readonly<Record<SpeciesId, number>>;
  productDeltasMol: Readonly<Record<SpeciesId, number>>;
  speciesAmountDeltaMol: Readonly<Record<SpeciesId, number>>;
  deltaH_JPerMolExtent?: number;
  heatJ?: number;
  temperatureBeforeK?: number;
  temperatureAfterK?: number;
  scientificStatus: ScientificStatus;
  reasonCodes: readonly ReactionResolutionReasonCode[];
}

export interface ReactionResolutionDiagnostics {
  considered: number;
  selected: number;
  deferred: number;
  rankGroups: number;
  sharedReactantScaled: number;
  unresolvedProducts: number;
}

export interface ReactionResolutionResult {
  speciesBefore: readonly SpeciesState[];
  speciesAfter: readonly SpeciesState[];
  selected: readonly ResolvedReaction[];
  deferred: readonly DeferredReaction[];
  progressEvents: readonly ReactionProgressEvent[];
  netSpeciesAmountDeltaMol: Readonly<Record<SpeciesId, number>>;
  diagnostics: ReactionResolutionDiagnostics;
}

export type ReactionThermalCoverage = "COMPLETE" | "PARTIAL" | "OPEN";

export interface ReactionThermalCouplingResult {
  state: ThermalState;
  events: readonly ReactionProgressEvent[];
  scientificStatus: ScientificStatus;
  missingHeatCandidateIds: readonly string[];
  knownReactionHeat_J: number;
  /** Phase 3A additive metadata; real coupling populates all fields. */
  openHeatCandidateIds?: readonly string[];
  knownContributionCount?: number;
  committedContributionCount?: number;
  thermalCoverage?: ReactionThermalCoverage;
}

export type ExternalThermalStepInput = Omit<
  ThermalStepInput,
  "dtS" | "reactionHeat" | "reactionHeat_J"
>;

export interface ReactionThermalCouplingInput {
  thermalState: ThermalState;
  progressEvents: readonly ReactionProgressEvent[];
  evaluations: readonly RankedReactionEvaluation[];
  dtS: number;
  externalThermal?: ExternalThermalStepInput;
}
