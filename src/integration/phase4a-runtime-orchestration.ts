import {
  aggregateSystemMatterInventory,
  transferMatterBatch,
  type CompartmentId,
  type MatterCompartmentState,
  type MatterSystemState,
  type MatterTransferRequest,
} from "../simulation/compartment";
import {
  evaluateGasTransport,
  evaluateIdealGasCompartment,
  type GasConnectionTransportModel,
  type GasPressureEvaluation,
  type GasTransportEvaluation,
} from "../simulation/gas-transport";
import type {
  ScientificStatus,
  SpeciesId,
  SpeciesState,
} from "../simulation/molecular";
import type { ReactionProgressEvent } from "../simulation/reaction-progression";
import type { DynamicSpeciesRegistryLike } from "../simulation/species-registry";
import {
  evaluateThermalApparatusStep,
  validateThermalState,
  type ThermalApparatusEvaluation,
  type ThermalBody,
  type ThermalBodyId,
  type ThermalContact,
  type ThermalPowerActuator,
  type ThermalReservoirBoundary,
} from "../simulation/thermal";
import {
  projectPhase3BReactionProgressEvent,
  runPhase3BReactionNetworkStep,
  type Phase3BProviderProjection,
  type Phase3BReactionNetworkStepConfig,
  type Phase3BReactionNetworkStepResult,
  type ReversiblePairArbitrationFact,
} from "./phase3b-reversible-arbitration";
import type {
  Phase3AReactionNetworkInput,
  Phase3AReactionNetworkState,
} from "./phase3a-reaction-network";

const DEFAULT_AMOUNT_TOLERANCE_MOL = 1e-12;
const CONSERVATION_TOLERANCE_MOL = 1e-10;

const STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

function worstStatus(values: readonly ScientificStatus[]): ScientificStatus {
  return values.reduce(
    (worst, current) =>
      STATUS_ORDER[current] > STATUS_ORDER[worst] ? current : worst,
    "VERIFIED",
  );
}

export interface Phase4AReactionStageResult {
  speciesAfter: readonly SpeciesState[];
  speciesRegistry: DynamicSpeciesRegistryLike;
  progressEvents: readonly ReactionProgressEvent[];
  netSpeciesAmountDeltaMol: Readonly<Record<SpeciesId, number>>;
  knownReactionHeat_J: number;
  thermalCoverage: "COMPLETE" | "PARTIAL" | "OPEN";
  thermalScientificStatus: ScientificStatus;
  missingHeatCandidateIds: readonly string[];
  reversiblePairs: readonly ReversiblePairArbitrationFact[];
}

export type Phase4AReactionStageExecutor = (input: {
  state: Phase3AReactionNetworkState;
  reactionInput: Phase3AReactionNetworkInput;
  reactionConfig: Omit<
    Phase3BReactionNetworkStepConfig,
    "dtS" | "timestepId" | "externalThermal"
  >;
  dtS: number;
  timestepId: string;
  reactionCompartmentVolumeM3?: number;
}) => Phase4AReactionStageResult;

export interface Phase4AGasStageConfig {
  connectionModels: readonly GasConnectionTransportModel[];
  /**
   * Explicit mapping from gas-capable matter compartments to authoritative
   * finite thermal bodies. The transport stage reads these temperatures from
   * the immutable pre-thermal snapshot.
   */
  thermalBodyByCompartmentId: Readonly<Record<CompartmentId, ThermalBodyId>>;
  /** Optional primary pressure fact for compact audit/provider consumers. */
  primaryPressureCompartmentId?: CompartmentId;
}

export interface Phase4AThermalStageConfig {
  contacts?: readonly ThermalContact[];
  reservoirs?: readonly ThermalReservoirBoundary[];
  actuators?: readonly ThermalPowerActuator[];
}

export interface Phase4ARuntimeStepConfig {
  dtS: number;
  timestepId: string;
  reactionCompartmentId: CompartmentId;
  vesselThermalBodyId: ThermalBodyId;
  reactionInput: Phase3AReactionNetworkInput;
  reactionConfig: Omit<
    Phase3BReactionNetworkStepConfig,
    "dtS" | "timestepId" | "externalThermal"
  >;
  gas: Phase4AGasStageConfig;
  thermal?: Phase4AThermalStageConfig;
  amountToleranceMol?: number;
  reactionExecutor?: Phase4AReactionStageExecutor;
}

