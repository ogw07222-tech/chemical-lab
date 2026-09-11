import type { ReactionCandidateGenerationInput } from "../simulation/reaction";
import type { ThermalState } from "../simulation/thermal";
import {
  applyReactionThermalCoupling,
  resolveReactionCandidates,
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
  productStateResolver: ReactionProductStateResolver;
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
    phaseReevaluationRequired: boolean;
  };
}

/**
 * Canonical Phase 2E order:
 * current species -> candidate generation -> 02 evaluation/ranking -> 01 bounded
 * extent/competition -> species mutation -> reaction heat -> thermal update.
 *
 * Phase re-resolution remains an explicit later hook; this function never
 * invents a phase transition or dynamic species identity.
 */
export function runPhase2EReactionProgression(
  input: ReactionCandidateGenerationInput,
  config: Phase2EReactionProgressionConfig,
): Phase2EReactionProgressionResult {
  if (!Number.isFinite(config.dtS) || config.dtS <= 0) {
    throw new RangeError("dtS must be finite and > 0.");
  }

  const foundation = runPhase2ReactionFoundation(input, config);
  const resolution = resolveReactionCandidates({
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
      phaseReevaluationRequired: resolution.selected.length > 0,
    },
  };
}
