import { describe, expect, it } from "vitest";
import {
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type MolecularGraph,
  type PhaseStateRef,
  type SpeciesState,
} from "../src/simulation/molecular";
import {
  addBond,
  detectReactiveSites,
  generateReactionCandidates,
  generateReactionCandidatesWithDiagnostics,
  removeBond,
  transferProton,
  validateCoarseValence,
} from "../src/simulation/reaction";

const elementList: readonly ElementDefinition[] = [
  { atomicNumber: 1, symbol: "H", atomicMolarMassKgPerMol: 0.001, valenceElectrons: 1, commonOxidationStates: [-1, 1], electronegativity: 2.2, typicalValences: [1] },
  { atomicNumber: 6, symbol: "C", atomicMolarMassKgPerMol: 0.012, valenceElectrons: 4, commonOxidationStates: [-4, 4], electronegativity: 2.55, typicalValences: [4] },
  { atomicNumber: 7, symbol: "N", atomicMolarMassKgPerMol: 0.014, valenceElectrons: 5, commonOxidationStates: [-3, 3, 5], electronegativity: 3.04, typicalValences: [3] },
  { atomicNumber: 8, symbol: "O", atomicMolarMassKgPerMol: 0.016, valenceElectrons: 6, commonOxidationStates: [-2], electronegativity: 3.44, typicalValences: [2] },
];
const map = new Map(elementList.map((element) => [element.symbol, element]));
const elements: ElementProvider = { getElement: (symbol) => map.get(symbol) };
const phase: PhaseStateRef = { phase: "gas", source: "test", phaseStateId: "p:test", scientificStatus: "OPEN" };

function graph(atoms: readonly [string, string, number?][], bonds: readonly [string, string, string, number][]): MolecularGraph {
  return {
    atoms: atoms.map(([id, element, formalCharge = 0]) => ({ id, element, formalCharge })),
    bonds: bonds.map(([id, a, b, order]) => ({ id, a, b, kind: "covalent" as const, order })),
  };
}
function species(id: string, g: MolecularGraph, amountMol = 1): SpeciesState {
  return { id, molecule: createMoleculeRecord(g, elements), amountMol, phaseState: phase };
}

