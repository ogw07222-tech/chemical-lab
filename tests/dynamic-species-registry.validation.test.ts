import { describe, expect, it } from "vitest";
import {
  canonicalStructuralRepresentation,
  createMoleculeRecord,
  validateGraph,
  type ElementDefinition,
  type ElementProvider,
  type MolecularGraph,
} from "../src/simulation/molecular";
import {
  validateCanonicalIdentity,
  validateDistinctIdentity,
  validateDuplicateSuppression,
  validateFailedRegistrationAtomicity,
  validateGeneratedProductConservation,
  validateKnownSpeciesReuse,
  validateRegistryDeterminism,
  validateRegistryPerformance,
  validateRegistryPersistence,
  validateTimestepSemantics,
  validateUnknownSpeciesHandling,
  type RegistryResolutionObservation,
} from "../src/validation";

const elements: readonly ElementDefinition[] = [
  { atomicNumber: 1, symbol: "H", atomicMolarMassKgPerMol: 1, valenceElectrons: 1, commonOxidationStates: [-1, 1], typicalValences: [1] },
  { atomicNumber: 6, symbol: "C", atomicMolarMassKgPerMol: 1, valenceElectrons: 4, commonOxidationStates: [-4, 4], typicalValences: [4] },
  { atomicNumber: 8, symbol: "O", atomicMolarMassKgPerMol: 1, valenceElectrons: 6, commonOxidationStates: [-2], typicalValences: [2] },
];
const map = new Map(elements.map((entry) => [entry.symbol, entry]));
const provider: ElementProvider = { getElement: (symbol) => map.get(symbol) };

function graph(
  atoms: readonly [string, string, number?][],
  bonds: readonly [string, string, string, number][],
): MolecularGraph {
  return {
    atoms: atoms.map(([id, element, formalCharge = 0]) => ({ id, element, formalCharge })),
    bonds: bonds.map(([id, a, b, order]) => ({ id, a, b, order, kind: "covalent" as const })),
  };
}

const water = graph(
  [["o", "O"], ["h1", "H"], ["h2", "H"]],
  [["b1", "o", "h1", 1], ["b2", "o", "h2", 1]],
);

function permuteGraph(source: MolecularGraph, seed: number): MolecularGraph {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const atoms = [...source.atoms].sort(() => next() - 0.5);
  const idMap = new Map(atoms.map((atom, index) => [atom.id, `a${seed}-${index}`]));
  const bonds = [...source.bonds]
    .sort(() => next() - 0.5)
    .map((bond, index) => ({ ...bond, id: `b${seed}-${index}`, a: idMap.get(bond.a)!, b: idMap.get(bond.b)! }));
  return { atoms: atoms.map((atom) => ({ ...atom, id: idMap.get(atom.id)! })), bonds };
}

function resolution(speciesId: string, canonicalKey: string, overrides: Partial<RegistryResolutionObservation> = {}): RegistryResolutionObservation {
  return { speciesId, canonicalKey, created: false, knownSpecies: false, ...overrides };
}