export interface Phase4ARuntimeState {
  /**
   * Phase 3 state retains registry/timeline/clock. Its species and thermalState
   * must mirror the authoritative matter compartment and vessel ThermalBody.
   */
  reactionNetwork: Phase3AReactionNetworkState;
  matterSystem: MatterSystemState;
  thermalBodies: readonly ThermalBody[];
}

export interface Phase4AThermalProviderFact {
  bodyId: ThermalBodyId;
  temperatureK: number;
  scientificStatus: ScientificStatus;
}

export interface Phase4ARuntimeProviderProjection {
  simulationTimeS: number;
  scientificStatus: ScientificStatus;
  reaction: Phase3BProviderProjection;
  gasPressures: readonly GasPressureEvaluation[];
  thermalBodies: readonly Phase4AThermalProviderFact[];
}

export interface Phase4ARuntimeAudit {
  timestepId: string;
  reactionMatterDeltaMol: Readonly<Record<SpeciesId, number>>;
  transportRequests: readonly MatterTransferRequest[];
  transportMatterDeltaMol: Readonly<Record<string, number>>;
  reactionEnergyJ: number;
  internalTransferEnergyJ: number;
  externalEnergyJ: number;
  finalTemperatureK?: number;
  finalPressurePa?: number;
  gasScientificStatus: ScientificStatus;
  thermalScientificStatus: ScientificStatus;
  scientificStatus: ScientificStatus;
  reactionGasRoutingOpen: boolean;
}

export type Phase4ARuntimeReasonCode =
  | "INVALID_RUNTIME_INPUT"
  | "REACTION_STAGE_FAILED"
  | "REACTION_MATTER_CONSERVATION_FAILURE"
  | "REACTION_GAS_SOURCE_ROUTING_OPEN"
  | "REACTION_THERMAL_OPEN"
  | "GAS_TRANSPORT_OPEN"
  | "GAS_TRANSPORT_COMMIT_REJECTED"
  | "THERMAL_STAGE_OPEN"
  | "FINAL_PRESSURE_OPEN"
  | "FINAL_CONSERVATION_FAILURE";

export interface Phase4ARuntimeCommittedResult {
  status: "COMMITTED";
  state: Phase4ARuntimeState;
  audit: Phase4ARuntimeAudit;
  provider: Phase4ARuntimeProviderProjection;
}

export interface Phase4ARuntimeOpenResult {
  status: "OPEN";
  state: Phase4ARuntimeState;
  reasonCode: Phase4ARuntimeReasonCode;
  message: string;
  audit?: Partial<Phase4ARuntimeAudit>;
}

export interface Phase4ARuntimeRejectedResult {
  status: "REJECTED";
  state: Phase4ARuntimeState;
  reasonCode: Phase4ARuntimeReasonCode;
  message: string;
}

export type Phase4ARuntimeStepResult =
  | Phase4ARuntimeCommittedResult
  | Phase4ARuntimeOpenResult
  | Phase4ARuntimeRejectedResult;

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function cloneSpecies(species: readonly SpeciesState[]): readonly SpeciesState[] {
  return species.map((entry) => ({
    ...entry,
    phaseState: { ...entry.phaseState },
    ...(entry.metadata ? { metadata: { ...entry.metadata } } : {}),
  }));
}

function snapshotMatterSystem(system: MatterSystemState): MatterSystemState {
  return {
    compartments: system.compartments.map((compartment) => ({
      ...compartment,
      species: cloneSpecies(compartment.species),
      ...(compartment.environment
        ? {
            environment: {
              ...compartment.environment,
              ...(compartment.environment.metadata
                ? { metadata: { ...compartment.environment.metadata } }
                : {}),
            },
          }
        : {}),
      ...(compartment.metadata ? { metadata: { ...compartment.metadata } } : {}),
    })),
    ...(system.connections
      ? { connections: system.connections.map((connection) => ({ ...connection })) }
      : {}),
  };
}

function assertRuntimeMatterState(system: MatterSystemState): void {
  const compartmentIds = new Set<string>();
  for (const compartment of system.compartments) {
    if (!compartment.id || compartmentIds.has(compartment.id)) {
      throw new Error("duplicate or empty compartment id");
    }
    compartmentIds.add(compartment.id);
    if (
      compartment.volumeM3 !== undefined &&
      (!Number.isFinite(compartment.volumeM3) || compartment.volumeM3 < 0)
    ) {
      throw new Error(`invalid volume for compartment ${compartment.id}`);
    }
    const speciesIds = new Set<string>();
    for (const species of compartment.species) {
      if (
        !species.id ||
        speciesIds.has(species.id) ||
        !finiteNonNegative(species.amountMol)
      ) {
        throw new Error(`invalid species state in compartment ${compartment.id}`);
      }
      speciesIds.add(species.id);
    }
  }
}

