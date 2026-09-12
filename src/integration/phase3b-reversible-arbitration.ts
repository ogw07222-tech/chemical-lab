import type { ScientificStatus, SpeciesId, SpeciesState } from "../simulation/molecular";
import type { ReactionCandidate, ReactionCandidateGenerationInput } from "../simulation/reaction";
import {
  evaluateReactionEquilibrium,
  recommendEquilibriumProgression,
  type EquilibriumComposition,
  type EquilibriumDataProvider,
  type EquilibriumEvaluationOptions,
  type EquilibriumEvaluationResult,
  type EquilibriumProgressionOptions,
  type EquilibriumProgressionReasonCode,
  type EquilibriumProgressionRecommendation,
  type ReactionCandidateEvaluationView,
  type RankedReactionEvaluation,
} from "../simulation/reaction-evaluation";
import {
  applyReactionThermalCoupling,
  resolveReactionCandidates,
  resolveReactionCandidatesWithRegistry,
  type ReactionCandidateExtentControl,
  type ReactionEquilibriumEventMetadata,
} from "../simulation/reaction-progression";
import type { DynamicSpeciesRegistryLike } from "../simulation/species-registry";
import {
  runPhase2ReactionFoundation,
  type Phase2ReactionPipelineResult,
} from "./phase2-reaction";
import {
  type Phase2EReactionProgressionConfig,
  type Phase2EReactionProgressionResult,
} from "./phase2e-reaction-progression";
import {
  projectReactionProgressEvent,
  runPhase3AReactionNetworkStep,
  type Phase3AProviderProjection,
  type Phase3AReactionNetworkInput,
  type Phase3AReactionNetworkState,
  type Phase3AReactionNetworkStepConfig,
  type Phase3AReactionNetworkStepResult,
  type ReactionFactProjection,
} from "./phase3a-reaction-network";

const AMOUNT_TOLERANCE_MOL = 1e-12;

const STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

function worstStatus(values: readonly ScientificStatus[]): ScientificStatus {
  return values.reduce(
    (worst, current) => STATUS_ORDER[current] > STATUS_ORDER[worst] ? current : worst,
    "VERIFIED",
  );
}

export interface Phase3BEquilibriumCompositionAdapter {
  /**
   * Converts an 01-owned read-only vessel projection into the activity-facing
   * composition consumed by 02 equilibrium thermodynamics. Activity/pressure/
   * concentration modeling belongs in this adapter, not in 01 arbitration.
   */
  toEquilibriumComposition(input: {
    species: readonly SpeciesState[];
    view: ReactionCandidateEvaluationView;
    temperatureK: number;
    pressurePa?: number;
    volumeM3?: number;
  }): EquilibriumComposition;
}

export interface Phase3BEquilibriumAuthority {
  provider: EquilibriumDataProvider;
  compositionAdapter: Phase3BEquilibriumCompositionAdapter;
  equilibriumOptions?: EquilibriumEvaluationOptions;
  progressionOptions?: EquilibriumProgressionOptions;
}

export interface ReversiblePairArbitrationFact {
  reversiblePairId: string;
  equilibriumDirection: EquilibriumProgressionRecommendation["mode"];
  equilibriumScientificStatus: ScientificStatus;
  selectedChannelDirection?: "FORWARD" | "REVERSE";
  drivingStrength: number;
  maxNetProgressFraction: number;
  preventEquilibriumCrossing: boolean;
  maxExtentTowardEquilibriumMol?: number;
  lnQOverK?: number;
  reactionQuotientQ?: number;
  equilibriumConstantK?: number;
  reasonCodes: readonly EquilibriumProgressionReasonCode[];
}

export interface Phase3BReversibleArbitrationResult {
  candidateExtentControls: Readonly<Record<string, ReactionCandidateExtentControl>>;
  pairs: readonly ReversiblePairArbitrationFact[];
}

export interface Phase3BReactionProgressionConfig extends Phase2EReactionProgressionConfig {
  equilibrium: Phase3BEquilibriumAuthority;
}

export interface Phase3BReactionProgressionResult extends Phase2EReactionProgressionResult {
  arbitration: Phase3BReversibleArbitrationResult;
}

