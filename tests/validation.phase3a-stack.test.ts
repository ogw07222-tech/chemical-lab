import { describe, expect, it } from "vitest";
import {
  evaluateReactionCandidate,
  kineticExtentInputOverDt,
  type EvaluatedQuantity,
  type ReactionCandidateAdapter,
  type ReactionCandidateEvaluationView,
  type ReactionEvaluationDataProvider,
} from "../src/simulation/reaction-evaluation";
import { applyReactionThermalCoupling, type ReactionProgressEvent } from "../src/simulation/reaction-progression";
import { createThermalState } from "../src/simulation/thermal";
import type { Phase3AProviderProjection, ReactionFactProjection } from "../src/integration/phase3a-reaction-network";
import { projectPhase3AReactionUi } from "../src/ui/reactionProjection";

const quantity = (value: number): EvaluatedQuantity => ({
  value,
  status: "VERIFIED",
  confidence: "HIGH",
  source: { sourceIds: ["06-phase3a-stack"] },
});

const adapter: ReactionCandidateAdapter<ReactionCandidateEvaluationView> = {
  toEvaluationView: (candidate) => candidate,
};

const view: ReactionCandidateEvaluationView = {
  candidateId: "v",
  family: "TEST",
  reactants: [{ speciesKey: "A", coefficient: 1, phase: "gas" }],
  products: [{ speciesKey: "B", coefficient: 1, phase: "gas" }],
  accessMode: "gas",
  scientificStatus: "APPROXIMATED",
};

const provider = (overrides: Partial<ReactionEvaluationDataProvider> = {}): ReactionEvaluationDataProvider => ({
  getSpeciesThermo: () => undefined,
  getDirectReactionThermo: () => ({ deltaG_J_per_mol: quantity(-100), deltaH_J_per_mol: quantity(-50) }),
  ...overrides,
});

