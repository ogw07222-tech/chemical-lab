import { describe, expect, it } from "vitest";
import {
  evaluateReactionCandidate,
  kineticExtentInputOverDt,
  rankReactionEvaluations,
  type EvaluatedQuantity,
  type ReactionCandidateAdapter,
  type ReactionCandidateEvaluationView,
  type ReactionEvaluationDataProvider,
} from "../src/simulation/reaction-evaluation";
import {
  applyReactionThermalCoupling,
  type ReactionProgressEvent,
} from "../src/simulation/reaction-progression";
import { createThermalState } from "../src/simulation/thermal";

const quantity = (value: number, status = "VERIFIED" as const): EvaluatedQuantity => ({
  value,
  status,
  confidence: "HIGH",
  source: { sourceIds: ["test"] },
});

const baseView: ReactionCandidateEvaluationView = {
  candidateId: "r",
  family: "TEST",
  reactants: [{ speciesKey: "A", coefficient: 1, phase: "gas" }],
  products: [{ speciesKey: "B", coefficient: 1, phase: "gas" }],
  accessMode: "gas",
  scientificStatus: "APPROXIMATED",
};

const adapter: ReactionCandidateAdapter<ReactionCandidateEvaluationView> = {
  toEvaluationView: (candidate) => candidate,
};

function provider(overrides: Partial<ReactionEvaluationDataProvider> = {}): ReactionEvaluationDataProvider {
  return {
    getSpeciesThermo: () => undefined,
    getDirectReactionThermo: () => ({ deltaG_J_per_mol: quantity(-1000), deltaH_J_per_mol: quantity(-100) }),
    ...overrides,
  };
}

function event(candidateId: string, sequence: number, extentMol = 1): ReactionProgressEvent {
  return {
    id: `step:reaction:${sequence}:${candidateId}`,
    timestepId: "step",
    candidateId,
    sequence,
    startTimeS: 0,
    endTimeS: 1,
    dtS: 1,
    extentMol,
    reactantDeltasMol: { A: -extentMol },
    productDeltasMol: { B: extentMol },
    speciesAmountDeltaMol: { A: -extentMol, B: extentMol },
    scientificStatus: "APPROXIMATED",
    reasonCodes: ["SELECTED"],
  };
}

function evaluation(candidateId: string, deltaH_J_per_mol?: number) {
  return {
    candidateId,
    thermo: {
      ...(deltaH_J_per_mol === undefined ? {} : { deltaH_J_per_mol }),
      deltaG_J_per_mol: -100,
      direction: "FORWARD_FAVORED" as const,
      confidence: "HIGH" as const,
      approximationClass: deltaH_J_per_mol === undefined ? "OPEN" as const : "APPROXIMATED" as const,
      source: { sourceIds: ["test"] },
    },
    kinetics: {
      rateClass: "FAST" as const,
      relativeRate: 0.5,
      confidence: "HIGH" as const,
      approximationClass: "APPROXIMATED" as const,
    },
    environment: {
      temperatureContribution: 1,
      pressureRelevance: "RELEVANT" as const,
      activityContribution: 1,
      catalystModifier: 1,
      phaseAccessibility: { class: "GAS_GAS" as const, factor: 1, status: "APPROXIMATED" as const },
    },
    feasible: "FEASIBLE" as const,
    rankScore: 0.5,
    status: deltaH_J_per_mol === undefined ? "OPEN" as const : "APPROXIMATED" as const,
    reasonCodes: [],
    rank: 1,
    tie: false,
  };
}

const thermal = () => createThermalState({
  temperatureK: 300,
  mixtureHeatCapacity_JPerK: 100,
  vesselHeatCapacity_JPerK: 100,
});

describe("Phase 3A kinetic support", () => {
  it("exposes dimensioned extent rate and integrates it linearly over dt without inventory mutation", () => {
    const result = evaluateReactionCandidate(baseView, adapter, { temperatureK: 300 }, provider({
      getDimensionedExtentRate: () => ({
        extentRateMolPerS: quantity(0.2),
        dependencies: { temperature: false, activityOrConcentration: false, pressure: false, catalyst: false, phase: false },
      }),
    }));
    expect(result.kinetics.supportClass).toBe("DIMENSIONED_RATE");
    expect(result.kinetics.extentRateMolPerS).toBe(0.2);
    expect(kineticExtentInputOverDt(result.kinetics, 2).requestedExtentMol).toBeCloseTo(0.4, 12);
    expect(kineticExtentInputOverDt(result.kinetics, 0.5).requestedExtentMol).toBeCloseTo(0.1, 12);
  });

  it("keeps Arrhenius fallback explicitly relative and temperature dependent", () => {
    const p = provider({ getActivationBarrier: () => ({ activationEnergy_J_per_mol: quantity(50_000) }) });
    const cold = evaluateReactionCandidate(baseView, adapter, { temperatureK: 300 }, p);
    const hot = evaluateReactionCandidate(baseView, adapter, { temperatureK: 600 }, p);
    expect(cold.kinetics.supportClass).toBe("RELATIVE_RATE");
    expect(hot.kinetics.relativeRate!).toBeGreaterThan(cold.kinetics.relativeRate!);
    const one = kineticExtentInputOverDt(cold.kinetics, 0.5, { maxRelativeProgressFraction: 1 });
    const two = kineticExtentInputOverDt(cold.kinetics, 1, { maxRelativeProgressFraction: 1 });
    expect(two.relativeProgressFraction!).toBeGreaterThan(one.relativeProgressFraction!);
  });

  it("does not fabricate numeric rates for qualitative or OPEN kinetics", () => {
    const qualitative = evaluateReactionCandidate(baseView, adapter, { temperatureK: 300 }, provider({
      getQualitativeRate: () => ({ rateClass: "SLOW", status: "EMPIRICAL", confidence: "LOW", source: { sourceIds: ["qual"] } }),
    }));
    expect(qualitative.kinetics.supportClass).toBe("QUALITATIVE_ONLY");
    expect(qualitative.kinetics.relativeRate).toBeUndefined();
    expect(kineticExtentInputOverDt(qualitative.kinetics, 1).requestedExtentMol).toBeUndefined();

    const open = evaluateReactionCandidate(baseView, adapter, { temperatureK: 300 }, provider());
    expect(open.kinetics.supportClass).toBe("OPEN");
    expect(open.kinetics.activationEnergy_J_per_mol).toBeUndefined();
    expect(open.kinetics.relativeRate).toBeUndefined();
  });

  it("keeps forward and reverse channel metadata independent without claiming detailed balance", () => {
    const forward = evaluateReactionCandidate(
      { ...baseView, candidateId: "f", reversible: { pairKey: "pair", direction: "FORWARD" } },
      adapter,
      { temperatureK: 300 },
      provider({ getActivationBarrier: () => ({ activationEnergy_J_per_mol: quantity(10_000) }) }),
    );
    const reverse = evaluateReactionCandidate(
      { ...baseView, candidateId: "r", reversible: { pairKey: "pair", direction: "REVERSE" } },
      adapter,
      { temperatureK: 300 },
      provider({ getActivationBarrier: () => ({ activationEnergy_J_per_mol: quantity(20_000) }) }),
    );
    expect(forward.reversibility?.direction).toBe("FORWARD");
    expect(reverse.reversibility?.direction).toBe("REVERSE");
    expect(forward.reversibility?.detailedBalanceSupported).toBe(false);
    expect(reverse.kinetics.relativeRate).not.toBe(forward.kinetics.relativeRate);
    expect(rankReactionEvaluations([forward, reverse]).map((x) => x.candidateId)).toEqual(
      rankReactionEvaluations([reverse, forward]).map((x) => x.candidateId),
    );
  });
});

