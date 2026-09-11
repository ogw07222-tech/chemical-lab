import { reactionHeatToSystem, stepThermalState, type ThermalState } from "../thermal";
import type { ScientificStatus } from "../molecular";
import type { RankedReactionEvaluation } from "../reaction-evaluation";
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

export function applyReactionThermalCoupling(input: ReactionThermalCouplingInput): ReactionThermalCouplingResult {
  if (!Number.isFinite(input.dtS) || input.dtS <= 0) throw new RangeError("dtS must be finite and > 0.");
  const evaluations = new Map(input.evaluations.map((evaluation) => [evaluation.candidateId, evaluation] as const));
  let state: ThermalState = input.thermalState;
  let knownReactionHeat_J = 0;
  const missingHeatCandidateIds: string[] = [];
  const events: ReactionProgressEvent[] = [];
  let status: ScientificStatus = "VERIFIED";

  for (const event of [...input.progressEvents].sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id))) {
    const evaluation = evaluations.get(event.candidateId);
    const deltaH = evaluation?.thermo.deltaH_J_per_mol;
    if (deltaH === undefined || !Number.isFinite(deltaH)) {
      missingHeatCandidateIds.push(event.candidateId);
      status = worstStatus(status, "OPEN");
      events.push({
        ...event,
        scientificStatus: worstStatus(event.scientificStatus, "OPEN"),
        reasonCodes: [...event.reasonCodes, "MISSING_REACTION_ENTHALPY"],
      });
      continue;
    }

    const temperatureBeforeK = state.temperatureK;
    const heatJ = reactionHeatToSystem({ reactionExtentMol: event.extentMol, deltaH_JPerMolExtent: deltaH });
    const stepped = stepThermalState(state, {
      dtS: 0,
      reactionHeat: { reactionExtentMol: event.extentMol, deltaH_JPerMolExtent: deltaH },
    });
    state = stepped.state;
    knownReactionHeat_J += heatJ;
    const thermoStatus = evaluation?.thermo.approximationClass ?? "OPEN";
    status = worstStatus(status, thermoStatus, event.scientificStatus);
    events.push({
      ...event,
      deltaH_JPerMolExtent: deltaH,
      heatJ,
      temperatureBeforeK,
      temperatureAfterK: state.temperatureK,
      scientificStatus: worstStatus(event.scientificStatus, thermoStatus),
      reasonCodes: [...event.reasonCodes, "REACTION_HEAT_APPLIED"],
    });
  }

  if (input.externalThermal) {
    state = stepThermalState(state, { dtS: input.dtS, ...input.externalThermal }).state;
  }

  return {
    state,
    events,
    scientificStatus: missingHeatCandidateIds.length ? "OPEN" : status,
    missingHeatCandidateIds: [...new Set(missingHeatCandidateIds)].sort(),
    knownReactionHeat_J,
  };
}
