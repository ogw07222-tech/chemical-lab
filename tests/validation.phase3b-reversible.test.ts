import { describe, expect, it } from "vitest";
import { DEFAULT_EQUILIBRIUM_STANDARD_STATE, type EquilibriumDataProvider, type RankedReactionEvaluation } from "../src/simulation/reaction-evaluation";
import { createMoleculeRecord, type ElementDefinition, type ElementProvider, type SpeciesState } from "../src/simulation/molecular";
import type { ReactionCandidate } from "../src/simulation/reaction";
import { createDynamicSpeciesRegistryFromSpecies } from "../src/simulation/reaction-progression";
import { createThermalState } from "../src/simulation/thermal";
import { arbitrateReversiblePairs, runPhase3BReactionProgressionFromFoundation, type Phase2ReactionPipelineResult, type Phase3BEquilibriumAuthority } from "../src/integration";

const T = 300;
const P = 100_000;
const H: ElementDefinition = { atomicNumber: 1, symbol: "H", atomicMolarMassKgPerMol: 0.001, valenceElectrons: 1, commonOxidationStates: [-1, 1], typicalValences: [1] };
const elements: ElementProvider = { getElement: (symbol) => symbol === "H" ? H : undefined };
const gas: SpeciesState["phaseState"] = { phase: "gas", source: "06", phaseStateId: "gas:06", scientificStatus: "APPROXIMATED" };
const H_ATOM = createMoleculeRecord({ atoms: [{ id: "h", element: "H", formalCharge: 0 }], bonds: [] }, elements);
const H2 = createMoleculeRecord({ atoms: [{ id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }], bonds: [{ id: "b", a: "h1", b: "h2", kind: "covalent", order: 1 }] }, elements);

