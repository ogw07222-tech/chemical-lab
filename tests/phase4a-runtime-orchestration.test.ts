import { describe, expect, it } from "vitest";
import {
  aggregateSystemMatterInventory,
  createMatterCompartment,
  type MatterSystemState,
} from "../src/simulation/compartment";
import {
  createMoleculeRecord,
  type ElementDefinition,
  type ElementProvider,
  type SpeciesState,
} from "../src/simulation/molecular";
import {
  createThermalState,
  type ThermalBody,
  type ThermalPowerActuator,
} from "../src/simulation/thermal";
import {
  runPhase4AAuthoritativeTimestep,
  type Phase4AReactionStageExecutor,
  type Phase4ARuntimeState,
  type Phase4ARuntimeStepConfig,
} from "../src/integration/phase4a-runtime-orchestration";

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
    return symbol === "H" ? H : undefined;
  },
};
const h2 = createMoleculeRecord({
  atoms: [
    { id: "h1", element: "H", formalCharge: 0 },
    { id: "h2", element: "H", formalCharge: 0 },
  ],
  bonds: [{ id: "hh", a: "h1", b: "h2", kind: "covalent", order: 1 }],
}, elements);
const h = createMoleculeRecord({
  atoms: [{ id: "h", element: "H", formalCharge: 0 }],
  bonds: [],
}, elements);
const gasPhase = {
  phase: "gas" as const,
  source: "phase4a-runtime-test",
  phaseStateId: "gas:runtime-test",
  scientificStatus: "APPROXIMATED" as const,
};

function species(id: string, amountMol: number, molecule = h2): SpeciesState {
  return { id, amountMol, molecule, phaseState: gasPhase };
}

function thermalBody(
  id: string,
  temperatureK = 300,
  capacityJPerK = 100,
  kind: ThermalBody["kind"] = "VESSEL",
): ThermalBody {
  return {
    id,
    kind,
    state: createThermalState({
      temperatureK,
      mixtureHeatCapacity_JPerK: capacityJPerK,
      vesselHeatCapacity_JPerK: 0,
    }),
    scientificStatus: "APPROXIMATED",
    source: "phase4a-runtime-test",
  };
}

function baseState(options: {
  connection?: boolean;
  atmosphereAmount?: number;
  headAmount?: number;
  atmosphereTemperatureK?: number;
} = {}): Phase4ARuntimeState {
  const head = createMatterCompartment({
    id: "head",
    kind: "VESSEL_HEADSPACE",
    species: [species("H2", options.headAmount ?? 1)],
    volumeM3: 0.01,
    ownerApparatusId: "vessel",
  });
  const atmosphere = createMatterCompartment({
    id: "atm",
    kind: "LAB_ATMOSPHERE",
    species:
      (options.atmosphereAmount ?? 0) > 0
        ? [species("H2", options.atmosphereAmount ?? 0)]
        : [],
    volumeM3: 0.01,
  });
  const matterSystem: MatterSystemState = {
    compartments: [head, atmosphere],
    ...(options.connection
      ? {
          connections: [{
            id: "head-atm",
            sourceCompartmentId: "head",
            destinationCompartmentId: "atm",
            kind: "GAS" as const,
            enabled: true,
          }],
        }
      : {}),
  };
  const vessel = thermalBody("vessel", 300, 100);
  const ambient = thermalBody(
    "ambient",
    options.atmosphereTemperatureK ?? 300,
    1000,
    "LAB_ENVIRONMENT",
  );
  return {
    matterSystem,
    thermalBodies: [vessel, ambient],
    reactionNetwork: {
      species: head.species,
      thermalState: vessel.state,
      speciesRegistry: {} as never,
      simTimeS: 0,
      completedTimesteps: 0,
      timelineEvents: [],
    },
  };
}

const noReaction: Phase4AReactionStageExecutor = ({ state }) => ({
  speciesAfter: state.species,
  speciesRegistry: state.speciesRegistry,
  progressEvents: [],
  netSpeciesAmountDeltaMol: {},
  knownReactionHeat_J: 0,
  thermalCoverage: "COMPLETE",
  thermalScientificStatus: "VERIFIED",
  missingHeatCandidateIds: [],
  reversiblePairs: [],
});

