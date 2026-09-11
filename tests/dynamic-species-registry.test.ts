import { describe, expect, it } from "vitest";
import {
  createMoleculeRecord,
  deriveNetCharge,
  type ElementDefinition,
  type ElementProvider,
  type MoleculeRecord,
  type SpeciesState,
} from "../src/simulation/molecular";
import type { ReactionCandidate } from "../src/simulation/reaction";
import type { RankedReactionEvaluation } from "../src/simulation/reaction-evaluation";
import {
  resolveReactionCandidatesWithRegistry,
  type RegistryReactionResolutionResult,
} from "../src/simulation/reaction-progression";
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
const elements: ElementProvider = {
  getElement(symbol) {
    return symbol === "H" ? H : symbol === "C" ? C : undefined;
  },
};

const phase = {
  phase: "gas" as const,
  source: "test",
  phaseStateId: "gas:test",
  scientificStatus: "APPROXIMATED" as const,
};

function hAtom(id = "h", charge = 0): MoleculeRecord {
  return createMoleculeRecord({ atoms: [{ id, element: "H", formalCharge: charge }], bonds: [] }, elements);
}

function h2(): MoleculeRecord {
  return createMoleculeRecord({
    atoms: [
      { id: "h1", element: "H", formalCharge: 0 },
      { id: "h2", element: "H", formalCharge: 0 },
    ],
    bonds: [{ id: "b", a: "h1", b: "h2", kind: "covalent", order: 1 }],
  }, elements);
}

function carbonPair(order: number, reversed = false): MoleculeRecord {
  const atoms = reversed
    ? [
        { id: "b", element: "C", formalCharge: 0 },
        { id: "a", element: "C", formalCharge: 0 },
      ]
    : [
        { id: "a", element: "C", formalCharge: 0 },
        { id: "b", element: "C", formalCharge: 0 },
      ];
  return createMoleculeRecord({
    atoms,
    bonds: [{ id: reversed ? "z" : "x", a: "a", b: "b", kind: "covalent", order }],
  }, elements);
}

function carbonPairDisconnected(): MoleculeRecord {
  return createMoleculeRecord({
    atoms: [
      { id: "a", element: "C", formalCharge: 0 },
      { id: "b", element: "C", formalCharge: 0 },
    ],
    bonds: [],
  }, elements);
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
      source: { sourceIds: ["test"] },
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
      products: [
        { productIndex: 0, coefficient: 1 },
        { productIndex: 1, coefficient: 1 },
      ],
    },
    structuralConfidence: 0.8,
    assumptions: ["synthetic registry fixture"],
    ruleId: "test:cleavage",
    conservation: {
      valid: true,
      delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 },
      reasons: [],
    },
    debug: { structuralKey: `fixture:${id}`, rulePriority: 1, siteKeys: [] },
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
    assumptions: ["synthetic registry fixture"],
    ruleId: "test:association",
    conservation: {
      valid: true,
      delta: { elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 },
      reasons: [],
    },
    debug: { structuralKey: `fixture:${id}`, rulePriority: 1, siteKeys: [] },
  };
}

function totalAtoms(species: readonly SpeciesState[]): number {
  return species.reduce((sum, state) => sum + state.molecule.graph.atoms.length * state.amountMol, 0);
}

function totalCharge(species: readonly SpeciesState[]): number {
  return species.reduce((sum, state) => sum + deriveNetCharge(state.molecule.graph) * state.amountMol, 0);
}

describe("canonical molecular identity", () => {
  it("is independent of atom array/runtime ids", () => {
    expect(carbonPair(1, false).canonicalKey).toBe(carbonPair(1, true).canonicalKey);
  });

  it("distinguishes connectivity, bond order, and formal charge", () => {
    expect(carbonPair(1).canonicalKey).not.toBe(carbonPairDisconnected().canonicalKey);
    expect(carbonPair(1).canonicalKey).not.toBe(carbonPair(2).canonicalKey);
    expect(hAtom("h", 0).canonicalKey).not.toBe(hAtom("h", 1).canonicalKey);
  });
});

