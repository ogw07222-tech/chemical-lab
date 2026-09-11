import { describe, expect, it } from "vitest";
import {
  canonicalStructuralRepresentation,
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type MoleculeRecord,
  type MolecularGraph,
  type SpeciesState,
} from "../src/simulation/molecular";
import type { ReactionCandidate } from "../src/simulation/reaction";
import type { RankedReactionEvaluation } from "../src/simulation/reaction-evaluation";
import { resolveReactionCandidatesWithRegistry } from "../src/simulation/reaction-progression";
import {
  createDynamicSpeciesRegistry,
  restoreDynamicSpeciesRegistry,
} from "../src/simulation/species-registry";

const H: ElementDefinition = {
  atomicNumber: 1,
  symbol: "H",
  atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1,
  commonOxidationStates: [-1, 1],
  electronegativity: 2.2,
  typicalValences: [1],
};
const C: ElementDefinition = {
  atomicNumber: 6,
  symbol: "C",
  atomicMolarMassKgPerMol: 0.012,
  valenceElectrons: 4,
  commonOxidationStates: [-4, 2, 4],
  electronegativity: 2.55,
  typicalValences: [4],
};
const O: ElementDefinition = {
  atomicNumber: 8,
  symbol: "O",
  atomicMolarMassKgPerMol: 0.016,
  valenceElectrons: 6,
  commonOxidationStates: [-2],
  electronegativity: 3.44,
  typicalValences: [2],
};
const bySymbol = new Map([H, C, O].map((element) => [element.symbol, element]));
const elements: ElementProvider = { getElement: (symbol) => bySymbol.get(symbol) };

const phase = {
  phase: "gas" as const,
  source: "06-pr39-validation",
  phaseStateId: "phase:06",
  scientificStatus: "OPEN" as const,
};

function graph(
  atoms: readonly [id: string, element: string, formalCharge?: number][],
  bonds: readonly [id: string, a: string, b: string, order: number][],
): MolecularGraph {
  return {
    atoms: atoms.map(([id, element, formalCharge = 0]) => ({ id, element, formalCharge })),
    bonds: bonds.map(([id, a, b, order]) => ({ id, a, b, kind: "covalent" as const, order })),
  };
}

function hAtom(id = "h", charge = 0): MoleculeRecord {
  return createMoleculeRecord(graph([[id, "H", charge]], []), elements);
}

function h2(): MoleculeRecord {
  return createMoleculeRecord(graph(
    [["h1", "H"], ["h2", "H"]],
    [["b", "h1", "h2", 1]],
  ), elements);
}

function water(): MoleculeRecord {
  return createMoleculeRecord(graph(
    [["o", "O"], ["h1", "H"], ["h2", "H"]],
    [["b1", "o", "h1", 1], ["b2", "o", "h2", 1]],
  ), elements);
}

