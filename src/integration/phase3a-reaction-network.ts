import type { ElementProvider, PhaseKind, SpeciesId, SpeciesState } from "../simulation/molecular";
import type { ReactionCandidateOptions, ReactionGenerationEnvironment } from "../simulation/reaction";
import type { ReactionProgressEvent } from "../simulation/reaction-progression";
import type { DynamicSpeciesRegistryLike } from "../simulation/species-registry";
import type { ThermalState } from "../simulation/thermal";
import {
  runPhase2EReactionProgression,
  type Phase2EReactionProgressionConfig,
  type Phase2EReactionProgressionResult,
} from "./phase2e-reaction-progression";

const DEFAULT_AMOUNT_TOLERANCE_MOL = 1e-12;
const HEAT_TOLERANCE_J = 1e-9;
const TIME_TOLERANCE_S = 1e-12;

export interface Phase3AReactionNetworkState {
  species: readonly SpeciesState[];
  thermalState: ThermalState;
  speciesRegistry: DynamicSpeciesRegistryLike;
  simTimeS: number;
  completedTimesteps: number;
  timelineEvents: readonly ReactionProgressEvent[];
}

export interface Phase3AReactionNetworkInput {
  elements: ElementProvider;
  candidateEnvironment?: ReactionGenerationEnvironment;
  candidateOptions?: ReactionCandidateOptions;
}

export interface Phase3AReactionNetworkStepConfig
  extends Omit<
    Phase2EReactionProgressionConfig,
    "startTimeS" | "thermalState" | "speciesRegistry"
  > {
  amountToleranceMol?: number;
}

export type Phase3AReactionStepExecutor = typeof runPhase2EReactionProgression;

export interface ReactionFactSpeciesAmount {
  speciesRef: SpeciesId;
  amountMol: number;
}

export interface ReactionFactProjection {
  eventId: string;
  timestepId: string;
  sequence: number;
  candidateId: string;
  startTimeS: number;
  endTimeS: number;
  extentMol: number;
  consumed: readonly ReactionFactSpeciesAmount[];
  produced: readonly ReactionFactSpeciesAmount[];
  reactionHeat_J?: number;
  scientificStatus: ReactionProgressEvent["scientificStatus"];
  reasonCodes: ReactionProgressEvent["reasonCodes"];
}

export interface VesselCompositionProjection {
  speciesRef: SpeciesId;
  amountMol: number;
  phase: PhaseKind;
  phaseStateId: string;
}

export interface Phase3AProviderProjection {
  authoritativeVesselComposition: readonly VesselCompositionProjection[];
  activeReactionEvents: readonly ReactionFactProjection[];
  timelineEvents: readonly ReactionFactProjection[];
}

export interface Phase3AReactionNetworkStepResult {
  reactantSnapshot: readonly SpeciesState[];
  step: Phase2EReactionProgressionResult;
  nextState: Phase3AReactionNetworkState;
  provider: Phase3AProviderProjection;
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be finite and >= 0.`);
  }
}

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be finite and > 0.`);
  }
}

function snapshotSpecies(species: readonly SpeciesState[]): readonly SpeciesState[] {
  return Object.freeze(
    species.map((state) =>
      Object.freeze({
        ...state,
        phaseState: Object.freeze({ ...state.phaseState }),
        ...(state.metadata ? { metadata: Object.freeze({ ...state.metadata }) } : {}),
      }),
    ),
  );
}

function assertFiniteSpeciesState(species: readonly SpeciesState[]): void {
  const ids = new Set<string>();
  for (const state of species) {
    if (ids.has(state.id)) throw new Error(`DUPLICATE_SPECIES_ID:${state.id}`);
    ids.add(state.id);
    assertFiniteNonNegative(state.amountMol, `species(${state.id}).amountMol`);
  }
}

function sortedAmounts(record: Readonly<Record<SpeciesId, number>>, sign: "negative" | "positive"): ReactionFactSpeciesAmount[] {
  return Object.entries(record)
    .filter(([, delta]) => sign === "negative" ? delta < 0 : delta > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([speciesRef, delta]) => ({ speciesRef, amountMol: Math.abs(delta) }));
}

export function projectReactionProgressEvent(event: ReactionProgressEvent): ReactionFactProjection {
  return {
    eventId: event.id,
    timestepId: event.timestepId,
    sequence: event.sequence,
    candidateId: event.candidateId,
    startTimeS: event.startTimeS,
    endTimeS: event.endTimeS,
    extentMol: event.extentMol,
    consumed: sortedAmounts(event.reactantDeltasMol, "negative"),
    produced: sortedAmounts(event.productDeltasMol, "positive"),
    ...(event.heatJ === undefined ? {} : { reactionHeat_J: event.heatJ }),
    scientificStatus: event.scientificStatus,
    reasonCodes: event.reasonCodes,
  };
}

export function projectPhase3AProviderState(
  species: readonly SpeciesState[],
  activeEvents: readonly ReactionProgressEvent[],
  timelineEvents: readonly ReactionProgressEvent[],
): Phase3AProviderProjection {
  return {
    authoritativeVesselComposition: [...species]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((state) => ({
        speciesRef: state.id,
        amountMol: state.amountMol,
        phase: state.phaseState.phase,
        phaseStateId: state.phaseState.phaseStateId,
      })),
    activeReactionEvents: activeEvents.map(projectReactionProgressEvent),
    timelineEvents: timelineEvents.map(projectReactionProgressEvent),
  };
}

