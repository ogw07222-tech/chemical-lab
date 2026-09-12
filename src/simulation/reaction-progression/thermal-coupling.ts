import { reactionHeatToSystem, stepThermalState } from "../thermal";
import type { ScientificStatus } from "../molecular";
import type { ReactionProgressEvent, ReactionThermalCouplingInput, ReactionThermalCouplingResult } from "./types";

const STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

function worstStatus(...statuses: ScientificStatus[]): ScientificStatus {
  return statuses.reduce((worst, status) => STATUS_ORDER[status] > STATUS_ORDER[worst] ? status : worst, "VERIFIED");
}

/**
 * Phase 3A thermal coupling.
 *
 * Every committed event gets its own heat fact when deltaH is known, but all
 * known heat is summed before the thermal state is advanced. The thermal model
 * is therefore stepped exactly once per reaction timestep and cannot depend on
 * event ordering. Missing deltaH remains OPEN and contributes no fabricated J.
 */
export function applyReactionThermalCoupling(input: ReactionThermalCouplingInput): ReactionThermalCouplingResult {
  if (!Number.isFinite(input.dtS) || input.dtS <= 0) throw new RangeError("dtS must be finite and > 0.");

  const evaluations = new Map(input.evaluations.map((evaluation) => [evaluation.candidateId, evaluation] as const));
  const sortedEvents = [...input.progressEvents].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  const openHeatCandidateIds: string[] = [];
  const annotated: ReactionProgressEvent[] = [];
  let knownReactionHeat_J = 0;
  let knownContributionCount = 0;
  let status: ScientificStatus = "VERIFIED";

  for (const event of sortedEvents) {
    const evaluation = evaluations.get(event.candidateId);
    const deltaH = evaluation?.thermo.deltaH_J_per_mol;
    if (deltaH === undefined || !Number.isFinite(deltaH)) {
      openHeatCandidateIds.push(event.candidateId);
      status = worstStatus(status, event.scientificStatus, "OPEN");
      annotated.push({
        ...event,
        scientificStatus: worstStatus(event.scientificStatus, "OPEN"),
        reasonCodes: [...new Set([...event.reasonCodes, "MISSING_REACTION_ENTHALPY" as const])],
      });
      continue;
    }

    const heatJ = reactionHeatToSystem({ reactionExtentMol: event.extentMol, deltaH_JPerMolExtent: deltaH });
    const thermoStatus = evaluation?.thermo.approximationClass ?? "OPEN";
    knownReactionHeat_J += heatJ;
    knownContributionCount += 1;
    status = worstStatus(status, event.scientificStatus, thermoStatus);
    annotated.push({
      ...event,
      deltaH_JPerMolExtent: deltaH,
      heatJ,
      scientificStatus: worstStatus(event.scientificStatus, thermoStatus),
      reasonCodes: [...new Set([...event.reasonCodes, "REACTION_HEAT_APPLIED" as const])],
    });
  }

  const stepped = stepThermalState(input.thermalState, {
    dtS: input.dtS,
    reactionHeat_J: knownReactionHeat_J,
    ...(input.externalThermal ?? {}),
  });

  const events = annotated.map((event) => event.heatJ === undefined ? event : {
    ...event,
    temperatureBeforeK: input.thermalState.temperatureK,
    temperatureAfterK: stepped.state.temperatureK,
  });

  const uniqueOpen = [...new Set(openHeatCandidateIds)].sort();
  const committedContributionCount = sortedEvents.length;
  const thermalCoverage = committedContributionCount === 0 || uniqueOpen.length === 0
    ? "COMPLETE"
    : knownContributionCount === 0
      ? "OPEN"
      : "PARTIAL";

  return {
    state: stepped.state,
    events,
    scientificStatus: uniqueOpen.length ? "OPEN" : status,
    missingHeatCandidateIds: uniqueOpen,
    openHeatCandidateIds: uniqueOpen,
    knownReactionHeat_J,
    knownContributionCount,
    committedContributionCount,
    thermalCoverage,
  };
}
