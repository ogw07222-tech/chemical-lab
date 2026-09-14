import { describe, expect, it } from "vitest";
import {
  aggregateSystemMatterInventory,
  createMatterCompartment,
  transferMatterBatch,
  type MatterSystemState,
} from "../src/simulation/compartment";
import {
  evaluateGasTransport,
  evaluateIdealGasCompartment,
  type GasConnectionTransportModel,
} from "../src/simulation/gas-transport";
import {
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type SpeciesState,
} from "../src/simulation/molecular";
import { createDynamicSpeciesRegistry } from "../src/simulation/species-registry";

const T = 300;
const V = 0.01;
const N: ElementDefinition = {
  atomicNumber: 7,
  symbol: "N",
  atomicMolarMassKgPerMol: 0.014,
  valenceElectrons: 5,
  commonOxidationStates: [-3, 3, 5],
  electronegativity: 3.04,
  typicalValences: [3],
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
const H: ElementDefinition = {
  atomicNumber: 1,
  symbol: "H",
  atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1,
  commonOxidationStates: [-1, 1],
  electronegativity: 2.2,
  typicalValences: [1],
};
const elements: ElementProvider = { getElement: (symbol) => ({ N, O, H } as Record<string, ElementDefinition>)[symbol] };
const n2 = createMoleculeRecord({
  atoms: [
    { id: "n1", element: "N", formalCharge: 0 },
    { id: "n2", element: "N", formalCharge: 0 },
  ],
  bonds: [{ id: "nn", a: "n1", b: "n2", kind: "covalent", order: 3 }],
}, elements);
const o2 = createMoleculeRecord({
  atoms: [
    { id: "o1", element: "O", formalCharge: 0 },
    { id: "o2", element: "O", formalCharge: 0 },
  ],
  bonds: [{ id: "oo", a: "o1", b: "o2", kind: "covalent", order: 2 }],
}, elements);
const phase = {
  phase: "gas" as const,
  source: "phase4a2-regression",
  phaseStateId: "gas:phase4a2-regression",
  scientificStatus: "APPROXIMATED" as const,
};

function gas(id: string, amountMol: number, molecule = n2): SpeciesState {
  return { id, amountMol, molecule, phaseState: phase };
}

function compartment(id: string, species: SpeciesState[]) {
  return createMatterCompartment({ id, kind: "VESSEL_HEADSPACE", volumeM3: V, species });
}

function model(connectionId: string, bulk = 0, diffusion = 0): GasConnectionTransportModel {
  return {
    connectionId,
    bulkMolarConductanceMolPerSPaS: bulk,
    diffusiveMolarConductanceMolPerSPaS: diffusion,
    scientificStatus: "APPROXIMATED",
    source: "phase4a2-regression",
  };
}

function thermo(ids: readonly string[]) {
  return ids.map((compartmentId) => ({ compartmentId, temperatureK: T }));
}

function commit(system: MatterSystemState, evaluation: ReturnType<typeof evaluateGasTransport>): MatterSystemState {
  const result = transferMatterBatch(system, evaluation.transferRequests);
  expect(result.status).toBe("COMMITTED");
  if (result.status !== "COMMITTED") throw new Error("Expected COMMITTED transfer batch.");
  return result.state;
}

function pressure(system: MatterSystemState, id: string): number {
  const c = system.compartments.find((entry) => entry.id === id)!;
  return evaluateIdealGasCompartment(c, { compartmentId: id, temperatureK: T }).pressurePa ?? 0;
}

function partial(system: MatterSystemState, id: string, speciesId: string): number {
  const c = system.compartments.find((entry) => entry.id === id)!;
  return evaluateIdealGasCompartment(c, { compartmentId: id, temperatureK: T }).partialPressuresPa[speciesId] ?? 0;
}

function twoCompartmentSystem(aSpecies: SpeciesState[], bSpecies: SpeciesState[]): MatterSystemState {
  return {
    compartments: [compartment("A", aSpecies), compartment("B", bSpecies)],
    connections: [{
      id: "A-B",
      sourceCompartmentId: "A",
      destinationCompartmentId: "B",
      kind: "GAS",
      enabled: true,
    }],
  };
}

function inventorySnapshot(system: MatterSystemState) {
  return aggregateSystemMatterInventory(system);
}

function expectInventoryEqual(a: ReturnType<typeof inventorySnapshot>, b: ReturnType<typeof inventorySnapshot>) {
  expect(a.speciesAmountsMol).toEqual(b.speciesAmountsMol);
  expect(a.elementsMol).toEqual(b.elementsMol);
  expect(a.atomAmountMol).toBeCloseTo(b.atomAmountMol, 12);
  expect(a.netChargeAmountMol).toBeCloseTo(b.netChargeAmountMol, 12);
}

describe("Phase 4A-2 06B defect regressions", () => {
  it("diagnostics final bulk amount equals the final request bulk amount", () => {
    const connections = ["B", "C", "D"].map((destination) => ({
      id: `A-${destination}`,
      sourceCompartmentId: "A",
      destinationCompartmentId: destination,
      kind: "GAS" as const,
      enabled: true,
    }));
    const system: MatterSystemState = {
      compartments: [compartment("A", [gas("N2", 1)]), compartment("B", []), compartment("C", []), compartment("D", [])],
      connections,
    };
    const evaluation = evaluateGasTransport({
      system,
      thermodynamicInputs: thermo(["A", "B", "C", "D"]),
      connectionModels: connections.map((entry) => model(entry.id, 1, 0)),
      dtS: 1e9,
    });
    for (const diagnostic of evaluation.diagnostics) {
      const finalAmount = evaluation.bulkTransfers
        .find((request) => request.connectionId === diagnostic.connectionId)
        ?.species.reduce((sum, entry) => sum + entry.amountMol, 0) ?? 0;
      expect(diagnostic.boundedBulkAmountMol ?? 0).toBe(finalAmount);
    }
  });

  it("normalizes a three-way outgoing demand from one immutable source snapshot", () => {
    const connections = ["B", "C", "D"].map((destination) => ({
      id: `A-${destination}`,
      sourceCompartmentId: "A",
      destinationCompartmentId: destination,
      kind: "GAS" as const,
      enabled: true,
    }));
    const system: MatterSystemState = {
      compartments: [compartment("A", [gas("N2", 1)]), compartment("B", []), compartment("C", []), compartment("D", [])],
      connections,
    };
    const evaluation = evaluateGasTransport({
      system,
      thermodynamicInputs: thermo(["A", "B", "C", "D"]),
      connectionModels: connections.map((entry) => model(entry.id, 1, 0)),
      dtS: 1e9,
    });
    const amounts = evaluation.transferRequests.map((request) => request.species[0]!.amountMol);
    expect(amounts).toEqual([0.25, 0.25, 0.25]);
    expect(amounts.reduce((sum, amount) => sum + amount, 0)).toBeLessThanOrEqual(1);
  });

  it("is exactly invariant to connection and model order permutations", () => {
    const connections = ["B", "C", "D"].map((destination) => ({
      id: `A-${destination}`,
      sourceCompartmentId: "A",
      destinationCompartmentId: destination,
      kind: "GAS" as const,
      enabled: true,
    }));
    const compartments = [compartment("A", [gas("N2", 1)]), compartment("B", []), compartment("C", []), compartment("D", [])];
    const models = connections.map((entry) => model(entry.id, 1, 1));
    const a = evaluateGasTransport({ system: { compartments, connections }, thermodynamicInputs: thermo(["A", "B", "C", "D"]), connectionModels: models, dtS: 1e9 });
    const b = evaluateGasTransport({ system: { compartments: [...compartments].reverse(), connections: [...connections].reverse() }, thermodynamicInputs: thermo(["D", "C", "B", "A"]), connectionModels: [...models].reverse(), dtS: 1e9 });
    expect(b).toEqual(a);
  });

  it("is invariant to source species ordering", () => {
    const base = twoCompartmentSystem([gas("N2", 0.7), gas("O2", 0.3, o2)], []);
    const reversed = twoCompartmentSystem([gas("O2", 0.3, o2), gas("N2", 0.7)], []);
    const input = { thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model("A-B", 1, 1)], dtS: 1e9 };
    expect(evaluateGasTransport({ ...input, system: reversed })).toEqual(evaluateGasTransport({ ...input, system: base }));
  });

  it("bulk-only large dt does not cross total-pressure equilibrium", () => {
    const system = twoCompartmentSystem([gas("N2", 1)], []);
    const next = commit(system, evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model("A-B", 1, 0)], dtS: 1e12 }));
    expect(pressure(next, "A")).toBeGreaterThanOrEqual(pressure(next, "B"));
  });

  it("diffusion-only large dt does not cross species partial-pressure equilibrium", () => {
    const system = twoCompartmentSystem([gas("N2", 1)], []);
    const next = commit(system, evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model("A-B", 0, 1)], dtS: 1e12 }));
    expect(partial(next, "A", "N2")).toBeGreaterThanOrEqual(partial(next, "B", "N2"));
  });

  it("combined bulk and diffusion large dt stays on the equilibrium boundary", () => {
    const system = twoCompartmentSystem([gas("N2", 1)], []);
    const next = commit(system, evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model("A-B", 1, 1)], dtS: 1e12 }));
    expect(pressure(next, "A")).toBeGreaterThanOrEqual(pressure(next, "B"));
  });

  it("combined mechanisms do not reverse total-pressure ordering", () => {
    const system = twoCompartmentSystem([gas("N2", 0.8), gas("O2", 0.2, o2)], [gas("N2", 0.1), gas("O2", 0.1, o2)]);
    expect(pressure(system, "A")).toBeGreaterThan(pressure(system, "B"));
    const next = commit(system, evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model("A-B", 1, 1)], dtS: 1e12 }));
    expect(pressure(next, "A")).toBeGreaterThanOrEqual(pressure(next, "B"));
  });

  it("combined mechanisms do not reverse a relevant species partial-pressure ordering", () => {
    const system = twoCompartmentSystem([gas("N2", 0.9), gas("O2", 0.1, o2)], [gas("N2", 0.2), gas("O2", 0.1, o2)]);
    expect(partial(system, "A", "N2")).toBeGreaterThan(partial(system, "B", "N2"));
    const next = commit(system, evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model("A-B", 1, 1)], dtS: 1e12 }));
    expect(partial(next, "A", "N2")).toBeGreaterThanOrEqual(partial(next, "B", "N2"));
  });

  it("never overdrafts source species and conserves species/elements/atoms/charge", () => {
    const connections = ["B", "C", "D"].map((destination) => ({
      id: `A-${destination}`,
      sourceCompartmentId: "A",
      destinationCompartmentId: destination,
      kind: "GAS" as const,
      enabled: true,
    }));
    const system: MatterSystemState = {
      compartments: [compartment("A", [gas("N2", 0.6), gas("O2", 0.4, o2)]), compartment("B", []), compartment("C", []), compartment("D", [])],
      connections,
    };
    const before = inventorySnapshot(system);
    const evaluation = evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B", "C", "D"]), connectionModels: connections.map((entry) => model(entry.id, 1, 1)), dtS: 1e12 });
    for (const speciesId of ["N2", "O2"]) {
      const requested = evaluation.contributions.filter((entry) => entry.sourceCompartmentId === "A" && entry.speciesId === speciesId).reduce((sum, entry) => sum + entry.amountMol, 0);
      const available = system.compartments[0]!.species.find((entry) => entry.id === speciesId)!.amountMol;
      expect(requested).toBeLessThanOrEqual(available);
    }
    const next = commit(system, evaluation);
    expectInventoryEqual(inventorySnapshot(next), before);
  });

  it("transports a generated SpeciesId without identity substitution", () => {
    const water = createMoleculeRecord({
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
    const resolved = createDynamicSpeciesRegistry({ elements }).resolveOrRegister({ molecule: water });
    expect(resolved.status).toBe("GENERATED");
    if (resolved.status === "INVALID") return;
    const system = twoCompartmentSystem([gas(resolved.speciesId, 0.2, resolved.record.molecule)], []);
    const next = commit(system, evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model("A-B", 1, 1)], dtS: 1e9 }));
    expect(next.compartments.find((entry) => entry.id === "B")?.species[0]?.id).toBe(resolved.speciesId);
  });

  it("replays deterministically with identical final allocations and diagnostics", () => {
    const system = twoCompartmentSystem([gas("N2", 0.7), gas("O2", 0.3, o2)], [gas("N2", 0.1)]);
    const input = { system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model("A-B", 0.3, 0.7)], dtS: 1e7 };
    const first = evaluateGasTransport(input);
    const second = evaluateGasTransport(input);
    expect(second).toEqual(first);
    expect(commit(system, second)).toEqual(commit(system, first));
  });
});