describe("dynamic species registry preparation: canonical foundation", () => {
  it("is invariant to repeated atom/bond/id permutations", () => {
    const baseline = createMoleculeRecord(water, provider);
    for (let seed = 1; seed <= 100; seed += 1) {
      const permuted = createMoleculeRecord(permuteGraph(water, seed), provider);
      expect(permuted.canonicalKey).toBe(baseline.canonicalKey);
      expect(canonicalStructuralRepresentation(permuted.graph)).toBe(canonicalStructuralRepresentation(baseline.graph));
    }
  });

  it("does not collapse same-formula connectivity isomers", () => {
    const ethanolLike = graph(
      [["c1", "C"], ["c2", "C"], ["o", "O"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"], ["h5", "H"], ["h6", "H"]],
      [["cc", "c1", "c2", 1], ["co", "c2", "o", 1], ["1", "c1", "h1", 1], ["2", "c1", "h2", 1], ["3", "c1", "h3", 1], ["4", "c2", "h4", 1], ["5", "c2", "h5", 1], ["6", "o", "h6", 1]],
    );
    const etherLike = graph(
      [["c1", "C"], ["c2", "C"], ["o", "O"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"], ["h5", "H"], ["h6", "H"]],
      [["c1o", "c1", "o", 1], ["c2o", "c2", "o", 1], ["1", "c1", "h1", 1], ["2", "c1", "h2", 1], ["3", "c1", "h3", 1], ["4", "c2", "h4", 1], ["5", "c2", "h5", 1], ["6", "c2", "h6", 1]],
    );
    expect(createMoleculeRecord(ethanolLike, provider).formula).toEqual(createMoleculeRecord(etherLike, provider).formula);
    expect(createMoleculeRecord(ethanolLike, provider).canonicalKey).not.toBe(createMoleculeRecord(etherLike, provider).canonicalKey);
  });

  it("distinguishes bond order and formal/net charge", () => {
    const single = createMoleculeRecord(graph([["c", "C"], ["o", "O"]], [["b", "c", "o", 1]]), provider);
    const double = createMoleculeRecord(graph([["c", "C"], ["o", "O"]], [["b", "c", "o", 2]]), provider);
    const charged = createMoleculeRecord(graph([["c", "C", 1], ["o", "O"]], [["b", "c", "o", 1]]), provider);
    expect(single.canonicalKey).not.toBe(double.canonicalKey);
    expect(single.canonicalKey).not.toBe(charged.canonicalKey);
    expect(single.netCharge).not.toBe(charged.netCharge);
  });

  it("rejects malformed graph fixtures already covered by the main molecular contract", () => {
    const fixtures: MolecularGraph[] = [
      graph([["h", "H"]], [["b", "h", "missing", 1]]),
      graph([["h", "H"]], [["b", "h", "h", 1]]),
      graph([["h1", "H"], ["h2", "H"]], [["b1", "h1", "h2", 1], ["b2", "h1", "h2", 2]]),
      graph([["h1", "H"], ["h2", "H"]], [["b", "h1", "h2", 0]]),
      graph([["h1", "H"], ["h2", "H"]], [["b", "h1", "h2", Number.NaN]]),
      graph([["h", "H", 0.5]], []),
    ];
    for (const fixture of fixtures) expect(validateGraph(fixture, provider).valid).toBe(false);
  });
});

describe("dynamic species registry preparation: failure criteria harness", () => {
  it("requires same identity for equivalent resolutions", () => {
    const base = resolution("species:x", "mol:key");
    expect(validateCanonicalIdentity(base, [resolution("species:x", "mol:key"), resolution("species:x", "mol:key")]).verdict).toBe("PASS");
    expect(validateCanonicalIdentity(base, [resolution("species:y", "mol:key")]).verdict).toBe("FAIL");
  });

  it("treats false merge as FAIL and unresolved hash collision as OPEN", () => {
    expect(validateDistinctIdentity(resolution("a", "ka"), resolution("a", "kb")).verdict).toBe("FAIL");
    expect(validateDistinctIdentity(resolution("a", "same"), resolution("b", "same")).verdict).toBe("OPEN");
    expect(validateDistinctIdentity(
      resolution("a", "same", { exactStructureVerified: true }),
      resolution("b", "same", { exactStructureVerified: true }),
    ).verdict).toBe("PASS");
  });

  it.each([10, 100, 1000])("requires duplicate suppression across %i identical registrations", (attempts) => {
    expect(validateDuplicateSuppression({
      attempts,
      initialSize: 8,
      finalSize: 9,
      resolvedSpeciesIds: Array.from({ length: attempts }, () => "generated:1"),
      resolvedCanonicalKeys: Array.from({ length: attempts }, () => "mol:same"),
    }).verdict).toBe("PASS");
  });

  it("makes failed registration atomic and partial vessel mutation an absolute FAIL", () => {
    const clean = validateFailedRegistrationAtomicity({
      registrationFailed: true,
      beforeRegistry: { ids: ["a"] }, afterRegistry: { ids: ["a"] },
      beforeVessel: { a: 1 }, afterVessel: { a: 1 },
    });
    expect(clean.verdict).toBe("PASS");
    expect(validateFailedRegistrationAtomicity({
      registrationFailed: true,
      beforeRegistry: { ids: ["a"] }, afterRegistry: { ids: ["a"] },
      beforeVessel: { a: 1 }, afterVessel: { a: 0.5 },
    }).verdict).toBe("FAIL");
  });

  it("requires conservation and finite non-negative amounts", () => {
    expect(validateGeneratedProductConservation({ beforeElements: { H: 2 }, afterElements: { H: 2 }, beforeAtomCount: 2, afterAtomCount: 2, beforeCharge: 0, afterCharge: 0, amountsMol: [0, 1] }).verdict).toBe("PASS");
    expect(validateGeneratedProductConservation({ beforeElements: { H: 2 }, afterElements: { H: 1 }, beforeAtomCount: 2, afterAtomCount: 1, beforeCharge: 0, afterCharge: 0, amountsMol: [1] }).verdict).toBe("FAIL");
    expect(validateGeneratedProductConservation({ beforeElements: { H: 2 }, afterElements: { H: 2 }, beforeAtomCount: 2, afterAtomCount: 2, beforeCharge: 0, afterCharge: 0, amountsMol: [Number.NaN] }).verdict).toBe("FAIL");
  });

  it("requires next-step participation and prohibits same-step cascade", () => {
    expect(validateTimestepSemantics({ productSpeciesId: "x", existsAtEndOfStepN: true, availableToStepNPlus1CandidateGeneration: true, participatedInSameStepCascade: false }).verdict).toBe("PASS");
    expect(validateTimestepSemantics({ productSpeciesId: "x", existsAtEndOfStepN: true, availableToStepNPlus1CandidateGeneration: true, participatedInSameStepCascade: true }).verdict).toBe("FAIL");
  });

  it("requires deterministic replay and persistence identity stability", () => {
    const run = { generatedSpeciesIds: ["g1"], canonicalKeys: ["k1"], finalVesselAmountsMol: [0.5], reactionProgressEvents: [{ id: "e1" }], registrySerialization: { entries: ["g1"] } };
    expect(validateRegistryDeterminism(run, { ...run }).verdict).toBe("PASS");
    expect(validateRegistryPersistence({
      before: resolution("g1", "k1", { created: true }),
      afterRestore: resolution("g1", "k1", { created: false }),
      serializedBefore: { entries: ["g1"] }, serializedAfterRestore: { entries: ["g1"] },
      nextStepBehaviorBefore: ["candidate:x"], nextStepBehaviorAfter: ["candidate:x"],
    }).verdict).toBe("PASS");
  });

  it("requires known-species reuse and permits unknown internal identity without fabricated truth", () => {
    expect(validateKnownSpeciesReuse({ existingSpeciesId: "H2O", resolved: resolution("H2O", "water", { knownSpecies: true, created: false }) }).verdict).toBe("PASS");
    expect(validateKnownSpeciesReuse({ existingSpeciesId: "H2O", resolved: resolution("generated:1", "water", { created: true }) }).verdict).toBe("FAIL");
    expect(validateUnknownSpeciesHandling({ structurallyAccepted: true, generatedIdentityCreated: true, fabricatedRealWorldIdentity: false, fabricatedProperties: false }).verdict).toBe("PASS");
  });

  it("reports finite performance baseline as OPEN until an engineering budget is canonical", () => {
    const samples = [
      { registrySize: 10, lookupMs: 0.1, resolveRegisterMs: 0.3, timestepOverheadMs: 0.5 },
      { registrySize: 100, lookupMs: 0.2, resolveRegisterMs: 0.8, timestepOverheadMs: 1.2 },
      { registrySize: 1000, lookupMs: 0.5, resolveRegisterMs: 2.1, timestepOverheadMs: 3.5 },
    ];
    expect(validateRegistryPerformance(samples).verdict).toBe("OPEN");
    expect(validateRegistryPerformance(samples, { maxLookupMs: 1, maxResolveRegisterMs: 3, maxTimestepOverheadMs: 4 }).verdict).toBe("PASS");
  });
});