export interface Phase3BReactionFactProjection extends ReactionFactProjection {
  reversiblePairId?: string;
  channelDirection?: "FORWARD" | "REVERSE";
  equilibriumDirection?: EquilibriumProgressionRecommendation["mode"];
  equilibriumScientificStatus?: ScientificStatus;
  equilibriumDrivingStrength?: number;
  lnQOverK?: number;
  reactionQuotientQ?: number;
  equilibriumConstantK?: number;
}

export interface Phase3BProviderProjection
  extends Omit<Phase3AProviderProjection, "activeReactionEvents" | "timelineEvents"> {
  activeReactionEvents: readonly Phase3BReactionFactProjection[];
  timelineEvents: readonly Phase3BReactionFactProjection[];
  reversiblePairs: readonly ReversiblePairArbitrationFact[];
}

export interface Phase3BReactionNetworkStepConfig extends Phase3AReactionNetworkStepConfig {
  equilibrium: Phase3BEquilibriumAuthority;
}

export interface Phase3BReactionNetworkStepResult
  extends Omit<Phase3AReactionNetworkStepResult, "provider"> {
  provider: Phase3BProviderProjection;
  arbitration: Phase3BReversibleArbitrationResult;
}

interface PairChannels {
  pairId: string;
  forward?: ReactionCandidate;
  reverse?: ReactionCandidate;
}

function stateById(species: readonly SpeciesState[]): ReadonlyMap<SpeciesId, SpeciesState> {
  return new Map(species.map((state) => [state.id, state] as const));
}

function maxFeasibleExtentMol(candidate: ReactionCandidate, species: readonly SpeciesState[]): number {
  const states = stateById(species);
  let maximum = Number.POSITIVE_INFINITY;
  for (const term of candidate.stoichiometry.reactants) {
    if (!Number.isFinite(term.coefficient) || term.coefficient <= 0) {
      throw new Error(`INVALID_STOICHIOMETRY:${candidate.id}`);
    }
    const amount = states.get(term.speciesId)?.amountMol;
    if (amount === undefined) return 0;
    maximum = Math.min(maximum, amount / term.coefficient);
  }
  return Number.isFinite(maximum) ? Math.max(0, maximum) : 0;
}

function resolveProductTargets(
  candidate: ReactionCandidate,
  opposite: ReactionCandidate,
  species: readonly SpeciesState[],
): ReadonlyMap<number, SpeciesState> {
  const states = stateById(species);
  const targets = new Map<number, SpeciesState>();
  for (const productTerm of candidate.stoichiometry.products) {
    const product = candidate.productGraphs[productTerm.productIndex];
    if (!product) throw new Error(`REVERSIBLE_PAIR_MISSING_PRODUCT_GRAPH:${candidate.id}:${productTerm.productIndex}`);
    const matching = opposite.stoichiometry.reactants
      .map((term) => states.get(term.speciesId))
      .filter((state): state is SpeciesState => state?.molecule.canonicalKey === product.canonicalKey);
    const unique = [...new Map(matching.map((state) => [state.id, state] as const)).values()];
    if (unique.length !== 1) {
      throw new Error(`REVERSIBLE_PAIR_PRODUCT_IDENTITY_MISMATCH:${candidate.id}:${productTerm.productIndex}`);
    }
    targets.set(productTerm.productIndex, unique[0]!);
  }
  return targets;
}

function buildForwardEvaluationView(
  forward: ReactionCandidate,
  reverse: ReactionCandidate,
  species: readonly SpeciesState[],
): ReactionCandidateEvaluationView {
  const states = stateById(species);
  const productTargets = resolveProductTargets(forward, reverse, species);
  const reactants = forward.stoichiometry.reactants.map((term) => {
    const state = states.get(term.speciesId);
    if (!state) throw new Error(`REVERSIBLE_PAIR_MISSING_REACTANT:${term.speciesId}`);
    return {
      speciesKey: state.id,
      coefficient: term.coefficient,
      phase: state.phaseState.phase,
    };
  });
  const products = forward.stoichiometry.products.map((term) => {
    const state = productTargets.get(term.productIndex);
    if (!state) throw new Error(`REVERSIBLE_PAIR_MISSING_PRODUCT_TARGET:${forward.id}:${term.productIndex}`);
    return {
      speciesKey: state.id,
      coefficient: term.coefficient,
      phase: state.phaseState.phase,
    };
  });
  const statuses = [
    ...forward.stoichiometry.reactants.map((term) => states.get(term.speciesId)?.phaseState.scientificStatus ?? "OPEN" as const),
    ...[...productTargets.values()].map((state) => state.phaseState.scientificStatus),
  ];
  return {
    candidateId: forward.id,
    family: forward.family,
    reactants,
    products,
    accessMode: "REVERSIBLE_PAIR",
    scientificStatus: worstStatus(statuses),
    reversible: {
      pairKey: forward.reversible!.pairId,
      direction: "FORWARD",
    },
  };
}