describe("DynamicSpeciesRegistry", () => {
  it("reuses known species instead of creating a generated id", () => {
    const known = h2();
    const registry = createDynamicSpeciesRegistry({
      elements,
      knownSpecies: [{ speciesId: "known:H2", molecule: known }],
    });
    const result = registry.resolveOrRegister({ molecule: h2() });
    expect(result.status).toBe("KNOWN");
    if (result.status !== "INVALID") expect(result.speciesId).toBe("known:H2");
  });

  it("registers unknown valid structures deterministically and deduplicates them", () => {
    const registry = createDynamicSpeciesRegistry({ elements });
    const first = registry.resolveOrRegister({ molecule: carbonPair(1) });
    expect(first.status).toBe("GENERATED");
    if (first.status === "INVALID") return;
    expect(first.record.scientificStatus).toBe("OPEN");
    expect(first.record.referenceMatchStatus).toBe("OPEN");
    const second = first.registry.resolveOrRegister({ molecule: carbonPair(1, true) });
    expect(second.status).toBe("GENERATED");
    if (second.status === "INVALID") return;
    expect(second.speciesId).toBe(first.speciesId);
    expect(second.registry.size).toBe(1);
  });

  it("assigns different ids to different valid structures", () => {
    const registry = createDynamicSpeciesRegistry({ elements });
    const a = registry.resolveOrRegister({ molecule: carbonPair(1) });
    expect(a.status).not.toBe("INVALID");
    if (a.status === "INVALID") return;
    const b = a.registry.resolveOrRegister({ molecule: carbonPair(2) });
    expect(b.status).not.toBe("INVALID");
    if (b.status === "INVALID") return;
    expect(a.speciesId).not.toBe(b.speciesId);
  });

  it("rejects malformed graphs before registration", () => {
    const registry = createDynamicSpeciesRegistry({ elements });
    const result = registry.resolveOrRegister({
      graph: {
        atoms: [{ id: "a", element: "H", formalCharge: 0 }],
        bonds: [{ id: "bad", a: "a", b: "missing", kind: "covalent", order: 1 }],
      },
    });
    expect(result.status).toBe("INVALID");
    expect(registry.size).toBe(0);
  });

  it("serializes and restores stable generated identity", () => {
    const registry = createDynamicSpeciesRegistry({ elements });
    const generated = registry.resolveOrRegister({ molecule: carbonPair(1) });
    expect(generated.status).toBe("GENERATED");
    if (generated.status === "INVALID") return;
    const restored = restoreDynamicSpeciesRegistry(generated.registry.serialize(), elements);
    const lookup = restored.resolveOrRegister({ molecule: carbonPair(1, true) });
    expect(lookup.status).toBe("GENERATED");
    if (lookup.status === "INVALID") return;
    expect(lookup.speciesId).toBe(generated.speciesId);
    expect(lookup.registry.serialize()).toEqual(generated.registry.serialize());
  });
});