function assertEventContract(
  snapshot: readonly SpeciesState[],
  result: Phase2EReactionProgressionResult,
  config: Phase3AReactionNetworkStepConfig,
  startTimeS: number,
): void {
  const amountTolerance = config.amountToleranceMol ?? DEFAULT_AMOUNT_TOLERANCE_MOL;
  assertFiniteNonNegative(amountTolerance, "amountToleranceMol");

  const available = new Map(snapshot.map((state) => [state.id, state.amountMol] as const));
  const totalConsumed = new Map<SpeciesId, number>();
  let knownHeatFromEvents = 0;

  result.resolution.progressEvents.forEach((event, index) => {
    if (event.timestepId !== config.timestepId || event.sequence !== index) {
      throw new Error(`INVALID_REACTION_EVENT_ORDER:${event.id}`);
    }
    if (
      Math.abs(event.startTimeS - startTimeS) > TIME_TOLERANCE_S ||
      Math.abs(event.endTimeS - (startTimeS + config.dtS)) > TIME_TOLERANCE_S
    ) {
      throw new Error(`INVALID_REACTION_EVENT_TIME:${event.id}`);
    }
    if (!Number.isFinite(event.extentMol) || event.extentMol <= 0) {
      throw new Error(`INVALID_REACTION_EVENT_EXTENT:${event.id}`);
    }

    for (const [speciesId, deltaMol] of Object.entries(event.reactantDeltasMol)) {
      if (!Number.isFinite(deltaMol) || deltaMol >= 0) {
        throw new Error(`INVALID_REACTION_REACTANT_DELTA:${event.id}:${speciesId}`);
      }
      const initialAmount = available.get(speciesId) ?? 0;
      if (initialAmount <= amountTolerance) {
        throw new Error(`SAME_STEP_CASCADE_BLOCKED:${event.id}:${speciesId}`);
      }
      totalConsumed.set(speciesId, (totalConsumed.get(speciesId) ?? 0) - deltaMol);
    }

    for (const [speciesId, deltaMol] of Object.entries(event.productDeltasMol)) {
      if (!Number.isFinite(deltaMol) || deltaMol <= 0) {
        throw new Error(`INVALID_REACTION_PRODUCT_DELTA:${event.id}:${speciesId}`);
      }
    }

    if (event.heatJ !== undefined) {
      if (!Number.isFinite(event.heatJ)) throw new Error(`INVALID_REACTION_HEAT:${event.id}`);
      knownHeatFromEvents += event.heatJ;
    }
  });

  for (const [speciesId, consumedMol] of totalConsumed) {
    const initialAmount = available.get(speciesId) ?? 0;
    if (consumedMol > initialAmount + amountTolerance) {
      throw new Error(`SHARED_REACTANT_OVERCONSUMPTION:${speciesId}`);
    }
  }

  if (Math.abs(knownHeatFromEvents - result.thermal.knownReactionHeat_J) > HEAT_TOLERANCE_J) {
    throw new Error("REACTION_HEAT_EVENT_MISMATCH");
  }
}

/**
 * Phase 3A authoritative timestep execution.
 *
 * Exactly one immutable reactant snapshot is exposed to Phase 2E candidate
 * generation/evaluation/resolution. Products committed by this call are only
 * present in nextState and therefore cannot become reactants until a later call.
 */
export function runPhase3AReactionNetworkStep(
  state: Phase3AReactionNetworkState,
  input: Phase3AReactionNetworkInput,
  config: Phase3AReactionNetworkStepConfig,
  executor: Phase3AReactionStepExecutor = runPhase2EReactionProgression,
): Phase3AReactionNetworkStepResult {
  assertFiniteNonNegative(state.simTimeS, "simTimeS");
  if (!Number.isInteger(state.completedTimesteps) || state.completedTimesteps < 0) {
    throw new RangeError("completedTimesteps must be a non-negative integer.");
  }
  assertFinitePositive(config.dtS, "dtS");
  if (!config.timestepId) throw new Error("timestepId must be non-empty.");
  assertFiniteSpeciesState(state.species);

  const reactantSnapshot = snapshotSpecies(state.species);
  const { amountToleranceMol: _amountToleranceMol, ...phase2eConfig } = config;
  void _amountToleranceMol;
  const step = executor(
    {
      species: reactantSnapshot,
      elements: input.elements,
      ...(input.candidateEnvironment ? { environment: input.candidateEnvironment } : {}),
      ...(input.candidateOptions ? { options: input.candidateOptions } : {}),
    },
    {
      ...phase2eConfig,
      startTimeS: state.simTimeS,
      thermalState: state.thermalState,
      speciesRegistry: state.speciesRegistry,
    },
  );

  if (!step.nextState.speciesRegistry) {
    throw new Error("PHASE3A_REQUIRES_PERSISTENT_SPECIES_REGISTRY");
  }
  assertFiniteSpeciesState(step.nextState.species);
  assertEventContract(reactantSnapshot, step, config, state.simTimeS);

  const timelineEvents = [...state.timelineEvents, ...step.resolution.progressEvents];
  const nextState: Phase3AReactionNetworkState = {
    species: step.nextState.species,
    thermalState: step.nextState.thermalState,
    speciesRegistry: step.nextState.speciesRegistry,
    simTimeS: state.simTimeS + config.dtS,
    completedTimesteps: state.completedTimesteps + 1,
    timelineEvents,
  };

  return {
    reactantSnapshot,
    step,
    nextState,
    provider: projectPhase3AProviderState(
      nextState.species,
      step.resolution.progressEvents,
      timelineEvents,
    ),
  };
}