function assertRuntimeThermalBodies(bodies: readonly ThermalBody[]): void {
  const ids = new Set<string>();
  for (const body of bodies) {
    if (!body.id || ids.has(body.id)) throw new Error("duplicate or empty thermal body id");
    ids.add(body.id);
    validateThermalState(body.state);
  }
}

function speciesEquivalent(
  a: readonly SpeciesState[],
  b: readonly SpeciesState[],
  toleranceMol: number,
): boolean {
  const as = [...a].sort((x, y) => x.id.localeCompare(y.id));
  const bs = [...b].sort((x, y) => x.id.localeCompare(y.id));
  if (as.length !== bs.length) return false;
  for (let index = 0; index < as.length; index += 1) {
    const left = as[index]!;
    const right = bs[index]!;
    if (
      left.id !== right.id ||
      left.molecule.canonicalKey !== right.molecule.canonicalKey ||
      left.phaseState.phase !== right.phaseState.phase ||
      Math.abs(left.amountMol - right.amountMol) > toleranceMol
    ) {
      return false;
    }
  }
  return true;
}

function thermalStateEquivalent(a: ThermalBody["state"], b: ThermalBody["state"]): boolean {
  return (
    a.temperatureK === b.temperatureK &&
    a.mixtureHeatCapacity_JPerK === b.mixtureHeatCapacity_JPerK &&
    a.vesselHeatCapacity_JPerK === b.vesselHeatCapacity_JPerK &&
    JSON.stringify(a.cumulativeEnergy) === JSON.stringify(b.cumulativeEnergy)
  );
}

function recordClose(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
  tolerance: number,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (Math.abs((a[key] ?? 0) - (b[key] ?? 0)) > tolerance) return false;
  }
  return true;
}

function conservedChemicalInventory(
  before: ReturnType<typeof aggregateSystemMatterInventory>,
  after: ReturnType<typeof aggregateSystemMatterInventory>,
  tolerance = CONSERVATION_TOLERANCE_MOL,
): boolean {
  return (
    recordClose(before.elementsMol, after.elementsMol, tolerance) &&
    Math.abs(before.atomAmountMol - after.atomAmountMol) <= tolerance &&
    Math.abs(before.netChargeAmountMol - after.netChargeAmountMol) <= tolerance
  );
}

function replaceCompartmentSpecies(
  system: MatterSystemState,
  compartmentId: CompartmentId,
  species: readonly SpeciesState[],
): MatterSystemState {
  let found = false;
  const compartments = system.compartments.map((compartment) => {
    if (compartment.id !== compartmentId) return compartment;
    found = true;
    return { ...compartment, species: cloneSpecies(species) };
  });
  if (!found) throw new Error(`reaction compartment not found: ${compartmentId}`);
  return { ...system, compartments };
}

function bodyMap(bodies: readonly ThermalBody[]): Map<ThermalBodyId, ThermalBody> {
  return new Map(bodies.map((body) => [body.id, body] as const));
}

function gasThermodynamicInputs(
  bodies: readonly ThermalBody[],
  mapping: Readonly<Record<CompartmentId, ThermalBodyId>>,
): readonly { compartmentId: CompartmentId; temperatureK: number }[] {
  const thermal = bodyMap(bodies);
  return Object.entries(mapping)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([compartmentId, bodyId]) => {
      const body = thermal.get(bodyId);
      if (!body) throw new Error(`missing thermal body ${bodyId} for ${compartmentId}`);
      return { compartmentId, temperatureK: body.state.temperatureK };
    });
}

function validateMappedGasCompartments(
  system: MatterSystemState,
  mapping: Readonly<Record<CompartmentId, ThermalBodyId>>,
): void {
  const compartments = new Map(system.compartments.map((entry) => [entry.id, entry] as const));
  for (const compartmentId of Object.keys(mapping)) {
    const compartment = compartments.get(compartmentId);
    if (!compartment) throw new Error(`missing mapped gas compartment ${compartmentId}`);
    if (!finitePositive(compartment.volumeM3 ?? Number.NaN)) {
      throw new Error(`mapped gas compartment ${compartmentId} requires volumeM3 > 0`);
    }
    for (const species of compartment.species) {
      if (!finiteNonNegative(species.amountMol)) {
        throw new Error(`invalid gas species amount in ${compartmentId}`);
      }
    }
  }
}

