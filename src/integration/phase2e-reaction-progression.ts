import type { ReactionCandidateGenerationInput } from "../simulation/reaction";
import type { ThermalState } from "../simulation/thermal";
import type { DynamicSpeciesRegistryLike } from "../simulation/species-registry";
import {
  applyReactionThermalCoupling,
  resolveReactionCandidates,
  resolveReactionCandidatesWithRegistry,
  type ExternalThermalStepInput,
  type ReactionProductStateResolver,
  type ReactionResolutionOptions,
  type ReactionResolutionResult,
  type ReactionThermalCouplingResult,
} from "../simulation/reaction-progression";
import {
  runPhase2ReactionFoundation,
  type Phase2ReactionPipelineConfig,
  type Phase2ReactionPipelineResult,
} from "./phase2-reaction";

export interface Phase2EReactionProgressionConfig extends Phase2ReactionPipelineConfig {
  dtS: number;
  timestepId: string;
  startTimeS: number;
  thermalState: ThermalState;
  /** Legacy/pre-registry product resolver. Not required when speciesRegistry is supplied. */
  productStateResolver?: ReactionProductStateResolver;
  /** Persistent internal species identity registry. Pass nextState.speciesRegistry into the next timestep. */
  speciesRegistry?: DynamicSpeciesRegistryLike;
  resolutionOptions?: ReactionResolutionOptions;
  externalThermal?: ExternalThermalStepInput;
  volumeM3?: number;
}

export interface Phase2EReactionProgressionResult {
  foundation: Phase2ReactionPipelineResult;
  resolution: ReactionResolutionResult;
  thermal: ReactionThermalCouplingResult;
  nextState: {
    species: ReactionResolutionResult["speciesAfter"];
    thermalState: ThermalState;
    speciesRegistry?: DynamicSpeciesRegistryLike;
    phaseReevaluationRequired: boolean;
  };
}

/**
 * Canonical Phase 2E order:
 * current species -> candidate generation -> 02 evaluation/ranking -> 01 bounded
 * extent/competition -> atomic species/registry mutation -> reaction heat ->
 * thermal update.
 *
 * Newly generated species enter the returned vessel state and may participate
 * in the next timestep. The resolver's zero-initial-reactant rule still blocks
 * hidden same-step cascades.
 */
export function runPhase2EReactionProgression(
  input: ReactionCandidateGenerationInput,
  config: Phase2EReactionProgressionConfig,
): Phase2EReactionProgressionResult {
  if (!Number.isFinite(config.dtS) || config.dtS <= 0) {
    throw new RangeError("dtS must be finite and > 0.");
  }

  const foundation = runPhase2ReactionFoundation(input, config);
  let nextRegistry: DynamicSpeciesRegistryLike | undefined = config.speciesRegistry;
  let resolution: ReactionResolutionResult;

  if (config.speciesRegistry) {
    const registryResolution = resolveReactionCandidatesWithRegistry({
      species: input.species,
      elements: input.elements,
      candidates: foundation.candidates,
      rankedEvaluations: foundation.ranked,
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
    if (!config.productStateResolver) {
      throw new Error("Phase 2E requires speciesRegistry or productStateResolver.");
    }
    resolution = resolveReactionCandidates({
      species: input.species,
      elements: input.elements,
      candidates: foundation.candidates,
      rankedEvaluations: foundation.ranked,
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
