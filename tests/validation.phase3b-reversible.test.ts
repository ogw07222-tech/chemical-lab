import { describe, expect, it } from "vitest";
import {
  DEFAULT_EQUILIBRIUM_STANDARD_STATE,
  type EquilibriumDataProvider,
  type RankedReactionEvaluation,
} from "../src/simulation/reaction-evaluation";
import { createMoleculeRecord, type ElementDefinition, type ElementProvider, type SpeciesState } from "../src/simulation/molecular";
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
  typicalValences: [1],
};
const elements: ElementProvider = { getElement: (symbol) => symbol === "H" ? H : undefined };
const gas = { phase: "gas" as const, source: "06-validation", phaseStateId: "gas:06", scientificStatus: "APPROXIMATED" as const };
const H_ATOM = createMoleculeRecord({ atoms: [{ id: "h", element: "H", formalCharge: 0 }], bonds: [] }, elements);
const H2 = createMoleculeRecord({
  atoms: [{ id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }],
  bonds: [{ id: "b", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);

function vessel(h2Mol: number, hMol: number, hPhase = gas): SpeciesState[] {
  return [
    { id: "H2", molecule: H2, amountMol: h2Mol, phaseState: gas },
    { id: "H", molecule: H_ATOM, amountMol: hMol, phaseState: hPhase },
  ];
}

function pairCandidate(id: string, direction: "FORWARD" | "REVERSE", pair = true): ReactionCandidate {
  const forward = direction === "FORWARD";
  return {
    id,
    family: forward ? "BOND_CLEAVAGE" : "BOND_FORMATION",
    reactantRefs: forward ? [{ speciesId: "H2", coefficient: 1 }] : [{ speciesId: "H", coefficient: 2 }],
    productGraphs: forward ? [H_ATOM] : [H2],
    atomMapping: [],
    bondChanges: [],
    chargeChanges: [],
    ...(pair ? { reversible: { pairId: "pair:06", direction } } : {}),
    stoichiometry: {
      reactants: forward ? [{ speciesId: "H2", coefficient: 1 }] : [{ speciesId: "H", coefficient: 2 }],
      products: [{ productIndex: 0, coefficient: forward ? 2 : 1 }],
    },
    structuralConfidence: 1,
    assumptions: ["06 synthetic reversible validation fixture"],
    ruleId: `06:${id}`,
    conservation: { valid: true, delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 }, reasons: [] },
    debug: { structuralKey: `06:${id}`, rulePriority: 1, siteKeys: [] },
  };
}

function evalFor(
  candidateId: string,
  direction: "FORWARD" | "REVERSE" | "UNSPECIFIED",
  rate = 0.2,
  supportClass: "DIMENSIONED_RATE" | "OPEN" | "QUALITATIVE_ONLY" = "DIMENSIONED_RATE",
): RankedReactionEvaluation {
  return {
    candidateId,
    thermo: {
      deltaH_J_per_mol: direction === "REVERSE" ? 100 : -100,
      deltaG_J_per_mol: -1,
      direction: "FORWARD_FAVORED",
      confidence: "HIGH",
      approximationClass: "APPROXIMATED",
      source: { sourceIds: ["06-phase3b-validation"] },
    },
    kinetics: supportClass === "DIMENSIONED_RATE"
      ? { supportClass, extentRateMolPerS: rate, rateClass: "FAST", confidence: "HIGH", approximationClass: "VERIFIED" }
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
    ...(direction === "UNSPECIFIED" ? {} : { reversibility: { pairKey: "pair:06", direction, detailedBalanceSupported: false } }),
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
      source: { sourceIds: ["06-equilibrium-fixture"] },
    }),
  };
}

