import { describe, expect, it } from "vitest";
import {
  aggregateSystemMatterInventory,
  createMatterCompartment,
  transferMatterBatch,
  type MatterCompartmentState,
  type MatterSystemState,
  type SystemMatterInventory,
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
const N: ElementDefinition = { atomicNumber: 7, symbol: "N", atomicMolarMassKgPerMol: 0.014, valenceElectrons: 5, commonOxidationStates: [-3, 3, 5], electronegativity: 3.04, typicalValences: [3] };
const O: ElementDefinition = { atomicNumber: 8, symbol: "O", atomicMolarMassKgPerMol: 0.016, valenceElectrons: 6, commonOxidationStates: [-2], electronegativity: 3.44, typicalValences: [2] };
const C: ElementDefinition = { atomicNumber: 6, symbol: "C", atomicMolarMassKgPerMol: 0.012, valenceElectrons: 4, commonOxidationStates: [-4, 2, 4], electronegativity: 2.55, typicalValences: [4] };
const H: ElementDefinition = { atomicNumber: 1, symbol: "H", atomicMolarMassKgPerMol: 0.001, valenceElectrons: 1, commonOxidationStates: [-1, 1], electronegativity: 2.2, typicalValences: [1] };
const elements: ElementProvider = { getElement: (symbol) => ({ N, O, C, H } as Record<string, ElementDefinition>)[symbol] };
const n2 = createMoleculeRecord({ atoms: [{ id: "n1", element: "N", formalCharge: 0 }, { id: "n2", element: "N", formalCharge: 0 }], bonds: [{ id: "nn", a: "n1", b: "n2", kind: "covalent", order: 3 }] }, elements);
const o2 = createMoleculeRecord({ atoms: [{ id: "o1", element: "O", formalCharge: 0 }, { id: "o2", element: "O", formalCharge: 0 }], bonds: [{ id: "oo", a: "o1", b: "o2", kind: "covalent", order: 2 }] }, elements);
const co2 = createMoleculeRecord({ atoms: [{ id: "c", element: "C", formalCharge: 0 }, { id: "o1", element: "O", formalCharge: 0 }, { id: "o2", element: "O", formalCharge: 0 }], bonds: [{ id: "co1", a: "c", b: "o1", kind: "covalent", order: 2 }, { id: "co2", a: "c", b: "o2", kind: "covalent", order: 2 }] }, elements);
const gasPhase = { phase: "gas" as const, source: "phase4a2-test", phaseStateId: "gas:test", scientificStatus: "APPROXIMATED" as const };

function gas(id: string, amountMol: number, molecule = n2): SpeciesState {
  return { id, amountMol, molecule, phaseState: gasPhase };
}
function compartment(id: string, kind: "VESSEL_HEADSPACE" | "LAB_ATMOSPHERE" | "GAS_COLLECTOR", species: SpeciesState[], volumeM3 = V): MatterCompartmentState {
  return createMatterCompartment({ id, kind, species, volumeM3 });
}
function thermo(...ids: string[]): GasCompartmentThermodynamicInput[] {
  return ids.map((compartmentId) => ({ compartmentId, temperatureK: T }));
}
function model(connectionId: string, bulk = 0, diffusion = 0): GasConnectionTransportModel {
  return { connectionId, bulkMolarConductanceMolPerSPaS: bulk, diffusiveMolarConductanceMolPerSPaS: diffusion, scientificStatus: "APPROXIMATED", source: "parameterized-test" };
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
function expectInventoryClose(actual: SystemMatterInventory, expected: SystemMatterInventory): void {
  for (const key of new Set([...Object.keys(actual.speciesAmountsMol), ...Object.keys(expected.speciesAmountsMol)])) {
    expect(actual.speciesAmountsMol[key] ?? 0).toBeCloseTo(expected.speciesAmountsMol[key] ?? 0, 12);
  }
  for (const key of new Set([...Object.keys(actual.elementsMol), ...Object.keys(expected.elementsMol)])) {
    expect(actual.elementsMol[key] ?? 0).toBeCloseTo(expected.elementsMol[key] ?? 0, 12);
  }
  expect(actual.atomAmountMol).toBeCloseTo(expected.atomAmountMol, 12);
  expect(actual.netChargeAmountMol).toBeCloseTo(expected.netChargeAmountMol, 12);
}

describe("Phase 4A-2 gas/headspace transport", () => {
  it("computes ideal gas pressure and species partial pressures", () => {
    const c = compartment("A", "VESSEL_HEADSPACE", [gas("N2", 0.8), gas("O2", 0.2, o2)]);
    const result = evaluateIdealGasCompartment(c, { compartmentId: "A", temperatureK: T });
    expect(result.model).toBe("IDEAL_GAS");
    expect(result.pressurePa).toBeCloseTo(IDEAL_GAS_CONSTANT_J_PER_MOL_K * T / V, 10);
    expect(result.partialPressuresPa.N2).toBeCloseTo(0.8 * IDEAL_GAS_CONSTANT_J_PER_MOL_K * T / V, 10);
    expect(result.partialPressuresPa.O2).toBeCloseTo(0.2 * IDEAL_GAS_CONSTANT_J_PER_MOL_K * T / V, 10);
    expect(result.moleFractions).toEqual({ N2: 0.8, O2: 0.2 });
    expect(result.scientificStatus).toBe("APPROXIMATED");
  });

  it.each([
    [0, T], [-1, T], [Number.NaN, T], [V, 0], [V, -1], [V, Number.POSITIVE_INFINITY],
  ])("returns OPEN for invalid thermodynamic input volume=%s T=%s", (volumeM3, temperatureK) => {
    const valid = compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]);
    const raw: MatterCompartmentState = { ...valid, volumeM3 };
    const result = evaluateIdealGasCompartment(raw, { compartmentId: "A", temperatureK });
    expect(result.model).toBe("OPEN");
    expect(result.scientificStatus).toBe("OPEN");
    expect(Object.values(result.partialPressuresPa).every(Number.isFinite)).toBe(true);
  });

  it("moves bulk gas high→low and has zero bulk flow at equal pressure", () => {
    const connection = { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS" as const, enabled: true };
    const highLow: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 0.1)])], connections: [connection] };
    const moving = evaluateGasTransport({ system: highLow, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-5)], dtS: 1 });
    expect(moving.bulkTransfers.length).toBe(1);
    expect(moving.transferRequests[0]?.sourceCompartmentId).toBe("A");
    const equal: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 1)])], connections: [connection] };
    expect(evaluateGasTransport({ system: equal, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-5)], dtS: 1 }).bulkTransfers).toEqual([]);
  });

  it("supports equal-pressure composition diffusion while bulk flow stays zero", () => {
    const state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 0.5), gas("O2", 0.5, o2)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 0.8), gas("O2", 0.2, o2)])],
      connections: [
        { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true },
        { id: "B-A", sourceCompartmentId: "B", destinationCompartmentId: "A", kind: "GAS", enabled: true },
      ],
    };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 0, 1e-5), model("B-A", 0, 1e-5)], dtS: 1 });
    expect(result.bulkTransfers).toEqual([]);
    expect(result.contributions.some((entry) => entry.speciesId === "O2" && entry.sourceCompartmentId === "A")).toBe(true);
    expect(result.contributions.some((entry) => entry.speciesId === "N2" && entry.sourceCompartmentId === "B")).toBe(true);
  });

  it("disabled connections emit zero transfer and directed topology is not secretly reversed", () => {
    const disabled: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: false }] };
    expect(evaluateGasTransport({ system: disabled, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1)], dtS: 1 }).transferRequests).toEqual([]);
    const wrongDirection: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", []), compartment("B", "GAS_COLLECTOR", [gas("N2", 1)])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    expect(evaluateGasTransport({ system: wrongDirection, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1, 1)], dtS: 1 }).transferRequests).toEqual([]);
  });

  it("distributes pressure-driven bulk transfer by source mole fraction", () => {
    const state: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 0.8), gas("O2", 0.2, o2)]), compartment("B", "GAS_COLLECTOR", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const entries = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-9)], dtS: 1 }).bulkTransfers[0]!.species;
    const n = entries.find((entry) => entry.speciesId === "N2")!.amountMol;
    const o = entries.find((entry) => entry.speciesId === "O2")!.amountMol;
    expect(n / o).toBeCloseTo(4, 12);
  });

  it("never overdraws source and normalizes competing connections order-invariantly", () => {
    const connections = [
      { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS" as const, enabled: true },
      { id: "A-C", sourceCompartmentId: "A", destinationCompartmentId: "C", kind: "GAS" as const, enabled: true },
      { id: "A-D", sourceCompartmentId: "A", destinationCompartmentId: "D", kind: "GAS" as const, enabled: true },
    ];
    const compartments = [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", []), compartment("C", "GAS_COLLECTOR", []), compartment("D", "LAB_ATMOSPHERE", [])];
    const models = connections.map((entry) => model(entry.id, 1));
    const first = evaluateGasTransport({ system: { compartments, connections }, thermodynamicInputs: thermo("A", "B", "C", "D"), connectionModels: models, dtS: 1e6 });
    const second = evaluateGasTransport({ system: { compartments: [...compartments].reverse(), connections: [...connections].reverse() }, thermodynamicInputs: [...thermo("A", "B", "C", "D")].reverse(), connectionModels: [...models].reverse(), dtS: 1e6 });
    const requested = first.transferRequests.flatMap((request) => request.species).reduce((sum, entry) => sum + entry.amountMol, 0);
    expect(requested).toBeLessThanOrEqual(1);
    expect(second.transferRequests).toEqual(first.transferRequests);
    expect(second.contributions).toEqual(first.contributions);
    commit({ compartments, connections }, first);
  });

  it("closed-form relaxation prevents pressure overshoot for very large dt", () => {
    const state: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const next = commit(state, evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1)], dtS: 1e12 }));
    expect(pressure(next, "A")).toBeGreaterThanOrEqual(pressure(next, "B") - 1e-6);
    expect(amount(next, "A", "N2")).toBeCloseTo(0.5, 10);
    expect(amount(next, "B", "N2")).toBeCloseTo(0.5, 10);
  });

  it("sealed two-chamber repeated transport conserves matter and converges deterministically", () => {
    let state: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 0.1)])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const before = aggregateSystemMatterInventory(state);
    let previous = pressure(state, "A") - pressure(state, "B");
    for (let step = 0; step < 30; step += 1) {
      state = commit(state, evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-6)], dtS: 1 }));
      const difference = pressure(state, "A") - pressure(state, "B");
      expect(difference).toBeGreaterThanOrEqual(-1e-7);
      expect(difference).toBeLessThanOrEqual(previous + 1e-7);
      previous = difference;
    }
    expectInventoryClose(aggregateSystemMatterInventory(state), before);
  });

  it("bidirectional species diffusion conserves each species and approaches equal partial pressure", () => {
    let state: MatterSystemState = {
      compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 0.5), gas("O2", 0.5, o2)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 0.8), gas("O2", 0.2, o2)])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }, { id: "B-A", sourceCompartmentId: "B", destinationCompartmentId: "A", kind: "GAS", enabled: true }],
    };
    const before = aggregateSystemMatterInventory(state);
    for (let step = 0; step < 20; step += 1) state = commit(state, evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 0, 1e-6), model("B-A", 0, 1e-6)], dtS: 1 }));
    expectInventoryClose(aggregateSystemMatterInventory(state), before);
    const a = evaluateIdealGasCompartment(state.compartments.find((entry) => entry.id === "A")!, { compartmentId: "A", temperatureK: T });
    const b = evaluateIdealGasCompartment(state.compartments.find((entry) => entry.id === "B")!, { compartmentId: "B", temperatureK: T });
    expect(Math.abs((a.partialPressuresPa.N2 ?? 0) - (b.partialPressuresPa.N2 ?? 0))).toBeLessThan(100);
    expect(Math.abs((a.partialPressuresPa.O2 ?? 0) - (b.partialPressuresPa.O2 ?? 0))).toBeLessThan(100);
  });

  it("routes open headspace CO2 into finite lab atmosphere and conserves system-wide CO2", () => {
    const state: MatterSystemState = { compartments: [compartment("headspace", "VESSEL_HEADSPACE", [gas("CO2", 0.5, co2)]), compartment("lab", "LAB_ATMOSPHERE", [gas("CO2", 0.001, co2)], 1)], connections: [{ id: "open-boundary", sourceCompartmentId: "headspace", destinationCompartmentId: "lab", kind: "GAS", enabled: true }] };
    const before = aggregateSystemMatterInventory(state);
    const next = commit(state, evaluateGasTransport({ system: state, thermodynamicInputs: thermo("headspace", "lab"), connectionModels: [model("open-boundary", 0, 1e-6)], dtS: 1 }));
    expect(amount(next, "headspace", "CO2")).toBeLessThan(0.5);
    expect(amount(next, "lab", "CO2")).toBeGreaterThan(0.001);
    expectInventoryClose(aggregateSystemMatterInventory(next), before);
  });

  it("closed/sealed headspace never auto-deletes gas", () => {
    const state: MatterSystemState = { compartments: [compartment("headspace", "VESSEL_HEADSPACE", [gas("CO2", 0.5, co2)]), compartment("lab", "LAB_ATMOSPHERE", [], 1)], connections: [] };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("headspace", "lab"), connectionModels: [], dtS: 1000 });
    expect(result.transferRequests).toEqual([]);
    expect(amount(state, "headspace", "CO2")).toBe(0.5);
  });

  it("supports trace gas without negative amount or artificial threshold disappearance", () => {
    const state: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1e-16)]), compartment("B", "GAS_COLLECTOR", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const evaluation = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-6)], dtS: 1 });
    const requested = evaluation.transferRequests[0]?.species[0]?.amountMol ?? 0;
    expect(requested).toBeGreaterThan(0);
    expect(requested).toBeLessThanOrEqual(1e-16);
    expect(amount(commit(state, evaluation), "A", "N2")).toBeGreaterThanOrEqual(0);
  });

  it("supports an actual Dynamic Species Registry generated SpeciesId", () => {
    const waterLike = createMoleculeRecord({ atoms: [{ id: "o", element: "O", formalCharge: 0 }, { id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }], bonds: [{ id: "oh1", a: "o", b: "h1", kind: "covalent", order: 1 }, { id: "oh2", a: "o", b: "h2", kind: "covalent", order: 1 }] }, elements);
    const resolution = createDynamicSpeciesRegistry({ elements }).resolveOrRegister({ molecule: waterLike });
    expect(resolution.status).toBe("GENERATED");
    if (resolution.status === "INVALID") return;
    const state: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas(resolution.speciesId, 0.2, resolution.record.molecule)]), compartment("B", "GAS_COLLECTOR", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const evaluation = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-6)], dtS: 1 });
    expect(evaluation.transferRequests[0]?.species[0]?.speciesId).toBe(resolution.speciesId);
    expect(amount(commit(state, evaluation), "B", resolution.speciesId)).toBeGreaterThan(0);
  });

  it("is deterministic for replay-identical inputs", () => {
    const state: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1), gas("O2", 0.2, o2)]), compartment("B", "GAS_COLLECTOR", [gas("N2", 0.1)])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const input = { system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1e-6, 1e-6)], dtS: 0.25 };
    expect(evaluateGasTransport(input)).toEqual(evaluateGasTransport(input));
  });

  it("returns OPEN rather than NaN/Infinity when ideal-gas pressure overflows", () => {
    const state: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1e308)], 1e-308), compartment("B", "GAS_COLLECTOR", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1)], dtS: 1e200 });
    expect(result.scientificStatus).toBe("OPEN");
    expect(result.transferRequests).toEqual([]);
  });

  it("rejects invalid dt and treats invalid caller conductance as OPEN", () => {
    const state: MatterSystemState = { compartments: [compartment("A", "VESSEL_HEADSPACE", [gas("N2", 1)]), compartment("B", "GAS_COLLECTOR", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    expect(() => evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [model("A-B", 1)], dtS: 0 })).toThrow(/dtS/);
    const invalid = { ...model("A-B", 1), bulkMolarConductanceMolPerSPaS: Number.NaN };
    const result = evaluateGasTransport({ system: state, thermodynamicInputs: thermo("A", "B"), connectionModels: [invalid], dtS: 1 });
    expect(result.transferRequests).toEqual([]);
    expect(result.scientificStatus).toBe("OPEN");
  });
});