const H2 = graph([["h1", "H"], ["h2", "H"]], [["b1", "h1", "h2", 1]]);
const O2 = graph([["o1", "O"], ["o2", "O"]], [["b1", "o1", "o2", 2]]);
const N2 = graph([["n1", "N"], ["n2", "N"]], [["b1", "n1", "n2", 3]]);
const H2O = graph([["o", "O"], ["h1", "H"], ["h2", "H"]], [["b1", "o", "h1", 1], ["b2", "o", "h2", 1]]);
const CO = graph([["c", "C"], ["o", "O"]], [["b1", "c", "o", 3]]);
const CO2 = graph([["c", "C"], ["o1", "O"], ["o2", "O"]], [["b1", "c", "o1", 2], ["b2", "c", "o2", 2]]);
const CH4 = graph([["c", "C"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"]], [["b1", "c", "h1", 1], ["b2", "c", "h2", 1], ["b3", "c", "h3", 1], ["b4", "c", "h4", 1]]);
const NH3 = graph([["n", "N"], ["h1", "H"], ["h2", "H"], ["h3", "H"]], [["b1", "n", "h1", 1], ["b2", "n", "h2", 1], ["b3", "n", "h3", 1]]);
const fixtures = { H2, O2, N2, H2O, CO, CO2, CH4, NH3 };

describe("Phase 2A reactive site detection", () => {
  for (const [name, g] of Object.entries(fixtures)) {
    it(`is deterministic for ${name}`, () => {
      const s = species(name, g);
      expect(detectReactiveSites(s, elements)).toEqual(detectReactiveSites(s, elements));
      expect(validateCoarseValence(s, elements)).toEqual([]);
    });
  }
  it("detects formal charge and proton sites", () => {
    const hydroxide = species("oh-", graph([["o", "O", -1], ["h", "H"]], [["b", "o", "h", 1]]));
    const kinds = detectReactiveSites(hydroxide, elements).map((site) => site.kind);
    expect(kinds).toContain("FORMAL_NEGATIVE");
    expect(kinds).toContain("PROTON_DONOR");
    expect(kinds).toContain("PROTON_ACCEPTOR");
  });
});

describe("immutable graph transformations", () => {
  it("adds and removes bonds without mutating input", () => {
    const fragments = graph([["h1", "H"], ["h2", "H"]], []);
    const joined = addBond(fragments, "h1", "h2", 1);
    expect(fragments.bonds).toHaveLength(0);
    expect(joined.bonds).toHaveLength(1);
    const split = removeBond(joined, "h1", "h2");
    expect(joined.bonds).toHaveLength(1);
    expect(split.bonds).toHaveLength(0);
  });
  it("supports a generic proton-transfer primitive", () => {
    const water = species("water", H2O);
    const ammonia = species("ammonia", NH3);
    const transformed = transferProton(water, "o", "h1", ammonia, "n");
    expect(transformed.graph.atoms).toHaveLength(7);
    expect(water.molecule.netCharge).toBe(0);
    expect(ammonia.molecule.netCharge).toBe(0);
  });
});

describe("generic candidate generation", () => {
  it("produces deterministic candidate IDs/order and conserves atoms/charge", () => {
    const input = { species: [species("water", H2O), species("ammonia", NH3)], elements };
    const first = generateReactionCandidates(input);
    const second = generateReactionCandidates(input);
    expect(first.map((candidate) => candidate.id)).toEqual(second.map((candidate) => candidate.id));
    expect(first.length).toBeGreaterThan(0);
    for (const candidate of first) {
      expect(candidate.conservation.valid).toBe(true);
      expect(candidate.conservation.delta.atomCountDelta).toBe(0);
      expect(candidate.conservation.delta.netChargeDelta).toBe(0);
      expect(Object.values(candidate.conservation.delta.elementDelta).every((delta) => delta === 0)).toBe(true);
    }
    expect(first.some((candidate) => candidate.family === "PROTON_TRANSFER")).toBe(true);
  });

  it("deduplicates structural candidates and removes no-ops", () => {
    const result = generateReactionCandidatesWithDiagnostics({ species: [species("water", H2O), species("ammonia", NH3)], elements });
    const keys = result.candidates.map((candidate) => candidate.debug.structuralKey);
    expect(new Set(keys).size).toBe(keys.length);
    const moleculeBySpeciesId = new Map([
      ["water", createMoleculeRecord(H2O, elements)],
      ["ammonia", createMoleculeRecord(NH3, elements)],
    ]);
    expect(result.candidates.every((candidate) => {
      const products = candidate.productGraphs.map((p) => p.canonicalKey).sort().join("+");
      const reactants = candidate.reactantRefs.map((ref) => moleculeBySpeciesId.get(ref.speciesId)!.canonicalKey).sort().join("+");
      return products !== reactants;
    })).toBe(true);
  });

  it("enforces total and per-family candidate caps", () => {
    const charged = [
      species("o-1", graph([["o", "O", -1]], [])),
      species("o-2", graph([["o", "O", -1]], [])),
      species("h+1", graph([["h", "H", 1]], [])),
      species("h+2", graph([["h", "H", 1]], [])),
    ];
    const result = generateReactionCandidatesWithDiagnostics({ species: charged, elements, options: { maxCandidatesPerFamily: 1, maxTotalCandidates: 2, maxSitesPerSpecies: 8 } });
    expect(result.candidates.length).toBeLessThanOrEqual(2);
    const counts = new Map<string, number>();
    for (const candidate of result.candidates) counts.set(candidate.family, (counts.get(candidate.family) ?? 0) + 1);
    expect([...counts.values()].every((count) => count <= 1)).toBe(true);
  });

  it("rejects invalid input graphs before candidate generation", () => {
    const valid = species("valid", H2);
    const invalid: SpeciesState = { ...valid, molecule: { ...valid.molecule, graph: { atoms: valid.molecule.graph.atoms, bonds: [{ id: "bad", a: "h1", b: "missing", kind: "covalent", order: 1 }] } } };
    expect(() => generateReactionCandidates({ species: [invalid], elements })).toThrow(/Invalid SpeciesState/);
  });

  it("does not explode on the basic MVP set", () => {
    const states = Object.entries(fixtures).map(([name, g]) => species(name, g));
    const result = generateReactionCandidatesWithDiagnostics({ species: states, elements, options: { maxTotalCandidates: 32, maxCandidatesPerFamily: 8, maxSitesPerSpecies: 12 } });
    expect(result.candidates.length).toBeLessThanOrEqual(32);
    expect(result.candidates.every((candidate) => candidate.conservation.valid)).toBe(true);
  });
});
