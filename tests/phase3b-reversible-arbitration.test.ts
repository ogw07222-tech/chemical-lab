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
  type MoleculeRecord,
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
const phase = {
  phase: "gas" as const,
  source: "test",
  phaseStateId: "gas:test",
  scientificStatus: "APPROXIMATED" as const,
};

const atomH = createMoleculeRecord({ atoms: [{ id: "h", element: "H", formalCharge: 0 }], bonds: [] }, elements);
const hPlus = createMoleculeRecord({ atoms: [{ id: "hp", element: "H", formalCharge: 1 }], bonds: [] }, elements);
const hMinus = createMoleculeRecord({ atoms: [{ id: "hm", element: "H", formalCharge: -1 }], bonds: [] }, elements);
const h2 = createMoleculeRecord({
  atoms: [{ id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }],
  bonds: [{ id: "b", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);

function species(h2Mol: number, hMol: number, hId = "H"): SpeciesState[] {
  return [
    { id: "H2", molecule: h2, amountMol: h2Mol, phaseState: phase },
    { id: hId, molecule: atomH, amountMol: hMol, phaseState: phase },
  ];
}

function candidate(
  id: string,
  direction: "FORWARD" | "REVERSE",
  hId = "H",
): ReactionCandidate {
  const forward = direction === "FORWARD";
  return {
    id,
    family: forward ? "BOND_CLEAVAGE" : "BOND_FORMATION",
    reactantRefs: forward
      ? [{ speciesId: "H2", coefficient: 1 }]
      : [{ speciesId: hId, coefficient: 2 }],
    productGraphs: forward ? [atomH] : [h2],
    atomMapping: [],
    bondChanges: [],
    chargeChanges: [],
    reversible: { pairId: "pair:H2:2H", direction },
    stoichiometry: {
      reactants: forward
        ? [{ speciesId: "H2", coefficient: 1 }]
        : [{ speciesId: hId, coefficient: 2 }],
      products: [{ productIndex: 0, coefficient: forward ? 2 : 1 }],
    },
    structuralConfidence: 1,
    assumptions: ["synthetic exact reversible pair"],
    ruleId: `test:${id}`,
    conservation: {
      valid: true,
      delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 },
      reasons: [],
    },
    debug: { structuralKey: `test:${id}`, rulePriority: 1, siteKeys: [] },
  };
}

function unrelatedIonization(id = "ionize"): ReactionCandidate {
  return {
    id,
    family: "BOND_CLEAVAGE",
    reactantRefs: [{ speciesId: "H2", coefficient: 1 }],
    productGraphs: [hPlus, hMinus],
    atomMapping: [],
    bondChanges: [],
    chargeChanges: [],
    stoichiometry: {
      reactants: [{ speciesId: "H2", coefficient: 1 }],
      products: [{ productIndex: 0, coefficient: 1 }, { productIndex: 1, coefficient: 1 }],
    },
    structuralConfidence: 1,
    assumptions: ["synthetic shared-reactant branch"],
    ruleId: `test:${id}`,
    conservation: {
      valid: true,
      delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 },
      reasons: [],
    },
    debug: { structuralKey: `test:${id}`, rulePriority: 1, siteKeys: [] },
  };
}

function evaluation(
  candidateId: string,
  direction: "FORWARD" | "REVERSE" | "UNSPECIFIED",
  extentRateMolPerS = 0.2,
  deltaH = direction === "REVERSE" ? 100 : -100,
  supportClass: "DIMENSIONED_RATE" | "OPEN" | "QUALITATIVE_ONLY" = "DIMENSIONED_RATE",
): RankedReactionEvaluation {
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
      ? {
          supportClass,
          extentRateMolPerS,
          rateClass: "FAST",
          confidence: "HIGH",
          approximationClass: "VERIFIED",
        }
      : {
          supportClass,
          rateClass: supportClass === "OPEN" ? "UNKNOWN" : "MODERATE",
          confidence: supportClass === "OPEN" ? "UNASSESSED" : "MEDIUM",
          approximationClass: supportClass === "OPEN" ? "OPEN" : "APPROXIMATED",
        },
    environment: {
      temperatureContribution: 1,
      pressureRelevance: "RELEVANT",
      activityContribution: 1,
      catalystModifier: 1,
      phaseAccessibility: { class: "GAS_GAS", factor: 1, status: "APPROXIMATED" },
    },
    ...(direction === "UNSPECIFIED" ? {} : {
      reversibility: { pairKey: "pair:H2:2H", direction, detailedBalanceSupported: false },
    }),
    feasible: "FEASIBLE",
    rankScore: 1,
    status: supportClass === "OPEN" ? "OPEN" : "APPROXIMATED",
    reasonCodes: [],
    rank: 1,
    tie: true,
  };
}