function dissociationReaction(
  heatJ: number,
  options: {
    coverage?: "COMPLETE" | "PARTIAL" | "OPEN";
    status?: "VERIFIED" | "APPROXIMATED" | "OPEN";
  } = {},
): Phase4AReactionStageExecutor {
  return ({ state, dtS, timestepId }) => {
    const h2State = state.species.find((entry) => entry.id === "H2");
    if (!h2State || h2State.amountMol < 0.5) return noReaction({
      state,
      reactionInput: { elements },
      reactionConfig: {} as never,
      dtS,
      timestepId,
    });
    const after: SpeciesState[] = [
      species("H2", h2State.amountMol - 0.5),
      species("H", 1, h),
    ];
    return {
      speciesAfter: after,
      speciesRegistry: state.speciesRegistry,
      progressEvents: [{
        id: `${timestepId}:reaction:0`,
        timestepId,
        candidateId: "synthetic-dissociation",
        sequence: 0,
        startTimeS: state.simTimeS,
        endTimeS: state.simTimeS + dtS,
        dtS,
        extentMol: 0.5,
        reactantDeltasMol: { H2: -0.5 },
        productDeltasMol: { H: 1 },
        speciesAmountDeltaMol: { H2: -0.5, H: 1 },
        deltaH_JPerMolExtent: heatJ === 0 ? 0 : -heatJ / 0.5,
        heatJ,
        scientificStatus: options.status ?? "APPROXIMATED",
        reasonCodes: ["SELECTED", "REACTION_HEAT_APPLIED"],
      }],
      netSpeciesAmountDeltaMol: { H2: -0.5, H: 1 },
      knownReactionHeat_J: heatJ,
      thermalCoverage: options.coverage ?? "COMPLETE",
      thermalScientificStatus: options.status ?? "APPROXIMATED",
      missingHeatCandidateIds:
        options.coverage && options.coverage !== "COMPLETE"
          ? ["synthetic-dissociation"]
          : [],
      reversiblePairs: [],
    };
  };
}

function config(
  executor: Phase4AReactionStageExecutor = noReaction,
  options: {
    connection?: boolean;
    actuators?: readonly ThermalPowerActuator[];
    connectionModels?: Phase4ARuntimeStepConfig["gas"]["connectionModels"];
    timestepId?: string;
  } = {},
): Phase4ARuntimeStepConfig {
  return {
    dtS: 1,
    timestepId: options.timestepId ?? "step-1",
    reactionCompartmentId: "head",
    vesselThermalBodyId: "vessel",
    reactionInput: { elements },
    reactionConfig: {} as Phase4ARuntimeStepConfig["reactionConfig"],
    reactionExecutor: executor,
    gas: {
      connectionModels:
        options.connectionModels ??
        (options.connection
          ? [{
              connectionId: "head-atm",
              bulkMolarConductanceMolPerSPaS: 1e-8,
              diffusiveMolarConductanceMolPerSPaS: 0,
              scientificStatus: "APPROXIMATED" as const,
              source: "runtime-test",
            }]
          : []),
      thermalBodyByCompartmentId: {
        head: "vessel",
        atm: "ambient",
      },
      primaryPressureCompartmentId: "head",
    },
    thermal: {
      actuators: options.actuators,
    },
  };
}

function amount(state: Phase4ARuntimeState, compartmentId: string, speciesId: string): number {
  return state.matterSystem.compartments
    .find((entry) => entry.id === compartmentId)?.species
    .find((entry) => entry.id === speciesId)?.amountMol ?? 0;
}

function vesselTemperature(state: Phase4ARuntimeState): number {
  return state.thermalBodies.find((entry) => entry.id === "vessel")!.state.temperatureK;
}

