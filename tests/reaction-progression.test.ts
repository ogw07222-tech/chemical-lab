import { describe, expect, it } from "vitest";
import { createMoleculeRecord, type ElementDefinition, type ElementProvider, type SpeciesState } from "../src/simulation/molecular";
import type { ReactionCandidate } from "../src/simulation/reaction";
import type { RankedReactionEvaluation } from "../src/simulation/reaction-evaluation";
import { applyReactionThermalCoupling, resolveReactionCandidates, type ReactionProductStateResolver } from "../src/simulation/reaction-progression";
import { createThermalState, stepThermalState } from "../src/simulation/thermal";

const H: ElementDefinition = {
  atomicNumber: 1,
  symbol: "H",
  atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1,
  commonOxidationStates: [-1, 1],
  typicalValences: [1],
};
const elements: ElementProvider = { getElement: (symbol) => symbol === "H" ? H : undefined };
const atomH = createMoleculeRecord({ atoms: [{ id: "h", element: "H", formalCharge: 0 }], bonds: [] }, elements);
const h2 = createMoleculeRecord({
  atoms: [{ id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }],
  bonds: [{ id: "b", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);
const phase = { phase: "gas" as const, source: "test", phaseStateId: "gas:test", scientificStatus: "APPROXIMATED" as const };

function states(h2Amount = 1, hAmount = 0): SpeciesState[] {
  return [
    { id: "H2", molecule: h2, amountMol: h2Amount, phaseState: phase },
    { id: "H", molecule: atomH, amountMol: hAmount, phaseState: phase },
  ];
}

function totalHAtomsMol(species: readonly SpeciesState[]): number {
  return species.reduce((sum, state) => sum + (state.molecule.formula.H ?? 0) * state.amountMol, 0);
}

function candidate(id: string): ReactionCandidate {
  return {
    id,
    family: "BOND_CLEAVAGE",
    reactantRefs: [{ speciesId: "H2", coefficient: 1 }],
    productGraphs: [atomH, atomH],
    atomMapping: [
      { reactant: { speciesId: "H2", atomId: "h1" }, productIndex: 0, productAtomId: "h" },
      { reactant: { speciesId: "H2", atomId: "h2" }, productIndex: 1, productAtomId: "h" },
    ],
    bondChanges: [{ kind: "REMOVE", a: { speciesId: "H2", atomId: "h1" }, b: { speciesId: "H2", atomId: "h2" }, beforeOrder: 1, bondKind: "covalent" }],
    chargeChanges: [],
    stoichiometry: {
      reactants: [{ speciesId: "H2", coefficient: 1 }],
      products: [{ productIndex: 0, coefficient: 1 }, { productIndex: 1, coefficient: 1 }],
    },
    structuralConfidence: 0.8,
    assumptions: ["synthetic progression fixture"],
    ruleId: "test:h2-cleavage",
    conservation: { valid: true, delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 }, reasons: [] },
    debug: { structuralKey: `fixture:${id}`, rulePriority: 1, siteKeys: [] },
  };
}

function evaluation(id: string, rank = 1, relativeRate = 1, deltaH: number | undefined = 100): RankedReactionEvaluation {
  return {
    candidateId: id,
    thermo: {
      ...(deltaH === undefined ? {} : { deltaH_J_per_mol: deltaH }),
      deltaG_J_per_mol: -100,
      direction: "FORWARD_FAVORED",
      confidence: "MEDIUM",
      approximationClass: deltaH === undefined ? "OPEN" : "APPROXIMATED",
      source: { sourceIds: ["test"] },
    },
    kinetics: {
      activationEnergy_J_per_mol: 0,
      rateClass: relativeRate === 0 ? "NEGLIGIBLE" : "VERY_FAST",
      relativeRate,
      confidence: "MEDIUM",
      approximationClass: "APPROXIMATED",
    },
    environment: {
      temperatureContribution: 1,
      pressureRelevance: "RELEVANT",
      activityContribution: 1,
      catalystModifier: 1,
      phaseAccessibility: { class: "GAS_GAS", factor: 1, status: "APPROXIMATED" },
    },
    feasible: "FEASIBLE",
    rankScore: 1,
    status: deltaH === undefined ? "OPEN" : "APPROXIMATED",
    reasonCodes: [],
    rank,
    tie: false,
  };
}

const productResolver: ReactionProductStateResolver = {
  resolveProductState: (_candidate, _productIndex, product) => product.canonicalKey === atomH.canonicalKey ? { speciesId: "H" } : undefined,
};

function resolve(candidates: ReactionCandidate[], evaluations: RankedReactionEvaluation[], species = states(), options = {}) {
  return resolveReactionCandidates({
    species,
    elements,
    candidates,
    rankedEvaluations: evaluations,
    productStateResolver: productResolver,
    dtS: 1,
    timestepId: "step-1",
    startTimeS: 0,
    temperatureK: 300,
    pressurePa: 101325,
    volumeM3: 0.001,
    options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01, ...options },
  });
}

describe("Phase 2E reaction resolution", () => {
  it("bounds extent by limiting reactant and never creates negative amounts", () => {
    const result = resolve([candidate("a")], [evaluation("a")], states(0.25, 0));
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0]!.appliedExtentMol).toBeLessThanOrEqual(0.25);
    expect(result.speciesAfter.find((s) => s.id === "H2")!.amountMol).toBeGreaterThanOrEqual(0);
  });

  it("preserves explicit atom inventory across applied state mutation", () => {
    const initial = states(0.4, 0.2);
    const result = resolve([candidate("a")], [evaluation("a")], initial);
    expect(totalHAtomsMol(result.speciesAfter)).toBeCloseTo(totalHAtomsMol(initial), 12);
  });

  it("shares a tied reactant pool without overconsumption", () => {
    const ea = { ...evaluation("a"), tie: true };
    const eb = { ...evaluation("b"), tie: true };
    const result = resolve([candidate("a"), candidate("b")], [ea, eb]);
    expect(result.selected).toHaveLength(2);
    expect(result.selected[0]!.appliedExtentMol + result.selected[1]!.appliedExtentMol).toBeLessThanOrEqual(1 + 1e-12);
    expect(result.diagnostics.sharedReactantScaled).toBe(2);
  });

  it("is deterministic across repeated identical timesteps", () => {
    const a = resolve([candidate("a"), candidate("b")], [{ ...evaluation("a"), tie: true }, { ...evaluation("b"), tie: true }]);
    const b = resolve([candidate("a"), candidate("b")], [{ ...evaluation("a"), tie: true }, { ...evaluation("b"), tie: true }]);
    expect(a.selected).toEqual(b.selected);
    expect(a.netSpeciesAmountDeltaMol).toEqual(b.netSpeciesAmountDeltaMol);
    expect(a.progressEvents).toEqual(b.progressEvents);
  });

  it("rejects invalid dt and NaN/Infinity species state", () => {
    expect(() => resolveReactionCandidates({ species: states(), elements, candidates: [], rankedEvaluations: [], productStateResolver: productResolver, dtS: 0, timestepId: "x", startTimeS: 0, temperatureK: 300 })).toThrow();
    expect(() => resolve([candidate("a")], [evaluation("a")], states(Number.NaN, 0))).toThrow();
    expect(() => resolve([candidate("a")], [evaluation("a")], states(Number.POSITIVE_INFINITY, 0))).toThrow();
    expect(() => resolve([candidate("a")], [evaluation("a")], states(Number.NEGATIVE_INFINITY, 0))).toThrow();
  });

  it("defers unresolved product identity instead of inventing a species id", () => {
    const result = resolveReactionCandidates({ species: states(), elements, candidates: [candidate("a")], rankedEvaluations: [evaluation("a")], productStateResolver: { resolveProductState: () => undefined }, dtS: 1, timestepId: "x", startTimeS: 0, temperatureK: 300 });
    expect(result.selected).toHaveLength(0);
    expect(result.deferred[0]!.reasonCodes).toContain("UNRESOLVED_PRODUCT_IDENTITY");
  });

  it("ignores zero-extent kinetics safely", () => {
    const result = resolve([candidate("a")], [evaluation("a", 1, 0)]);
    expect(result.selected).toHaveLength(0);
    expect(result.deferred[0]!.reasonCodes).toContain("ZERO_EXTENT");
  });
});

