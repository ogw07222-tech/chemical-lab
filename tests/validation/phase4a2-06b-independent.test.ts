import { describe, expect, it } from "vitest";
import {
  aggregateSystemMatterInventory,
  createMatterCompartment,
  transferMatterBatch,
  type MatterCompartmentState,
  type MatterSystemState,
} from "../../src/simulation/compartment";
import {
  evaluateGasTransport,
  evaluateIdealGasCompartment,
  IDEAL_GAS_CONSTANT_J_PER_MOL_K,
  type GasConnectionTransportModel,
} from "../../src/simulation/gas-transport";
import {
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type SpeciesState,
} from "../../src/simulation/molecular";
import { createDynamicSpeciesRegistry } from "../../src/simulation/species-registry";

const T = 300;
const V = 0.01;
const N: ElementDefinition = { atomicNumber: 7, symbol: "N", atomicMolarMassKgPerMol: 0.014, valenceElectrons: 5, commonOxidationStates: [-3, 3, 5], electronegativity: 3.04, typicalValences: [3] };
const O: ElementDefinition = { atomicNumber: 8, symbol: "O", atomicMolarMassKgPerMol: 0.016, valenceElectrons: 6, commonOxidationStates: [-2], electronegativity: 3.44, typicalValences: [2] };
const H: ElementDefinition = { atomicNumber: 1, symbol: "H", atomicMolarMassKgPerMol: 0.001, valenceElectrons: 1, commonOxidationStates: [-1, 1], electronegativity: 2.2, typicalValences: [1] };
const elements: ElementProvider = { getElement: (symbol) => ({ N, O, H } as Record<string, ElementDefinition>)[symbol] };
const n2 = createMoleculeRecord({ atoms: [{ id: "n1", element: "N", formalCharge: 0 }, { id: "n2", element: "N", formalCharge: 0 }], bonds: [{ id: "nn", a: "n1", b: "n2", kind: "covalent", order: 3 }] }, elements);
const o2 = createMoleculeRecord({ atoms: [{ id: "o1", element: "O", formalCharge: 0 }, { id: "o2", element: "O", formalCharge: 0 }], bonds: [{ id: "oo", a: "o1", b: "o2", kind: "covalent", order: 2 }] }, elements);
const gasPhase = { phase: "gas" as const, source: "06b-validation", phaseStateId: "gas:06b", scientificStatus: "APPROXIMATED" as const };