function vessel(h2Mol: number, hMol: number, hPhase: SpeciesState["phaseState"] = gas): SpeciesState[] {
  return [{ id: "H2", molecule: H2, amountMol: h2Mol, phaseState: gas }, { id: "H", molecule: H_ATOM, amountMol: hMol, phaseState: hPhase }];
}
function candidate(id: string, direction: "FORWARD" | "REVERSE", paired = true): ReactionCandidate {
  const forward = direction === "FORWARD";
  return {
    id, family: forward ? "BOND_CLEAVAGE" : "BOND_FORMATION",
    reactantRefs: forward ? [{ speciesId: "H2", coefficient: 1 }] : [{ speciesId: "H", coefficient: 2 }],
    productGraphs: forward ? [H_ATOM] : [H2], atomMapping: [], bondChanges: [], chargeChanges: [],
    ...(paired ? { reversible: { pairId: "pair:06", direction } } : {}),
    stoichiometry: { reactants: forward ? [{ speciesId: "H2", coefficient: 1 }] : [{ speciesId: "H", coefficient: 2 }], products: [{ productIndex: 0, coefficient: forward ? 2 : 1 }] },
    structuralConfidence: 1, assumptions: ["06 fixture"], ruleId: `06:${id}`,
    conservation: { valid: true, delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 }, reasons: [] },
    debug: { structuralKey: `06:${id}`, rulePriority: 1, siteKeys: [] },
  };
}
function evaluation(id: string, direction: "FORWARD" | "REVERSE", rate = 0.2, support: "DIMENSIONED_RATE" | "OPEN" | "QUALITATIVE_ONLY" = "DIMENSIONED_RATE"): RankedReactionEvaluation {
  return {
    candidateId: id,
    thermo: { deltaH_J_per_mol: direction === "REVERSE" ? 100 : -100, deltaG_J_per_mol: -1, direction: "FORWARD_FAVORED", confidence: "HIGH", approximationClass: "APPROXIMATED", source: { sourceIds: ["06"] } },
    kinetics: support === "DIMENSIONED_RATE"
      ? { supportClass: support, extentRateMolPerS: rate, rateClass: "FAST", confidence: "HIGH", approximationClass: "VERIFIED" }
      : { supportClass: support, rateClass: support === "OPEN" ? "UNKNOWN" : "MODERATE", confidence: support === "OPEN" ? "UNASSESSED" : "MEDIUM", approximationClass: support === "OPEN" ? "OPEN" : "APPROXIMATED" },
    environment: { temperatureContribution: 1, pressureRelevance: "RELEVANT", activityContribution: 1, catalystModifier: 1, phaseAccessibility: { class: "GAS_GAS", factor: 1, status: "APPROXIMATED" } },
    reversibility: { pairKey: "pair:06", direction, detailedBalanceSupported: false }, feasible: "FEASIBLE", rankScore: 1,
    status: support === "OPEN" ? "OPEN" : "APPROXIMATED", reasonCodes: [], rank: 1, tie: true,
  };
}
const F = (paired = true) => candidate("forward", "FORWARD", paired);
const R = (paired = true) => candidate("reverse", "REVERSE", paired);
const evals = (rate = 0.2, support: "DIMENSIONED_RATE" | "OPEN" | "QUALITATIVE_ONLY" = "DIMENSIONED_RATE") => [evaluation("forward", "FORWARD", rate, support), evaluation("reverse", "REVERSE", rate, support)];
function foundation(candidates: ReactionCandidate[], ranked: RankedReactionEvaluation[]): Phase2ReactionPipelineResult {
  return { candidates, evaluations: ranked, ranked, validationCandidates: [], performance: { reactiveSites: 0, eligiblePairs: 0, rawCandidates: candidates.length, deduplicatedCandidates: candidates.length, prunedCandidates: candidates.length, runtimeMs: 0 } };
}
function provider(k = 1): EquilibriumDataProvider {
  return { getEquilibriumConstant: () => ({ equilibriumConstantK: k, referenceTemperatureK: T, standardState: DEFAULT_EQUILIBRIUM_STANDARD_STATE, status: "VERIFIED", confidence: "HIGH", source: { sourceIds: ["06"] } }) };
}
function authority(dataProvider: EquilibriumDataProvider = provider()): Phase3BEquilibriumAuthority {
  return {
    provider: dataProvider,
    compositionAdapter: { toEquilibriumComposition({ species, view }) {
      const map = new Map(species.map((s) => [s.id, s] as const));
      const keys = [...new Set([...view.reactants, ...view.products].map((x) => x.speciesKey))].sort();
      return { species: keys.map((speciesKey) => {
        const s = map.get(speciesKey); if (!s) throw new Error(`missing ${speciesKey}`);
        if (s.phaseState.phase !== "gas") return { speciesKey, phase: s.phaseState.phase, amountMol: s.amountMol };
        return { speciesKey, phase: "gas" as const, amountMol: s.amountMol, partialPressurePa: s.amountMol * P };
      }) };
    } },
  };
}
function run(species: SpeciesState[], candidates = [F(), R()], ranked = evals(), dtS = 1, eq = authority(), timestepId = "step") {
  return runPhase3BReactionProgressionFromFoundation(
    { species, elements },
    { environment: { temperatureK: T, pressurePa: P }, dtS, timestepId, startTimeS: 0, thermalState: createThermalState({ temperatureK: T, mixtureHeatCapacity_JPerK: 100, vesselHeatCapacity_JPerK: 100 }), speciesRegistry: createDynamicSpeciesRegistryFromSpecies(elements, species), resolutionOptions: { maxFractionalConsumptionPerStep: 1 }, equilibrium: eq },
    foundation(candidates, ranked),
  );
}
function inventory(species: readonly SpeciesState[]) { return species.reduce((n, s) => n + (s.molecule.formula.H ?? 0) * s.amountMol, 0); }
function snap(result: ReturnType<typeof run>) { return { arbitration: result.arbitration, selected: result.resolution.selected, species: result.nextState.species.map((x) => [x.id, x.amountMol]), events: result.resolution.progressEvents, heat: result.thermal.knownReactionHeat_J }; }