describe("registry-backed reaction progression", () => {
  it("atomically creates a generated product, blocks same-step cascade, and allows next-step participation", () => {
    const moleculeH2 = h2();
    const moleculeH = hAtom();
    const initial: SpeciesState[] = [
      { id: "known:H2", molecule: moleculeH2, amountMol: 1, phaseState: phase },
    ];
    const registry = createDynamicSpeciesRegistry({
      elements,
      knownSpecies: [{ speciesId: "known:H2", molecule: moleculeH2 }],
    });
    const step1Cleavage = cleavageCandidate("step1-cleave", "known:H2", moleculeH);
    const generatedId = `generated:${moleculeH.canonicalKey}`;
    const sameStepBackReaction = associationCandidate("same-step-back", generatedId, moleculeH2);

    const step1 = resolveReactionCandidatesWithRegistry({
      species: initial,
      elements,
      candidates: [step1Cleavage, sameStepBackReaction],
      rankedEvaluations: [evaluation("step1-cleave", 1), evaluation("same-step-back", 2)],
      registry,
      dtS: 1,
      timestepId: "t1",
      startTimeS: 0,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });

    expect(step1.resolution.selected.map((entry) => entry.candidateId)).toEqual(["step1-cleave"]);
    expect(step1.resolution.deferred.find((entry) => entry.candidateId === "same-step-back")?.reasonCodes)
      .toContain("ZERO_INITIAL_REACTANT");
    const generatedState = step1.resolution.speciesAfter.find((state) => state.id === generatedId);
    expect(generatedState).toBeDefined();
    expect(generatedState!.amountMol).toBeGreaterThan(0);
    expect(step1.registry.lookupBySpeciesId(generatedId)?.origin).toBe("GENERATED");
    expect(step1.resolution.progressEvents[0]!.productDeltasMol[generatedId]).toBeGreaterThan(0);
    expect(totalAtoms(step1.resolution.speciesAfter)).toBeCloseTo(totalAtoms(initial), 12);
    expect(totalCharge(step1.resolution.speciesAfter)).toBeCloseTo(totalCharge(initial), 12);

    const nextStepBack = associationCandidate("next-step-back", generatedId, moleculeH2);
    const step2 = resolveReactionCandidatesWithRegistry({
      species: step1.resolution.speciesAfter,
      elements,
      candidates: [nextStepBack],
      rankedEvaluations: [evaluation("next-step-back", 1)],
      registry: step1.registry,
      dtS: 1,
      timestepId: "t2",
      startTimeS: 1,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    expect(step2.resolution.selected.map((entry) => entry.candidateId)).toEqual(["next-step-back"]);
    expect(step2.resolution.speciesAfter.find((state) => state.id === generatedId)!.amountMol)
      .toBeLessThan(generatedState!.amountMol);
    expect(step2.registry.lookupBySpeciesId(generatedId)?.speciesId).toBe(generatedId);
  });

  it("reuses an existing known product vessel state", () => {
    const moleculeH2 = h2();
    const moleculeH = hAtom();
    const generatedId = "known:H";
    const species: SpeciesState[] = [
      { id: generatedId, molecule: moleculeH, amountMol: 2, phaseState: phase },
      { id: "known:H2", molecule: moleculeH2, amountMol: 0, phaseState: phase },
    ];
    const registry = createDynamicSpeciesRegistry({
      elements,
      knownSpecies: species.map((state) => ({ speciesId: state.id, molecule: state.molecule })),
    });
    const result = resolveReactionCandidatesWithRegistry({
      species,
      elements,
      candidates: [associationCandidate("known-product", generatedId, moleculeH2)],
      rankedEvaluations: [evaluation("known-product")],
      registry,
      dtS: 1,
      timestepId: "known",
      startTimeS: 0,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    expect(result.resolution.speciesAfter.find((state) => state.id === "known:H2")!.amountMol).toBeGreaterThan(0);
    expect(result.registry.lookupByCanonicalKey(moleculeH2.canonicalKey)?.speciesId).toBe("known:H2");
  });

  it("keeps vessel and authoritative registry unchanged when product registration fails", () => {
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
    const registry = createDynamicSpeciesRegistry({
      elements,
      knownSpecies: [{ speciesId: "known:H2", molecule: moleculeH2 }],
    });
    const malformed = cleavageCandidate("malformed-product", "known:H2", badProduct);
    const result = resolveReactionCandidatesWithRegistry({
      species,
      elements,
      candidates: [malformed],
      rankedEvaluations: [evaluation("malformed-product")],
      registry,
      dtS: 1,
      timestepId: "bad",
      startTimeS: 0,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    expect(result.resolution.selected).toHaveLength(0);
    expect(result.resolution.deferred[0]!.reasonCodes).toContain("PRODUCT_REGISTRATION_FAILED");
    expect(result.resolution.speciesAfter).toEqual(species);
    expect(result.registry.serialize()).toEqual(registry.serialize());
  });

  it("is deterministic for identical state and registry snapshots", () => {
    const moleculeH2 = h2();
    const moleculeH = hAtom();
    const species: SpeciesState[] = [{ id: "known:H2", molecule: moleculeH2, amountMol: 1, phaseState: phase }];
    const registry = createDynamicSpeciesRegistry({ elements, knownSpecies: [{ speciesId: "known:H2", molecule: moleculeH2 }] });
    const run = (): RegistryReactionResolutionResult => resolveReactionCandidatesWithRegistry({
      species,
      elements,
      candidates: [cleavageCandidate("det", "known:H2", moleculeH)],
      rankedEvaluations: [evaluation("det")],
      registry,
      dtS: 1,
      timestepId: "det-step",
      startTimeS: 0,
      temperatureK: 300,
      options: { maxFractionalConsumptionPerStep: 1, coarseRateTimescaleS: 0.01 },
    });
    const a = run();
    const b = run();
    expect(a.resolution.speciesAfter).toEqual(b.resolution.speciesAfter);
    expect(a.resolution.progressEvents).toEqual(b.resolution.progressEvents);
    expect(a.registry.serialize()).toEqual(b.registry.serialize());
  });
});