function defaultReactionExecutor(input: Parameters<Phase4AReactionStageExecutor>[0]): Phase4AReactionStageResult {
  const config: Phase3BReactionNetworkStepConfig = {
    ...input.reactionConfig,
    dtS: input.dtS,
    timestepId: input.timestepId,
    ...(input.reactionConfig.volumeM3 === undefined &&
    input.reactionCompartmentVolumeM3 !== undefined
      ? { volumeM3: input.reactionCompartmentVolumeM3 }
      : {}),
  };
  const result: Phase3BReactionNetworkStepResult = runPhase3BReactionNetworkStep(
    input.state,
    input.reactionInput,
    config,
  );
  return {
    speciesAfter: result.nextState.species,
    speciesRegistry: result.nextState.speciesRegistry,
    progressEvents: result.step.resolution.progressEvents,
    netSpeciesAmountDeltaMol: result.step.resolution.netSpeciesAmountDeltaMol,
    knownReactionHeat_J: result.step.thermal.knownReactionHeat_J,
    thermalCoverage: result.step.thermal.thermalCoverage ?? "OPEN",
    thermalScientificStatus: result.step.thermal.scientificStatus,
    missingHeatCandidateIds:
      result.step.thermal.missingHeatCandidateIds ??
      result.step.thermal.openHeatCandidateIds ??
      [],
    reversiblePairs: result.arbitration.pairs,
  };
}

function enabledGasConnectionExists(system: MatterSystemState): boolean {
  return (system.connections ?? []).some(
    (connection) => connection.enabled && connection.kind === "GAS",
  );
}

function emptyGasEvaluation(): GasTransportEvaluation {
  return {
    scientificStatus: "VERIFIED",
    bulkTransfers: [],
    diffusiveTransfers: [],
    transferRequests: [],
    contributions: [],
    diagnostics: [],
  };
}

function applyTransport(
  system: MatterSystemState,
  evaluation: GasTransportEvaluation,
  amountToleranceMol: number,
): { ok: true; state: MatterSystemState } | { ok: false; message: string } {
  if (evaluation.transferRequests.length === 0) return { ok: true, state: system };
  const result = transferMatterBatch(system, evaluation.transferRequests, {
    amountToleranceMol,
  });
  if (result.status !== "COMMITTED") {
    return {
      ok: false,
      message: `${result.reasonCode}: ${result.message}`,
    };
  }
  return { ok: true, state: result.state };
}

function transportDelta(
  before: MatterSystemState,
  after: MatterSystemState,
): Readonly<Record<string, number>> {
  const amounts = (system: MatterSystemState): Map<string, number> => {
    const result = new Map<string, number>();
    for (const compartment of system.compartments) {
      for (const species of compartment.species) {
        result.set(`${compartment.id}:${species.id}`, species.amountMol);
      }
    }
    return result;
  };
  const a = amounts(before);
  const b = amounts(after);
  const keys = new Set([...a.keys(), ...b.keys()]);
  return Object.freeze(
    Object.fromEntries(
      [...keys]
        .sort()
        .map((key) => [key, (b.get(key) ?? 0) - (a.get(key) ?? 0)])
        .filter(([, value]) => value !== 0),
    ),
  );
}

function updateThermalBodies(
  previous: readonly ThermalBody[],
  evaluation: ThermalApparatusEvaluation,
): readonly ThermalBody[] {
  const updates = new Map(evaluation.bodyUpdates.map((entry) => [entry.bodyId, entry.state] as const));
  return previous.map((body) => ({
    ...body,
    state: updates.get(body.id) ?? body.state,
  }));
}

function pressureProjection(
  system: MatterSystemState,
  bodies: readonly ThermalBody[],
  mapping: Readonly<Record<CompartmentId, ThermalBodyId>>,
): readonly GasPressureEvaluation[] {
  const thermal = bodyMap(bodies);
  const compartments = new Map(system.compartments.map((entry) => [entry.id, entry] as const));
  return Object.entries(mapping)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([compartmentId, bodyId]) => {
      const compartment = compartments.get(compartmentId);
      const body = thermal.get(bodyId);
      if (!compartment || !body) {
        return {
          compartmentId,
          model: "OPEN" as const,
          scientificStatus: "OPEN" as const,
          reasonCodes: [!compartment ? "MISSING_VOLUME" as const : "MISSING_TEMPERATURE" as const],
          partialPressuresPa: {},
          moleFractions: {},
        };
      }
      return evaluateIdealGasCompartment(compartment, {
        compartmentId,
        temperatureK: body.state.temperatureK,
      });
    });
}