function projectCandidateExtent(
  species: readonly SpeciesState[],
  candidate: ReactionCandidate,
  opposite: ReactionCandidate,
  extentMol: number,
): readonly SpeciesState[] {
  if (!Number.isFinite(extentMol) || extentMol < 0) throw new RangeError("extentMol must be finite and >= 0.");
  const amounts = new Map(species.map((state) => [state.id, state.amountMol] as const));
  const targets = resolveProductTargets(candidate, opposite, species);
  for (const term of candidate.stoichiometry.reactants) {
    const current = amounts.get(term.speciesId);
    if (current === undefined) throw new Error(`REVERSIBLE_PAIR_MISSING_REACTANT:${term.speciesId}`);
    const next = current - term.coefficient * extentMol;
    if (next < -AMOUNT_TOLERANCE_MOL) throw new RangeError(`PROJECTED_NEGATIVE_AMOUNT:${term.speciesId}`);
    amounts.set(term.speciesId, next < 0 ? 0 : next);
  }
  for (const term of candidate.stoichiometry.products) {
    const target = targets.get(term.productIndex);
    if (!target) throw new Error(`REVERSIBLE_PAIR_MISSING_PRODUCT_TARGET:${candidate.id}:${term.productIndex}`);
    amounts.set(target.id, (amounts.get(target.id) ?? 0) + term.coefficient * extentMol);
  }
  return species.map((state) => {
    const projected: SpeciesState = { ...state, amountMol: amounts.get(state.id) ?? state.amountMol };
    delete (projected as { concentrationMolPerM3?: number }).concentrationMolPerM3;
    return projected;
  });
}

function eventMetadata(
  pairId: string,
  direction: "FORWARD" | "REVERSE",
  equilibrium: EquilibriumEvaluationResult,
  recommendation: EquilibriumProgressionRecommendation,
): ReactionEquilibriumEventMetadata {
  return {
    reversiblePairId: pairId,
    channelDirection: direction,
    equilibriumDirection: recommendation.mode,
    equilibriumScientificStatus: recommendation.scientificStatus,
    equilibriumDrivingStrength: recommendation.drivingStrength,
    ...(equilibrium.lnQOverK === undefined ? {} : { lnQOverK: equilibrium.lnQOverK }),
    ...(equilibrium.reactionQuotientQ === undefined ? {} : { reactionQuotientQ: equilibrium.reactionQuotientQ }),
    ...(equilibrium.equilibriumConstantK === undefined ? {} : { equilibriumConstantK: equilibrium.equilibriumConstantK }),
  };
}

function factFor(
  pairId: string,
  equilibrium: EquilibriumEvaluationResult,
  recommendation: EquilibriumProgressionRecommendation,
): ReversiblePairArbitrationFact {
  return {
    reversiblePairId: pairId,
    equilibriumDirection: recommendation.mode,
    equilibriumScientificStatus: recommendation.scientificStatus,
    ...(recommendation.mode === "FORWARD" || recommendation.mode === "REVERSE"
      ? { selectedChannelDirection: recommendation.mode }
      : {}),
    drivingStrength: recommendation.drivingStrength,
    maxNetProgressFraction: recommendation.maxNetProgressFraction,
    preventEquilibriumCrossing: recommendation.preventEquilibriumCrossing,
    ...(recommendation.maxExtentTowardEquilibriumMol === undefined
      ? {}
      : { maxExtentTowardEquilibriumMol: recommendation.maxExtentTowardEquilibriumMol }),
    ...(equilibrium.lnQOverK === undefined ? {} : { lnQOverK: equilibrium.lnQOverK }),
    ...(equilibrium.reactionQuotientQ === undefined ? {} : { reactionQuotientQ: equilibrium.reactionQuotientQ }),
    ...(equilibrium.equilibriumConstantK === undefined ? {} : { equilibriumConstantK: equilibrium.equilibriumConstantK }),
    reasonCodes: recommendation.reasonCodes,
  };
}