function foundation(candidates: ReactionCandidate[], evaluations: RankedReactionEvaluation[]): Phase2ReactionPipelineResult {
  return {
    candidates,
    evaluations,
    ranked: evaluations,
    validationCandidates: [],
    performance: {
      reactiveSites: 0,
      eligiblePairs: 0,
      rawCandidates: candidates.length,
      deduplicatedCandidates: candidates.length,
      prunedCandidates: candidates.length,
      runtimeMs: 0,
    },
  };
}

function provider(k = 1): EquilibriumDataProvider {
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

function authority(dataProvider: EquilibriumDataProvider = provider()): Phase3BEquilibriumAuthority {
  return {
    provider: dataProvider,
    compositionAdapter: {
      toEquilibriumComposition({ species: current, view }) {
        const byId = new Map(current.map((state) => [state.id, state] as const));
        const keys = [...new Set([...view.reactants, ...view.products].map((term) => term.speciesKey))].sort();
        return {
          species: keys.map((speciesKey) => {
            const state = byId.get(speciesKey);
            if (!state) throw new Error(`missing projected species ${speciesKey}`);
            return {
              speciesKey,
              phase: "gas" as const,
              amountMol: state.amountMol,
              partialPressurePa: state.amountMol * P,
            };
          }),
        };
      },
    },
  };
}

function thermal() {
  return createThermalState({
    temperatureK: T,
    mixtureHeatCapacity_JPerK: 100,
    vesselHeatCapacity_JPerK: 100,
  });
}

function run(
  initial: SpeciesState[],
  candidates: ReactionCandidate[],
  evaluations: RankedReactionEvaluation[],
  dtS = 1,
  eqAuthority = authority(),
  timestepId = "step-1",
) {
  return runPhase3BReactionProgressionFromFoundation(
    { species: initial, elements },
    {
      environment: { temperatureK: T, pressurePa: P },
      dtS,
      timestepId,
      startTimeS: 0,
      thermalState: thermal(),
      speciesRegistry: createDynamicSpeciesRegistryFromSpecies(elements, initial),
      resolutionOptions: { maxFractionalConsumptionPerStep: 1 },
      equilibrium: eqAuthority,
    },
    foundation(candidates, evaluations),
  );
}

const forward = () => candidate("forward", "FORWARD");
const reverse = () => candidate("reverse", "REVERSE");
const evals = (rate = 0.2) => [evaluation("forward", "FORWARD", rate), evaluation("reverse", "REVERSE", rate)];

function amount(result: ReturnType<typeof run>, id: string): number {
  return result.nextState.species.find((state) => state.id === id)?.amountMol ?? 0;
}

describe("Phase 3B reversible-pair arbitration", () => {
  it("A: mostly reactant selects forward and suppresses reverse", () => {
    const result = run(species(0.9, 0.1), [forward(), reverse()], evals());
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("FORWARD");
    expect(result.resolution.selected.map((entry) => entry.candidateId)).toEqual(["forward"]);
    expect(result.resolution.deferred.find((entry) => entry.candidateId === "reverse")?.reasonCodes).toContain("REVERSIBLE_PAIR_SUPPRESSED");
  });

  it("B: mostly product selects reverse", () => {
    const result = run(species(0.1, 1.8), [forward(), reverse()], evals());
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("REVERSE");
    expect(result.resolution.selected.map((entry) => entry.candidateId)).toEqual(["reverse"]);
  });

  it("C: near equilibrium gives zero coarse net progression without snapping state", () => {
    const initial = species(1, 1);
    const result = run(initial, [forward(), reverse()], evals());
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("NEAR_EQUILIBRIUM");
    expect(result.resolution.selected).toHaveLength(0);
    expect(result.nextState.species.map((state) => state.amountMol)).toEqual(initial.map((state) => state.amountMol));
  });

  it("D: repeated approach shrinks committed extent as driving weakens", () => {
    let current = species(0.9, 0.1);
    const extents: number[] = [];
    for (let step = 0; step < 8; step += 1) {
      const result = run(current, [forward(), reverse()], evals(0.08), 1, authority(), `step-${step}`);
      if (result.resolution.selected[0]) extents.push(result.resolution.selected[0].appliedExtentMol);
      current = [...result.nextState.species];
    }
    expect(extents.length).toBeGreaterThan(2);
    expect(extents.at(-1)!).toBeLessThan(extents[0]!);
  });

  it("E: enforces the 02 anti-crossing extent cap", () => {
    const result = run(species(0.9, 0.1), [forward(), reverse()], evals(10));
    const fact = result.arbitration.pairs[0]!;
    expect(fact.preventEquilibriumCrossing).toBe(true);
    expect(fact.maxExtentTowardEquilibriumMol).toBeDefined();
    expect(result.resolution.selected[0]!.appliedExtentMol).toBeLessThanOrEqual(fact.maxExtentTowardEquilibriumMol! + 1e-12);
  });

  it("F: repeated timesteps do not persistently ping-pong across equilibrium", () => {
    let current = species(0.9, 0.1);
    const directions: string[] = [];
    for (let step = 0; step < 12; step += 1) {
      const result = run(current, [forward(), reverse()], evals(0.3), 1, authority(), `step-${step}`);
      if (result.resolution.selected[0]) directions.push(result.resolution.selected[0].candidateId);
      current = [...result.nextState.species];
    }
    expect(directions).not.toContain("reverse");
  });

  it("G: candidate/evaluation permutation does not change arbitration", () => {
    const current = species(0.9, 0.1);
    const first = arbitrateReversiblePairs({
      species: current,
      candidates: [forward(), reverse()],
      rankedEvaluations: evals(),
      temperatureK: T,
      pressurePa: P,
      authority: authority(),
    });
    const second = arbitrateReversiblePairs({
      species: current,
      candidates: [reverse(), forward()],
      rankedEvaluations: [...evals()].reverse(),
      temperatureK: T,
      pressurePa: P,
      authority: authority(),
    });
    expect(second).toEqual(first);
  });

  it("H: never commits both net directions for a determinate pair", () => {
    const result = run(species(0.9, 0.1), [forward(), reverse()], evals(10));
    expect(result.resolution.selected).toHaveLength(1);
    expect(result.thermal.committedContributionCount).toBe(1);
  });

  it("I: surviving pair channel enters normal shared-reactant competition", () => {
    const branch = unrelatedIonization();
    const result = run(
      species(0.9, 0.1),
      [forward(), reverse(), branch],
      [...evals(10), evaluation(branch.id, "UNSPECIFIED", 10, 0)],
    );
    expect(amount(result, "H2")).toBeGreaterThanOrEqual(0);
    expect(result.resolution.selected.some((entry) => entry.candidateId === "reverse")).toBe(false);
    expect(result.resolution.selected.some((entry) => entry.candidateId === branch.id)).toBe(true);
  });

  it("J: INDETERMINATE/OPEN equilibrium authority abstains without bias", () => {
    const current = species(0.9, 0.1);
    const arbitration = arbitrateReversiblePairs({
      species: current,
      candidates: [forward(), reverse()],
      rankedEvaluations: evals(),
      temperatureK: T,
      pressurePa: P,
      authority: authority({}),
    });
    expect(arbitration.pairs[0]!.equilibriumDirection).toBe("INDETERMINATE");
    expect(arbitration.pairs[0]!.equilibriumScientificStatus).toBe("OPEN");
    expect(arbitration.candidateExtentControls).toEqual({});
  });

  it("K: equilibrium driving never fabricates numeric extent for OPEN kinetics", () => {
    const result = run(
      species(0.9, 0.1),
      [forward(), reverse()],
      [evaluation("forward", "FORWARD", 0, -100, "OPEN"), evaluation("reverse", "REVERSE", 1, 100)],
    );
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("FORWARD");
    expect(result.resolution.selected).toHaveLength(0);
    expect(result.resolution.deferred.find((entry) => entry.candidateId === "forward")?.reasonCodes).toContain("MISSING_KINETIC_SIGNAL");
  });

  it("L: forward/reverse channels preserve opposite heat sign semantics and heat is applied once", () => {
    const forwardRun = run(species(0.9, 0.1), [forward(), reverse()], evals(0.1));
    expect(forwardRun.thermal.knownReactionHeat_J).toBeGreaterThan(0);
    expect(forwardRun.thermal.committedContributionCount).toBe(1);

    const reverseRun = run(species(0.1, 1.8), [forward(), reverse()], evals(0.1));
    expect(reverseRun.thermal.knownReactionHeat_J).toBeLessThan(0);
    expect(reverseRun.thermal.committedContributionCount).toBe(1);
  });

  it("M: a generated product can become the reverse reactant on the next timestep", () => {
    const initial: SpeciesState[] = [{ id: "H2", molecule: h2, amountMol: 1, phaseState: phase }];
    const firstForward = candidate("forward", "FORWARD", "future-generated-H");
    const first = runPhase3BReactionProgressionFromFoundation(
      { species: initial, elements },
      {
        environment: { temperatureK: T, pressurePa: P },
        dtS: 1,
        timestepId: "generate-H",
        startTimeS: 0,
        thermalState: thermal(),
        speciesRegistry: createDynamicSpeciesRegistryFromSpecies(elements, initial),
        resolutionOptions: { maxFractionalConsumptionPerStep: 1 },
        equilibrium: authority(),
      },
      foundation([firstForward], [evaluation("forward", "FORWARD", 10)]),
    );
    const generated = first.nextState.species.find((state) => state.id !== "H2");
    expect(generated?.amountMol).toBeGreaterThan(0);
    expect(generated?.id.startsWith("generated:")).toBe(true);

    const generatedId = generated!.id;
    const secondForward = candidate("forward", "FORWARD", generatedId);
    const secondReverse = candidate("reverse", "REVERSE", generatedId);
    const second = runPhase3BReactionProgressionFromFoundation(
      { species: first.nextState.species, elements },
      {
        environment: { temperatureK: T, pressurePa: P },
        dtS: 1,
        timestepId: "consume-generated-H",
        startTimeS: 1,
        thermalState: first.nextState.thermalState,
        speciesRegistry: first.nextState.speciesRegistry!,
        resolutionOptions: { maxFractionalConsumptionPerStep: 1 },
        equilibrium: authority(),
      },
      foundation([secondForward, secondReverse], [evaluation("forward", "FORWARD", 0.1), evaluation("reverse", "REVERSE", 0.1)]),
    );
    expect(second.arbitration.pairs).toHaveLength(1);
    expect(second.arbitration.pairs[0]!.equilibriumDirection).toBe("REVERSE");
    expect(second.resolution.selected[0]?.candidateId).toBe("reverse");
  });

  it("N: generated species is still prohibited from same-step reverse cascade", () => {
    const initial: SpeciesState[] = [{ id: "H2", molecule: h2, amountMol: 1, phaseState: phase }];
    const futureId = `generated:${atomH.canonicalKey}`;
    const f = candidate("forward", "FORWARD", futureId);
    const r = candidate("reverse", "REVERSE", futureId);
    const result = runPhase3BReactionProgressionFromFoundation(
      { species: initial, elements },
      {
        environment: { temperatureK: T, pressurePa: P },
        dtS: 1,
        timestepId: "no-cascade",
        startTimeS: 0,
        thermalState: thermal(),
        speciesRegistry: createDynamicSpeciesRegistryFromSpecies(elements, initial),
        resolutionOptions: { maxFractionalConsumptionPerStep: 1 },
        equilibrium: authority(),
      },
      foundation([f, r], [evaluation("forward", "FORWARD", 1), evaluation("reverse", "REVERSE", 1)]),
    );
    expect(result.resolution.selected.some((entry) => entry.candidateId === "reverse")).toBe(false);
    expect(result.resolution.deferred.find((entry) => entry.candidateId === "reverse")?.reasonCodes).toContain("ZERO_INITIAL_REACTANT");
  });

  it("O: deterministic replay preserves direction, extent, composition, events, and heat", () => {
    const initial = species(0.9, 0.1);
    const a = run(initial, [forward(), reverse()], evals(0.15));
    const b = run(initial, [forward(), reverse()], evals(0.15));
    expect(b.arbitration).toEqual(a.arbitration);
    expect(b.resolution.selected).toEqual(a.resolution.selected);
    expect(b.nextState.species).toEqual(a.nextState.species);
    expect(b.resolution.progressEvents).toEqual(a.resolution.progressEvents);
    expect(b.thermal.knownReactionHeat_J).toBe(a.thermal.knownReactionHeat_J);
  });

  it("timestep subdivision remains finite, conservative, and on the same equilibrium side", () => {
    const initial = species(0.9, 0.1);
    const one = run(initial, [forward(), reverse()], evals(0.08), 1);
    const half1 = run(initial, [forward(), reverse()], evals(0.08), 0.5, authority(), "half-1");
    const half2 = run([...half1.nextState.species], [forward(), reverse()], evals(0.08), 0.5, authority(), "half-2");
    for (const state of [...one.nextState.species, ...half2.nextState.species]) {
      expect(Number.isFinite(state.amountMol)).toBe(true);
      expect(state.amountMol).toBeGreaterThanOrEqual(0);
    }
    expect(one.arbitration.pairs[0]!.equilibriumDirection).toBe("FORWARD");
    expect(half1.arbitration.pairs[0]!.equilibriumDirection).toBe("FORWARD");
  });
});