function internalTransferMagnitude(evaluation: ThermalApparatusEvaluation): number {
  return evaluation.transfers
    .filter((entry) =>
      entry.mechanism === "CONTACT" ||
      entry.mechanism === "BATH" ||
      entry.mechanism === "CONVECTION")
    .reduce((sum, entry) => sum + entry.energyJ, 0);
}

function gasReactionRoutingIsOpen(
  beforeReaction: MatterCompartmentState,
  afterReaction: MatterCompartmentState,
  system: MatterSystemState,
  delta: Readonly<Record<SpeciesId, number>>,
  toleranceMol: number,
): boolean {
  if (beforeReaction.kind === "VESSEL_HEADSPACE") return false;
  const hasSiblingHeadspace = system.compartments.some(
    (compartment) =>
      compartment.kind === "VESSEL_HEADSPACE" &&
      compartment.id !== beforeReaction.id &&
      (beforeReaction.ownerApparatusId === undefined ||
        compartment.ownerApparatusId === beforeReaction.ownerApparatusId),
  );
  if (!hasSiblingHeadspace) return false;
  const afterById = new Map(afterReaction.species.map((entry) => [entry.id, entry] as const));
  return Object.entries(delta).some(([speciesId, amountMol]) => {
    if (!(amountMol > toleranceMol)) return false;
    return afterById.get(speciesId)?.phaseState.phase === "gas";
  });
}

function finalizeCurrentReactionEvents(
  events: readonly ReactionProgressEvent[],
  temperatureBeforeK: number,
  temperatureAfterK: number,
): readonly ReactionProgressEvent[] {
  return events.map((event) =>
    event.heatJ === undefined
      ? event
      : {
          ...event,
          temperatureBeforeK,
          temperatureAfterK,
        },
  );
}

function finalReactionProvider(
  reactionCompartment: MatterCompartmentState,
  currentEvents: readonly ReactionProgressEvent[],
  timelineEvents: readonly ReactionProgressEvent[],
  pairs: readonly ReversiblePairArbitrationFact[],
): Phase3BProviderProjection {
  return {
    authoritativeVesselComposition: [...reactionCompartment.species]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((species) => ({
        speciesRef: species.id,
        amountMol: species.amountMol,
        phase: species.phaseState.phase,
        phaseStateId: species.phaseState.phaseStateId,
      })),
    activeReactionEvents: currentEvents.map(projectPhase3BReactionProgressEvent),
    timelineEvents: timelineEvents.map(projectPhase3BReactionProgressEvent),
    reversiblePairs: pairs,
  };
}

function open(
  state: Phase4ARuntimeState,
  reasonCode: Phase4ARuntimeReasonCode,
  message: string,
  audit?: Partial<Phase4ARuntimeAudit>,
): Phase4ARuntimeOpenResult {
  return { status: "OPEN", state, reasonCode, message, ...(audit ? { audit } : {}) };
}

function rejected(
  state: Phase4ARuntimeState,
  reasonCode: Phase4ARuntimeReasonCode,
  message: string,
): Phase4ARuntimeRejectedResult {
  return { status: "REJECTED", state, reasonCode, message };
}

/**
 * Authoritative Phase 4A staged timestep.
 *
 * Ordering:
 * snapshot -> reaction/equilibrium extent -> reaction matter commit ->
 * immutable gas transport evaluation -> Phase 4A-1 transport commit ->
 * Phase 4A-3 apparatus + reaction heat aggregation -> temperature commit ->
 * final ideal-gas pressure projection -> provider publication.
 *
 * The existing Phase 3 reaction path still evaluates its legacy thermal result
 * internally. This orchestrator intentionally does NOT commit that state. It
 * uses only the heat fact derived from actual applied reaction extent and gives
 * that energy exactly once to Phase 4A-3 as a ThermalReactionSource.
 */