function selectedControl(
  pairId: string,
  direction: "FORWARD" | "REVERSE",
  maxFeasibleMol: number,
  equilibrium: EquilibriumEvaluationResult,
  recommendation: EquilibriumProgressionRecommendation,
): ReactionCandidateExtentControl {
  const fractionCap = maxFeasibleMol * recommendation.maxNetProgressFraction;
  let maxRequestedExtentMol = fractionCap;
  const reasons: ReactionCandidateExtentControl["reasonCodes"] extends readonly (infer T)[] | undefined ? T[] : never = [
    "EQUILIBRIUM_DRIVING_MODULATED",
  ];
  if (recommendation.maxNetProgressFraction < 1) reasons.push("EQUILIBRIUM_NET_FRACTION_BOUNDED");
  if (recommendation.preventEquilibriumCrossing && recommendation.maxExtentTowardEquilibriumMol !== undefined) {
    if (recommendation.maxExtentTowardEquilibriumMol < maxRequestedExtentMol) {
      reasons.push("EQUILIBRIUM_CROSSING_BOUNDED");
    }
    maxRequestedExtentMol = Math.min(maxRequestedExtentMol, recommendation.maxExtentTowardEquilibriumMol);
  }
  return {
    requestMultiplier: recommendation.drivingStrength,
    maxRequestedExtentMol,
    reasonCodes: reasons,
    eventMetadata: eventMetadata(pairId, direction, equilibrium, recommendation),
  };
}

/**
 * Pair arbitration uses only explicit candidate.reversible metadata. No pair is
 * inferred from formulas, graph similarity, candidate ids, or reactant/product
 * resemblance.
 */
