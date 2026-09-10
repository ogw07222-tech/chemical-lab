import { describe, expect, it } from "vitest";
import {
  conservationDelta,
  conservationVectorFromMolecule,
  createMoleculeRecord,
  deriveFormula,
  deriveNetCharge,
  validateGraph,
  validateSpeciesState,
  type ElementDefinition,
  type ElementProvider,
  type MolecularGraph,
  type PhaseStateRef,
} from "../src/simulation/molecular";

const elements: readonly ElementDefinition[] = [
  { atomicNumber: 1, symbol: "H", atomicMolarMassKgPerMol: 1, valenceElectrons: 1, commonOxidationStates: [-1, 1], typicalValences: [1] },
  { atomicNumber: 6, symbol: "C", atomicMolarMassKgPerMol: 1, valenceElectrons: 4, commonOxidationStates: [-4, 4], typicalValences: [4] },
  { atomicNumber: 7, symbol: "N", atomicMolarMassKgPerMol: 1, valenceElectrons: 5, commonOxidationStates: [-3, 3, 5], typicalValences: [3] },
  { atomicNumber: 8, symbol: "O", atomicMolarMassKgPerMol: 1, valenceElectrons: 6, commonOxidationStates: [-2], typicalValences: [2] },
];

const elementMap = new Map(elements.map((element) => [element.symbol, element]));
const provider: ElementProvider = { getElement: (symbol) => elementMap.get(symbol) };
const phase: PhaseStateRef = {
  phase: "gas",
  source: "test-fixture",
  phaseStateId: "phase:test",
  scientificStatus: "OPEN",
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

const fixtures = {
  H2: graph([["h1", "H"], ["h2", "H"]], [["b1", "h1", "h2", 1]]),
  O2: graph([["o1", "O"], ["o2", "O"]], [["b1", "o1", "o2", 2]]),
  N2: graph([["n1", "N"], ["n2", "N"]], [["b1", "n1", "n2", 3]]),
  H2O: graph([["o", "O"], ["h1", "H"], ["h2", "H"]], [["b1", "o", "h1", 1], ["b2", "o", "h2", 1]]),
  CO: graph([["c", "C"], ["o", "O"]], [["b1", "c", "o", 3]]),
  CO2: graph([["c", "C"], ["o1", "O"], ["o2", "O"]], [["b1", "c", "o1", 2], ["b2", "c", "o2", 2]]),
  CH4: graph(
    [["c", "C"], ["h1", "H"], ["h2", "H"], ["h3", "H"], ["h4", "H"]],
    [["b1", "c", "h1", 1], ["b2", "c", "h2", 1], ["b3", "c", "h3", 1], ["b4", "c", "h4", 1]],
  ),
  NH3: graph(
    [["n", "N"], ["h1", "H"], ["h2", "H"], ["h3", "H"]],
    [["b1", "n", "h1", 1], ["b2", "n", "h2", 1], ["b3", "n", "h3", 1]],
  ),
};

describe("molecular graph fixtures", () => {
  for (const [name, fixture] of Object.entries(fixtures)) {
    it(`represents ${name}`, () => {
      expect(validateGraph(fixture, provider)).toMatchObject({ valid: true, issues: [] });
      expect(createMoleculeRecord(fixture, provider).canonicalKey).toMatch(/^mol-v1-/);
    });
  }

  it("derives formula deterministically", () => {
    expect(deriveFormula(fixtures.H2O)).toEqual({ H: 2, O: 1 });
    expect(deriveFormula(fixtures.CO2)).toEqual({ C: 1, O: 2 });
  });

  it("derives net formal charge", () => {
    expect(deriveNetCharge(fixtures.H2O)).toBe(0);
    expect(deriveNetCharge(graph([["n", "N", 1]], []))).toBe(1);
  });
});

describe("graph sanity", () => {
  it("rejects an invalid bond endpoint", () => {
    const result = validateGraph(graph([["h", "H"]], [["b", "h", "missing", 1]]), provider);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "INVALID_BOND_ENDPOINT")).toBe(true);
  });

  it("rejects duplicate atom ids", () => {
    const result = validateGraph(graph([["a", "H"], ["a", "H"]], []), provider);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "DUPLICATE_ATOM_ID")).toBe(true);
  });

  it("rejects self bonds", () => {
    const result = validateGraph(graph([["a", "H"]], [["b", "a", "a", 1]]), provider);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "SELF_BOND")).toBe(true);
  });
});

describe("deterministic structural identity foundation", () => {
  it("is independent of atom ids, atom ordering, bond ids, and bond ordering", () => {
    const original = createMoleculeRecord(fixtures.CH4, provider);
    const reversedAtoms = [...fixtures.CH4.atoms].reverse();
    const idMap = new Map(reversedAtoms.map((atom, index) => [atom.id, `runtime-${index}`]));
    const reordered: MolecularGraph = {
      atoms: reversedAtoms.map((atom, index) => ({ ...atom, id: `runtime-${index}` })),
      bonds: [...fixtures.CH4.bonds].reverse().map((bond, index) => ({
        ...bond,
        id: `edge-${index}`,
        a: idMap.get(bond.a)!,
        b: idMap.get(bond.b)!,
      })),
    };
    expect(createMoleculeRecord(reordered, provider).canonicalKey).toBe(original.canonicalKey);
  });
});

describe("finite species amount invariant", () => {
  const molecule = createMoleculeRecord(fixtures.H2, provider);

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid amount %s",
    (amountMol) => {
      expect(validateSpeciesState({ id: "species:h2", molecule, amountMol, phaseState: phase }, provider).valid).toBe(false);
    },
  );

  it("accepts finite non-negative mol amount", () => {
    expect(validateSpeciesState({ id: "species:h2", molecule, amountMol: 0.5, phaseState: phase }, provider).valid).toBe(true);
  });
});

describe("conservation primitives", () => {
  it("tracks element, atom, and charge deltas", () => {
    const h2 = createMoleculeRecord(fixtures.H2, provider);
    const unchanged = conservationDelta(
      conservationVectorFromMolecule(h2, 2),
      conservationVectorFromMolecule(h2, 2),
    );
    expect(unchanged).toEqual({ elementDelta: { H: 0 }, atomCountDelta: 0, netChargeDelta: 0 });
  });

  it("supports explicit electron bookkeeping extension", () => {
    const delta = conservationDelta(
      { elements: { H: 1 }, atomCount: 1, netCharge: 0, explicitElectronCount: 1 },
      { elements: { H: 1 }, atomCount: 1, netCharge: 0, explicitElectronCount: 0 },
    );
    expect(delta.explicitElectronDelta).toBe(-1);
  });
});