function normalizedMatter(state: Phase4ARuntimeState) {
  return state.matterSystem.compartments
    .map((compartment) => ({
      id: compartment.id,
      species: [...compartment.species]
        .map((entry) => [entry.id, entry.amountMol] as const)
        .sort(([a], [b]) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe("Phase 4A authoritative runtime orchestration", () => {
  it("1. reaction only commits reaction matter and heat once", () => {
    const state = baseState();
    const result = runPhase4AAuthoritativeTimestep(
      state,
      config(dissociationReaction(100)),
    );
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(amount(result.state, "head", "H2")).toBeCloseTo(0.5, 12);
    expect(amount(result.state, "head", "H")).toBeCloseTo(1, 12);
    expect(result.audit.reactionEnergyJ).toBe(100);
    expect(vesselTemperature(result.state)).toBeCloseTo(301, 12);
  });

  it("2. gas transport only uses Phase 4A-1 commit authority", () => {
    const state = baseState({ connection: true });
    const result = runPhase4AAuthoritativeTimestep(
      state,
      config(noReaction, { connection: true }),
    );
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(amount(result.state, "head", "H2")).toBeLessThan(1);
    expect(amount(result.state, "atm", "H2")).toBeGreaterThan(0);
    expect(result.audit.transportRequests.length).toBeGreaterThan(0);
  });

  it("3. thermal apparatus only commits actuator energy once", () => {
    const state = baseState();
    const heater: ThermalPowerActuator = {
      id: "heater",
      bodyId: "vessel",
      enabled: true,
      mode: "HEATER",
      powerW: 50,
      apparatusKind: "OTHER",
      scientificStatus: "APPROXIMATED",
    };
    const result = runPhase4AAuthoritativeTimestep(
      state,
      config(noReaction, { actuators: [heater] }),
    );
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(result.audit.externalEnergyJ).toBeCloseTo(50, 12);
    expect(vesselTemperature(result.state)).toBeCloseTo(300.5, 12);
  });

  it("4. reaction + thermal double-count regression gives Q + apparatus exactly once", () => {
    const heater: ThermalPowerActuator = {
      id: "heater",
      bodyId: "vessel",
      enabled: true,
      mode: "HEATER",
      powerW: 50,
      apparatusKind: "OTHER",
      scientificStatus: "APPROXIMATED",
    };
    const result = runPhase4AAuthoritativeTimestep(
      baseState(),
      config(dissociationReaction(100), { actuators: [heater] }),
    );
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(result.audit.reactionEnergyJ).toBeCloseTo(100, 12);
    expect(result.audit.externalEnergyJ).toBeCloseTo(50, 12);
    expect(vesselTemperature(result.state)).toBeCloseTo(301.5, 12);
    expect(result.state.reactionNetwork.thermalState.cumulativeEnergy.reactionHeat_J)
      .toBeCloseTo(100, 12);
  });

  it("5. gas + thermal keeps gas amount fixed in sealed vessel and updates pressure from final T", () => {
    const heater: ThermalPowerActuator = {
      id: "heater",
      bodyId: "vessel",
      enabled: true,
      mode: "HEATER",
      powerW: 100,
      apparatusKind: "OTHER",
      scientificStatus: "APPROXIMATED",
    };
    const result = runPhase4AAuthoritativeTimestep(
      baseState(),
      config(noReaction, { actuators: [heater] }),
    );
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(amount(result.state, "head", "H2")).toBeCloseTo(1, 12);
    expect(result.audit.finalPressurePa).toBeDefined();
    expect(result.provider.gasPressures.find((entry) => entry.compartmentId === "head")?.temperatureK)
      .toBeCloseTo(301, 12);
  });

  it("6. reaction + gas transport lets post-reaction inventory fund transport", () => {
    const result = runPhase4AAuthoritativeTimestep(
      baseState({ connection: true }),
      config(dissociationReaction(0), { connection: true }),
    );
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(amount(result.state, "atm", "H")).toBeGreaterThan(0);
    expect(result.audit.transportMatterDeltaMol["atm:H"]).toBeGreaterThan(0);
  });

  it("7. reaction + gas + thermal produces one completed provider state", () => {
    const heater: ThermalPowerActuator = {
      id: "heater",
      bodyId: "vessel",
      enabled: true,
      mode: "HEATER",
      powerW: 20,
      apparatusKind: "OTHER",
      scientificStatus: "APPROXIMATED",
    };
    const result = runPhase4AAuthoritativeTimestep(
      baseState({ connection: true }),
      config(dissociationReaction(100), {
        connection: true,
        actuators: [heater],
      }),
    );
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(result.provider.simulationTimeS).toBe(1);
    expect(result.provider.reaction.activeReactionEvents).toHaveLength(1);
    expect(result.provider.reaction.activeReactionEvents[0]?.reactionHeat_J).toBe(100);
    expect(result.provider.thermalBodies.find((entry) => entry.bodyId === "vessel")?.temperatureK)
      .toBeCloseTo(vesselTemperature(result.state), 12);
  });

  it("8. sealed vessel performs no transport", () => {
    const result = runPhase4AAuthoritativeTimestep(baseState(), config(noReaction));
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(result.audit.transportRequests).toEqual([]);
    expect(amount(result.state, "head", "H2")).toBeCloseTo(1, 12);
  });

  it("9. explicit open-atmosphere connection moves matter without deletion", () => {
    const state = baseState({ connection: true });
    const before = aggregateSystemMatterInventory(state.matterSystem);
    const result = runPhase4AAuthoritativeTimestep(
      state,
      config(noReaction, { connection: true }),
    );
    expect(result.status).toBe("COMMITTED");
    if (result.status !== "COMMITTED") return;
    expect(aggregateSystemMatterInventory(result.state.matterSystem).elementsMol)
      .toEqual(before.elementsMol);
    expect(amount(result.state, "atm", "H2")).toBeGreaterThan(0);
  });

  it("10. multiple gas connections are permutation-invariant", () => {
    const state = baseState({ connection: true });
    const collector = createMatterCompartment({
      id: "collector",
      kind: "GAS_COLLECTOR",
      species: [],
      volumeM3: 0.01,
    });
    const expanded: Phase4ARuntimeState = {
      ...state,
      matterSystem: {
        ...state.matterSystem,
        compartments: [...state.matterSystem.compartments, collector],
        connections: [
          ...(state.matterSystem.connections ?? []),
          {
            id: "head-collector",
            sourceCompartmentId: "head",
            destinationCompartmentId: "collector",
            kind: "GAS",
            enabled: true,
          },
        ],
      },
      thermalBodies: [...state.thermalBodies, thermalBody("collector-body", 300, 500)],
    };
    const models = [
      {
        connectionId: "head-atm",
        bulkMolarConductanceMolPerSPaS: 1e-8,
        scientificStatus: "APPROXIMATED" as const,
      },
      {
        connectionId: "head-collector",
        bulkMolarConductanceMolPerSPaS: 1e-8,
        scientificStatus: "APPROXIMATED" as const,
      },
    ];
    const baseConfig = config(noReaction, { connection: true, connectionModels: models });
    baseConfig.gas.thermalBodyByCompartmentId = {
      ...baseConfig.gas.thermalBodyByCompartmentId,
      collector: "collector-body",
    };
    const reversedConfig = {
      ...baseConfig,
      gas: { ...baseConfig.gas, connectionModels: [...models].reverse() },
    };
    const first = runPhase4AAuthoritativeTimestep(expanded, baseConfig);
    const second = runPhase4AAuthoritativeTimestep(expanded, reversedConfig);
    expect(first.status).toBe("COMMITTED");
    expect(second.status).toBe("COMMITTED");
    if (first.status !== "COMMITTED" || second.status !== "COMMITTED") return;
    expect(normalizedMatter(first.state)).toEqual(normalizedMatter(second.state));
  });

  it("11. multiple thermal actuators are permutation-invariant", () => {
    const actuators: ThermalPowerActuator[] = [
      {
        id: "heater-a",
        bodyId: "vessel",
        enabled: true,
        mode: "HEATER",
        powerW: 40,
        apparatusKind: "OTHER",
        scientificStatus: "APPROXIMATED",
      },
      {
        id: "heater-b",
        bodyId: "vessel",
        enabled: true,
        mode: "HEATER",
        powerW: 60,
        apparatusKind: "OTHER",
        scientificStatus: "APPROXIMATED",
      },
    ];
    const first = runPhase4AAuthoritativeTimestep(
      baseState(),
      config(noReaction, { actuators }),
    );
    const second = runPhase4AAuthoritativeTimestep(
      baseState(),
      config(noReaction, { actuators: [...actuators].reverse() }),
    );
    expect(first.status).toBe("COMMITTED");
    expect(second.status).toBe("COMMITTED");
    if (first.status !== "COMMITTED" || second.status !== "COMMITTED") return;
    expect(vesselTemperature(first.state)).toBeCloseTo(vesselTemperature(second.state), 12);
    expect(first.audit.externalEnergyJ).toBeCloseTo(second.audit.externalEnergyJ, 12);
  });

  it("12. invalid stage input rejects atomically", () => {
    const state = baseState();
    const invalid: Phase4ARuntimeState = {
      ...state,
      thermalBodies: state.thermalBodies.map((body) =>
        body.id === "vessel"
          ? { ...body, state: { ...body.state, temperatureK: 0 } }
          : body),
      reactionNetwork: {
        ...state.reactionNetwork,
        thermalState: { ...state.reactionNetwork.thermalState, temperatureK: 0 },
      },
    };
    const result = runPhase4AAuthoritativeTimestep(invalid, config(noReaction));
    expect(result.status).toBe("REJECTED");
    expect(result.state).toBe(invalid);
  });

  it("13. OPEN gas subsystem rolls back rather than inventing zero transport", () => {
    const state = baseState({ connection: true });
    const result = runPhase4AAuthoritativeTimestep(
      state,
      config(noReaction, {
        connection: true,
        connectionModels: [{
          connectionId: "head-atm",
          bulkMolarConductanceMolPerSPaS: -1,
          scientificStatus: "APPROXIMATED",
        }],
      }),
    );
    expect(result.status).toBe("OPEN");
    expect(result.state).toBe(state);
    if (result.status === "OPEN") expect(result.reasonCode).toBe("GAS_TRANSPORT_OPEN");
  });

  it("14. deterministic replay returns identical audit/provider/state facts", () => {
    const state = baseState({ connection: true });
    const stepConfig = config(dissociationReaction(100), { connection: true });
    const first = runPhase4AAuthoritativeTimestep(state, stepConfig);
    const second = runPhase4AAuthoritativeTimestep(state, stepConfig);
    expect(first.status).toBe("COMMITTED");
    expect(second.status).toBe("COMMITTED");
    if (first.status !== "COMMITTED" || second.status !== "COMMITTED") return;
    expect(first.audit).toEqual(second.audit);
    expect(first.provider).toEqual(second.provider);
    expect(normalizedMatter(first.state)).toEqual(normalizedMatter(second.state));
    expect(vesselTemperature(first.state)).toBe(vesselTemperature(second.state));
  });

  it("15. reaction heat OPEN rolls back the whole staged timestep", () => {
    const state = baseState();
    const result = runPhase4AAuthoritativeTimestep(
      state,
      config(dissociationReaction(0, { coverage: "OPEN", status: "OPEN" })),
    );
    expect(result.status).toBe("OPEN");
    expect(result.state).toBe(state);
    if (result.status === "OPEN") expect(result.reasonCode).toBe("REACTION_THERMAL_OPEN");
  });

  it("16. multi-step run remains finite, deterministic, and matter-conserving", () => {
    const start = baseState({ connection: true, atmosphereAmount: 0.1 });
    const inventory = aggregateSystemMatterInventory(start.matterSystem);
    const run = (): Phase4ARuntimeState => {
      let state = start;
      for (let index = 0; index < 20; index += 1) {
        const result = runPhase4AAuthoritativeTimestep(
          state,
          config(noReaction, { connection: true, timestepId: `step-${index}` }),
        );
        expect(result.status).toBe("COMMITTED");
        if (result.status !== "COMMITTED") throw new Error(result.message);
        state = result.state;
      }
      return state;
    };
    const first = run();
    const second = run();
    expect(normalizedMatter(first)).toEqual(normalizedMatter(second));
    expect(vesselTemperature(first)).toBe(vesselTemperature(second));
    const finalInventory = aggregateSystemMatterInventory(first.matterSystem);
    expect(finalInventory.elementsMol).toEqual(inventory.elementsMol);
    expect(finalInventory.atomAmountMol).toBeCloseTo(inventory.atomAmountMol, 12);
    expect(Number.isFinite(vesselTemperature(first))).toBe(true);
    expect(first.reactionNetwork.simTimeS).toBe(20);
  });

  it("marks reaction gas source routing OPEN instead of inventing headspace insertion", () => {
    const state = baseState();
    const contents = createMatterCompartment({
      id: "contents",
      kind: "VESSEL_CONTENTS",
      species: [species("H2", 1)],
      volumeM3: 0.01,
      ownerApparatusId: "vessel",
    });
    const head = createMatterCompartment({
      id: "head",
      kind: "VESSEL_HEADSPACE",
      species: [],
      volumeM3: 0.01,
      ownerApparatusId: "vessel",
    });
    const routedOpenState: Phase4ARuntimeState = {
      ...state,
      matterSystem: { compartments: [contents, head] },
      reactionNetwork: { ...state.reactionNetwork, species: contents.species },
    };
    const stepConfig = config(dissociationReaction(0));
    stepConfig.reactionCompartmentId = "contents";
    stepConfig.gas.thermalBodyByCompartmentId = { head: "vessel" };
    stepConfig.gas.primaryPressureCompartmentId = "head";
    const result = runPhase4AAuthoritativeTimestep(routedOpenState, stepConfig);
    expect(result.status).toBe("OPEN");
    if (result.status === "OPEN") {
      expect(result.reasonCode).toBe("REACTION_GAS_SOURCE_ROUTING_OPEN");
    }
    expect(result.state).toBe(routedOpenState);
  });
});
