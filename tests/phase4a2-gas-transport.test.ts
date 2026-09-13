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
  IDEAL_GAS_CONSTANT_J_PER_MOL_K,
  type GasCompartmentThermodynamicInput,
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
const C: ElementDefinition = {
  atomicNumber: 6,
  symbol: "C",
  atomicMolarMassKgPerMol: 0.012,
  valenceElectrons: 4,
  commonOxidationStates: [-4, 2, 4],
  electronegativity: 2.55,
  typicalValences: [4],
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
const elements: ElementProvider = {
  getElement(symbol) {
    return ({ N, O, C, H } as Record<string, ElementDefinition>)[symbol];
  },
};

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
const co2 = createMoleculeRecord({
  atoms: [
    { id: "c", element: "C", formalCharge: 0 },
    { id: "o1", element: "O", formalCharge: 0 },
    { id: "o2", element: "O", formalCharge: 0 },
  ],
  bonds: [
    { id: "co1", a: "c", b: "o1", kind: "covalent", order: 2 },
    { id: "co2", a: "c", b: "o2", kind: "covalent", order: 2 },
  ],
}, elements);
const gasPhase = {
  phase: "gas" as const,
  source: "phase4a2-test",
  phaseStateId: "gas:test",
  scientificStatus: "APPROXIMATED" as const,
};

function gas(id: string, amountMol: number, molecule = n2): SpeciesState {
  return { id, amountMol, molecule, phaseState: gasPhase };
}

function compartment(id: string, kind: "VESSEL_HEADSPACE" | "LAB_ATMOSPHERE" | "GAS_COLLECTOR", species: SpeciesState[], volumeM3 = V) {
  return createMatterCompartment({ id, kind, species, volumeM3 });
}

function thermo(...ids: string[]): GasCompartmentThermodynamicInput[] {
  return ids.map((compartmentId) => ({ compartmentId, temperatureK: T }));
}

function model(connectionId: string, bulk = 0, diffusion = 0): GasConnectionTransportModel {
  return {
    connectionId,
    bulkMolarConductanceMolPerSPaS: bulk,
    diffusiveMolarConductanceMolPerSPaS: diffusion,
    scientificStatus: "APPROXIMATED",
    source: "parameterized-test",
  };
}

function amount(state: MatterSystemState, compartmentId: string, speciesId: string): number {
  return state.compartments.find((entry) => entry.id === compartmentId)?.species.find((entry) => entry.id === speciesId)?.amountMol ?? 0;
}

function commit(state: MatterSystemState, evaluation: ReturnType<typeof evaluateGasTransport>): MatterSystemState {
  if (evaluation.transferRequests.length === 0) return state;
  const result = transferMatterBatch(state, evaluation.transferRequests);
  expect(result.status).toBe("COMMITTED");
  return result.status === "COMMITTED" ? result.state : state;
}

function pressure(state: MatterSystemState, id: string): number {
  const c = state.compartments.find((entry) => entry.id === id)!;
  return evaluateIdealGasCompartment(c, { compartmentId: id, temperatureK: T }).pressurePa ?? 0;
}

describe("Phase 4A-2 gas/headspace transport", () => {
  it("computes ideal-gas pressure from gas amount only", () => {
    const c = compartment("A", "VESSEL_HEADSPACE", [gas("N2", 2)]);
    const result = evaluateIdealGasCompartment(c, { compartmentId: "A", temperatureK: T });
    expect(result.model).toBe("IDEAL_GAS");
    expect(result.pressurePa).toBeCloseTo(2 * IDEAL_GAS_CONSTANT_J_PER_MOL_K * T / V, 10);
    expect(result.scientificStatus).toBe("APPROXIMATED");
  });

  it("computes species partial pressure directly from n_i R T / V", () => {
    const c = compartment("A", "VESSEL_HEADSPACE", [gas("N2", 0.8), gas("O2", 0.2, o2)]);
    const result = evaluateIdealGasCompartment(c, { compartmentId: "A", temperatureK: T });
    expect(result.partialPressuresPa.N2).toBeCloseTo(0.8 * IDEAL_GAS_CONSTANT_J_PER_MOL_K * T / V, 10);
    expect(result.partialPressuresPa.O2).toBeCloseTo(0.2 * IDEAL_GAS_CONSTANT_J_PER_MOL_K * T / V, 10);
    expect(result.moleFractions.N2).toBeCloseTo(0.8);
    expect(result.moleFractions.O2).toBeCloseTo(0.2);
  });

  it.each([
    [0, T],
    [-1, T],
    [Number.NaN, T],
    [V, 0],
    [V, -1],
    [V, Number.POSITIVE_INFINITY],
  ])("returns OPEN for invalid thermodynamic input volume=%s T=%s", (volumeM3, temperatureK) => {
    const c = compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)], volumeM3);
    const result = evaluateIdealGasCompartment(c, { compartmentId: "A", temperatureK });
    expect(result.model).toBe("OPEN");
    expect(result.scientificStatus).toBe("OPEN");
    expect(Object.values(result.partialPressuresPa).every(Number.isFinite)).toBe(true);
  });

  it("moves bulk gas from high to low pressure through an enabled directed GAS connection", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 0.1)])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-5)], dtS: 1 });
    expect(result.bulkTransfers.length).toBe(1);
    expect(result.transferRequests[0]?.sourceCompartmentId).toBe("A");
    expect(result.transferRequests[0]?.destinationCompartmentId).toBe("B");
  });

  it("produces zero bulk transfer at zero total-pressure gradient", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 1)])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-5)], dtS: 1 });
    expect(result.bulkTransfers).toEqual([]);
  });

  it("supports species diffusion at equal total pressure with composition gradients", () => {
    const state: MatterSystemState = {
      compartments: [
        compartment("A", "VESSEL_HEADSPACE", [gas("N2", 0.5), gas("O2", 0.5, o2)]),
        compartment("B", "GAS_COLLECTOR", [gas("N2", 0.8), gas("O2", 0.2, o2)]),
      ],
      connections: [
        { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true },
        { id: "B-A", sourceCompartmentId: "B", destinationCompartmentId: "A", kind: "GAS", enabled: true },
      ],
    };
    const result = evaluateGasTransport({
      system: state,
      thermodynamicInputs: thermo("A", "B"),
      connectionModels: [model("A-B", 0, 1e-5), model("B-A", 0, 1e-5)],
      dtS: 1,
    });
    expect(result.bulkTransfers).toEqual([]);
    expect(result.diffusiveTransfers.length).toBe(2);
    expect(result.contributions.some((entry) => entry.speciesId === "O2" && entry.sourceCompartmentId === "A")).toBe(true);
    expect(result.contributions.some((entry) => entry.speciesId === "N2" && entry.sourceCompartmentId === "B")).toBe(true);
  });

  it("emits no request for a disabled connection", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: false }],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-5, 1e-5)], dtS: 1 });
    expect(result.transferRequests).toEqual([]);
    expect(result.diagnostics[0]?.reasonCodes).toContain("DISABLED_CONNECTION");
  });

  it("distributes bulk gas by source mole fraction", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 0.8), gas("O2", 0.2, o2)]), compartment("B", "GAS_COLLECTOR", [])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-9)], dtS: 1 });
    const entries = result.bulkTransfers[0]!.species;
    const n2Amount = entries.find((entry) => entry.speciesId === "N2")!.amountMol;
    const o2Amount = entries.find((entry) => entry.speciesId === "O2")!.amountMol;
    expect(n2Amount / o2Amount).toBeCloseTo(4, 12);
  });

  it("never asks 01 to overdraw source species", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", []), compartment("C", "LAB_ATMOSPHERE", [])],
      connections: [
        { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true },
        { id: "A-C", sourceCompartmentId: "A", destinationCompartmentId: "C", kind: "GAS", enabled: true },
      ],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B", "C"), connectionModels: [model("A-B", 1), model("A-C", 1)], dtS: 1e6 });
    const requested = result.transferRequests.flatMap((request) => request.species).reduce((sum, entry) => sum + entry.amountMol, 0);
    expect(requested).toBeLessThanOrEqual(1);
    expect(commit(state, result)).not.toBe(state);
  });

  it("normalizes multiple competing connections deterministically and order-invariantly", () => {
    const connections = [
      { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS" as const, enabled: true },
      { id: "A-C", sourceCompartmentId: "A", destinationCompartmentId: "C", kind: "GAS" as const, enabled: true },
      { id: "A-D", sourceCompartmentId: "A", destinationCompartmentId: "D", kind: "GAS" as const, enabled: true },
    ];
    const compartments = [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", []), compartment("C", "GAS_COLLECTOR", []), compartment("D", "LAB_ATMOSPHERE", [])];
    const models = connections.map((entry) => model(entry.id, 1));
    const first = evaluateGasTransport({ system: { compartments, connections }, thermodynamicInputs: thermo("A", "B", "C", "D"), connectionModels: models, dtS: 1e6 });
    const second = evaluateGasTransport({ system: { compartments: [...compartments].reverse(), connections: [...connections].reverse() }, thermodynamicInputs: [...thermo("A", "B", "C", "D")].reverse(), connectionModels: [...models].reverse(), dtS: 1e6 });
    expect(second.transferRequests).toEqual(first.transferRequests);
    expect(second.contributions).toEqual(first.contributions);
  });

  it("closed-form relaxation prevents pressure overshoot even at huge dt", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1)], dtS: 1e12 });
    const next = commit(state, result);
    expect(pressure(next, "A")).toBeGreaterThanOrEqual(pressure(next, "B") - 1e-6);
    expect(amount(next, "A", "N2")).toBeCloseTo(0.5, 10);
    expect(amount(next, "B", "N2")).toBeCloseTo(0.5, 10);
  });

  it("conserves a sealed two-chamber system and deterministically converges", () => {
    let state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 0.1)])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const before = aggregateSystemMatterInventory(state);
    let previousDifference = pressure(state, "A") - pressure(state, "B");
    for (let step = 0; step < 30; step += 1) {
      const evaluation = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-6)], dtS: 1 });
      state = commit(state, evaluation);
      const difference = pressure(state, "A") - pressure(state, "B");
      expect(difference).toBeGreaterThanOrEqual(-1e-7);
      expect(difference).toBeLessThanOrEqual(previousDifference + 1e-7);
      previousDifference = difference;
    }
    expect(aggregateSystemMatterInventory(state)).toEqual(before);
  });

  it("species diffusion conserves each species while approaching equal partial pressures", () => {
    let state: MatterSystemState = {
      compartments: [
        compartment("A", "VESSEL_HEADSPACE", [gas("N2", 0.5), gas("O2", 0.5, o2)]),
        compartment("B", "GAS_COLLECTOR", [gas("N2", 0.8), gas("O2", 0.2, o2)]),
      ],
      connections: [
        { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true },
        { id: "B-A", sourceCompartmentId: "B", destinationCompartmentId: "A", kind: "GAS", enabled: true },
      ],
    };
    const before = aggregateSystemMatterInventory(state);
    for (let step = 0; step < 20; step += 1) {
      const evaluation = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 0, 1e-6), model("B-A", 0, 1e-6)], dtS: 1 });
      state = commit(state, evaluation);
    }
    expect(aggregateSystemMatterInventory(state)).toEqual(before);
    const a = evaluateIdealGasCompartment(state.compartments.find((entry) => entry.id === "A")!, { compartmentId: "A", temperatureK: T });
    const b = evaluateIdealGasCompartment(state.compartments.find((entry) => entry.id === "B")!, { compartmentId: "B", temperatureK: T });
    expect(Math.abs((a.partialPressuresPa.N2 ?? 0) - (b.partialPressuresPa.N2 ?? 0))).toBeLessThan(100);
    expect(Math.abs((a.partialPressuresPa.O2 ?? 0) - (b.partialPressuresPa.O2 ?? 0))).toBeLessThan(100);
  });

  it("routes open-headspace CO2 to finite modeled lab atmosphere without deleting matter", () => {
    const state: MatterSystemState = {
      compartments: [
        compartment("headspace", "VESSEL_HEADSPACE", [gas("CO2", 0.5, co2)]),
        compartment("lab", "LAB_ATMOSPHERE", [gas("CO2", 0.001, co2)], 1),
      ],
      connections: [{ id: "open-boundary", sourceCompartmentId: "headspace", destinationCompartmentId: "lab", kind: "GAS", enabled: true }],
    };
    const before = aggregateSystemMatterInventory(state);
    const evaluation = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("headspace", "lab"), connectionModels: [model("open-boundary", 0, 1e-6)], dtS: 1 });
    expect(evaluation.transferRequests.length).toBe(1);
    const next = commit(state, evaluation);
    expect(amount(next, "headspace", "CO2")).toBeLessThan(0.5);
    expect(amount(next, "lab", "CO2")).toBeGreaterThan(0.001);
    expect(aggregateSystemMatterInventory(next)).toEqual(before);
  });

  it("sealed/closed headspace has no automatic atmosphere loss", () => {
    const state: MatterSystemState = {
      compartments: [compartment("headspace", "VESSEL_HEADSPACE", [gas("CO2", 0.5, co2)]), compartment("lab", "LAB_ATMOSPHERE", [], 1)],
      connections: [],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("headspace", "lab"), connectionModels: [], dtS: 1000 });
    expect(result.transferRequests).toEqual([]);
    expect(amount(state, "headspace", "CO2")).toBe(0.5);
  });

  it("supports trace gas amounts without negative or artificial disappearance", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1e-16)]), compartment("B", "GAS_COLLECTOR", [])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const evaluation = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-6)], dtS: 1 });
    const requested = evaluation.transferRequests[0]?.species[0]?.amountMol ?? 0;
    expect(requested).toBeGreaterThan(0);
    expect(requested).toBeLessThanOrEqual(1e-16);
    const next = commit(state, evaluation);
    expect(amount(next, "A", "N2")).toBeGreaterThanOrEqual(0);
  });

  it("works with an actual Dynamic Species Registry generated SpeciesId", () => {
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
    const generated = gas(resolution.speciesId, 0.2, resolution.record.molecule);
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [generated]), compartment("B", "GAS_COLLECTOR", [])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const evaluation = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-6)], dtS: 1 });
    expect(evaluation.transferRequests[0]?.species[0]?.speciesId).toBe(resolution.speciesId);
    const next = commit(state, evaluation);
    expect(amount(next, "B", resolution.speciesId)).toBeGreaterThan(0);
  });

  it("is deterministic for replay-identical inputs", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1), gas("O2", 0.2, o2)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 0.1)])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const input = { system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-6, 1e-6)], dtS: 0.25 };
    expect(evaluateGasTransport(input)).toEqual(evaluateGasTransport(input));
  });

  it("never emits NaN/Infinity for extreme but finite inputs", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1e200)], 1e-100), compartment("B", "GAS_COLLECTOR", [])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1)], dtS: 1e200 });
    expect(result.scientificStatus).toBe("OPEN");
    for (const request of result.transferRequests) for (const entry of request.species) expect(Number.isFinite(entry.amountMol)).toBe(true);
  });

  it("rejects invalid dt and invalid caller-provided conductance without NaN propagation", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    expect(() => evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1)], dtS: 0 })).toThrow(/dtS/);
    const invalid = { ...model("A-B", 1), bulkMolarConductanceMolPerSPaS: Number.NaN };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [invalid], dtS: 1 });
    expect(result.transferRequests).toEqual([]);
    expect(result.scientificStatus).toBe("OPEN");
  });
});
