import { describe, expect, it } from "vitest";
import { aggregateSystemMatterInventory, createMatterCompartment, type MatterSystemState } from "../src/simulation/compartment";
import { createMoleculeRecord, type ElementDefinition, type ElementProvider, type SpeciesState } from "../src/simulation/molecular";
import { createThermalState, type ThermalBody, type ThermalPowerActuator } from "../src/simulation/thermal";
import {
  runPhase4AAuthoritativeTimestep,
  type Phase4AReactionStageExecutor,
  type Phase4ARuntimeState,
  type Phase4ARuntimeStepConfig,
} from "../src/integration/phase4a-runtime-orchestration";

const H: ElementDefinition = {
  atomicNumber: 1, symbol: "H", atomicMolarMassKgPerMol: 0.001,
  valenceElectrons: 1, commonOxidationStates: [-1, 1], electronegativity: 2.2, typicalValences: [1],
};
const elements: ElementProvider = { getElement(symbol) { return symbol === "H" ? H : undefined; } };
const h2 = createMoleculeRecord({
  atoms: [{ id: "h1", element: "H", formalCharge: 0 }, { id: "h2", element: "H", formalCharge: 0 }],
  bonds: [{ id: "hh", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);
const h = createMoleculeRecord({ atoms: [{ id: "h", element: "H", formalCharge: 0 }], bonds: [] }, elements);
const gasPhase = { phase: "gas" as const, source: "06f-validation", phaseStateId: "gas:06f", scientificStatus: "APPROXIMATED" as const };

function species(id: string, amountMol: number, molecule = h2): SpeciesState {
  return { id, amountMol, molecule, phaseState: gasPhase };
}
function tBody(id: string, temperatureK = 300, capacityJPerK = 100, kind: ThermalBody["kind"] = "VESSEL"): ThermalBody {
  return {
    id, kind,
    state: createThermalState({ temperatureK, mixtureHeatCapacity_JPerK: capacityJPerK, vesselHeatCapacity_JPerK: 0 }),
    scientificStatus: "APPROXIMATED", source: "06f-validation",
  };
}
function baseState(connection = false): Phase4ARuntimeState {
  const head = createMatterCompartment({
    id: "head", kind: "VESSEL_HEADSPACE", species: [species("H2", 1)], volumeM3: 0.01, ownerApparatusId: "vessel",
  });
  const atm = createMatterCompartment({ id: "atm", kind: "LAB_ATMOSPHERE", species: [], volumeM3: 0.01 });
  const matterSystem: MatterSystemState = {
    compartments: [head, atm],
    ...(connection ? { connections: [{ id: "head-atm", sourceCompartmentId: "head", destinationCompartmentId: "atm", kind: "GAS" as const, enabled: true }] } : {}),
  };
  const vessel = tBody("vessel", 300, 100);
  const ambient = tBody("ambient", 300, 1000, "LAB_ENVIRONMENT");
  return {
    matterSystem,
    thermalBodies: [vessel, ambient],
    reactionNetwork: { species: head.species, thermalState: vessel.state, speciesRegistry: {} as never, simTimeS: 0, completedTimesteps: 0, timelineEvents: [] },
  };
}
const noReaction: Phase4AReactionStageExecutor = ({ state }) => ({
  speciesAfter: state.species, speciesRegistry: state.speciesRegistry, progressEvents: [],
  netSpeciesAmountDeltaMol: {}, knownReactionHeat_J: 0, thermalCoverage: "COMPLETE",
  thermalScientificStatus: "VERIFIED", missingHeatCandidateIds: [], reversiblePairs: [],
});
function reaction(heatJ: number, coverage: "COMPLETE" | "OPEN" = "COMPLETE"): Phase4AReactionStageExecutor {
  return ({ state, dtS, timestepId }) => ({
    speciesAfter: [species("H2", 0.5), species("H", 1, h)],
    speciesRegistry: state.speciesRegistry,
    progressEvents: [{
      id: timestepId + ":r0", timestepId, candidateId: "r0", sequence: 0,
      startTimeS: state.simTimeS, endTimeS: state.simTimeS + dtS, dtS, extentMol: 0.5,
      reactantDeltasMol: { H2: -0.5 }, productDeltasMol: { H: 1 },
      speciesAmountDeltaMol: { H2: -0.5, H: 1 }, deltaH_JPerMolExtent: heatJ === 0 ? 0 : -heatJ / 0.5,
      heatJ, scientificStatus: coverage === "COMPLETE" ? "APPROXIMATED" : "OPEN",
      reasonCodes: ["SELECTED", "REACTION_HEAT_APPLIED"],
    }],
    netSpeciesAmountDeltaMol: { H2: -0.5, H: 1 },
    knownReactionHeat_J: heatJ,
    thermalCoverage: coverage,
    thermalScientificStatus: coverage === "COMPLETE" ? "APPROXIMATED" : "OPEN",
    missingHeatCandidateIds: coverage === "COMPLETE" ? [] : ["r0"],
    reversiblePairs: [],
  });
}
function cfg(executor: Phase4AReactionStageExecutor = noReaction, connection = false): Phase4ARuntimeStepConfig {
  return {
    dtS: 1, timestepId: "06f-step", reactionCompartmentId: "head", vesselThermalBodyId: "vessel",
    reactionInput: { elements }, reactionConfig: {} as Phase4ARuntimeStepConfig["reactionConfig"], reactionExecutor: executor,
    gas: {
      connectionModels: connection ? [{
        connectionId: "head-atm", bulkMolarConductanceMolPerSPaS: 1e-8,
        diffusiveMolarConductanceMolPerSPaS: 0, scientificStatus: "APPROXIMATED" as const,
      }] : [],
      thermalBodyByCompartmentId: { head: "vessel", atm: "ambient" },
      primaryPressureCompartmentId: "head",
    },
    thermal: {},
  };
}
function vesselT(state: Phase4ARuntimeState) {
  return state.thermalBodies.find(x => x.id === "vessel")!.state.temperatureK;
}
function amount(state: Phase4ARuntimeState, compartment: string, id: string) {
  return state.matterSystem.compartments.find(x => x.id === compartment)?.species.find(x => x.id === id)?.amountMol ?? 0;
}

describe("06F Phase 4A runtime independent validation", () => {
  it("reaction heat + actuator are each applied exactly once", () => {
    const c = cfg(reaction(100));
    c.thermal = { actuators: [{
      id: "heater", bodyId: "vessel", enabled: true, mode: "HEATER", powerW: 20,
      apparatusKind: "OTHER", scientificStatus: "APPROXIMATED",
    }] };
    const r = runPhase4AAuthoritativeTimestep(baseState(), c);
    expect(r.status).toBe("COMMITTED");
    if (r.status !== "COMMITTED") return;
    expect(r.audit.reactionEnergyJ).toBe(100);
    expect(r.audit.externalEnergyJ).toBe(20);
    expect(vesselT(r.state)).toBeCloseTo(301.2, 12);
    expect(r.state.reactionNetwork.thermalState.cumulativeEnergy.reactionHeat_J).toBeCloseTo(100, 12);
  });

  it("reaction-only +Q changes sensible temperature by Q/C exactly once", () => {
    const r = runPhase4AAuthoritativeTimestep(baseState(), cfg(reaction(100)));
    expect(r.status).toBe("COMMITTED");
    if (r.status !== "COMMITTED") return;
    expect(vesselT(r.state)).toBeCloseTo(301, 12);
    expect(r.audit.externalEnergyJ).toBe(0);
    expect(r.audit.reactionEnergyJ).toBe(100);
  });

  it("incomplete reaction heat blocks atomically", () => {
    const s = baseState();
    const r = runPhase4AAuthoritativeTimestep(s, cfg(reaction(0, "OPEN")));
    expect(r.status).toBe("OPEN");
    expect(r.state).toBe(s);
    expect((r as any).provider).toBeUndefined();
  });

  it("gas OPEN rolls back reaction progress and publishes no half-step", () => {
    const s = baseState(true);
    const c = cfg(reaction(100), true);
    c.gas.connectionModels = [{ connectionId: "head-atm", bulkMolarConductanceMolPerSPaS: -1, scientificStatus: "APPROXIMATED" }];
    const r = runPhase4AAuthoritativeTimestep(s, c);
    expect(r.status).toBe("OPEN");
    expect(r.state).toBe(s);
    expect(amount(s, "head", "H2")).toBe(1);
    expect((r as any).provider).toBeUndefined();
  });

  it("thermal OPEN rolls back already-evaluated reaction/gas stages", () => {
    const s = baseState(true);
    const c = cfg(reaction(100), true);
    c.thermal = { reservoirs: [{
      id: "bad", bodyId: "vessel", enabled: true, reservoirTemperatureK: 350,
      conductanceWPerK: -1, mechanism: "AMBIENT", scientificStatus: "APPROXIMATED",
    }] };
    const r = runPhase4AAuthoritativeTimestep(s, c);
    expect(r.status).toBe("OPEN");
    expect(r.state).toBe(s);
    expect((r as any).provider).toBeUndefined();
  });

  it("final pressure uses final post-heating temperature rather than stale T", () => {
    const c = cfg(noReaction);
    c.thermal = { actuators: [{
      id: "heater", bodyId: "vessel", enabled: true, mode: "HEATER", powerW: 100,
      apparatusKind: "OTHER", scientificStatus: "APPROXIMATED",
    }] };
    const cold = runPhase4AAuthoritativeTimestep(baseState(), cfg(noReaction));
    const hot = runPhase4AAuthoritativeTimestep(baseState(), c);
    expect(cold.status).toBe("COMMITTED");
    expect(hot.status).toBe("COMMITTED");
    if (cold.status !== "COMMITTED" || hot.status !== "COMMITTED") return;
    expect(hot.audit.finalTemperatureK).toBeCloseTo(301, 12);
    expect(hot.audit.finalPressurePa!).toBeGreaterThan(cold.audit.finalPressurePa!);
    expect(hot.provider.gasPressures.find(x => x.compartmentId === "head")?.temperatureK).toBeCloseTo(301, 12);
  });

  it("gas transport conserves system matter and uses post-reaction inventory", () => {
    const s = baseState(true);
    const before = aggregateSystemMatterInventory(s.matterSystem);
    const r = runPhase4AAuthoritativeTimestep(s, cfg(reaction(0), true));
    expect(r.status).toBe("COMMITTED");
    if (r.status !== "COMMITTED") return;
    expect(amount(r.state, "atm", "H")).toBeGreaterThan(0);
    const after = aggregateSystemMatterInventory(r.state.matterSystem);
    expect(after.elementsMol).toEqual(before.elementsMol);
    expect(after.atomAmountMol).toBeCloseTo(before.atomAmountMol, 12);
    expect(after.netChargeAmountMol).toBeCloseTo(before.netChargeAmountMol, 12);
  });

  it("same-target multi-heater regression remains bounded through orchestrator", () => {
    const c = cfg(noReaction);
    const hs: ThermalPowerActuator[] = [1,2,3,4,5].map(i => ({
      id: "h"+i, bodyId: "vessel", enabled: true, mode: "HEATER" as const,
      powerW: 1e9, targetTemperatureK: 400, apparatusKind: "OTHER" as const,
      scientificStatus: "APPROXIMATED" as const,
    }));
    c.dtS = 1000;
    c.thermal = { actuators: hs };
    const r = runPhase4AAuthoritativeTimestep(baseState(), c);
    expect(r.status).toBe("COMMITTED");
    if (r.status !== "COMMITTED") return;
    expect(vesselT(r.state)).toBeCloseTo(400, 10);
  });

  it("deterministic exact replay returns identical state/audit/provider", () => {
    const s = baseState(true);
    const c = cfg(reaction(100), true);
    const a = runPhase4AAuthoritativeTimestep(s, c);
    const b = runPhase4AAuthoritativeTimestep(s, c);
    expect(b).toEqual(a);
  });

  it("invalid initial Kelvin rejects without partial state", () => {
    const s = baseState();
    const bad: Phase4ARuntimeState = {
      ...s,
      thermalBodies: s.thermalBodies.map(b => b.id === "vessel" ? { ...b, state: { ...b.state, temperatureK: 0 } } : b),
      reactionNetwork: { ...s.reactionNetwork, thermalState: { ...s.reactionNetwork.thermalState, temperatureK: 0 } },
    };
    const r = runPhase4AAuthoritativeTimestep(bad, cfg(noReaction));
    expect(r.status).toBe("REJECTED");
    expect(r.state).toBe(bad);
  });

  it("unsupported reaction-to-headspace routing stays OPEN without fabricated insertion", () => {
    const s = baseState();
    const contents = createMatterCompartment({
      id: "contents", kind: "VESSEL_CONTENTS", species: [species("H2", 1)], volumeM3: 0.01, ownerApparatusId: "vessel",
    });
    const head = createMatterCompartment({
      id: "head", kind: "VESSEL_HEADSPACE", species: [], volumeM3: 0.01, ownerApparatusId: "vessel",
    });
    const routed: Phase4ARuntimeState = {
      ...s,
      matterSystem: { compartments: [contents, head] },
      reactionNetwork: { ...s.reactionNetwork, species: contents.species },
    };
    const c = cfg(reaction(0));
    c.reactionCompartmentId = "contents";
    c.gas.thermalBodyByCompartmentId = { head: "vessel" };
    c.gas.primaryPressureCompartmentId = "head";
    const r = runPhase4AAuthoritativeTimestep(routed, c);
    expect(r.status).toBe("OPEN");
    expect(r.state).toBe(routed);
    if (r.status === "OPEN") expect(r.reasonCode).toBe("REACTION_GAS_SOURCE_ROUTING_OPEN");
  });
});