export function runPhase4AAuthoritativeTimestep(
  state: Phase4ARuntimeState,
  config: Phase4ARuntimeStepConfig,
): Phase4ARuntimeStepResult {
  const amountToleranceMol = config.amountToleranceMol ?? DEFAULT_AMOUNT_TOLERANCE_MOL;
  if (
    !finitePositive(config.dtS) ||
    !config.timestepId ||
    !config.reactionCompartmentId ||
    !config.vesselThermalBodyId ||
    !finiteNonNegative(amountToleranceMol)
  ) {
    return rejected(state, "INVALID_RUNTIME_INPUT", "Invalid timestep/id/tolerance configuration.");
  }

  try {
    assertRuntimeMatterState(state.matterSystem);
    assertRuntimeThermalBodies(state.thermalBodies);
    validateMappedGasCompartments(state.matterSystem, config.gas.thermalBodyByCompartmentId);
  } catch (error) {
    return rejected(
      state,
      "INVALID_RUNTIME_INPUT",
      error instanceof Error ? error.message : String(error),
    );
  }

  const reactionCompartment = state.matterSystem.compartments.find(
    (entry) => entry.id === config.reactionCompartmentId,
  );
  const vesselThermalBody = state.thermalBodies.find(
    (entry) => entry.id === config.vesselThermalBodyId,
  );
  if (!reactionCompartment || !vesselThermalBody) {
    return rejected(state, "INVALID_RUNTIME_INPUT", "Missing reaction compartment or vessel thermal body.");
  }
  if (
    !speciesEquivalent(
      state.reactionNetwork.species,
      reactionCompartment.species,
      amountToleranceMol,
    ) ||
    !thermalStateEquivalent(state.reactionNetwork.thermalState, vesselThermalBody.state)
  ) {
    return rejected(
      state,
      "INVALID_RUNTIME_INPUT",
      "Reaction-network shadow state is not synchronized with authoritative matter/thermal state.",
    );
  }

  const initialMatterInventory = aggregateSystemMatterInventory(state.matterSystem);
  const thermalSnapshot = state.thermalBodies.map((body) => ({
    ...body,
    state: {
      ...body.state,
      cumulativeEnergy: { ...body.state.cumulativeEnergy },
    },
  }));

  let reaction: Phase4AReactionStageResult;
  try {
    reaction = (config.reactionExecutor ?? defaultReactionExecutor)({
      state: {
        ...state.reactionNetwork,
        species: cloneSpecies(reactionCompartment.species),
        thermalState: vesselThermalBody.state,
      },
      reactionInput: config.reactionInput,
      reactionConfig: config.reactionConfig,
      dtS: config.dtS,
      timestepId: config.timestepId,
      reactionCompartmentVolumeM3: reactionCompartment.volumeM3,
    });
  } catch (error) {
    return rejected(
      state,
      "REACTION_STAGE_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!Number.isFinite(reaction.knownReactionHeat_J)) {
    return rejected(state, "REACTION_STAGE_FAILED", "Reaction heat must be finite.");
  }

  let afterReaction: MatterSystemState;
  try {
    afterReaction = replaceCompartmentSpecies(
      state.matterSystem,
      config.reactionCompartmentId,
      reaction.speciesAfter,
    );
    assertRuntimeMatterState(afterReaction);
  } catch (error) {
    return rejected(
      state,
      "REACTION_STAGE_FAILED",
      error instanceof Error ? error.message : String(error),
    );
  }

  const afterReactionInventory = aggregateSystemMatterInventory(afterReaction);
  if (!conservedChemicalInventory(initialMatterInventory, afterReactionInventory)) {
    return rejected(
      state,
      "REACTION_MATTER_CONSERVATION_FAILURE",
      "Reaction matter commit violated element/atom/charge conservation.",
    );
  }

  const reactionCompartmentAfter = afterReaction.compartments.find(
    (entry) => entry.id === config.reactionCompartmentId,
  )!;
  const reactionGasRoutingOpen = gasReactionRoutingIsOpen(
    reactionCompartment,
    reactionCompartmentAfter,
    afterReaction,
    reaction.netSpeciesAmountDeltaMol,
    amountToleranceMol,
  );
  if (reactionGasRoutingOpen) {
    return open(
      state,
      "REACTION_GAS_SOURCE_ROUTING_OPEN",
      "Reaction produced gas outside an explicit headspace routing authority; no compartment insertion was fabricated.",
      {
        timestepId: config.timestepId,
        reactionMatterDeltaMol: reaction.netSpeciesAmountDeltaMol,
        reactionEnergyJ: reaction.knownReactionHeat_J,
        reactionGasRoutingOpen: true,
      },
    );
  }

  if (
    reaction.progressEvents.length > 0 &&
    reaction.thermalCoverage !== "COMPLETE"
  ) {
    return open(
      state,
      "REACTION_THERMAL_OPEN",
      `Reaction heat coverage is ${reaction.thermalCoverage}; missing heat was not fabricated.`,
      {
        timestepId: config.timestepId,
        reactionMatterDeltaMol: reaction.netSpeciesAmountDeltaMol,
        reactionEnergyJ: reaction.knownReactionHeat_J,
        reactionGasRoutingOpen: false,
      },
    );
  }

  const transportSnapshot = snapshotMatterSystem(afterReaction);
  let gasEvaluation = emptyGasEvaluation();
  try {
    if (enabledGasConnectionExists(transportSnapshot)) {
      gasEvaluation = evaluateGasTransport({
        system: transportSnapshot,
        thermodynamicInputs: gasThermodynamicInputs(
          thermalSnapshot,
          config.gas.thermalBodyByCompartmentId,
        ),
        connectionModels: config.gas.connectionModels,
        dtS: config.dtS,
      });
    }
  } catch (error) {
    return rejected(
      state,
      "INVALID_RUNTIME_INPUT",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (gasEvaluation.scientificStatus === "OPEN") {
    return open(
      state,
      "GAS_TRANSPORT_OPEN",
      "Gas transport returned OPEN; no zero-flow fallback was committed.",
      {
        timestepId: config.timestepId,
        reactionMatterDeltaMol: reaction.netSpeciesAmountDeltaMol,
        transportRequests: gasEvaluation.transferRequests,
        reactionEnergyJ: reaction.knownReactionHeat_J,
        gasScientificStatus: gasEvaluation.scientificStatus,
        reactionGasRoutingOpen: false,
      },
    );
  }

  const transportCommit = applyTransport(
    transportSnapshot,
    gasEvaluation,
    amountToleranceMol,
  );
  if (!transportCommit.ok) {
    return rejected(
      state,
      "GAS_TRANSPORT_COMMIT_REJECTED",
      transportCommit.message,
    );
  }
  const afterTransport = transportCommit.state;

  const transportInventory = aggregateSystemMatterInventory(afterTransport);
  if (!conservedChemicalInventory(afterReactionInventory, transportInventory)) {
    return rejected(
      state,
      "FINAL_CONSERVATION_FAILURE",
      "Phase 4A-1 transport commit violated element/atom/charge conservation.",
    );
  }

  let thermalEvaluation: ThermalApparatusEvaluation;
  try {
    thermalEvaluation = evaluateThermalApparatusStep({
      bodies: thermalSnapshot,
      contacts: config.thermal?.contacts,
      reservoirs: config.thermal?.reservoirs,
      actuators: config.thermal?.actuators,
      reactionSources: [
        {
          id: `reaction:${config.timestepId}`,
          bodyId: config.vesselThermalBodyId,
          energyJ: reaction.knownReactionHeat_J,
          scientificStatus: reaction.thermalScientificStatus,
          source: "phase4a-runtime-orchestration",
        },
      ],
      dtS: config.dtS,
    });
  } catch (error) {
    return rejected(
      state,
      "INVALID_RUNTIME_INPUT",
      error instanceof Error ? error.message : String(error),
    );
  }

  if (thermalEvaluation.scientificStatus === "OPEN") {
    return open(
      state,
      "THERMAL_STAGE_OPEN",
      "Thermal apparatus evaluation returned OPEN; no partial thermal/matter state was committed.",
      {
        timestepId: config.timestepId,
        reactionMatterDeltaMol: reaction.netSpeciesAmountDeltaMol,
        transportRequests: gasEvaluation.transferRequests,
        transportMatterDeltaMol: transportDelta(afterReaction, afterTransport),
        reactionEnergyJ: reaction.knownReactionHeat_J,
        internalTransferEnergyJ: internalTransferMagnitude(thermalEvaluation),
        externalEnergyJ: thermalEvaluation.externalEnergyJ,
        gasScientificStatus: gasEvaluation.scientificStatus,
        thermalScientificStatus: thermalEvaluation.scientificStatus,
        reactionGasRoutingOpen: false,
      },
    );
  }

  const finalThermalBodies = updateThermalBodies(
    thermalSnapshot,
    thermalEvaluation,
  );
  const finalVesselBody = finalThermalBodies.find(
    (entry) => entry.id === config.vesselThermalBodyId,
  );
  if (!finalVesselBody) {
    return rejected(state, "INVALID_RUNTIME_INPUT", "Final vessel thermal body missing.");
  }

  // Phase 4A-4 seam:
  // future liquid density/volume authority belongs here, after temperature commit
  // and before headspace-volume/pressure projection. No liquid volume is
  // calculated or mutated in Phase 4A.
  const finalPressures = pressureProjection(
    afterTransport,
    finalThermalBodies,
    config.gas.thermalBodyByCompartmentId,
  );
  if (finalPressures.some((entry) => entry.scientificStatus === "OPEN" || entry.model === "OPEN")) {
    return open(
      state,
      "FINAL_PRESSURE_OPEN",
      "Final pressure projection is OPEN; no fabricated pressure/provider fact was published.",
      {
        timestepId: config.timestepId,
        reactionMatterDeltaMol: reaction.netSpeciesAmountDeltaMol,
        transportRequests: gasEvaluation.transferRequests,
        transportMatterDeltaMol: transportDelta(afterReaction, afterTransport),
        reactionEnergyJ: reaction.knownReactionHeat_J,
        internalTransferEnergyJ: internalTransferMagnitude(thermalEvaluation),
        externalEnergyJ: thermalEvaluation.externalEnergyJ,
        finalTemperatureK: finalVesselBody.state.temperatureK,
        gasScientificStatus: gasEvaluation.scientificStatus,
        thermalScientificStatus: thermalEvaluation.scientificStatus,
        reactionGasRoutingOpen: false,
      },
    );
  }

  const finalInventory = aggregateSystemMatterInventory(afterTransport);
  if (!conservedChemicalInventory(initialMatterInventory, finalInventory)) {
    return rejected(
      state,
      "FINAL_CONSERVATION_FAILURE",
      "Full timestep violated element/atom/charge conservation.",
    );
  }

  const finalizedEvents = finalizeCurrentReactionEvents(
    reaction.progressEvents,
    vesselThermalBody.state.temperatureK,
    finalVesselBody.state.temperatureK,
  );
  const timelineEvents = [
    ...state.reactionNetwork.timelineEvents,
    ...finalizedEvents,
  ];

  const finalReactionCompartment = afterTransport.compartments.find(
    (entry) => entry.id === config.reactionCompartmentId,
  )!;

  const nextReactionNetwork: Phase3AReactionNetworkState = {
    species: cloneSpecies(finalReactionCompartment.species),
    thermalState: finalVesselBody.state,
    speciesRegistry: reaction.speciesRegistry,
    simTimeS: state.reactionNetwork.simTimeS + config.dtS,
    completedTimesteps: state.reactionNetwork.completedTimesteps + 1,
    timelineEvents,
  };
  const nextState: Phase4ARuntimeState = {
    reactionNetwork: nextReactionNetwork,
    matterSystem: afterTransport,
    thermalBodies: finalThermalBodies,
  };

  const pressureStatus = worstStatus(
    finalPressures.map((entry) => entry.scientificStatus),
  );
  const scientificStatus = worstStatus([
    reaction.thermalScientificStatus,
    gasEvaluation.scientificStatus,
    thermalEvaluation.scientificStatus,
    pressureStatus,
  ]);
  const primaryPressure = config.gas.primaryPressureCompartmentId
    ? finalPressures.find(
        (entry) => entry.compartmentId === config.gas.primaryPressureCompartmentId,
      )?.pressurePa
    : undefined;

  const provider: Phase4ARuntimeProviderProjection = {
    simulationTimeS: nextReactionNetwork.simTimeS,
    scientificStatus,
    reaction: finalReactionProvider(
      finalReactionCompartment,
      finalizedEvents,
      timelineEvents,
      reaction.reversiblePairs,
    ),
    gasPressures: finalPressures,
    thermalBodies: finalThermalBodies
      .map((body) => ({
        bodyId: body.id,
        temperatureK: body.state.temperatureK,
        scientificStatus: body.scientificStatus,
      }))
      .sort((a, b) => a.bodyId.localeCompare(b.bodyId)),
  };

  const audit: Phase4ARuntimeAudit = {
    timestepId: config.timestepId,
    reactionMatterDeltaMol: reaction.netSpeciesAmountDeltaMol,
    transportRequests: gasEvaluation.transferRequests,
    transportMatterDeltaMol: transportDelta(afterReaction, afterTransport),
    reactionEnergyJ: reaction.knownReactionHeat_J,
    internalTransferEnergyJ: internalTransferMagnitude(thermalEvaluation),
    externalEnergyJ: thermalEvaluation.externalEnergyJ,
    finalTemperatureK: finalVesselBody.state.temperatureK,
    ...(primaryPressure === undefined ? {} : { finalPressurePa: primaryPressure }),
    gasScientificStatus: gasEvaluation.scientificStatus,
    thermalScientificStatus: thermalEvaluation.scientificStatus,
    scientificStatus,
    reactionGasRoutingOpen: false,
  };

  return { status: "COMMITTED", state: nextState, audit, provider };
}