function gas(id: string, amountMol: number, molecule = n2): SpeciesState {
  return { id, amountMol, molecule, phaseState: gasPhase };
}
function c(id: string, species: SpeciesState[], kind: "VESSEL_HEADSPACE" | "LAB_ATMOSPHERE" | "GAS_COLLECTOR" = "GAS_COLLECTOR", volumeM3 = V): MatterCompartmentState {
  return createMatterCompartment({ id, kind, species, volumeM3 });
}
function m(connectionId: string, bulk = 0, diffusion = 0): GasConnectionTransportModel {
  return { connectionId, bulkMolarConductanceMolPerSPaS: bulk, diffusiveMolarConductanceMolPerSPaS: diffusion, scientificStatus: "APPROXIMATED", source: "06b-parameterized" };
}
function thermo(ids: readonly string[]) { return ids.map((compartmentId) => ({ compartmentId, temperatureK: T })); }
function amount(state: MatterSystemState, cid: string, sid: string): number {
  return state.compartments.find((x) => x.id === cid)?.species.find((x) => x.id === sid)?.amountMol ?? 0;
}
function pressure(state: MatterSystemState, cid: string): number {
  const compartment = state.compartments.find((x) => x.id === cid)!;
  return evaluateIdealGasCompartment(compartment, { compartmentId: cid, temperatureK: T }).pressurePa ?? 0;
}
function commit(state: MatterSystemState, evaluation: ReturnType<typeof evaluateGasTransport>): MatterSystemState {
  if (evaluation.transferRequests.length === 0) return state;
  const result = transferMatterBatch(state, evaluation.transferRequests);
  expect(result.status).toBe("COMMITTED");
  if (result.status !== "COMMITTED") throw new Error("06B expected atomic commit");
  return result.state;
}
function totalRequested(evaluation: ReturnType<typeof evaluateGasTransport>, sid?: string): number {
  return evaluation.transferRequests.flatMap((r) => r.species).filter((x) => sid === undefined || x.speciesId === sid).reduce((s, x) => s + x.amountMol, 0);
}
function expectInventoryEqual(a: ReturnType<typeof aggregateSystemMatterInventory>, b: ReturnType<typeof aggregateSystemMatterInventory>) {
  for (const k of new Set([...Object.keys(a.speciesAmountsMol), ...Object.keys(b.speciesAmountsMol)])) expect(a.speciesAmountsMol[k] ?? 0).toBeCloseTo(b.speciesAmountsMol[k] ?? 0, 11);
  for (const k of new Set([...Object.keys(a.elementsMol), ...Object.keys(b.elementsMol)])) expect(a.elementsMol[k] ?? 0).toBeCloseTo(b.elementsMol[k] ?? 0, 11);
  expect(a.atomAmountMol).toBeCloseTo(b.atomAmountMol, 11);
  expect(a.netChargeAmountMol).toBeCloseTo(b.netChargeAmountMol, 11);
}
function finiteNonNegative(evaluation: ReturnType<typeof evaluateGasTransport>) {
  for (const x of evaluation.transferRequests.flatMap((r) => r.species)) {
    expect(Number.isFinite(x.amountMol)).toBe(true);
    expect(x.amountMol).toBeGreaterThanOrEqual(0);
  }
}

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (1664525 * s + 1013904223) >>> 0) / 0x100000000);
}