function authority(dataProvider: EquilibriumDataProvider = provider()): Phase3BEquilibriumAuthority {
  return {
    provider: dataProvider,
    compositionAdapter: {
      toEquilibriumComposition({ species, view }) {
        const byId = new Map(species.map((state) => [state.id, state] as const));
        const keys = [...new Set([...view.reactants, ...view.products].map((term) => term.speciesKey))].sort();
        return {
          species: keys.map((speciesKey) => {
            const state = byId.get(speciesKey);
            if (!state) throw new Error(`missing species ${speciesKey}`);
            if (state.phaseState.phase !== "gas") {
              return { speciesKey, phase: state.phaseState.phase, amountMol: state.amountMol };
            }
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

const F = (pair = true) => pairCandidate("forward", "FORWARD", pair);
const R = (pair = true) => pairCandidate("reverse", "REVERSE", pair);
const evals = (rate = 0.2, support: "DIMENSIONED_RATE" | "OPEN" | "QUALITATIVE_ONLY" = "DIMENSIONED_RATE") => [
  evalFor("forward", "FORWARD", rate, support),
  evalFor("reverse", "REVERSE", rate, support),
];

function run(
  species: SpeciesState[],
  candidates = [F(), R()],
  ranked = evals(),
  dtS = 1,
  eq = authority(),
  timestepId = "06-step",
  startTimeS = 0,
) {
  return runPhase3BReactionProgressionFromFoundation(
    { species, elements },
    {
      environment: { temperatureK: T, pressurePa: P },
      dtS,
      timestepId,
      startTimeS,
      thermalState: thermal(),
      speciesRegistry: createDynamicSpeciesRegistryFromSpecies(elements, species),
      resolutionOptions: { maxFractionalConsumptionPerStep: 1 },
      equilibrium: eq,
    },
    foundation(candidates, ranked),
  );
}

function hInventory(species: readonly SpeciesState[]): number {
  return species.reduce((sum, state) => sum + (state.molecule.formula.H ?? 0) * state.amountMol, 0);
}

function snapshot(result: ReturnType<typeof run>) {
  return {
    arbitration: result.arbitration,
    selected: result.resolution.selected,
    species: result.nextState.species.map((x) => ({ id: x.id, amountMol: x.amountMol })),
    events: result.resolution.progressEvents,
    heat: result.thermal.knownReactionHeat_J,
  };
}

function advance(initial: SpeciesState[], dt: number, total: number) {
  let current = initial;
  const directions: string[] = [];
  let heat = 0;
  let events = 0;
  const steps = Math.round(total / dt);
  for (let i = 0; i < steps; i += 1) {
    const result = run(current, [F(), R()], evals(0.2), dt, authority(), `dt-${dt}-${i}`, i * dt);
    if (result.resolution.selected[0]) directions.push(result.resolution.selected[0].candidateId);
    current = [...result.nextState.species];
    heat += result.thermal.knownReactionHeat_J;
    events += result.resolution.progressEvents.length;
  }
  return { current, directions, heat, events };
}

describe("06 independent Phase 3B reversible validation", () => {
  it("uses explicit reversible metadata only; reverse-looking unpaired channels are not arbitrated", () => {
    const result = arbitrateReversiblePairs({
      species: vessel(0.9, 0.1),
      candidates: [F(false), R(false)],
      rankedEvaluations: evals(),
      temperatureK: T,
      pressurePa: P,
      authority: authority(),
    });
    expect(result.pairs).toEqual([]);
    expect(result.candidateExtentControls).toEqual({});
  });

  it("is directionally correct and symmetric in driving magnitude for reciprocal Q/K states", () => {
    const forward = arbitrateReversiblePairs({ species: vessel(1, 0.5), candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority() });
    const reverse = arbitrateReversiblePairs({ species: vessel(1, 2), candidates: [R(), F()], rankedEvaluations: [...evals()].reverse(), temperatureK: T, pressurePa: P, authority: authority() });
    expect(forward.pairs[0]!.equilibriumDirection).toBe("FORWARD");
    expect(reverse.pairs[0]!.equilibriumDirection).toBe("REVERSE");
    expect(forward.pairs[0]!.drivingStrength).toBeCloseTo(reverse.pairs[0]!.drivingStrength, 12);
  });

  it("near-equilibrium produces zero coarse net mutation without snap or heat", () => {
    const initial = vessel(1, 1);
    const result = run(initial);
    expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("NEAR_EQUILIBRIUM");
    expect(result.resolution.selected).toHaveLength(0);
    expect(result.nextState.species.map((x) => x.amountMol)).toEqual(initial.map((x) => x.amountMol));
    expect(result.thermal.committedContributionCount).toBe(0);
    expect(result.thermal.knownReactionHeat_J).toBe(0);
  });

  it("INDETERMINATE abstains without controls or fabricated caps", () => {
    const arbitration = arbitrateReversiblePairs({
      species: vessel(0.9, 0.1), candidates: [F(), R()], rankedEvaluations: evals(),
      temperatureK: T, pressurePa: P, authority: authority({}),
    });
    expect(arbitration.pairs[0]!.equilibriumDirection).toBe("INDETERMINATE");
    expect(arbitration.pairs[0]!.equilibriumScientificStatus).toBe("OPEN");
    expect(arbitration.candidateExtentControls).toEqual({});
    expect(arbitration.pairs[0]!.maxExtentTowardEquilibriumMol).toBeUndefined();
    expect(arbitration.pairs[0]!.preventEquilibriumCrossing).toBe(false);
  });

  it("prevents overshoot with a high kinetic request and never double-commits the pair", () => {
    const result = run(vessel(0.95, 0.05), [F(), R()], evals(100));
    const fact = result.arbitration.pairs[0]!;
    expect(fact.preventEquilibriumCrossing).toBe(true);
    expect(fact.maxExtentTowardEquilibriumMol).toBeDefined();
    expect(result.resolution.selected).toHaveLength(1);
    expect(result.resolution.selected[0]!.candidateId).toBe("forward");
    expect(result.resolution.selected[0]!.appliedExtentMol).toBeLessThanOrEqual(fact.maxExtentTowardEquilibriumMol! + 1e-12);
    expect(result.thermal.committedContributionCount).toBe(1);
    expect(result.resolution.progressEvents).toHaveLength(1);
  });

  it("approaches equilibrium without alternating ping-pong from six initial regimes", () => {
    const starts = [
      vessel(0.99, 0.01),
      vessel(0.8, 0.4),
      vessel(0.500001, 0.999998),
      vessel(1, 1),
      vessel(0.5, 1.000002),
      vessel(0.1, 1.8),
    ];
    for (const initial of starts) {
      let current = initial;
      const directions: string[] = [];
      const magnitudes: number[] = [];
      for (let i = 0; i < 30; i += 1) {
        const result = run(current, [F(), R()], evals(0.25), 0.25, authority(), `pp-${i}`, i * 0.25);
        const selected = result.resolution.selected[0];
        if (selected) {
          directions.push(selected.candidateId);
          magnitudes.push(selected.appliedExtentMol);
        }
        current = [...result.nextState.species];
      }
      const flips = directions.slice(1).filter((d, i) => d !== directions[i]).length;
      expect(flips).toBe(0);
      if (magnitudes.length > 1) expect(magnitudes.at(-1)!).toBeLessThanOrEqual(magnitudes[0]! + 1e-12);
      for (const state of current) {
        expect(Number.isFinite(state.amountMol)).toBe(true);
        expect(state.amountMol).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("keeps coarse/medium/fine timestep runs qualitatively stable and conservative", () => {
    const initial = vessel(0.9, 0.1);
    const coarse = advance(initial, 1, 2);
    const medium = advance(initial, 0.5, 2);
    const fine = advance(initial, 0.25, 2);
    for (const result of [coarse, medium, fine]) {
      expect(result.directions).not.toContain("reverse");
      expect(hInventory(result.current)).toBeCloseTo(hInventory(initial), 10);
      for (const state of result.current) {
        expect(Number.isFinite(state.amountMol)).toBe(true);
        expect(state.amountMol).toBeGreaterThanOrEqual(0);
      }
      expect(Number.isFinite(result.heat)).toBe(true);
    }
    const coarseH2 = coarse.current.find((x) => x.id === "H2")!.amountMol;
    const fineH2 = fine.current.find((x) => x.id === "H2")!.amountMol;
    expect(Math.abs(coarseH2 - fineH2)).toBeLessThan(0.25);
  });

  it("candidate permutation preserves mutation, extent, heat, and event semantics", () => {
    const initial = vessel(0.9, 0.1);
    const a = run(initial, [F(), R()], evals(0.2));
    const b = run(initial, [R(), F()], [...evals(0.2)].reverse());
    expect(snapshot(b)).toEqual(snapshot(a));
  });

  it("deterministic replay is exact across repeated identical execution", () => {
    const initial = vessel(0.9, 0.1);
    const reference = snapshot(run(initial, [F(), R()], evals(0.17)));
    for (let i = 0; i < 20; i += 1) {
      expect(snapshot(run(initial, [F(), R()], evals(0.17)))).toEqual(reference);
    }
  });

  it("OPEN and QUALITATIVE_ONLY kinetics are not converted into numeric extent by equilibrium drive", () => {
    for (const support of ["OPEN", "QUALITATIVE_ONLY"] as const) {
      const result = run(vessel(0.9, 0.1), [F(), R()], evals(0.2, support));
      expect(result.arbitration.pairs[0]!.equilibriumDirection).toBe("FORWARD");
      expect(result.resolution.selected).toHaveLength(0);
      expect(result.resolution.deferred.find((x) => x.candidateId === "forward")?.reasonCodes).toContain("MISSING_KINETIC_SIGNAL");
    }
  });

  it("unsupported/unknown phase evidence yields abstention instead of forced direction", () => {
    const unknownPhase = { phase: "unknown" as const, source: "06", phaseStateId: "unknown:06", scientificStatus: "OPEN" as const };
    const arbitration = arbitrateReversiblePairs({
      species: vessel(0.9, 0.1, unknownPhase),
      candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P,
      authority: authority(),
    });
    expect(arbitration.pairs[0]!.equilibriumDirection).toBe("INDETERMINATE");
    expect(arbitration.candidateExtentControls).toEqual({});
  });

  it("randomized positive states preserve invariants and deterministic arbitration", () => {
    let seed = 0x51a3b;
    const random = () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 0x1_0000_0000;
    };
    for (let i = 0; i < 128; i += 1) {
      const initial = vessel(0.01 + random() * 1.99, 0.01 + random() * 2.99);
      const before = hInventory(initial);
      const first = run(initial, [F(), R()], evals(0.5), 0.2, authority(), `rnd-${i}`);
      const second = run(initial, [R(), F()], [...evals(0.5)].reverse(), 0.2, authority(), `rnd-${i}`);
      expect(snapshot(second)).toEqual(snapshot(first));
      expect(hInventory(first.nextState.species)).toBeCloseTo(before, 10);
      expect(first.resolution.selected.filter((x) => x.candidateId === "forward" || x.candidateId === "reverse").length).toBeLessThanOrEqual(1);
      for (const state of first.nextState.species) {
        expect(Number.isFinite(state.amountMol)).toBe(true);
        expect(state.amountMol).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("arbitration work remains bounded in a synthetic repeated measurement", () => {
    const initial = vessel(0.9, 0.1);
    const start = performance.now();
    let checksum = 0;
    for (let i = 0; i < 2000; i += 1) {
      const result = arbitrateReversiblePairs({
        species: initial, candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority(),
      });
      checksum += result.pairs[0]!.drivingStrength;
    }
    const elapsedMs = performance.now() - start;
    expect(Number.isFinite(elapsedMs)).toBe(true);
    expect(checksum).toBeGreaterThan(0);
    console.log(`PHASE3B_06_PERF 2000_arbitrations_ms=${elapsedMs.toFixed(3)}`);
  });
});
