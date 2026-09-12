import { describe, expect, it } from "vitest";
import {
  aggregateSystemMatterInventory,
  createMatterCompartment,
  transferMatter,
  transferMatterBatch,
  type MatterConnectionState,
  type MatterSystemState,
  type MatterTransferRequest,
} from "../../src/simulation/compartment";
import {
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type SpeciesState,
} from "../../src/simulation/molecular";

const H: ElementDefinition = {
  atomicNumber: 1, symbol: "H", atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1, commonOxidationStates: [-1, 1], electronegativity: 2.2, typicalValences: [1],
};
const O: ElementDefinition = {
  atomicNumber: 8, symbol: "O", atomicMolarMassKgPerMol: 0.016,
  valenceElectrons: 6, commonOxidationStates: [-2], electronegativity: 3.44, typicalValences: [2],
};
const elements: ElementProvider = {
  getElement(symbol) { return symbol === "H" ? H : symbol === "O" ? O : undefined; },
};
const phase = {
  phase: "gas" as const,
  source: "06a-independent-revalidation",
  phaseStateId: "gas:06a-revalidation",
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

function sp(id: string, amountMol: number, molecule = h2): SpeciesState {
  return { id, amountMol, molecule, phaseState: phase };
}
function c(id: string, species: SpeciesState[] = []) {
  return createMatterCompartment({ id, kind: "OTHER", species });
}
function amount(state: MatterSystemState, compartmentId: string, speciesId: string): number {
  return state.compartments.find((x) => x.id === compartmentId)?.species.find((x) => x.id === speciesId)?.amountMol ?? 0;
}

function assertInventoryExactlyEqual(a: MatterSystemState, b: MatterSystemState) {
  expect(aggregateSystemMatterInventory(a)).toEqual(aggregateSystemMatterInventory(b));
}

describe("06A Phase 4A-1 independent revalidation", () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects invalid transfer amount %s atomically",
    (value) => {
      const before: MatterSystemState = { compartments: [c("A", [sp("H2", 1)]), c("B")] };
      const result = transferMatter(before, {
        sourceCompartmentId: "A", destinationCompartmentId: "B",
        species: [{ speciesId: "H2", amountMol: value }],
      });
      expect(result.status).toBe("REJECTED");
      expect(result.state).toBe(before);
    },
  );

  it("reproduces old aggregation fixture and requires exact equality across canonical/reversed/shuffled compartment and species order", () => {
    const A = c("A", [sp("H2", 1), sp("O2", 1e-16, o2)]);
    const B = c("B", [sp("H2", 1e-16), sp("O2", 1, o2)]);
    const C = c("C", [sp("H2", 1e-16), sp("O2", 1e-16, o2)]);

    const ARev = c("A", [...A.species].reverse());
    const BRev = c("B", [...B.species].reverse());
    const CRev = c("C", [...C.species].reverse());

    const canonical: MatterSystemState = { compartments: [A, B, C] };
    const reversed: MatterSystemState = { compartments: [C, B, A] };
    const shuffled: MatterSystemState = { compartments: [B, A, C] };
    const speciesReversed: MatterSystemState = { compartments: [ARev, BRev, CRev] };

    const baseline = aggregateSystemMatterInventory(canonical);
    expect(aggregateSystemMatterInventory(reversed)).toEqual(baseline);
    expect(aggregateSystemMatterInventory(shuffled)).toEqual(baseline);
    expect(aggregateSystemMatterInventory(speciesReversed)).toEqual(baseline);
  });

  it.each(["SOLID", "", "MALFORMED"])("rejects malformed runtime connection kind %s atomically with explicit reason", (kind) => {
    const invalid = {
      id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind, enabled: true,
    } as unknown as MatterConnectionState;
    const before: MatterSystemState = { compartments: [c("A", [sp("H2", 1)]), c("B")], connections: [invalid] };
    const result = transferMatter(before, {
      sourceCompartmentId: "A", destinationCompartmentId: "B", connectionId: "A-B",
      species: [{ speciesId: "H2", amountMol: 0.1 }],
    });
    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED") expect(result.reasonCode).toBe("INVALID_CONNECTION_KIND");
    expect(result.state).toBe(before);
    expect(amount(before, "A", "H2")).toBe(1);
    expect(amount(before, "B", "H2")).toBe(0);
  });

  it.each(["GAS", "LIQUID"] as const)("still permits valid directed %s connection", (kind) => {
    const before: MatterSystemState = {
      compartments: [c("A", [sp("H2", 1)]), c("B")],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind, enabled: true }],
    };
    const result = transferMatter(before, {
      sourceCompartmentId: "A", destinationCompartmentId: "B", connectionId: "A-B",
      species: [{ speciesId: "H2", amountMol: 0.2 }],
    });
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(amount(result.state, "A", "H2")).toBe(0.8);
    expect(amount(result.state, "B", "H2")).toBe(0.2);
    assertInventoryExactlyEqual(before, result.state);
  });

  it("rejects reverse use of a directed connection", () => {
    const before: MatterSystemState = {
      compartments: [c("A", [sp("H2", 1)]), c("B", [sp("H2", 1)])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const result = transferMatter(before, {
      sourceCompartmentId: "B", destinationCompartmentId: "A", connectionId: "A-B",
      species: [{ speciesId: "H2", amountMol: 0.1 }],
    });
    expect(result.status).toBe("REJECTED");
    expect(result.state).toBe(before);
  });

  it("does not allow incoming matter to fund outgoing demand in the same batch", () => {
    const before: MatterSystemState = { compartments: [c("A", [sp("H2", 1)]), c("B"), c("C")] };
    const requests: MatterTransferRequest[] = [
      { sourceCompartmentId: "A", destinationCompartmentId: "B", species: [{ speciesId: "H2", amountMol: 1 }] },
      { sourceCompartmentId: "B", destinationCompartmentId: "C", species: [{ speciesId: "H2", amountMol: 1 }] },
    ];
    const result = transferMatterBatch(before, requests);
    expect(result.status).toBe("REJECTED");
    expect(result.state).toBe(before);
  });

  it("rejects one SpeciesId mapped to conflicting canonical identities", () => {
    const before: MatterSystemState = { compartments: [c("A", [sp("X", 1, h2)]), c("B", [sp("X", 1, o2)])] };
    const result = transferMatter(before, {
      sourceCompartmentId: "A", destinationCompartmentId: "B",
      species: [{ speciesId: "X", amountMol: 0.1 }],
    });
    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED") expect(result.reasonCode).toBe("SPECIES_IDENTITY_CONFLICT");
    expect(result.state).toBe(before);
  });

  it("competing source demand is rejected independent of request order", () => {
    const before: MatterSystemState = { compartments: [c("A", [sp("H2", 1)]), c("B"), c("C")] };
    const r1: MatterTransferRequest = { sourceCompartmentId: "A", destinationCompartmentId: "B", species: [{ speciesId: "H2", amountMol: 0.7 }] };
    const r2: MatterTransferRequest = { sourceCompartmentId: "A", destinationCompartmentId: "C", species: [{ speciesId: "H2", amountMol: 0.7 }] };
    const one = transferMatterBatch(before, [r1, r2]);
    const two = transferMatterBatch(before, [r2, r1]);
    expect(one).toEqual(two);
    expect(one.status).toBe("REJECTED");
    expect(one.state).toBe(before);
  });

  it("replays the same multi-species transaction deterministically and request-order invariant", () => {
    const before: MatterSystemState = { compartments: [c("A", [sp("H2", 1), sp("O2", 0.5, o2)]), c("B")] };
    const req: MatterTransferRequest = {
      sourceCompartmentId: "A", destinationCompartmentId: "B",
      species: [{ speciesId: "O2", amountMol: 0.1 }, { speciesId: "H2", amountMol: 0.2 }],
    };
    const baseline = transferMatter(before, req);
    for (let i = 0; i < 20; i += 1) expect(transferMatter(before, req)).toEqual(baseline);
    const reversedSpecies = transferMatter(before, { ...req, species: [...req.species].reverse() });
    expect(reversedSpecies).toEqual(baseline);
  });
});
