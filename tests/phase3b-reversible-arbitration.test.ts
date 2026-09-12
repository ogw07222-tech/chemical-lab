import { describe, expect, it } from "vitest";
import {
  DEFAULT_EQUILIBRIUM_STANDARD_STATE,
  type EquilibriumDataProvider,
  type RankedReactionEvaluation,
} from "../src/simulation/reaction-evaluation";
import {
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type SpeciesState,
} from "../src/simulation/molecular";
import type { ReactionCandidate } from "../src/simulation/reaction";
import { createDynamicSpeciesRegistryFromSpecies } from "../src/simulation/reaction-progression";
import { createThermalState } from "../src/simulation/thermal";
import {
  arbitrateReversiblePairs,
  runPhase3BReactionProgressionFromFoundation,
  type Phase2ReactionPipelineResult,
  type Phase3BEquilibriumAuthority,
} from "../src/integration";

const T = 300;
const P = 100_000;
const H: ElementDefinition = {
  atomicNumber: 1,
  symbol: "H",
  atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1,
  commonOxidationStates: [-1, 1],
  electronegativity: 2.2,
  typicalValences: [1],
};
const elements: ElementProvider = { getElement: (symbol) => symbol === "H" ? H : undefined };
const phase = { phase: "gas" as const, source: "test", phaseStateId: "gas:test", scientificStatus: "APPROXIMATED" as const };
const H_ATOM = createMoleculeRecord({ atoms: [{ id: "h", element: "H", formalCharge: 0 }], bonds: [] }, elements);
const H_PLUS = createMoleculeRecord({ atoms: [{ id: "hp", element: "H", formalCharge: 1 }], bonds: [] }, elements);
const H_MINUS = createMoleculeRecord({ atoms: [{ id: "hm", element: "H", formalCharge: -1 }], bonds: [] }, elements);
const H2 = createMoleculeRecord({
  atoms: [{ id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }],
  bonds: [{ id: "b", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);

function vessel(h2Mol: number, hMol: number, hId = "H"): SpeciesState[] {
  return [
    { id: "H2", molecule: H2, amountMol: h2Mol, phaseState: phase },
    { id: hId, molecule: H_ATOM, amountMol: hMol, phaseState: phase },
  ];
}

function reversible(id: string, direction: "FORWARD" | "REVERSE", hId = "H"): ReactionCandidate {
  const forward = direction === "FORWARD";
  return {
    id,
    family: forward ? "BOND_CLEAVAGE" : "BOND_FORMATION",
    reactantRefs: forward ? [{ speciesId: "H2", coefficient: 1 }] : [{ speciesId: hId, coefficient: 2 }],
    productGraphs: forward ? [H_ATOM] : [H2],
    atomMapping: [], bondChanges: [], chargeChanges: [],
    reversible: { pairId: "pair:H2:2H", direction },
    stoichiometry: {
      reactants: forward ? [{ speciesId: "H2", coefficient: 1 }] : [{ speciesId: hId, coefficient: 2 }],
      products: [{ productIndex: 0, coefficient: forward ? 2 : 1 }],
    },
    structuralConfidence: 1,
    assumptions: ["synthetic reversible fixture"],
    ruleId: `test:${id}`,
    conservation: { valid: true, delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 }, reasons: [] },
    debug: { structuralKey: `test:${id}`, rulePriority: 1, siteKeys: [] },
  };
}

function branchCandidate(): ReactionCandidate {
  return {
    id: "branch",
    family: "BOND_CLEAVAGE",
    reactantRefs: [{ speciesId: "H2", coefficient: 1 }],
    productGraphs: [H_PLUS, H_MINUS],
    atomMapping: [], bondChanges: [], chargeChanges: [],
    stoichiometry: {
      reactants: [{ speciesId: "H2", coefficient: 1 }],
      products: [{ productIndex: 0, coefficient: 1 }, { productIndex: 1, coefficient: 1 }],
    },
    structuralConfidence: 1,
    assumptions: ["synthetic branch fixture"],
    ruleId: "test:branch",
    conservation: { valid: true, delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 }, reasons: [] },
    debug: { structuralKey: "test:branch", rulePriority: 1, siteKeys: [] },
  };
}

function evaluation(
  candidateId: string,
  direction: "FORWARD" | "REVERSE" | "UNSPECIFIED",
  rate = 0.2,
  supportClass: "DIMENSIONED_RATE" | "OPEN" | "QUALITATIVE_ONLY" = "DIMENSIONED_RATE",
): RankedReactionEvaluation {
  const deltaH = direction === "REVERSE" ? 100 : -100;
  return {
    candidateId,
    thermo: {
      deltaH_J_per_mol: deltaH,
      deltaG_J_per_mol: -1,
      direction: "FORWARD_FAVORED",
      confidence: "HIGH",
      approximationClass: "APPROXIMATED",
      source: { sourceIds: ["test"] },
    },
    kinetics: supportClass === "DIMENSIONED_RATE"
      ? { supportClass, extentRateMolPerS: rate, rateClass: "FAST", confidence: "HIGH", approximationClass: "VERIFIED" }
      : { supportClass, rateClass: supportClass === "OPEN" ? "UNKNOWN" : "MODERATE", confidence: supportClass === "OPEN" ? "UNASSESSED" : "MEDIUM", approximationClass: supportClass === "OPEN" ? "OPEN" : "APPROXIMATED" },
    environment: {
      temperatureContribution: 1,
      pressureRelevance: "RELEVANT",
      activityContribution: 1,
      catalystModifier: 1,
      phaseAccessibility: { class: "GAS_GAS", factor: 1, status: "APPROXIMATED" },
    },
    ...(direction === "UNSPECIFIED" ? {} : { reversibility: { pairKey: "pair:H2:2H", direction, detailedBalanceSupported: false } }),
    feasible: "FEASIBLE",
    rankScore: 1,
    status: supportClass === "OPEN" ? "OPEN" : "APPROXIMATED",
    reasonCodes: [],
    rank: 1,
    tie: true,
  };
}

function foundation(candidates: ReactionCandidate[], ranked: RankedReactionEvaluation[]): Phase2ReactionPipelineResult {
  return {
    candidates,
    evaluations: ranked,
    ranked,
    validationCandidates: [],
    performance: { reactiveSites: 0, eligiblePairs: 0, rawCandidates: candidates.length, deduplicatedCandidates: candidates.length, prunedCandidates: candidates.length, runtimeMs: 0 },
  };
}

function equilibriumProvider(k = 1): EquilibriumDataProvider {
  return {
    getEquilibriumConstant: () => ({
      equilibriumConstantK: k,
      referenceTemperatureK: T,
      standardState: DEFAULT_EQUILIBRIUM_STANDARD_STATE,
      status: "VERIFIED",
      confidence: "HIGH",
      source: { sourceIds: ["phase3b-test"] },
    }),
  };
}

function authority(provider: EquilibriumDataProvider = equilibriumProvider()): Phase3BEquilibriumAuthority {
  return {
    provider,
    compositionAdapter: {
      toEquilibriumComposition({ species, view }) {
        const byId = new Map(species.map((state) => [state.id, state] as const));
        const keys = [...new Set([...view.reactants, ...view.products].map((term) => term.speciesKey))].sort();
        return {
          species: keys.map((speciesKey) => {
            const state = byId.get(speciesKey);
            if (!state) throw new Error(`missing species ${speciesKey}`);
            return { speciesKey, phase: "gas" as const, amountMol: state.amountMol, partialPressurePa: state.amountMol * P };
          }),
        };
      },
    },
  };
}

function thermal() {
  return createThermalState({ temperatureK: T, mixtureHeatCapacity_JPerK: 100, vesselHeatCapacity_JPerK: 100 });
}

function run(
  species: SpeciesState[],
  candidates: ReactionCandidate[],
  ranked: RankedReactionEvaluation[],
  dtS = 1,
  eq = authority(),
  timestepId = "step-1",
) {
  return runPhase3BReactionProgressionFromFoundation(
    { species, elements },
    {
      environment: { temperatureK: T, pressurePa: P },
      dtS,
      timestepId,
      startTimeS: 0,
      thermalState: thermal(),
      speciesRegistry: createDynamicSpeciesRegistryFromSpecies(elements, species),
      resolutionOptions: { maxFractionalConsumptionPerStep: 1 },
      equilibrium: eq,
    },
    foundation(candidates, ranked),
  );
}

const F = (hId = "H") => reversible("forward", "FORWARD", hId);
const R = (hId = "H") => reversible("reverse", "REVERSE", hId);
const evals = (rate = 0.2) => [evaluation("forward", "FORWARD", rate), evaluation("reverse", "REVERSE", rate)];

function amount(result: ReturnType<typeof run>, id: string): number {
  return result.nextState.species.find((state) => state.id === id)?.amountMol ?? 0;
}

describe("Phase 3B reversible pair arbitration", () => {
  it("A mostly A selects forward and suppresses reverse", () => {
    const result = run(vessel(0.9, 0.1), [F(), R()], evals());
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("FORWARD");
    expect(result.resolution.selected.map((x) => x.candidateId)).toEqual(["forward"]);
    expect(result.resolution.deferred.find((x) => x.candidateId === "reverse")?.reasonCodes).toContain("REVERSIBLE_PAIR_SUPPRESSED");
  });

  it("B mostly B selects reverse", () => {
    const result = run(vessel(0.1, 1.8), [F(), R()], evals());
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("REVERSE");
    expect(result.resolution.selected.map((x) => x.candidateId)).toEqual(["reverse"]);
  });

  it("C near equilibrium has zero coarse net progression and no snap", () => {
    const initial = vessel(1, 1);
    const result = run(initial, [F(), R()], evals());
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("NEAR_EQUILIBRIUM");
    expect(result.resolution.selected).toHaveLength(0);
    expect(result.nextState.species.map((x) => x.amountMol)).toEqual(initial.map((x) => x.amountMol));
  });

  it("D repeated approach shrinks extent as driving weakens", () => {
    let current = vessel(0.9, 0.1);
    const extents: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const result = run(current, [F(), R()], evals(0.08), 1, authority(), `step-${i}`);
      if (result.resolution.selected[0]) extents.push(result.resolution.selected[0].appliedExtentMol);
      current = [...result.nextState.species];
    }
    expect(extents.length).toBeGreaterThan(2);
    expect(extents.at(-1)!).toBeLessThan(extents[0]!);
  });

  it("E applies the PR51 anti-crossing cap", () => {
    const result = run(vessel(0.9, 0.1), [F(), R()], evals(10));
    const fact = result.arbitration.pairs[0]!;
    expect(fact.preventEquilibriumCrossing).toBe(true);
    expect(fact.maxExtentTowardEquilibriumMol).toBeDefined();
    expect(result.resolution.selected[0]!.appliedExtentMol).toBeLessThanOrEqual(fact.maxExtentTowardEquilibriumMol! + 1e-12);
  });

  it("F avoids persistent forward/reverse ping-pong", () => {
    let current = vessel(0.9, 0.1);
    const directions: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const result = run(current, [F(), R()], evals(0.3), 1, authority(), `step-${i}`);
      if (result.resolution.selected[0]) directions.push(result.resolution.selected[0].candidateId);
      current = [...result.nextState.species];
    }
    expect(directions).not.toContain("reverse");
  });

  it("G is invariant to candidate/evaluation permutation", () => {
    const current = vessel(0.9, 0.1);
    const a = arbitrateReversiblePairs({ species: current, candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority() });
    const b = arbitrateReversiblePairs({ species: current, candidates: [R(), F()], rankedEvaluations: [...evals()].reverse(), temperatureK: T, pressurePa: P, authority: authority() });
    expect(b).toEqual(a);
  });

  it("H commits at most one determinate net direction and heat contribution", () => {
    const result = run(vessel(0.9, 0.1), [F(), R()], evals(10));
    expect(result.resolution.selected).toHaveLength(1);
    expect(result.thermal.committedContributionCount).toBe(1);
  });

  it("I sends the surviving channel into ordinary shared-reactant competition", () => {
    const branch = branchCandidate();
    const result = run(vessel(0.9, 0.1), [F(), R(), branch], [...evals(10), evaluation("branch", "UNSPECIFIED", 10)]);
    expect(amount(result, "H2")).toBeGreaterThanOrEqual(0);
    expect(result.resolution.selected.some((x) => x.candidateId === "reverse")).toBe(false);
    expect(result.resolution.selected.some((x) => x.candidateId === "branch")).toBe(true);
  });

  it("J INDETERMINATE/OPEN authority abstains", () => {
    const arbitration = arbitrateReversiblePairs({ species: vessel(0.9, 0.1), candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority({}) });
    expect(arbitration.pairs[0]!.equilibriumDirection).toBe("INDETERMINATE");
    expect(arbitration.pairs[0]!.equilibriumScientificStatus).toBe("OPEN");
    expect(arbitration.candidateExtentControls).toEqual({});
  });

  it("K never fabricates numeric extent from OPEN kinetics", () => {
    const result = run(vessel(0.9, 0.1), [F(), R()], [evaluation("forward", "FORWARD", 0, "OPEN"), evaluation("reverse", "REVERSE", 1)]);
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("FORWARD");
    expect(result.resolution.selected).toHaveLength(0);
    expect(result.resolution.deferred.find((x) => x.candidateId === "forward")?.reasonCodes).toContain("MISSING_KINETIC_SIGNAL");
  });

  it("L preserves forward exothermic / reverse endothermic heat signs without double apply", () => {
    const f = run(vessel(0.9, 0.1), [F(), R()], evals(0.1));
    const r = run(vessel(0.1, 1.8), [F(), R()], evals(0.1));
    expect(f.thermal.knownReactionHeat_J).toBeGreaterThan(0);
    expect(r.thermal.knownReactionHeat_J).toBeLessThan(0);
    expect(f.thermal.committedContributionCount).toBe(1);
    expect(r.thermal.committedContributionCount).toBe(1);
  });

  it("M lets a generated species participate in the reversible pair on the next timestep", () => {
    const initial: SpeciesState[] = [{ id: "H2", molecule: H2, amountMol: 1, phaseState: phase }];
    const first = runPhase3BReactionProgressionFromFoundation(
      { species: initial, elements },
      {
        environment: { temperatureK: T, pressurePa: P }, dtS: 1, timestepId: "gen", startTimeS: 0,
        thermalState: thermal(), speciesRegistry: createDynamicSpeciesRegistryFromSpecies(elements, initial),
        resolutionOptions: { maxFractionalConsumptionPerStep: 1 }, equilibrium: authority(),
      },
      foundation([F("future-H")], [evaluation("forward", "FORWARD", 0.75)]),
    );
    const generated = first.nextState.species.find((x) => x.id !== "H2")!;
    expect(generated.amountMol).toBeGreaterThan(0);
    expect(generated.id.startsWith("generated:")).toBe(true);

    const second = runPhase3BReactionProgressionFromFoundation(
      { species: first.nextState.species, elements },
      {
        environment: { temperatureK: T, pressurePa: P }, dtS: 1, timestepId: "reverse", startTimeS: 1,
        thermalState: first.nextState.thermalState, speciesRegistry: first.nextState.speciesRegistry!,
        resolutionOptions: { maxFractionalConsumptionPerStep: 1 }, equilibrium: authority(),
      },
      foundation([F(generated.id), R(generated.id)], [evaluation("forward", "FORWARD", 0.1), evaluation("reverse", "REVERSE", 0.1)]),
    );
    expect(second.arbitration.pairs[0]!.equilibriumDirection).toBe("REVERSE");
    expect(second.resolution.selected[0]?.candidateId).toBe("reverse");
  });

  it("N keeps same-step generated reverse reactants ineligible", () => {
    const initial: SpeciesState[] = [{ id: "H2", molecule: H2, amountMol: 1, phaseState: phase }];
    const futureId = `generated:${H_ATOM.canonicalKey}`;
    const result = runPhase3BReactionProgressionFromFoundation(
      { species: initial, elements },
      {
        environment: { temperatureK: T, pressurePa: P }, dtS: 1, timestepId: "no-cascade", startTimeS: 0,
        thermalState: thermal(), speciesRegistry: createDynamicSpeciesRegistryFromSpecies(elements, initial),
        resolutionOptions: { maxFractionalConsumptionPerStep: 1 }, equilibrium: authority(),
      },
      foundation([F(futureId), R(futureId)], [evaluation("forward", "FORWARD", 0.2), evaluation("reverse", "REVERSE", 0.2)]),
    );
    expect(result.resolution.selected.some((x) => x.candidateId === "reverse")).toBe(false);
    expect(result.resolution.deferred.find((x) => x.candidateId === "reverse")?.reasonCodes).toContain("ZERO_INITIAL_REACTANT");
  });

  it("O replays deterministically", () => {
    const initial = vessel(0.9, 0.1);
    const a = run(initial, [F(), R()], evals(0.15));
    const b = run(initial, [F(), R()], evals(0.15));
    expect(b.arbitration).toEqual(a.arbitration);
    expect(b.resolution.selected).toEqual(a.resolution.selected);
    expect(b.nextState.species).toEqual(a.nextState.species);
    expect(b.resolution.progressEvents).toEqual(a.resolution.progressEvents);
    expect(b.thermal.knownReactionHeat_J).toBe(a.thermal.knownReactionHeat_J);
  });

  it("keeps dt and dt/2 trajectories finite/non-negative", () => {
    const initial = vessel(0.9, 0.1);
    const one = run(initial, [F(), R()], evals(0.08), 1);
    const half1 = run(initial, [F(), R()], evals(0.08), 0.5, authority(), "h1");
    const half2 = run([...half1.nextState.species], [F(), R()], evals(0.08), 0.5, authority(), "h2");
    for (const state of [...one.nextState.species, ...half2.nextState.species]) {
      expect(Number.isFinite(state.amountMol)).toBe(true);
      expect(state.amountMol).toBeGreaterThanOrEqual(0);
    }
  });
});