function event(id: string, sequence: number, extentMol = 1): ReactionProgressEvent {
  return {
    id: `ts:reaction:${sequence}:${id}`,
    timestepId: "ts",
    candidateId: id,
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

function evalFor(id: string, deltaH?: number) {
  return {
    candidateId: id,
    thermo: {
      ...(deltaH === undefined ? {} : { deltaH_J_per_mol: deltaH }),
      deltaG_J_per_mol: -1,
      direction: "FORWARD_FAVORED" as const,
      confidence: "HIGH" as const,
      approximationClass: deltaH === undefined ? "OPEN" as const : "APPROXIMATED" as const,
      source: { sourceIds: ["06"] },
    },
    kinetics: {
      supportClass: "RELATIVE_RATE" as const,
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
    status: deltaH === undefined ? "OPEN" as const : "APPROXIMATED" as const,
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

describe("06 independent Phase3A stack gates", () => {
  it("keeps dimensioned/relative/qualitative/open kinetic precision boundaries explicit", () => {
    const dimensioned = evaluateReactionCandidate(view, adapter, { temperatureK: 300 }, provider({
      getDimensionedExtentRate: () => ({
        extentRateMolPerS: quantity(0.25),
        dependencies: { temperature: false, activityOrConcentration: false, pressure: false, catalyst: false, phase: false },
      }),
    }));
    expect(dimensioned.kinetics.supportClass).toBe("DIMENSIONED_RATE");
    expect(kineticExtentInputOverDt(dimensioned.kinetics, 2).requestedExtentMol).toBeCloseTo(0.5, 12);

    const relative = evaluateReactionCandidate(view, adapter, { temperatureK: 300 }, provider({
      getActivationBarrier: () => ({ activationEnergy_J_per_mol: quantity(20_000) }),
    }));
    expect(relative.kinetics.supportClass).toBe("RELATIVE_RATE");
    expect(kineticExtentInputOverDt(relative.kinetics, 1).relativeProgressFraction).toBeGreaterThan(0);
    expect(kineticExtentInputOverDt(relative.kinetics, 1).relativeProgressFraction).toBeLessThanOrEqual(1);

    const qualitative = evaluateReactionCandidate(view, adapter, { temperatureK: 300 }, provider({
      getQualitativeRate: () => ({ rateClass: "SLOW", status: "EMPIRICAL", confidence: "LOW", source: { sourceIds: ["06"] } }),
    }));
    expect(qualitative.kinetics.supportClass).toBe("QUALITATIVE_ONLY");
    expect(kineticExtentInputOverDt(qualitative.kinetics, 1).requestedExtentMol).toBeUndefined();

    const open = evaluateReactionCandidate(view, adapter, { temperatureK: 300 }, provider());
    expect(open.kinetics.supportClass).toBe("OPEN");
    expect(open.kinetics.activationEnergy_J_per_mol).toBeUndefined();
    expect(open.kinetics.relativeRate).toBeUndefined();
  });

  it("does not promote reversible metadata into equilibrium or detailed-balance claims", () => {
    const result = evaluateReactionCandidate(
      { ...view, reversible: { pairKey: "pair", direction: "FORWARD" } },
      adapter,
      { temperatureK: 300 },
      provider({ getActivationBarrier: () => ({ activationEnergy_J_per_mol: quantity(10_000) }) }),
    );
    expect(result.reversibility?.direction).toBe("FORWARD");
    expect(result.reversibility?.detailedBalanceSupported).toBe(false);
    expect(result.reversibility).not.toHaveProperty("equilibriumConstant");
    expect(result.reversibility).not.toHaveProperty("reverseRate");
  });

  it("aggregates exact thermal cancellation once with complete coverage metadata", () => {
    const result = applyReactionThermalCoupling({
      thermalState: thermal(),
      progressEvents: [event("exo", 0), event("endo", 1)],
      evaluations: [evalFor("exo", -100), evalFor("endo", 100)],
      dtS: 1,
    });
    expect(result.knownReactionHeat_J).toBeCloseTo(0, 12);
    expect(result.state.temperatureK).toBeCloseTo(300, 12);
    expect(result.state.cumulativeEnergy.reactionHeat_J).toBeCloseTo(0, 12);
    expect(result.knownContributionCount).toBe(2);
    expect(result.committedContributionCount).toBe(2);
    expect(result.openHeatCandidateIds).toEqual([]);
    expect(result.thermalCoverage).toBe("COMPLETE");
  });

  it("keeps mixed known+missing enthalpy partial/open without fabricating heat", () => {
    const result = applyReactionThermalCoupling({
      thermalState: thermal(),
      progressEvents: [event("known", 0), event("open", 1)],
      evaluations: [evalFor("known", -100), evalFor("open")],
      dtS: 1,
    });
    expect(result.knownReactionHeat_J).toBe(100);
    expect(result.knownContributionCount).toBe(1);
    expect(result.committedContributionCount).toBe(2);
    expect(result.openHeatCandidateIds).toEqual(["open"]);
    expect(result.thermalCoverage).toBe("PARTIAL");
    expect(result.scientificStatus).toBe("OPEN");
  });

  it("keeps normal UI opaque, de-duplicates event delivery, and preserves provider order", () => {
    const first: ReactionFactProjection = {
      eventId: "e1", timestepId: "N", sequence: 0, candidateId: "internal-c1", startTimeS: 0, endTimeS: 1,
      extentMol: 0.1, consumed: [{ speciesRef: "known:A", amountMol: 0.1 }],
      produced: [{ speciesRef: "generated:hidden-X", amountMol: 0.1 }], scientificStatus: "OPEN",
      reasonCodes: ["MISSING_REACTION_ENTHALPY"],
    };
    const second: ReactionFactProjection = {
      eventId: "e2", timestepId: "N+1", sequence: 0, candidateId: "internal-c2", startTimeS: 1, endTimeS: 2,
      extentMol: 0.1, consumed: [{ speciesRef: "generated:hidden-X", amountMol: 0.1 }],
      produced: [{ speciesRef: "known:Y", amountMol: 0.1 }], reactionHeat_J: 42, scientificStatus: "APPROXIMATED",
      reasonCodes: [],
    };
    const p: Phase3AProviderProjection = {
      authoritativeVesselComposition: [{ speciesRef: "generated:hidden-X", amountMol: 0.1, phase: "unknown", phaseStateId: "p" }],
      activeReactionEvents: [second],
      timelineEvents: [first, first, second],
    };
    const resolver = (ref: string) => ref.startsWith("generated:")
      ? { unknownRef: "u:X", displayLabel: "Unknown X", identityConfirmed: false }
      : { unknownRef: `u:${ref}`, displayLabel: ref.endsWith("A") ? "A" : "Y", identityConfirmed: true, knownSpeciesId: ref };

    const normal = projectPhase3AReactionUi(p, resolver, false);
    expect(normal.reactionEvents.map((x) => x.id)).toEqual(["e1", "e2"]);
    expect(normal.reactionEvents.map((x) => x.timestepId)).toEqual(["N", "N+1"]);
    expect(normal.contents[0].displayIdentity).toBe("");
    expect(normal.contents[0].opaqueLabel).toBe("Unknown X");
    expect(normal.developerDiagnostics).toBeUndefined();
    expect(JSON.stringify(normal)).not.toContain("generated:hidden-X");
    expect(JSON.stringify(normal)).not.toContain("internal-c1");
    expect(normal.reactionEvents[0].reactionHeat.status).toBe("unavailable");
    expect(normal.reactionEvents[1].reactionHeat.label).toContain("≈");

    const dev = projectPhase3AReactionUi(p, resolver, true);
    expect(JSON.stringify(dev.developerDiagnostics)).toContain("generated:hidden-X");
    expect(JSON.stringify(dev.developerDiagnostics)).toContain("internal-c1");
  });
});