describe("Phase 3A aggregate reaction heat", () => {
  it("aggregates two exothermic reactions and applies heat once", () => {
    const result = applyReactionThermalCoupling({
      thermalState: thermal(),
      progressEvents: [event("a", 0, 1), event("b", 1, 2)],
      evaluations: [evaluation("a", -100), evaluation("b", -50)],
      dtS: 1,
    });
    expect(result.knownReactionHeat_J).toBeCloseTo(200, 12);
    expect(result.state.cumulativeEnergy.reactionHeat_J).toBeCloseTo(200, 12);
    expect(result.state.temperatureK).toBeCloseTo(301, 12);
    expect(result.thermalCoverage).toBe("COMPLETE");
    expect(result.knownContributionCount).toBe(2);
  });

  it("allows exothermic and endothermic contributions to cancel", () => {
    const result = applyReactionThermalCoupling({
      thermalState: thermal(),
      progressEvents: [event("exo", 0, 1), event("endo", 1, 2)],
      evaluations: [evaluation("exo", -100), evaluation("endo", 40)],
      dtS: 1,
    });
    expect(result.knownReactionHeat_J).toBeCloseTo(20, 12);
    expect(result.state.temperatureK).toBeCloseTo(300.1, 12);
  });

  it("is independent of input event ordering", () => {
    const events = [event("a", 0, 1), event("b", 1, 2)];
    const evaluations = [evaluation("a", -100), evaluation("b", 40)];
    const left = applyReactionThermalCoupling({ thermalState: thermal(), progressEvents: events, evaluations, dtS: 1 });
    const right = applyReactionThermalCoupling({ thermalState: thermal(), progressEvents: [...events].reverse(), evaluations: [...evaluations].reverse(), dtS: 1 });
    expect(right.knownReactionHeat_J).toBeCloseTo(left.knownReactionHeat_J, 12);
    expect(right.state.temperatureK).toBeCloseTo(left.state.temperatureK, 12);
    expect(right.state.cumulativeEnergy.reactionHeat_J).toBeCloseTo(left.state.cumulativeEnergy.reactionHeat_J, 12);
  });

  it("keeps all-missing deltaH OPEN without fabricated heat", () => {
    const result = applyReactionThermalCoupling({
      thermalState: thermal(),
      progressEvents: [event("open", 0)],
      evaluations: [evaluation("open")],
      dtS: 1,
    });
    expect(result.knownReactionHeat_J).toBe(0);
    expect(result.state.temperatureK).toBe(300);
    expect(result.thermalCoverage).toBe("OPEN");
    expect(result.openHeatCandidateIds).toEqual(["open"]);
  });

  it("reports PARTIAL coverage when known and OPEN heat coexist", () => {
    const result = applyReactionThermalCoupling({
      thermalState: thermal(),
      progressEvents: [event("known", 0), event("open", 1)],
      evaluations: [evaluation("known", -100), evaluation("open")],
      dtS: 1,
    });
    expect(result.knownReactionHeat_J).toBe(100);
    expect(result.state.temperatureK).toBeCloseTo(300.5, 12);
    expect(result.thermalCoverage).toBe("PARTIAL");
    expect(result.scientificStatus).toBe("OPEN");
  });

  it("does not double-apply per-event and aggregate heat", () => {
    const result = applyReactionThermalCoupling({
      thermalState: thermal(),
      progressEvents: [event("a", 0), event("b", 1)],
      evaluations: [evaluation("a", -100), evaluation("b", -100)],
      dtS: 1,
    });
    expect(result.events.map((x) => x.heatJ)).toEqual([100, 100]);
    expect(result.state.cumulativeEnergy.reactionHeat_J).toBe(200);
    expect(result.state.temperatureK).toBe(301);
  });
});
