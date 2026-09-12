import { describe, expect, it } from "vitest";
import {
  aggregateSystemMatterInventory,
  createMatterCompartment,
  createPrimaryVesselContentsCompartment,
  transferMatter,
  transferMatterBatch,
  type MatterSystemState,
  type MatterTransferRequest,
} from "../src/simulation/compartment";
import {
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type SpeciesState,
} from "../src/simulation/molecular";
import { createDynamicSpeciesRegistry } from "../src/simulation/species-registry";

const H: ElementDefinition = {
  atomicNumber: 1,
  symbol: "H",
  atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1,
  commonOxidationStates: [-1, 1],
  electronegativity: 2.2,
  typicalValences: [1],
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
const elements: ElementProvider = {
  getElement(symbol) {
    return symbol === "H" ? H : symbol === "O" ? O : undefined;
  },
};
const phase = {
  phase: "gas" as const,
  source: "phase4a1-test",
  phaseStateId: "gas:test",
  scientificStatus: "APPROXIMATED" as const,
};
const h2 = createMoleculeRecord({
  atoms: [
    { id: "h1", element: "H", formalCharge: 0 },
    { id: "h2", element: "H", formalCharge: 0 },
  ],
  bonds: [{ id: "hh", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);
const o2 = createMoleculeRecord({
  atoms: [
    { id: "o1", element: "O", formalCharge: 0 },
    { id: "o2", element: "O", formalCharge: 0 },
  ],
  bonds: [{ id: "oo", a: "o1", b: "o2", kind: "covalent", order: 2 }],
}, elements);
const hPlus = createMoleculeRecord({ atoms: [{ id: "h", element: "H", formalCharge: 1 }], bonds: [] }, elements);

function species(id: string, amountMol: number, molecule = h2): SpeciesState {
  return { id, amountMol, molecule, phaseState: phase };
}

function system(aSpecies: SpeciesState[], bSpecies: SpeciesState[] = []): MatterSystemState {
  return {
    compartments: [
      createMatterCompartment({ id: "A", kind: "VESSEL_CONTENTS", species: aSpecies }),
      createMatterCompartment({ id: "B", kind: "VESSEL_HEADSPACE", species: bSpecies }),
    ],
    connections: [{
      id: "A-to-B",
      sourceCompartmentId: "A",
      destinationCompartmentId: "B",
      kind: "GAS",
      enabled: true,
    }],
  };
}

function amount(state: MatterSystemState, compartmentId: string, speciesId: string): number {
  return state.compartments.find((entry) => entry.id === compartmentId)?.species
    .find((entry) => entry.id === speciesId)?.amountMol ?? 0;
}

function transfer(entries: MatterTransferRequest["species"]): MatterTransferRequest {
  return {
    sourceCompartmentId: "A",
    destinationCompartmentId: "B",
    connectionId: "A-to-B",
    species: entries,
  };
}

describe("Phase 4A-1 compartment foundation", () => {
  it("creates deterministic empty and populated compartment state", () => {
    const empty = createMatterCompartment({ id: "empty", kind: "LAB_ATMOSPHERE" });
    expect(empty.species).toEqual([]);
    const first = createPrimaryVesselContentsCompartment({ id: "contents", species: [species("O2", 0.2, o2), species("H2", 1)] });
    const second = createPrimaryVesselContentsCompartment({ id: "contents", species: [species("O2", 0.2, o2), species("H2", 1)] });
    expect(first).toEqual(second);
    expect(first.species.map((entry) => entry.id)).toEqual(["H2", "O2"]);
  });

  it("moves a single species without changing system inventory", () => {
    const before = system([species("H2", 1)]);
    const inventory = aggregateSystemMatterInventory(before);
    const result = transferMatter(before, transfer([{ speciesId: "H2", amountMol: 0.2 }]));
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(amount(result.state, "A", "H2")).toBeCloseTo(0.8);
    expect(amount(result.state, "B", "H2")).toBeCloseTo(0.2);
    expect(aggregateSystemMatterInventory(result.state)).toEqual(inventory);
  });

  it("moves multiple species atomically", () => {
    const before = system([species("H2", 1), species("O2", 0.5, o2)]);
    const result = transferMatter(before, transfer([
      { speciesId: "H2", amountMol: 0.2 },
      { speciesId: "O2", amountMol: 0.3 },
    ]));
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(amount(result.state, "A", "H2")).toBeCloseTo(0.8);
    expect(amount(result.state, "A", "O2")).toBeCloseTo(0.2);
    expect(amount(result.state, "B", "H2")).toBeCloseTo(0.2);
    expect(amount(result.state, "B", "O2")).toBeCloseTo(0.3);
  });

  it("rejects the whole multi-species request when one source amount is insufficient", () => {
    const before = system([species("H2", 1), species("O2", 0.5, o2)]);
    const result = transferMatter(before, transfer([
      { speciesId: "H2", amountMol: 0.8 },
      { speciesId: "O2", amountMol: 0.8 },
    ]));
    expect(result.status).toBe("REJECTED");
    expect(result.state).toBe(before);
    if (result.status === "REJECTED") expect(result.reasonCode).toBe("INSUFFICIENT_AMOUNT");
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("rejects invalid transfer amount %s", (value) => {
    const before = system([species("H2", 1)]);
    const result = transferMatter(before, transfer([{ speciesId: "H2", amountMol: value }]));
    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED") expect(result.reasonCode).toBe("INVALID_AMOUNT");
    expect(result.state).toBe(before);
  });

  it("preserves species, element, atom, and net-charge inventory", () => {
    const before = system([species("H2", 1), species("H+", 0.25, hPlus)]);
    const inventory = aggregateSystemMatterInventory(before);
    const result = transferMatter(before, transfer([
      { speciesId: "H2", amountMol: 0.4 },
      { speciesId: "H+", amountMol: 0.1 },
    ]));
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(aggregateSystemMatterInventory(result.state)).toEqual(inventory);
    expect(inventory.netChargeAmountMol).toBe(0.25);
    expect(inventory.elementsMol.H).toBe(2.25);
  });

  it("transfers an actual Dynamic Species Registry generated SpeciesId", () => {
    const waterLike = createMoleculeRecord({
      atoms: [
        { id: "o", element: "O", formalCharge: 0 },
        { id: "h1", element: "H", formalCharge: 0 },
        { id: "h2", element: "H", formalCharge: 0 },
      ],
      bonds: [
        { id: "oh1", a: "o", b: "h1", kind: "covalent", order: 1 },
        { id: "oh2", a: "o", b: "h2", kind: "covalent", order: 1 },
      ],
    }, elements);
    const registry = createDynamicSpeciesRegistry({ elements });
    const resolution = registry.resolveOrRegister({ molecule: waterLike });
    expect(resolution.status).toBe("GENERATED");
    if (resolution.status === "INVALID") return;
    const generated = species(resolution.speciesId, 0.4, resolution.record.molecule);
    const result = transferMatter(system([generated]), transfer([{ speciesId: generated.id, amountMol: 0.1 }]));
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(amount(result.state, "B", generated.id)).toBeCloseTo(0.1);
  });

  it("is deterministic for identical input", () => {
    const before = system([species("H2", 1), species("O2", 0.5, o2)]);
    const request = transfer([{ speciesId: "H2", amountMol: 0.2 }, { speciesId: "O2", amountMol: 0.1 }]);
    expect(transferMatter(before, request)).toEqual(transferMatter(before, request));
  });

  it("is invariant to species entry ordering", () => {
    const before = system([species("H2", 1), species("O2", 0.5, o2)]);
    const first = transferMatter(before, transfer([{ speciesId: "H2", amountMol: 0.2 }, { speciesId: "O2", amountMol: 0.1 }]));
    const second = transferMatter(before, transfer([{ speciesId: "O2", amountMol: 0.1 }, { speciesId: "H2", amountMol: 0.2 }]));
    expect(second).toEqual(first);
  });

  it("atomically rejects competing requests whose aggregate demand exceeds the snapshot", () => {
    const before: MatterSystemState = {
      compartments: [
        createMatterCompartment({ id: "A", kind: "VESSEL_CONTENTS", species: [species("H2", 1)] }),
        createMatterCompartment({ id: "B", kind: "GAS_COLLECTOR" }),
        createMatterCompartment({ id: "C", kind: "LAB_ATMOSPHERE" }),
      ],
    };
    const first: MatterTransferRequest = { sourceCompartmentId: "A", destinationCompartmentId: "B", species: [{ speciesId: "H2", amountMol: 0.6 }] };
    const second: MatterTransferRequest = { sourceCompartmentId: "A", destinationCompartmentId: "C", species: [{ speciesId: "H2", amountMol: 0.6 }] };
    const a = transferMatterBatch(before, [first, second]);
    const b = transferMatterBatch(before, [second, first]);
    expect(a).toEqual(b);
    expect(a.status).toBe("REJECTED");
    expect(a.state).toBe(before);
    if (a.status === "REJECTED") expect(a.reasonCode).toBe("INSUFFICIENT_AMOUNT");
  });

  it("validates an explicit connection without deriving flow physics", () => {
    const before = system([species("H2", 1)]);
    const disabled: MatterSystemState = {
      ...before,
      connections: [{ ...before.connections![0]!, enabled: false }],
    };
    const result = transferMatter(disabled, transfer([{ speciesId: "H2", amountMol: 0.1 }]));
    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED") expect(result.reasonCode).toBe("INVALID_CONNECTION");
  });

  it("aggregates species, elements, atoms, and charge identically across compartment and species ordering", () => {
    const a = createMatterCompartment({
      id: "A",
      kind: "VESSEL_CONTENTS",
      species: [species("H2", 1), species("H+", 1, hPlus)],
    });
    const b = createMatterCompartment({
      id: "B",
      kind: "VESSEL_HEADSPACE",
      species: [species("H+", 1e-16, hPlus), species("H2", 1e-16)],
    });
    const c = createMatterCompartment({
      id: "C",
      kind: "LAB_ATMOSPHERE",
      species: [species("H2", 1e-16), species("H+", 1e-16, hPlus)],
    });

    const canonical: MatterSystemState = { compartments: [a, b, c] };
    const reversed: MatterSystemState = {
      compartments: [
        { ...c, species: [...c.species].reverse() },
        { ...b, species: [...b.species].reverse() },
        { ...a, species: [...a.species].reverse() },
      ],
    };
    const shuffled: MatterSystemState = {
      compartments: [
        { ...b, species: [...b.species].reverse() },
        a,
        { ...c, species: [...c.species].reverse() },
      ],
    };

    const expected = aggregateSystemMatterInventory(canonical);
    expect(aggregateSystemMatterInventory(reversed)).toEqual(expected);
    expect(aggregateSystemMatterInventory(shuffled)).toEqual(expected);
    expect(expected.speciesAmountsMol.H2).toBe(1);
    expect(expected.speciesAmountsMol["H+"]).toBe(1);
  });

  it.each(["SOLID", "", "MALFORMED"])("rejects runtime-invalid connection kind %j atomically", (invalidKind) => {
    const before = system([species("H2", 1)]);
    const malformed = {
      ...before,
      connections: [{ ...before.connections![0]!, kind: invalidKind }],
    } as unknown as MatterSystemState;

    const result = transferMatter(malformed, transfer([{ speciesId: "H2", amountMol: 0.2 }]));
    expect(result.status).toBe("REJECTED");
    expect(result.state).toBe(malformed);
    expect(amount(result.state, "A", "H2")).toBe(1);
    expect(amount(result.state, "B", "H2")).toBe(0);
    if (result.status === "REJECTED") expect(result.reasonCode).toBe("INVALID_CONNECTION_KIND");
  });
});