describe("reaction heat coupling", () => {
  const thermal = createThermalState({ temperatureK: 300, mixtureHeatCapacity_JPerK: 100, vesselHeatCapacity_JPerK: 100 });

  it("uses actual applied extent for reaction heat and records the ledger", () => {
    const resolution = resolve([candidate("a")], [evaluation("a", 1, 1, 100)]);
    const extent = resolution.selected[0]!.appliedExtentMol;
    const coupled = applyReactionThermalCoupling({ thermalState: thermal, progressEvents: resolution.progressEvents, evaluations: [evaluation("a", 1, 1, 100)], dtS: 1 });
    expect(coupled.knownReactionHeat_J).toBeCloseTo(-100 * extent, 12);
    expect(coupled.events[0]!.heatJ).toBeCloseTo(-100 * extent, 12);
    expect(coupled.state.cumulativeEnergy.reactionHeat_J).toBeCloseTo(-100 * extent, 12);
    expect(coupled.state.temperatureK).toBeLessThan(300);
  });

  it("does not fabricate heat when deltaH is missing", () => {
    const resolution = resolve([candidate("a")], [evaluation("a", 1, 1, undefined)] , states(), { allowUncertainEvaluations: true });
    const coupled = applyReactionThermalCoupling({ thermalState: thermal, progressEvents: resolution.progressEvents, evaluations: [evaluation("a", 1, 1, undefined)], dtS: 1 });
    expect(coupled.knownReactionHeat_J).toBe(0);
    expect(coupled.missingHeatCandidateIds).toContain("a");
    expect(coupled.scientificStatus).toBe("OPEN");
    expect(coupled.state.cumulativeEnergy.reactionHeat_J).toBe(0);
  });

  it("supports aggregate reaction heat and rejects double specification", () => {
    const aggregate = stepThermalState(thermal, { dtS: 0, reactionHeat_J: 20 });
    expect(aggregate.state.cumulativeEnergy.reactionHeat_J).toBe(20);
    expect(aggregate.state.temperatureK).toBeCloseTo(300.1, 12);
    expect(() => stepThermalState(thermal, {
      dtS: 0,
      reactionHeat_J: 20,
      reactionHeat: { reactionExtentMol: 1, deltaH_JPerMolExtent: -20 },
    })).toThrow();
  });
});