describe("06 independent Phase 3B reversible gates", () => {
  it("requires explicit pair metadata", () => {
    const r = arbitrateReversiblePairs({ species: vessel(0.9, 0.1), candidates: [F(false), R(false)], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority() });
    expect(r.pairs).toEqual([]); expect(r.candidateExtentControls).toEqual({});
  });

  it("keeps forward/reverse drive symmetric for reciprocal Q/K", () => {
    const f = arbitrateReversiblePairs({ species: vessel(1, 0.5), candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority() });
    const r = arbitrateReversiblePairs({ species: vessel(1, 2), candidates: [R(), F()], rankedEvaluations: [...evals()].reverse(), temperatureK: T, pressurePa: P, authority: authority() });
    expect(f.pairs[0]!.equilibriumDirection).toBe("FORWARD"); expect(r.pairs[0]!.equilibriumDirection).toBe("REVERSE");
    expect(f.pairs[0]!.drivingStrength).toBeCloseTo(r.pairs[0]!.drivingStrength, 12);
  });

  it("near equilibrium has zero coarse mutation and heat", () => {
    const initial = vessel(1, 1); const r = run(initial);
    expect(r.arbitration.pairs[0]!.equilibriumDirection).toBe("NEAR_EQUILIBRIUM"); expect(r.resolution.selected).toHaveLength(0);
    expect(r.nextState.species.map((x) => x.amountMol)).toEqual(initial.map((x) => x.amountMol)); expect(r.thermal.knownReactionHeat_J).toBe(0);
  });

  it("INDETERMINATE abstains without fabricated control", () => {
    const r = arbitrateReversiblePairs({ species: vessel(0.9, 0.1), candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority({}) });
    expect(r.pairs[0]!.equilibriumDirection).toBe("INDETERMINATE"); expect(r.candidateExtentControls).toEqual({});
    expect(r.pairs[0]!.maxExtentTowardEquilibriumMol).toBeUndefined(); expect(r.pairs[0]!.preventEquilibriumCrossing).toBe(false);
  });

  it("respects crossing cap and commits only one pair channel/heat", () => {
    const r = run(vessel(0.95, 0.05), [F(), R()], evals(100)); const fact = r.arbitration.pairs[0]!;
    expect(fact.preventEquilibriumCrossing).toBe(true); expect(fact.maxExtentTowardEquilibriumMol).toBeDefined();
    expect(r.resolution.selected).toHaveLength(1); expect(r.resolution.selected[0]!.candidateId).toBe("forward");
    expect(r.resolution.selected[0]!.appliedExtentMol).toBeLessThanOrEqual(fact.maxExtentTowardEquilibriumMol! + 1e-12);
    expect(r.thermal.committedContributionCount).toBe(1); expect(r.resolution.progressEvents).toHaveLength(1);
  });

  it("does not ping-pong across six starting regimes", () => {
    const starts = [vessel(0.99, 0.01), vessel(0.8, 0.4), vessel(0.500001, 0.999998), vessel(1, 1), vessel(0.5, 1.000002), vessel(0.1, 1.8)];
    for (const initial of starts) {
      let current = initial; const dirs: string[] = []; const extents: number[] = [];
      for (let i = 0; i < 30; i += 1) {
        const r = run(current, [F(), R()], evals(0.25), 0.25, authority(), `pp-${i}`); const s = r.resolution.selected[0];
        if (s) { dirs.push(s.candidateId); extents.push(s.appliedExtentMol); } current = [...r.nextState.species];
      }
      expect(dirs.slice(1).filter((d, i) => d !== dirs[i]).length).toBe(0);
      if (extents.length > 1) expect(extents.at(-1)!).toBeLessThanOrEqual(extents[0]! + 1e-12);
    }
  });

  it("coarse/medium/fine dt remain directionally stable and conservative", () => {
    const initial = vessel(0.9, 0.1); const total = 2;
    const simulate = (dt: number) => { let current = initial; const dirs: string[] = []; let heat = 0; for (let i = 0; i < total / dt; i += 1) { const r = run(current, [F(), R()], evals(0.2), dt, authority(), `dt-${dt}-${i}`); if (r.resolution.selected[0]) dirs.push(r.resolution.selected[0]!.candidateId); current = [...r.nextState.species]; heat += r.thermal.knownReactionHeat_J; } return { current, dirs, heat }; };
    const coarse = simulate(1), medium = simulate(0.5), fine = simulate(0.25);
    for (const x of [coarse, medium, fine]) { expect(x.dirs).not.toContain("reverse"); expect(inventory(x.current)).toBeCloseTo(inventory(initial), 10); expect(Number.isFinite(x.heat)).toBe(true); }
    expect(Math.abs(coarse.current.find((x) => x.id === "H2")!.amountMol - fine.current.find((x) => x.id === "H2")!.amountMol)).toBeLessThan(0.25);
  });

  it("candidate permutation and repeated replay are exact", () => {
    const initial = vessel(0.9, 0.1); const ref = snap(run(initial, [F(), R()], evals(0.17)));
    expect(snap(run(initial, [R(), F()], [...evals(0.17)].reverse()))).toEqual(ref);
    for (let i = 0; i < 20; i += 1) expect(snap(run(initial, [F(), R()], evals(0.17)))).toEqual(ref);
  });

  it("OPEN/QUALITATIVE kinetics are never converted into numeric extent", () => {
    for (const support of ["OPEN", "QUALITATIVE_ONLY"] as const) { const r = run(vessel(0.9, 0.1), [F(), R()], evals(0.2, support)); expect(r.arbitration.pairs[0]!.equilibriumDirection).toBe("FORWARD"); expect(r.resolution.selected).toHaveLength(0); expect(r.resolution.deferred.find((x) => x.candidateId === "forward")?.reasonCodes).toContain("MISSING_KINETIC_SIGNAL"); }
  });

  it("unknown phase causes scientific abstention", () => {
    const unknown: SpeciesState["phaseState"] = { phase: "unknown", source: "06", phaseStateId: "u", scientificStatus: "OPEN" };
    const r = arbitrateReversiblePairs({ species: vessel(0.9, 0.1, unknown), candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority() });
    expect(r.pairs[0]!.equilibriumDirection).toBe("INDETERMINATE"); expect(r.candidateExtentControls).toEqual({});
  });

  it("128 pseudo-random states remain finite, conservative, single-channel, deterministic", () => {
    let seed = 0x51a3b; const rnd = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
    for (let i = 0; i < 128; i += 1) {
      const initial = vessel(0.01 + rnd() * 1.99, 0.01 + rnd() * 2.99); const before = inventory(initial);
      const a = run(initial, [F(), R()], evals(0.5), 0.2, authority(), `rnd-${i}`); const b = run(initial, [R(), F()], [...evals(0.5)].reverse(), 0.2, authority(), `rnd-${i}`);
      expect(snap(b)).toEqual(snap(a)); expect(inventory(a.nextState.species)).toBeCloseTo(before, 10);
      expect(a.resolution.selected.filter((x) => x.candidateId === "forward" || x.candidateId === "reverse").length).toBeLessThanOrEqual(1);
      for (const s of a.nextState.species) { expect(Number.isFinite(s.amountMol)).toBe(true); expect(s.amountMol).toBeGreaterThanOrEqual(0); }
    }
  });

  it("records bounded synthetic arbitration work without inventing a threshold", () => {
    const initial = vessel(0.9, 0.1); const start = performance.now(); let checksum = 0;
    for (let i = 0; i < 2000; i += 1) checksum += arbitrateReversiblePairs({ species: initial, candidates: [F(), R()], rankedEvaluations: evals(), temperatureK: T, pressurePa: P, authority: authority() }).pairs[0]!.drivingStrength;
    const elapsed = performance.now() - start; expect(Number.isFinite(elapsed)).toBe(true); expect(checksum).toBeGreaterThan(0); console.log(`PHASE3B_06_PERF 2000_arbitrations_ms=${elapsed.toFixed(3)}`);
  });
});