export function arbitrateReversiblePairs(input: {
  species: readonly SpeciesState[];
  candidates: readonly ReactionCandidate[];
  rankedEvaluations: readonly RankedReactionEvaluation[];
  temperatureK: number;
  pressurePa?: number;
  volumeM3?: number;
  authority: Phase3BEquilibriumAuthority;
}): Phase3BReversibleArbitrationResult {
  const pairs = new Map<string, PairChannels>();
  for (const candidate of [...input.candidates].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!candidate.reversible) continue;
    if (!candidate.reversible.pairId) throw new Error(`EMPTY_REVERSIBLE_PAIR_ID:${candidate.id}`);
    const entry = pairs.get(candidate.reversible.pairId) ?? { pairId: candidate.reversible.pairId };
    if (candidate.reversible.direction === "FORWARD") {
      if (entry.forward) throw new Error(`DUPLICATE_REVERSIBLE_FORWARD_CHANNEL:${entry.pairId}`);
      entry.forward = candidate;
    } else {
      if (entry.reverse) throw new Error(`DUPLICATE_REVERSIBLE_REVERSE_CHANNEL:${entry.pairId}`);
      entry.reverse = candidate;
    }
    pairs.set(entry.pairId, entry);
  }

  const evaluationIds = new Set(input.rankedEvaluations.map((evaluation) => evaluation.candidateId));
  const snapshotSpeciesIds = new Set(input.species.map((state) => state.id));
  const controls: Record<string, ReactionCandidateExtentControl> = {};
  const facts: ReversiblePairArbitrationFact[] = [];

  for (const pair of [...pairs.values()].sort((a, b) => a.pairId.localeCompare(b.pairId))) {
    if (!pair.forward || !pair.reverse) continue;
    if (!evaluationIds.has(pair.forward.id) || !evaluationIds.has(pair.reverse.id)) continue;
    const allPairReactantsExist = [...pair.forward.stoichiometry.reactants, ...pair.reverse.stoichiometry.reactants]
      .every((term) => snapshotSpeciesIds.has(term.speciesId));
    if (!allPairReactantsExist) continue;

    const forwardView = buildForwardEvaluationView(pair.forward, pair.reverse, input.species);
    const currentComposition = input.authority.compositionAdapter.toEquilibriumComposition({
      species: input.species,
      view: forwardView,
      temperatureK: input.temperatureK,
      ...(input.pressurePa === undefined ? {} : { pressurePa: input.pressurePa }),
      ...(input.volumeM3 === undefined ? {} : { volumeM3: input.volumeM3 }),
    });
    const equilibrium = evaluateReactionEquilibrium(
      forwardView,
      currentComposition,
      input.temperatureK,
      input.authority.provider,
      input.authority.equilibriumOptions,
    );

    const forwardMaximum = maxFeasibleExtentMol(pair.forward, input.species);
    const reverseMaximum = maxFeasibleExtentMol(pair.reverse, input.species);
    const recommendationMaximum = equilibrium.direction === "REVERSE_FAVORED" ? reverseMaximum : forwardMaximum;
    const projection = {
      maxFeasibleExtentMol: recommendationMaximum,
      projectComposition: (netForwardExtentMol: number): EquilibriumComposition => {
        const projected = netForwardExtentMol >= 0
          ? projectCandidateExtent(input.species, pair.forward!, pair.reverse!, netForwardExtentMol)
          : projectCandidateExtent(input.species, pair.reverse!, pair.forward!, -netForwardExtentMol);
        return input.authority.compositionAdapter.toEquilibriumComposition({
          species: projected,
          view: forwardView,
          temperatureK: input.temperatureK,
          ...(input.pressurePa === undefined ? {} : { pressurePa: input.pressurePa }),
          ...(input.volumeM3 === undefined ? {} : { volumeM3: input.volumeM3 }),
        });
      },
    };
    const recommendation = recommendEquilibriumProgression(
      forwardView,
      equilibrium,
      input.temperatureK,
      input.authority.provider,
      input.authority.equilibriumOptions,
      projection,
      input.authority.progressionOptions,
    );
    facts.push(factFor(pair.pairId, equilibrium, recommendation));

    if (recommendation.mode === "FORWARD") {
      controls[pair.forward.id] = selectedControl(pair.pairId, "FORWARD", forwardMaximum, equilibrium, recommendation);
      controls[pair.reverse.id] = {
        suppress: true,
        reasonCodes: ["REVERSIBLE_PAIR_SUPPRESSED"],
        eventMetadata: eventMetadata(pair.pairId, "REVERSE", equilibrium, recommendation),
      };
    } else if (recommendation.mode === "REVERSE") {
      controls[pair.reverse.id] = selectedControl(pair.pairId, "REVERSE", reverseMaximum, equilibrium, recommendation);
      controls[pair.forward.id] = {
        suppress: true,
        reasonCodes: ["REVERSIBLE_PAIR_SUPPRESSED"],
        eventMetadata: eventMetadata(pair.pairId, "FORWARD", equilibrium, recommendation),
      };
    } else if (recommendation.mode === "NEAR_EQUILIBRIUM") {
      controls[pair.forward.id] = {
        suppress: true,
        reasonCodes: ["NEAR_EQUILIBRIUM_ZERO_NET"],
        eventMetadata: eventMetadata(pair.pairId, "FORWARD", equilibrium, recommendation),
      };
      controls[pair.reverse.id] = {
        suppress: true,
        reasonCodes: ["NEAR_EQUILIBRIUM_ZERO_NET"],
        eventMetadata: eventMetadata(pair.pairId, "REVERSE", equilibrium, recommendation),
      };
    }
    // INDETERMINATE deliberately installs no controls. Equilibrium arbitration
    // abstains exactly as PR #51 specifies; independently-supported Phase 3A
    // kinetics therefore follow the pre-existing resolver path without bias.
  }

  return {
    candidateExtentControls: Object.fromEntries(Object.entries(controls).sort(([a], [b]) => a.localeCompare(b))),
    pairs: facts,
  };
}

