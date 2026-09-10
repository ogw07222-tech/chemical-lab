export const PROGRESSION_SCHEMA_VERSION = 1 as const;
export const UNLIMITED_UNLOCKED = "UNLIMITED_UNLOCKED" as const;

export type SpeciesKey = string;
export type ExperimentId = string;

export interface StarterMaterialSet {
  id: string;
  schemaVersion: number;
  speciesKeys: readonly SpeciesKey[];
  equipmentEntitlements?: readonly string[];
  contentRevision?: string;
}

export interface SpeciesDiscovery {
  speciesKey: SpeciesKey;
  firstExperimentId: ExperimentId;
  confirmedAtSimulationTimeS: number;
  confirmationMethod: "instrument-analysis" | "approved-direct-identity-channel";
  analysisResultId?: string;
}

export interface EncyclopediaEntryState {
  speciesKey: SpeciesKey;
  unlocked: true;
  firstDiscoveryExperimentId: ExperimentId;
  relatedExperimentIds: readonly ExperimentId[];
  firstDiscoveryOrder: number;
}

export interface InventoryUnlockState {
  unlockedSpecies: readonly SpeciesKey[];
  stockSemantics: typeof UNLIMITED_UNLOCKED;
}

export interface PlayerProgressionState {
  schemaVersion: typeof PROGRESSION_SCHEMA_VERSION;
  starterMaterialSetId: string;
  starterSpecies: readonly SpeciesKey[];
  discoveredSpecies: Readonly<Record<SpeciesKey, SpeciesDiscovery>>;
  encyclopedia: Readonly<Record<SpeciesKey, EncyclopediaEntryState>>;
  inventory: InventoryUnlockState;
  discoveryOrder: readonly SpeciesKey[];
}

export interface IdentityConfirmedEvent {
  kind: "IdentityConfirmed";
  eventId: string;
  speciesKey: SpeciesKey;
  experimentId: ExperimentId;
  simulationTimeS: number;
  confirmationMethod: SpeciesDiscovery["confirmationMethod"];
  analysisResultId?: string;
  authoritative: true;
}

export interface IdentityUnconfirmedEvent {
  kind: "IdentityUnconfirmed";
  eventId: string;
  experimentId: ExperimentId;
  simulationTimeS: number;
  authoritative: false;
}

export type IdentityEvent = IdentityConfirmedEvent | IdentityUnconfirmedEvent;

export interface FirstDiscoveryEvent {
  kind: "FirstDiscovery";
  speciesKey: SpeciesKey;
  experimentId: ExperimentId;
  sourceIdentityEventId: string;
  discoveryOrder: number;
}

export interface ProgressionTransitionResult {
  state: PlayerProgressionState;
  firstDiscoveryEvent?: FirstDiscoveryEvent;
  changed: boolean;
}

export interface MaterialAccessContext {
  developerModeEnabled?: boolean;
  premium?: boolean;
}

export interface AddUnlockedMaterialCommand {
  kind: "AddUnlockedMaterial";
  commandId: string;
  vesselId: string;
  speciesKey: SpeciesKey;
  amountMol: number;
}

export interface SimulationMaterialAdditionRequest {
  kind: "AddMaterial";
  commandId: string;
  vesselId: string;
  speciesKey: SpeciesKey;
  amountMol: number;
  source: "starter" | "unlocked-inventory" | "developer";
}

export type MaterialCommandValidationError =
  | "LOCKED_SPECIES"
  | "INVALID_AMOUNT";

export type MaterialCommandValidationResult =
  | { ok: true; request: SimulationMaterialAdditionRequest }
  | { ok: false; error: MaterialCommandValidationError };