function ethanolLike(): MoleculeRecord {
  return createMoleculeRecord(graph(
    [["c1", "C"], ["c2", "C"], ["o", "O"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"], ["h5", "H"], ["h6", "H"]],
    [["cc", "c1", "c2", 1], ["co", "c2", "o", 1], ["1", "c1", "h1", 1], ["2", "c1", "h2", 1], ["3", "c1", "h3", 1], ["4", "c2", "h4", 1], ["5", "c2", "h5", 1], ["6", "o", "h6", 1]],
  ), elements);
}

function etherLike(): MoleculeRecord {
  return createMoleculeRecord(graph(
    [["c1", "C"], ["c2", "C"], ["o", "O"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"], ["h5", "H"], ["h6", "H"]],
    [["c1o", "c1", "o", 1], ["c2o", "c2", "o", 1], ["1", "c1", "h1", 1], ["2", "c1", "h2", 1], ["3", "c1", "h3", 1], ["4", "c2", "h4", 1], ["5", "c2", "h5", 1], ["6", "c2", "h6", 1]],
  ), elements);
}

function carbonPair(order: number, chargeA = 0): MoleculeRecord {
  return createMoleculeRecord(graph(
    [["a", "C", chargeA], ["b", "C"]],
    [["bond", "a", "b", order]],
  ), elements);
}

function permute(source: MolecularGraph, seed: number): MolecularGraph {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const atoms = [...source.atoms].sort(() => random() - 0.5);
  const remap = new Map(atoms.map((atom, index) => [atom.id, `a-${seed}-${index}`]));
  const bonds = [...source.bonds]
    .sort(() => random() - 0.5)
    .map((bond, index) => ({
      ...bond,
      id: `b-${seed}-${index}`,
      a: remap.get(bond.a)!,
      b: remap.get(bond.b)!,
    }));
  return {
    atoms: atoms.map((atom) => ({ ...atom, id: remap.get(atom.id)! })),
    bonds,
  };
}

function evaluation(candidateId: string, rank = 1): RankedReactionEvaluation {
  return {
    candidateId,
    thermo: {
      deltaH_J_per_mol: 0,
      deltaG_J_per_mol: -1,
      direction: "FORWARD_FAVORED",
      confidence: "MEDIUM",
      approximationClass: "APPROXIMATED",
      source: { sourceIds: ["06-validation"] },
    },
    kinetics: {
      activationEnergy_J_per_mol: 0,
      rateClass: "VERY_FAST",
      relativeRate: 1,
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
    status: "APPROXIMATED",
    reasonCodes: [],
    rank,
    tie: false,
  };
}

function cleavageCandidate(id: string, sourceId: string, product: MoleculeRecord): ReactionCandidate {
  return {
    id,
    family: "BOND_CLEAVAGE",
    reactantRefs: [{ speciesId: sourceId, coefficient: 1 }],
    productGraphs: [product, product],
    atomMapping: [],
    bondChanges: [],
    chargeChanges: [],
    stoichiometry: {
      reactants: [{ speciesId: sourceId, coefficient: 1 }],
      products: [{ productIndex: 0, coefficient: 1 }, { productIndex: 1, coefficient: 1 }],
    },
    structuralConfidence: 0.8,
    assumptions: ["06 validation fixture"],
    ruleId: "06:cleavage",
    conservation: {
      valid: true,
      delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 },
      reasons: [],
    },
    debug: { structuralKey: `06:${id}`, rulePriority: 1, siteKeys: [] },
  };
}

function associationCandidate(id: string, sourceId: string, product: MoleculeRecord): ReactionCandidate {
  return {
    id,
    family: "BOND_FORMATION",
    reactantRefs: [{ speciesId: sourceId, coefficient: 2 }],
    productGraphs: [product],
    atomMapping: [],
    bondChanges: [],
    chargeChanges: [],
    stoichiometry: {
      reactants: [{ speciesId: sourceId, coefficient: 2 }],
      products: [{ productIndex: 0, coefficient: 1 }],
    },
    structuralConfidence: 0.8,
    assumptions: ["06 validation fixture"],
    ruleId: "06:association",
    conservation: {
      valid: true,
      delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 },
      reasons: [],
    },
    debug: { structuralKey: `06:${id}`, rulePriority: 1, siteKeys: [] },
  };
}

function totalElements(species: readonly SpeciesState[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const state of species) {
    for (const [symbol, count] of Object.entries(state.molecule.formula)) {
      out[symbol] = (out[symbol] ?? 0) + count * state.amountMol;
    }
  }
  return out;
}

function totalAtoms(species: readonly SpeciesState[]): number {
  return species.reduce((sum, state) => sum + state.molecule.graph.atoms.length * state.amountMol, 0);
}

function totalCharge(species: readonly SpeciesState[]): number {
  return species.reduce((sum, state) => sum + state.molecule.netCharge * state.amountMol, 0);
}

describe("06 independent validation — PR39 dynamic species registry", () => {
  it("canonical identity survives 128 deterministic atom/bond/runtime-id permutations", () => {
    const baseline = water();
    const baselineRepresentation = canonicalStructuralRepresentation(baseline.graph);
    const registry = createDynamicSpeciesRegistry({ elements });
    const first = registry.resolveOrRegister({ molecule: baseline });
    expect(first.status).toBe("GENERATED");
    if (first.status === "INVALID") throw new Error(first.reason);

    let current = first.registry;
    for (let seed = 1; seed <= 128; seed += 1) {
      const molecule = createMoleculeRecord(permute(baseline.graph, seed), elements);
      expect(molecule.canonicalKey).toBe(baseline.canonicalKey);
      expect(canonicalStructuralRepresentation(molecule.graph)).toBe(baselineRepresentation);
      const resolved = current.resolveOrRegister({ molecule });
      expect(resolved.status).toBe("GENERATED");
      if (resolved.status === "INVALID") throw new Error(resolved.reason);
      expect(resolved.speciesId).toBe(first.speciesId);
      current = resolved.registry;
    }
    expect(current.size).toBe(1);
  });

  it("does not false-merge same-formula connectivity isomers", () => {
    const left = ethanolLike();
    const right = etherLike();
    expect(left.formula).toEqual(right.formula);
    expect(left.canonicalKey).not.toBe(right.canonicalKey);

    const first = createDynamicSpeciesRegistry({ elements }).resolveOrRegister({ molecule: left });
    expect(first.status).toBe("GENERATED");
    if (first.status === "INVALID") throw new Error(first.reason);
    const second = first.registry.resolveOrRegister({ molecule: right });
    expect(second.status).toBe("GENERATED");
    if (second.status === "INVALID") throw new Error(second.reason);
    expect(second.speciesId).not.toBe(first.speciesId);
    expect(second.registry.size).toBe(2);
  });

  it("distinguishes bond order, formal charge, and net charge", () => {
    const single = carbonPair(1, 0);
    const double = carbonPair(2, 0);
    const charged = carbonPair(1, 1);
    expect(single.canonicalKey).not.toBe(double.canonicalKey);
    expect(single.canonicalKey).not.toBe(charged.canonicalKey);
    expect(single.netCharge).not.toBe(charged.netCharge);

    let registry = createDynamicSpeciesRegistry({ elements });
    const ids = new Set<string>();
    for (const molecule of [single, double, charged]) {
      const resolved = registry.resolveOrRegister({ molecule });
      expect(resolved.status).toBe("GENERATED");
      if (resolved.status === "INVALID") throw new Error(resolved.reason);
      ids.add(resolved.speciesId);
      registry = resolved.registry;
    }
    expect(ids.size).toBe(3);
  });

  it.each([10, 100, 1000])("suppresses duplicate registry growth across %i repeated resolutions", (attempts) => {
    const molecule = water();
    let registry = createDynamicSpeciesRegistry({ elements });
    let expectedId: string | undefined;
    for (let i = 0; i < attempts; i += 1) {
      const resolved = registry.resolveOrRegister({ molecule });
      expect(resolved.status).toBe("GENERATED");
      if (resolved.status === "INVALID") throw new Error(resolved.reason);
      expectedId ??= resolved.speciesId;
      expect(resolved.speciesId).toBe(expectedId);
      registry = resolved.registry;
    }
    expect(registry.size).toBe(1);
  });

  it("rejects malformed/adversarial graphs without growing the registry", () => {
    const malformed: MolecularGraph[] = [
      graph([["h", "H"]], [["b", "h", "missing", 1]]),
      graph([["h", "H"]], [["b", "h", "h", 1]]),
      graph([["h1", "H"], ["h2", "H"]], [["b1", "h1", "h2", 1], ["b2", "h1", "h2", 2]]),
      graph([["h1", "H"], ["h2", "H"]], [["b", "h1", "h2", 0]]),
      graph([["h1", "H"], ["h2", "H"]], [["b", "h1", "h2", Number.NaN]]),
      graph([["h", "H", 0.5]], []),
      graph([["c", "C"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"], ["h5", "H"]], [
        ["1", "c", "h1", 1], ["2", "c", "h2", 1], ["3", "c", "h3", 1], ["4", "c", "h4", 1], ["5", "c", "h5", 1],
      ]),
    ];
    const registry = createDynamicSpeciesRegistry({ elements });
    for (const fixture of malformed) {
      const result = registry.resolveOrRegister({ graph: fixture });
      expect(result.status).toBe("INVALID");
      expect(result.registry.size).toBe(0);
    }
    expect(registry.size).toBe(0);
  });

  it("reuses known species and keeps unknown identity structurally OPEN without fabricated properties", () => {
    const knownWater = water();
    const registry = createDynamicSpeciesRegistry({
      elements,
      knownSpecies: [{ speciesId: "known:H2O", molecule: knownWater }],
    });
    const known = registry.resolveOrRegister({ molecule: water() });
    expect(known.status).toBe("KNOWN");
    if (known.status === "INVALID") throw new Error(known.reason);
    expect(known.speciesId).toBe("known:H2O");

    const unknown = known.registry.resolveOrRegister({ molecule: carbonPair(1) });
    expect(unknown.status).toBe("GENERATED");
    if (unknown.status === "INVALID") throw new Error(unknown.reason);
    expect(unknown.speciesId).toBe(`generated:${unknown.record.canonicalKey}`);
    expect(unknown.record.referenceMatchStatus).toBe("OPEN");
    expect(unknown.record.scientificStatus).toBe("OPEN");
    expect(unknown.record.origin).toBe("GENERATED");
  });

  it("serialize -> restore preserves identity, order, deduplication and canonical resolution", () => {
    let registry = createDynamicSpeciesRegistry({ elements });
    for (const molecule of [etherLike(), ethanolLike(), water(), carbonPair(1), carbonPair(2)]) {
      const resolved = registry.resolveOrRegister({ molecule });
      expect(resolved.status).not.toBe("INVALID");
      if (resolved.status === "INVALID") throw new Error(resolved.reason);
      registry = resolved.registry;
    }
    const serialized = registry.serialize();
    const restored = restoreDynamicSpeciesRegistry(serialized, elements);
    expect(restored.serialize()).toEqual(serialized);
    expect(restored.size).toBe(registry.size);

    const before = registry.resolveOrRegister({ molecule: ethanolLike() });
    const after = restored.resolveOrRegister({ molecule: ethanolLike() });
    expect(before.status).not.toBe("INVALID");
    expect(after.status).not.toBe("INVALID");
    if (before.status === "INVALID" || after.status === "INVALID") throw new Error("unexpected invalid resolution");
    expect(after.speciesId).toBe(before.speciesId);
    expect(after.record.canonicalKey).toBe(before.record.canonicalKey);
    expect(after.registry.size).toBe(restored.size);
  });

  it("serialization is deterministic regardless of registration order", () => {
    const molecules = [etherLike(), ethanolLike(), water(), carbonPair(1), carbonPair(2)];
    const build = (items: readonly MoleculeRecord[]) => {
      let registry = createDynamicSpeciesRegistry({ elements });
      for (const molecule of items) {
        const resolved = registry.resolveOrRegister({ molecule });
        expect(resolved.status).not.toBe("INVALID");
        if (resolved.status === "INVALID") throw new Error(resolved.reason);
        registry = resolved.registry;
      }
      return registry.serialize();
    };
    expect(build(molecules)).toEqual(build([...molecules].reverse()));
  });

  it("failed product registration is atomic: no reactant consumption and no registry mutation", () => {
    const moleculeH2 = h2();
    const badProduct = {
      graph: {
        atoms: [{ id: "h", element: "H", formalCharge: 0 }],
        bonds: [{ id: "bad", a: "h", b: "missing", kind: "covalent" as const, order: 1 }],
      },
      formula: { H: 1 },
      netCharge: 0,
      canonicalKey: "malformed",
    } satisfies MoleculeRecord;
    const species: SpeciesState[] = [{ id: "known:H2", molecule: moleculeH2, amountMol: 1, phaseState: phase }];
    const registry = createDynamicSpeciesRegistry({ elements, knownSpecies: [{ speciesId: "known:H2", molecule: moleculeH2 }] });
    const beforeRegistry = registry.serialize();
    const beforeSpecies = structuredClone(species);
    const result = resolveReactionCandidatesWithRegistry({
      species,
      elements,
      candidates: [cleavageCandidate("bad", "known:H2", badProduct)],
      rankedEvaluations: [evaluation("bad")],
      registry,
      dtS: 1,
      timestepId: "atomic",
      startTimeS: 0,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    expect(result.resolution.selected).toHaveLength(0);
    expect(result.resolution.speciesAfter).toEqual(beforeSpecies);
    expect(result.registry.serialize()).toEqual(beforeRegistry);
    expect(result.resolution.deferred[0]?.reasonCodes).toContain("PRODUCT_REGISTRATION_FAILED");
  });

  it("conserves elements/atoms/charge and keeps finite non-negative amounts on generated-product success path", () => {
    const moleculeH2 = h2();
    const moleculeH = hAtom();
    const initial: SpeciesState[] = [{ id: "known:H2", molecule: moleculeH2, amountMol: 1, phaseState: phase }];
    const registry = createDynamicSpeciesRegistry({ elements, knownSpecies: [{ speciesId: "known:H2", molecule: moleculeH2 }] });
    const result = resolveReactionCandidatesWithRegistry({
      species: initial,
      elements,
      candidates: [cleavageCandidate("conserve", "known:H2", moleculeH)],
      rankedEvaluations: [evaluation("conserve")],
      registry,
      dtS: 1,
      timestepId: "conserve",
      startTimeS: 0,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    expect(totalElements(result.resolution.speciesAfter)).toEqual(totalElements(initial));
    expect(totalAtoms(result.resolution.speciesAfter)).toBeCloseTo(totalAtoms(initial), 12);
    expect(totalCharge(result.resolution.speciesAfter)).toBeCloseTo(totalCharge(initial), 12);
    for (const state of result.resolution.speciesAfter) {
      expect(Number.isFinite(state.amountMol)).toBe(true);
      expect(state.amountMol).toBeGreaterThanOrEqual(0);
    }
  });

  it("prohibits same-step hidden cascade and permits next-step generated-product participation", () => {
    const moleculeH2 = h2();
    const moleculeH = hAtom();
    const generatedId = `generated:${moleculeH.canonicalKey}`;
    const initial: SpeciesState[] = [{ id: "known:H2", molecule: moleculeH2, amountMol: 1, phaseState: phase }];
    const registry = createDynamicSpeciesRegistry({ elements, knownSpecies: [{ speciesId: "known:H2", molecule: moleculeH2 }] });

    const step1 = resolveReactionCandidatesWithRegistry({
      species: initial,
      elements,
      candidates: [
        cleavageCandidate("produce", "known:H2", moleculeH),
        associationCandidate("same-step-consume", generatedId, moleculeH2),
      ],
      rankedEvaluations: [evaluation("produce", 1), evaluation("same-step-consume", 2)],
      registry,
      dtS: 1,
      timestepId: "t1",
      startTimeS: 0,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    expect(step1.resolution.selected.map((entry) => entry.candidateId)).toEqual(["produce"]);
    expect(step1.resolution.deferred.find((entry) => entry.candidateId === "same-step-consume")?.reasonCodes)
      .toContain("ZERO_INITIAL_REACTANT");
    const generated = step1.resolution.speciesAfter.find((state) => state.id === generatedId);
    expect(generated?.amountMol).toBeGreaterThan(0);

    const step2 = resolveReactionCandidatesWithRegistry({
      species: step1.resolution.speciesAfter,
      elements,
      candidates: [associationCandidate("next-step-consume", generatedId, moleculeH2)],
      rankedEvaluations: [evaluation("next-step-consume")],
      registry: step1.registry,
      dtS: 1,
      timestepId: "t2",
      startTimeS: 1,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    expect(step2.resolution.selected.map((entry) => entry.candidateId)).toEqual(["next-step-consume"]);
  });

  it("is deterministic for identical registry/state/candidates/dt/config", () => {
    const moleculeH2 = h2();
    const moleculeH = hAtom();
    const species: SpeciesState[] = [{ id: "known:H2", molecule: moleculeH2, amountMol: 1, phaseState: phase }];
    const registry = createDynamicSpeciesRegistry({ elements, knownSpecies: [{ speciesId: "known:H2", molecule: moleculeH2 }] });
    const run = () => resolveReactionCandidatesWithRegistry({
      species,
      elements,
      candidates: [cleavageCandidate("det", "known:H2", moleculeH)],
      rankedEvaluations: [evaluation("det")],
      registry,
      dtS: 1,
      timestepId: "det",
      startTimeS: 0,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    const a = run();
    const b = run();
    expect(a.generatedSpeciesIds).toEqual(b.generatedSpeciesIds);
    expect(a.resolution.speciesAfter).toEqual(b.resolution.speciesAfter);
    expect(a.resolution.progressEvents).toEqual(b.resolution.progressEvents);
    expect(a.registry.serialize()).toEqual(b.registry.serialize());
  });

  it("records duplicate-resolution and lookup performance as baseline only, without inventing a PASS threshold", () => {
    const molecule = water();
    let registry = createDynamicSpeciesRegistry({ elements });
    const startResolve = performance.now();
    for (let i = 0; i < 1000; i += 1) {
      const resolved = registry.resolveOrRegister({ molecule });
      expect(resolved.status).not.toBe("INVALID");
      if (resolved.status === "INVALID") throw new Error(resolved.reason);
      registry = resolved.registry;
    }
    const resolveMs = performance.now() - startResolve;
    const key = molecule.canonicalKey;
    const startLookup = performance.now();
    for (let i = 0; i < 10000; i += 1) expect(registry.lookupByCanonicalKey(key)).toBeDefined();
    const lookupMs = performance.now() - startLookup;
    expect(registry.size).toBe(1);
    console.info(JSON.stringify({ validationMetric: "dynamic-species-registry", duplicateResolutions: 1000, resolveMs, lookups: 10000, lookupMs, verdict: "OPEN_PERFORMANCE_THRESHOLD" }));
  });
});