export function runPhase3BReactionProgressionFromFoundation(
  input: ReactionCandidateGenerationInput,
  config: Phase3BReactionProgressionConfig,
  foundation: Phase2ReactionPipelineResult,
): Phase3BReactionProgressionResult {
  const arbitration = arbitrateReversiblePairs({
    species: input.species,
    candidates: foundation.candidates,
    rankedEvaluations: foundation.ranked,
    temperatureK: config.thermalState.temperatureK,
    pressurePa: config.environment.pressurePa,
    volumeM3: config.volumeM3,
    authority: config.equilibrium,
  });

  let nextRegistry: DynamicSpeciesRegistryLike | undefined = config.speciesRegistry;
  let resolution;
  if (config.speciesRegistry) {
    const registryResolution = resolveReactionCandidatesWithRegistry({
      species: input.species,
      elements: input.elements,
      candidates: foundation.candidates,
      rankedEvaluations: foundation.ranked,
      candidateExtentControls: arbitration.candidateExtentControls,
      registry: config.speciesRegistry,
      dtS: config.dtS,
      timestepId: config.timestepId,
      startTimeS: config.startTimeS,
      temperatureK: config.thermalState.temperatureK,
      pressurePa: config.environment.pressurePa,
      volumeM3: config.volumeM3,
      options: config.resolutionOptions,
    });
    resolution = registryResolution.resolution;
    nextRegistry = registryResolution.registry;
  } else {
    if (!config.productStateResolver) throw new Error("Phase 3B requires speciesRegistry or productStateResolver.");
    resolution = resolveReactionCandidates({
      species: input.species,
      elements: input.elements,
      candidates: foundation.candidates,
      rankedEvaluations: foundation.ranked,
      candidateExtentControls: arbitration.candidateExtentControls,
      productStateResolver: config.productStateResolver,
      dtS: config.dtS,
      timestepId: config.timestepId,
      startTimeS: config.startTimeS,
      temperatureK: config.thermalState.temperatureK,
      pressurePa: config.environment.pressurePa,
      volumeM3: config.volumeM3,
      options: config.resolutionOptions,
    });
  }

  const thermal = applyReactionThermalCoupling({
    thermalState: config.thermalState,
    progressEvents: resolution.progressEvents,
    evaluations: foundation.ranked,
    dtS: config.dtS,
    externalThermal: config.externalThermal,
  });

  return {
    foundation,
    arbitration,
    resolution: { ...resolution, progressEvents: thermal.events },
    thermal,
    nextState: {
      species: resolution.speciesAfter,
      thermalState: thermal.state,
      ...(nextRegistry ? { speciesRegistry: nextRegistry } : {}),
      phaseReevaluationRequired: resolution.selected.length > 0,
    },
  };
}

export function runPhase3BReactionProgression(
  input: ReactionCandidateGenerationInput,
  config: Phase3BReactionProgressionConfig,
): Phase3BReactionProgressionResult {
  if (!Number.isFinite(config.dtS) || config.dtS <= 0) throw new RangeError("dtS must be finite and > 0.");
  const foundation = runPhase2ReactionFoundation(input, config);
  return runPhase3BReactionProgressionFromFoundation(input, config, foundation);
}

export function projectPhase3BReactionProgressEvent(event: Parameters<typeof projectReactionProgressEvent>[0]): Phase3BReactionFactProjection {
  return {
    ...projectReactionProgressEvent(event),
    ...(event.reversiblePairId === undefined ? {} : { reversiblePairId: event.reversiblePairId }),
    ...(event.channelDirection === undefined ? {} : { channelDirection: event.channelDirection }),
    ...(event.equilibriumDirection === undefined ? {} : { equilibriumDirection: event.equilibriumDirection }),
    ...(event.equilibriumScientificStatus === undefined ? {} : { equilibriumScientificStatus: event.equilibriumScientificStatus }),
    ...(event.equilibriumDrivingStrength === undefined ? {} : { equilibriumDrivingStrength: event.equilibriumDrivingStrength }),
    ...(event.lnQOverK === undefined ? {} : { lnQOverK: event.lnQOverK }),
    ...(event.reactionQuotientQ === undefined ? {} : { reactionQuotientQ: event.reactionQuotientQ }),
    ...(event.equilibriumConstantK === undefined ? {} : { equilibriumConstantK: event.equilibriumConstantK }),
  };
}

export function runPhase3BReactionNetworkStep(
  state: Phase3AReactionNetworkState,
  input: Phase3AReactionNetworkInput,
  config: Phase3BReactionNetworkStepConfig,
): Phase3BReactionNetworkStepResult {
  const { equilibrium, ...phase3aConfig } = config;
  let captured: Phase3BReversibleArbitrationResult | undefined;
  const base = runPhase3AReactionNetworkStep(
    state,
    input,
    phase3aConfig,
    (stepInput, stepConfig) => {
      const result = runPhase3BReactionProgression(stepInput, { ...stepConfig, equilibrium });
      captured = result.arbitration;
      return result;
    },
  );
  if (!captured) throw new Error("PHASE3B_ARBITRATION_RESULT_MISSING");

  return {
    ...base,
    arbitration: captured,
    provider: {
      authoritativeVesselComposition: base.provider.authoritativeVesselComposition,
      activeReactionEvents: base.step.resolution.progressEvents.map(projectPhase3BReactionProgressEvent),
      timelineEvents: base.nextState.timelineEvents.map(projectPhase3BReactionProgressEvent),
      reversiblePairs: captured.pairs,
    },
  };
}