export class UnsupportedProgressionSaveVersionError extends Error {
  constructor(readonly version: unknown) {
    super(`Unsupported progression save version: ${String(version)}`);
    this.name = "UnsupportedProgressionSaveVersionError";
  }
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function assertNonEmptyId(value: string, field: string): void {
  if (value.length === 0) throw new Error(`${field} must not be empty`);
}

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be finite and non-negative`);
  }
}

export function createInitialProgressionState(
  starterSet: StarterMaterialSet,
): PlayerProgressionState {
  assertNonEmptyId(starterSet.id, "starterSet.id");
  const starterSpecies = uniqueSorted(starterSet.speciesKeys);
  return {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    starterMaterialSetId: starterSet.id,
    starterSpecies,
    discoveredSpecies: {},
    encyclopedia: {},
    inventory: {
      unlockedSpecies: [],
      stockSemantics: UNLIMITED_UNLOCKED,
    },
    discoveryOrder: [],
  };
}

export function isSpeciesAccessible(
  state: PlayerProgressionState,
  speciesKey: SpeciesKey,
  context: MaterialAccessContext = {},
): boolean {
  if (context.developerModeEnabled === true) return true;
  // Premium is intentionally ignored. It cannot bypass discovery.
  return (
    state.starterSpecies.includes(speciesKey) ||
    state.inventory.unlockedSpecies.includes(speciesKey)
  );
}

export function handleIdentityEvent(
  state: PlayerProgressionState,
  event: IdentityEvent,
): ProgressionTransitionResult {
  if (event.kind !== "IdentityConfirmed" || event.authoritative !== true) {
    return { state, changed: false };
  }

  assertNonEmptyId(event.speciesKey, "event.speciesKey");
  assertNonEmptyId(event.experimentId, "event.experimentId");
  assertFiniteNonNegative(event.simulationTimeS, "event.simulationTimeS");

  const existing = state.discoveredSpecies[event.speciesKey];
  if (existing) {
    const entry = state.encyclopedia[event.speciesKey];
    if (!entry || !state.inventory.unlockedSpecies.includes(event.speciesKey)) {
      throw new Error("Progression invariant violated: discovery/encyclopedia/inventory out of sync");
    }

    if (entry.relatedExperimentIds.includes(event.experimentId)) {
      return { state, changed: false };
    }

    return {
      state: {
        ...state,
        encyclopedia: {
          ...state.encyclopedia,
          [event.speciesKey]: {
            ...entry,
            relatedExperimentIds: uniqueSorted([
              ...entry.relatedExperimentIds,
              event.experimentId,
            ]),
          },
        },
      },
      changed: true,
    };
  }

  const discoveryOrder = state.discoveryOrder.length;
  const discovery: SpeciesDiscovery = {
    speciesKey: event.speciesKey,
    firstExperimentId: event.experimentId,
    confirmedAtSimulationTimeS: event.simulationTimeS,
    confirmationMethod: event.confirmationMethod,
    ...(event.analysisResultId === undefined
      ? {}
      : { analysisResultId: event.analysisResultId }),
  };
  const encyclopediaEntry: EncyclopediaEntryState = {
    speciesKey: event.speciesKey,
    unlocked: true,
    firstDiscoveryExperimentId: event.experimentId,
    relatedExperimentIds: [event.experimentId],
    firstDiscoveryOrder: discoveryOrder,
  };

  const nextState: PlayerProgressionState = {
    ...state,
    discoveredSpecies: {
      ...state.discoveredSpecies,
      [event.speciesKey]: discovery,
    },
    encyclopedia: {
      ...state.encyclopedia,
      [event.speciesKey]: encyclopediaEntry,
    },
    inventory: {
      stockSemantics: UNLIMITED_UNLOCKED,
      unlockedSpecies: uniqueSorted([
        ...state.inventory.unlockedSpecies,
        event.speciesKey,
      ]),
    },
    discoveryOrder: [...state.discoveryOrder, event.speciesKey],
  };

  assertProgressionInvariants(nextState);

  return {
    state: nextState,
    changed: true,
    firstDiscoveryEvent: {
      kind: "FirstDiscovery",
      speciesKey: event.speciesKey,
      experimentId: event.experimentId,
      sourceIdentityEventId: event.eventId,
      discoveryOrder,
    },
  };
}

export function validateAddUnlockedMaterial(
  state: PlayerProgressionState,
  command: AddUnlockedMaterialCommand,
  context: MaterialAccessContext = {},
): MaterialCommandValidationResult {
  if (!Number.isFinite(command.amountMol) || command.amountMol <= 0) {
    return { ok: false, error: "INVALID_AMOUNT" };
  }

  if (!isSpeciesAccessible(state, command.speciesKey, context)) {
    return { ok: false, error: "LOCKED_SPECIES" };
  }

  const source: SimulationMaterialAdditionRequest["source"] =
    context.developerModeEnabled === true
      ? "developer"
      : state.starterSpecies.includes(command.speciesKey)
        ? "starter"
        : "unlocked-inventory";

  return {
    ok: true,
    request: {
      kind: "AddMaterial",
      commandId: command.commandId,
      vesselId: command.vesselId,
      speciesKey: command.speciesKey,
      amountMol: command.amountMol,
      source,
    },
  };
}

export function assertProgressionInvariants(state: PlayerProgressionState): void {
  if (state.schemaVersion !== PROGRESSION_SCHEMA_VERSION) {
    throw new UnsupportedProgressionSaveVersionError(state.schemaVersion);
  }
  if (state.inventory.stockSemantics !== UNLIMITED_UNLOCKED) {
    throw new Error("Unsupported inventory stock semantics");
  }

  const discoveries = Object.keys(state.discoveredSpecies).sort();
  const encyclopedia = Object.keys(state.encyclopedia).sort();
  const inventory = uniqueSorted(state.inventory.unlockedSpecies);

  if (JSON.stringify(discoveries) !== JSON.stringify(encyclopedia)) {
    throw new Error("Progression invariant violated: discoveries and encyclopedia differ");
  }
  if (JSON.stringify(discoveries) !== JSON.stringify(inventory)) {
    throw new Error("Progression invariant violated: discoveries and inventory differ");
  }
  if (new Set(state.discoveryOrder).size !== state.discoveryOrder.length) {
    throw new Error("Progression invariant violated: duplicate discovery order entry");
  }
  for (const key of state.discoveryOrder) {
    if (!(key in state.discoveredSpecies)) {
      throw new Error("Progression invariant violated: discovery order references unknown species");
    }
  }
}

interface SerializedProgressionStateV1 {
  schemaVersion: 1;
  starterMaterialSetId: string;
  starterSpecies: string[];
  discoveredSpecies: [string, SpeciesDiscovery][];
  encyclopedia: [string, EncyclopediaEntryState][];
  unlockedSpecies: string[];
  stockSemantics: typeof UNLIMITED_UNLOCKED;
  discoveryOrder: string[];
}

export function serializeProgressionState(state: PlayerProgressionState): string {
  assertProgressionInvariants(state);
  const payload: SerializedProgressionStateV1 = {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    starterMaterialSetId: state.starterMaterialSetId,
    starterSpecies: uniqueSorted(state.starterSpecies),
    discoveredSpecies: Object.entries(state.discoveredSpecies).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
    encyclopedia: Object.entries(state.encyclopedia)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [
        key,
        {
          ...entry,
          relatedExperimentIds: uniqueSorted(entry.relatedExperimentIds),
        },
      ]),
    unlockedSpecies: uniqueSorted(state.inventory.unlockedSpecies),
    stockSemantics: UNLIMITED_UNLOCKED,
    discoveryOrder: [...state.discoveryOrder],
  };
  return JSON.stringify(payload);
}

export function deserializeProgressionState(serialized: string): PlayerProgressionState {
  const raw = JSON.parse(serialized) as Partial<SerializedProgressionStateV1> & {
    schemaVersion?: unknown;
  };
  if (raw.schemaVersion !== PROGRESSION_SCHEMA_VERSION) {
    throw new UnsupportedProgressionSaveVersionError(raw.schemaVersion);
  }
  if (
    typeof raw.starterMaterialSetId !== "string" ||
    !Array.isArray(raw.starterSpecies) ||
    !Array.isArray(raw.discoveredSpecies) ||
    !Array.isArray(raw.encyclopedia) ||
    !Array.isArray(raw.unlockedSpecies) ||
    !Array.isArray(raw.discoveryOrder) ||
    raw.stockSemantics !== UNLIMITED_UNLOCKED
  ) {
    throw new Error("Invalid progression save payload");
  }

  const state: PlayerProgressionState = {
    schemaVersion: PROGRESSION_SCHEMA_VERSION,
    starterMaterialSetId: raw.starterMaterialSetId,
    starterSpecies: uniqueSorted(raw.starterSpecies),
    discoveredSpecies: Object.fromEntries(raw.discoveredSpecies),
    encyclopedia: Object.fromEntries(raw.encyclopedia),
    inventory: {
      unlockedSpecies: uniqueSorted(raw.unlockedSpecies),
      stockSemantics: UNLIMITED_UNLOCKED,
    },
    discoveryOrder: [...raw.discoveryOrder],
  };
  assertProgressionInvariants(state);
  return state;
}