describe("06B Phase 4A-2 independent validation", () => {
  it("validates ideal-gas pressure, partial-pressure sum, trace and zero gas", () => {
    for (const n of [0, 1e-18, 0.2, 1, 1e6]) {
      const state = c("A", [gas("N2", n * 0.8), gas("O2", n * 0.2, o2)], "VESSEL_HEADSPACE");
      const e = evaluateIdealGasCompartment(state, { compartmentId: "A", temperatureK: T });
      expect(e.model).toBe("IDEAL_GAS");
      expect(e.pressurePa).toBeCloseTo(n * IDEAL_GAS_CONSTANT_J_PER_MOL_K * T / V, 8);
      expect(Object.values(e.partialPressuresPa).reduce((a, b) => a + b, 0)).toBeCloseTo(e.pressurePa ?? 0, 8);
    }
  });

  it.each([
    [0, T], [-1, T], [Number.NaN, T], [Number.POSITIVE_INFINITY, T],
    [V, 0], [V, -1], [V, Number.NaN], [V, Number.POSITIVE_INFINITY],
  ])("rejects invalid V/T without non-finite output", (volumeM3, temperatureK) => {
    const raw = { ...c("A", [gas("N2", 1)]), volumeM3 };
    const e = evaluateIdealGasCompartment(raw, { compartmentId: "A", temperatureK });
    expect(e.model).toBe("OPEN");
    expect(e.scientificStatus).toBe("OPEN");
    expect(Object.values(e.partialPressuresPa).every(Number.isFinite)).toBe(true);
  });

  it("separates bulk and diffusion and preserves bulk source mole fraction", () => {
    const system: MatterSystemState = {
      compartments: [c("A", [gas("N2", 0.8), gas("O2", 0.2, o2)], "VESSEL_HEADSPACE"), c("B", [])],
      connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }],
    };
    const e = evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1e-9, 0)], dtS: 1 });
    expect(e.diffusiveTransfers).toEqual([]);
    const species = e.bulkTransfers[0]!.species;
    expect(species.find((x) => x.speciesId === "N2")!.amountMol / species.find((x) => x.speciesId === "O2")!.amountMol).toBeCloseTo(4, 12);
  });

  it("equal total pressure supports bidirectional composition diffusion with zero bulk", () => {
    const connections = [
      { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS" as const, enabled: true },
      { id: "B-A", sourceCompartmentId: "B", destinationCompartmentId: "A", kind: "GAS" as const, enabled: true },
    ];
    const system: MatterSystemState = { compartments: [c("A", [gas("N2", 0.5), gas("O2", 0.5, o2)]), c("B", [gas("N2", 0.8), gas("O2", 0.2, o2)])], connections };
    const e = evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1e-6, 1e-6), m("B-A", 1e-6, 1e-6)], dtS: 1 });
    expect(e.bulkTransfers).toEqual([]);
    expect(e.contributions.some((x) => x.kind === "SPECIES_DIFFUSION" && x.speciesId === "O2" && x.sourceCompartmentId === "A")).toBe(true);
    expect(e.contributions.some((x) => x.kind === "SPECIES_DIFFUSION" && x.speciesId === "N2" && x.sourceCompartmentId === "B")).toBe(true);
  });

  it("large dt never crosses pairwise equilibrium and no source overdraw occurs", () => {
    const system: MatterSystemState = { compartments: [c("A", [gas("N2", 1)], "VESSEL_HEADSPACE"), c("B", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const e = evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1e300)], dtS: 1e300 });
    finiteNonNegative(e);
    expect(totalRequested(e)).toBeLessThanOrEqual(1);
    const next = commit(system, e);
    expect(pressure(next, "A")).toBeGreaterThanOrEqual(pressure(next, "B") - 1e-6);
    expect(amount(next, "A", "N2")).toBeCloseTo(0.5, 10);
  });

  it("small repeated dt and one larger dt are consistent for the same linear two-chamber model", () => {
    const initial: MatterSystemState = { compartments: [c("A", [gas("N2", 1)]), c("B", [gas("N2", 0.1)])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    let repeated = initial;
    for (let i = 0; i < 100; i += 1) repeated = commit(repeated, evaluateGasTransport({ system: repeated, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1e-8)], dtS: 0.01 }));
    const once = commit(initial, evaluateGasTransport({ system: initial, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1e-8)], dtS: 1 }));
    expect(amount(repeated, "A", "N2")).toBeCloseTo(amount(once, "A", "N2"), 10);
    expect(amount(repeated, "B", "N2")).toBeCloseTo(amount(once, "B", "N2"), 10);
  });

  it("is invariant to connection, compartment, species, thermo and model ordering", () => {
    const connections = [
      { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS" as const, enabled: true },
      { id: "A-C", sourceCompartmentId: "A", destinationCompartmentId: "C", kind: "GAS" as const, enabled: true },
    ];
    const compartments = [c("A", [gas("O2", 0.2, o2), gas("N2", 0.8)]), c("B", []), c("C", [])];
    const models = [m("A-B", 1, 1), m("A-C", 1, 1)];
    const a = evaluateGasTransport({ system: { compartments, connections }, thermodynamicInputs: thermo(["A", "B", "C"]), connectionModels: models, dtS: 1e4 });
    const reversedSpecies = compartments.map((x) => ({ ...x, species: [...x.species].reverse() }));
    const b = evaluateGasTransport({ system: { compartments: [...reversedSpecies].reverse(), connections: [...connections].reverse() }, thermodynamicInputs: thermo(["C", "B", "A"]), connectionModels: [...models].reverse(), dtS: 1e4 });
    expect(b.transferRequests).toEqual(a.transferRequests);
    expect(b.contributions).toEqual(a.contributions);
  });

  it("requires explicit directed topology and explicit open-vessel routing", () => {
    const wrongDirection: MatterSystemState = { compartments: [c("A", []), c("B", [gas("N2", 1)])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    expect(evaluateGasTransport({ system: wrongDirection, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1, 1)], dtS: 10 }).transferRequests).toEqual([]);
    const sealed: MatterSystemState = { compartments: [c("head", [gas("N2", 1)], "VESSEL_HEADSPACE"), c("lab", [], "LAB_ATMOSPHERE", 1)], connections: [] };
    expect(evaluateGasTransport({ system: sealed, thermodynamicInputs: thermo(["head", "lab"]), connectionModels: [], dtS: 10 }).transferRequests).toEqual([]);
    expect(amount(sealed, "head", "N2")).toBe(1);
  });

  it("preserves species/elements/atoms/charge through Phase 4A-1 batch commit", () => {
    const system: MatterSystemState = { compartments: [c("A", [gas("N2", 1), gas("O2", 0.2, o2)]), c("B", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const before = aggregateSystemMatterInventory(system);
    const next = commit(system, evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1, 1)], dtS: 100 }));
    expectInventoryEqual(aggregateSystemMatterInventory(next), before);
  });

  it("supports generated SpeciesId without identity or registry mutation", () => {
    const water = createMoleculeRecord({ atoms: [{ id: "o", element: "O", formalCharge: 0 }, { id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }], bonds: [{ id: "oh1", a: "o", b: "h1", kind: "covalent", order: 1 }, { id: "oh2", a: "o", b: "h2", kind: "covalent", order: 1 }] }, elements);
    const registry = createDynamicSpeciesRegistry({ elements });
    const resolved = registry.resolveOrRegister({ molecule: water });
    expect(resolved.status).toBe("GENERATED");
    if (resolved.status === "INVALID") return;
    const system: MatterSystemState = { compartments: [c("A", [gas(resolved.speciesId, 0.1, resolved.record.molecule)]), c("B", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const e = evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1)], dtS: 1 });
    expect(e.transferRequests[0]?.species[0]?.speciesId).toBe(resolved.speciesId);
    expect(amount(commit(system, e), "B", resolved.speciesId)).toBeGreaterThan(0);
    expect(registry.resolveOrRegister({ molecule: water }).speciesId).toBe(resolved.speciesId);
  });

  it("fixed-seed randomized cases are finite, deterministic, non-negative, no-overdraw and conservative", () => {
    const rnd = lcg(0x06b4a2);
    for (let caseNo = 0; caseNo < 80; caseNo += 1) {
      const aN = rnd(); const aO = rnd(); const bN = rnd(); const bO = rnd();
      const system: MatterSystemState = {
        compartments: [c("A", [gas("N2", aN), gas("O2", aO, o2)]), c("B", [gas("N2", bN), gas("O2", bO, o2)]), c("C", [])],
        connections: [
          { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true },
          { id: "A-C", sourceCompartmentId: "A", destinationCompartmentId: "C", kind: "GAS", enabled: true },
          { id: "B-A", sourceCompartmentId: "B", destinationCompartmentId: "A", kind: "GAS", enabled: true },
        ],
      };
      const input = { system, thermodynamicInputs: thermo(["A", "B", "C"]), connectionModels: [m("A-B", rnd() * 1e-4, rnd() * 1e-4), m("A-C", rnd() * 1e-4, rnd() * 1e-4), m("B-A", rnd() * 1e-4, rnd() * 1e-4)], dtS: 10 ** (-6 + rnd() * 12) };
      const x = evaluateGasTransport(input); const y = evaluateGasTransport(input);
      expect(y).toEqual(x); finiteNonNegative(x);
      expect(x.contributions.filter((q) => q.sourceCompartmentId === "A" && q.speciesId === "N2").reduce((s, q) => s + q.amountMol, 0)).toBeLessThanOrEqual(aN + 1e-12);
      expect(x.contributions.filter((q) => q.sourceCompartmentId === "A" && q.speciesId === "O2").reduce((s, q) => s + q.amountMol, 0)).toBeLessThanOrEqual(aO + 1e-12);
      const before = aggregateSystemMatterInventory(system); const next = commit(system, x); expectInventoryEqual(aggregateSystemMatterInventory(next), before);
    }
  });

  it("long-run two-chamber and open-headspace systems conserve without oscillatory crossing", () => {
    let closed: MatterSystemState = { compartments: [c("A", [gas("N2", 1)]), c("B", [gas("N2", 0.1)])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    const closedBefore = aggregateSystemMatterInventory(closed);
    let previous = pressure(closed, "A") - pressure(closed, "B");
    for (let i = 0; i < 1000; i += 1) {
      closed = commit(closed, evaluateGasTransport({ system: closed, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1e-7)], dtS: 0.1 }));
      const d = pressure(closed, "A") - pressure(closed, "B");
      expect(d).toBeGreaterThanOrEqual(-1e-7); expect(d).toBeLessThanOrEqual(previous + 1e-7); previous = d;
    }
    expectInventoryEqual(aggregateSystemMatterInventory(closed), closedBefore);

    let open: MatterSystemState = { compartments: [c("head", [gas("N2", 1)], "VESSEL_HEADSPACE"), c("lab", [gas("N2", 0.01)], "LAB_ATMOSPHERE", 1)], connections: [{ id: "vent", sourceCompartmentId: "head", destinationCompartmentId: "lab", kind: "GAS", enabled: true }] };
    const openBefore = aggregateSystemMatterInventory(open);
    for (let i = 0; i < 300; i += 1) open = commit(open, evaluateGasTransport({ system: open, thermodynamicInputs: thermo(["head", "lab"]), connectionModels: [m("vent", 1e-7, 1e-7)], dtS: 0.1 }));
    expectInventoryEqual(aggregateSystemMatterInventory(open), openBefore);
    const disabled = { ...open, connections: [{ ...open.connections![0]!, enabled: false }] };
    expect(evaluateGasTransport({ system: disabled, thermodynamicInputs: thermo(["head", "lab"]), connectionModels: [m("vent", 1, 1)], dtS: 1e6 }).transferRequests).toEqual([]);
  });

  it("invalid dt and conductance never silently become valid transport", () => {
    const system: MatterSystemState = { compartments: [c("A", [gas("N2", 1)]), c("B", [])], connections: [{ id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS", enabled: true }] };
    for (const dtS of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(() => evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [m("A-B", 1)], dtS })).toThrow();
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const model = { ...m("A-B"), bulkMolarConductanceMolPerSPaS: bad };
      const e = evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B"]), connectionModels: [model], dtS: 1 });
      expect(e.scientificStatus).toBe("OPEN"); expect(e.transferRequests).toEqual([]);
    }
  });

  it("final bulk diagnostics agree with normalized commit requests per connection", () => {
    const connections = [
      { id: "A-B", sourceCompartmentId: "A", destinationCompartmentId: "B", kind: "GAS" as const, enabled: true },
      { id: "A-C", sourceCompartmentId: "A", destinationCompartmentId: "C", kind: "GAS" as const, enabled: true },
      { id: "A-D", sourceCompartmentId: "A", destinationCompartmentId: "D", kind: "GAS" as const, enabled: true },
    ];
    const system: MatterSystemState = { compartments: [c("A", [gas("N2", 1)]), c("B", []), c("C", []), c("D", [])], connections };
    const e = evaluateGasTransport({ system, thermodynamicInputs: thermo(["A", "B", "C", "D"]), connectionModels: connections.map((x) => m(x.id, 1)), dtS: 1e9 });
    for (const diagnostic of e.diagnostics) {
      const committedForConnection = e.bulkTransfers.find((r) => r.connectionId === diagnostic.connectionId)?.species.reduce((s, x) => s + x.amountMol, 0) ?? 0;
      expect(diagnostic.boundedBulkAmountMol ?? 0).toBeCloseTo(committedForConnection, 12);
    }
  });
});
