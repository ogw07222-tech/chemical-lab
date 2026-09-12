import {
  conservationVectorFromMolecule,
  type SpeciesId,
  type SpeciesState,
} from "../molecular";
import type {
  CompartmentId,
  MatterCompartmentState,
  MatterConnectionState,
  MatterSystemState,
  MatterTransferEntry,
  MatterTransferFailureReason,
  MatterTransferOptions,
  MatterTransferRequest,
  MatterTransferResult,
  SystemMatterInventory,
} from "./types";

// This is the existing reaction-progression default amount tolerance, reused
// rather than introducing a new Phase 4A numerical policy.
const DEFAULT_AMOUNT_TOLERANCE_MOL = 1e-12;

interface StateValidationFailure {
  reasonCode: MatterTransferFailureReason;
  message: string;
  compartmentId?: CompartmentId;
  speciesId?: SpeciesId;
}

interface StagedDelta {
  compartmentId: CompartmentId;
  speciesId: SpeciesId;
  deltaMol: number;
}

function sortedRecord(entries: Iterable<readonly [string, number]>): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b))));
}

function cloneSpeciesAmount(state: SpeciesState, amountMol: number): SpeciesState {
  const next: SpeciesState = { ...state, amountMol };
  delete (next as { concentrationMolPerM3?: number }).concentrationMolPerM3;
  return next;
}

function normalizeSpecies(species: readonly SpeciesState[]): readonly SpeciesState[] {
  return [...species].sort((a, b) => a.id.localeCompare(b.id));
}

function reject(
  state: MatterSystemState,
  reasonCode: MatterTransferFailureReason,
  message: string,
  details: {
    requestIndex?: number;
    speciesId?: SpeciesId;
    compartmentId?: CompartmentId;
  } = {},
): MatterTransferResult {
  return { status: "REJECTED", state, reasonCode, message, ...details };
}

function validateCompartmentState(compartment: MatterCompartmentState): StateValidationFailure | undefined {
  if (!compartment.id) {
    return { reasonCode: "NONFINITE_STATE", message: "Compartment id must be non-empty." };
  }
  if (compartment.volumeM3 !== undefined && (!Number.isFinite(compartment.volumeM3) || compartment.volumeM3 < 0)) {
    return {
      reasonCode: "NONFINITE_STATE",
      message: `Compartment ${compartment.id} has invalid volumeM3.`,
      compartmentId: compartment.id,
    };
  }

  const seen = new Set<SpeciesId>();
  for (const state of compartment.species) {
    if (!state.id) {
      return {
        reasonCode: "UNKNOWN_SPECIES",
        message: `Compartment ${compartment.id} contains an empty SpeciesId.`,
        compartmentId: compartment.id,
      };
    }
    if (seen.has(state.id)) {
      return {
        reasonCode: "DUPLICATE_SPECIES",
        message: `Compartment ${compartment.id} contains duplicate species ${state.id}.`,
        compartmentId: compartment.id,
        speciesId: state.id,
      };
    }
    seen.add(state.id);
    if (!Number.isFinite(state.amountMol) || state.amountMol < 0) {
      return {
        reasonCode: "NONFINITE_STATE",
        message: `Compartment ${compartment.id} has invalid amount for ${state.id}.`,
        compartmentId: compartment.id,
        speciesId: state.id,
      };
    }
    if (!state.molecule.canonicalKey) {
      return {
        reasonCode: "UNKNOWN_SPECIES",
        message: `Species ${state.id} has no canonical molecular identity.`,
        compartmentId: compartment.id,
        speciesId: state.id,
      };
    }
  }
  return undefined;
}

function validateSystemState(system: MatterSystemState): StateValidationFailure | undefined {
  const compartments = new Set<CompartmentId>();
  const globalSpeciesIdentity = new Map<SpeciesId, string>();
  for (const compartment of system.compartments) {
    if (compartments.has(compartment.id)) {
      return {
        reasonCode: "DUPLICATE_COMPARTMENT",
        message: `Duplicate compartment id: ${compartment.id}.`,
        compartmentId: compartment.id,
      };
    }
    compartments.add(compartment.id);
    const failure = validateCompartmentState(compartment);
    if (failure) return failure;

    for (const species of compartment.species) {
      const previous = globalSpeciesIdentity.get(species.id);
      if (previous !== undefined && previous !== species.molecule.canonicalKey) {
        return {
          reasonCode: "SPECIES_IDENTITY_CONFLICT",
          message: `SpeciesId ${species.id} resolves to multiple molecular identities.`,
          compartmentId: compartment.id,
          speciesId: species.id,
        };
      }
      globalSpeciesIdentity.set(species.id, species.molecule.canonicalKey);
    }
  }

  const connections = new Set<string>();
  for (const connection of system.connections ?? []) {
    if (!connection.id || connections.has(connection.id)) {
      return {
        reasonCode: "DUPLICATE_CONNECTION",
        message: `Connection id must be non-empty and unique: ${connection.id}.`,
      };
    }
    connections.add(connection.id);
    if (!compartments.has(connection.sourceCompartmentId) || !compartments.has(connection.destinationCompartmentId)) {
      return {
        reasonCode: "INVALID_CONNECTION",
        message: `Connection ${connection.id} references a missing compartment.`,
      };
    }
  }
  return undefined;
}

export function createMatterCompartment(
  input: Omit<MatterCompartmentState, "species"> & { species?: readonly SpeciesState[] },
): MatterCompartmentState {
  const compartment: MatterCompartmentState = {
    ...input,
    species: normalizeSpecies(input.species ?? []),
  };
  const failure = validateCompartmentState(compartment);
  if (failure) throw new Error(`${failure.reasonCode}:${failure.message}`);
  return compartment;
}

/**
 * Additive migration adapter for the current production vessel composition.
 * It does not change the Phase 3A/3B vessel authority or move gas to headspace.
 */
export function createPrimaryVesselContentsCompartment(input: {
  id: CompartmentId;
  species: readonly SpeciesState[];
  ownerApparatusId?: string;
  volumeM3?: number;
}): MatterCompartmentState {
  return createMatterCompartment({
    id: input.id,
    kind: "VESSEL_CONTENTS",
    species: input.species,
    ...(input.ownerApparatusId === undefined ? {} : { ownerApparatusId: input.ownerApparatusId }),
    ...(input.volumeM3 === undefined ? {} : { volumeM3: input.volumeM3 }),
  });
}

export function aggregateSystemSpeciesAmounts(
  system: MatterSystemState,
): Readonly<Record<SpeciesId, number>> {
  const amounts = new Map<SpeciesId, number>();
  for (const compartment of system.compartments) {
    for (const state of compartment.species) {
      amounts.set(state.id, (amounts.get(state.id) ?? 0) + state.amountMol);
    }
  }
  return sortedRecord(amounts.entries());
}

export function aggregateSystemElementInventory(
  system: MatterSystemState,
): Readonly<Record<string, number>> {
  const elements = new Map<string, number>();
  for (const compartment of system.compartments) {
    for (const state of compartment.species) {
      const vector = conservationVectorFromMolecule(state.molecule, state.amountMol);
      for (const [element, amount] of Object.entries(vector.elements)) {
        elements.set(element, (elements.get(element) ?? 0) + amount);
      }
    }
  }
  return sortedRecord(elements.entries());
}

export function aggregateSystemAtomAmountMol(system: MatterSystemState): number {
  let atomAmountMol = 0;
  for (const compartment of system.compartments) {
    for (const state of compartment.species) {
      atomAmountMol += state.molecule.graph.atoms.length * state.amountMol;
    }
  }
  return atomAmountMol;
}

export function aggregateSystemNetChargeAmountMol(system: MatterSystemState): number {
  let netChargeAmountMol = 0;
  for (const compartment of system.compartments) {
    for (const state of compartment.species) {
      netChargeAmountMol += state.molecule.netCharge * state.amountMol;
    }
  }
  return netChargeAmountMol;
}

export function aggregateSystemMatterInventory(system: MatterSystemState): SystemMatterInventory {
  return {
    speciesAmountsMol: aggregateSystemSpeciesAmounts(system),
    elementsMol: aggregateSystemElementInventory(system),
    atomAmountMol: aggregateSystemAtomAmountMol(system),
    netChargeAmountMol: aggregateSystemNetChargeAmountMol(system),
  };
}

function connectionForRequest(
  request: MatterTransferRequest,
  connections: readonly MatterConnectionState[],
): MatterConnectionState | undefined {
  if (request.connectionId === undefined) return undefined;
  return connections.find((connection) => connection.id === request.connectionId);
}

function canonicalRequest(request: MatterTransferRequest): MatterTransferRequest {
  return {
    ...request,
    species: [...request.species].sort((a, b) => a.speciesId.localeCompare(b.speciesId)),
  };
}

function transferSortKey(request: MatterTransferRequest): string {
  return [
    request.sourceCompartmentId,
    request.destinationCompartmentId,
    request.connectionId ?? "",
    request.species.map((entry) => `${entry.speciesId}:${entry.amountMol}`).join("|"),
  ].join("\u0000");
}

function inventoryMap(compartment: MatterCompartmentState): Map<SpeciesId, SpeciesState> {
  return new Map(compartment.species.map((state) => [state.id, state] as const));
}

function sameInventoryWithinTolerance(
  before: SystemMatterInventory,
  after: SystemMatterInventory,
  toleranceMol: number,
): boolean {
  const speciesIds = new Set([...Object.keys(before.speciesAmountsMol), ...Object.keys(after.speciesAmountsMol)]);
  for (const speciesId of speciesIds) {
    if (Math.abs((before.speciesAmountsMol[speciesId] ?? 0) - (after.speciesAmountsMol[speciesId] ?? 0)) > toleranceMol) {
      return false;
    }
  }
  const elements = new Set([...Object.keys(before.elementsMol), ...Object.keys(after.elementsMol)]);
  for (const element of elements) {
    if (Math.abs((before.elementsMol[element] ?? 0) - (after.elementsMol[element] ?? 0)) > toleranceMol) {
      return false;
    }
  }
  return Math.abs(before.atomAmountMol - after.atomAmountMol) <= toleranceMol
    && Math.abs(before.netChargeAmountMol - after.netChargeAmountMol) <= toleranceMol;
}

/**
 * Atomic, ordering-independent matter bookkeeping transaction.
 *
 * All requests are validated against the same start-of-transaction snapshot.
 * Incoming matter in this batch cannot fund another outgoing request in the
 * same batch, which prevents hidden transport cascades and array-order capture.
 */
export function transferMatterBatch(
  system: MatterSystemState,
  requests: readonly MatterTransferRequest[],
  options: MatterTransferOptions = {},
): MatterTransferResult {
  const toleranceMol = options.amountToleranceMol ?? DEFAULT_AMOUNT_TOLERANCE_MOL;
  if (!Number.isFinite(toleranceMol) || toleranceMol < 0) {
    return reject(system, "INVALID_AMOUNT", "amountToleranceMol must be finite and non-negative.");
  }

  const stateFailure = validateSystemState(system);
  if (stateFailure) {
    return reject(system, stateFailure.reasonCode, stateFailure.message, stateFailure);
  }
  if (requests.length === 0) {
    return reject(system, "EMPTY_TRANSFER", "Matter transfer batch must contain at least one request.");
  }

  const compartments = new Map(system.compartments.map((compartment) => [compartment.id, compartment] as const));
  const connections = system.connections ?? [];
  const canonicalRequests = requests.map(canonicalRequest).sort((a, b) => transferSortKey(a).localeCompare(transferSortKey(b)));
  const outgoingDemand = new Map<string, number>();
  const stagedDeltas = new Map<string, StagedDelta>();
  const templates = new Map<SpeciesId, SpeciesState>();

  for (const compartment of system.compartments) {
    for (const state of compartment.species) templates.set(state.id, state);
  }

  for (let requestIndex = 0; requestIndex < canonicalRequests.length; requestIndex += 1) {
    const request = canonicalRequests[requestIndex]!;
    if (request.sourceCompartmentId === request.destinationCompartmentId) {
      return reject(system, "SAME_COMPARTMENT_TRANSFER", "Source and destination compartments must differ.", { requestIndex });
    }
    const source = compartments.get(request.sourceCompartmentId);
    if (!source) {
      return reject(system, "SOURCE_NOT_FOUND", `Missing source compartment ${request.sourceCompartmentId}.`, {
        requestIndex,
        compartmentId: request.sourceCompartmentId,
      });
    }
    const destination = compartments.get(request.destinationCompartmentId);
    if (!destination) {
      return reject(system, "DESTINATION_NOT_FOUND", `Missing destination compartment ${request.destinationCompartmentId}.`, {
        requestIndex,
        compartmentId: request.destinationCompartmentId,
      });
    }
    if (request.species.length === 0) {
      return reject(system, "EMPTY_TRANSFER", "Each matter transfer request must contain at least one species.", { requestIndex });
    }

    if (request.connectionId !== undefined) {
      const connection = connectionForRequest(request, connections);
      if (!connection || !connection.enabled
        || connection.sourceCompartmentId !== request.sourceCompartmentId
        || connection.destinationCompartmentId !== request.destinationCompartmentId) {
        return reject(system, "INVALID_CONNECTION", `Connection ${request.connectionId} is missing, disabled, or mismatched.`, { requestIndex });
      }
    }

    const sourceInventory = inventoryMap(source);
    const destinationInventory = inventoryMap(destination);
    const requestSpecies = new Set<SpeciesId>();
    for (const entry of request.species) {
      if (requestSpecies.has(entry.speciesId)) {
        return reject(system, "DUPLICATE_SPECIES", `Duplicate species ${entry.speciesId} in one transfer request.`, {
          requestIndex,
          speciesId: entry.speciesId,
        });
      }
      requestSpecies.add(entry.speciesId);
      if (!Number.isFinite(entry.amountMol) || entry.amountMol <= 0) {
        return reject(system, "INVALID_AMOUNT", `Transfer amount for ${entry.speciesId} must be finite and > 0.`, {
          requestIndex,
          speciesId: entry.speciesId,
        });
      }
      const sourceState = sourceInventory.get(entry.speciesId);
      if (!sourceState) {
        return reject(system, "UNKNOWN_SPECIES", `Source compartment does not contain ${entry.speciesId}.`, {
          requestIndex,
          speciesId: entry.speciesId,
          compartmentId: source.id,
        });
      }
      const destinationState = destinationInventory.get(entry.speciesId);
      if (destinationState && destinationState.molecule.canonicalKey !== sourceState.molecule.canonicalKey) {
        return reject(system, "SPECIES_IDENTITY_CONFLICT", `Destination ${entry.speciesId} identity conflicts with source.`, {
          requestIndex,
          speciesId: entry.speciesId,
          compartmentId: destination.id,
        });
      }

      const demandKey = `${source.id}\u0000${entry.speciesId}`;
      outgoingDemand.set(demandKey, (outgoingDemand.get(demandKey) ?? 0) + entry.amountMol);

      const sourceDeltaKey = `${source.id}\u0000${entry.speciesId}`;
      const destinationDeltaKey = `${destination.id}\u0000${entry.speciesId}`;
      stagedDeltas.set(sourceDeltaKey, {
        compartmentId: source.id,
        speciesId: entry.speciesId,
        deltaMol: (stagedDeltas.get(sourceDeltaKey)?.deltaMol ?? 0) - entry.amountMol,
      });
      stagedDeltas.set(destinationDeltaKey, {
        compartmentId: destination.id,
        speciesId: entry.speciesId,
        deltaMol: (stagedDeltas.get(destinationDeltaKey)?.deltaMol ?? 0) + entry.amountMol,
      });
    }
  }

  for (const [key, demandMol] of outgoingDemand) {
    const separator = key.indexOf("\u0000");
    const compartmentId = key.slice(0, separator);
    const speciesId = key.slice(separator + 1);
    const compartment = compartments.get(compartmentId)!;
    const availableMol = inventoryMap(compartment).get(speciesId)?.amountMol;
    if (availableMol === undefined) {
      return reject(system, "UNKNOWN_SPECIES", `Source compartment does not contain ${speciesId}.`, { compartmentId, speciesId });
    }
    if (demandMol - availableMol > toleranceMol) {
      return reject(system, "INSUFFICIENT_AMOUNT", `Requested ${demandMol} mol ${speciesId} from ${compartmentId}, only ${availableMol} mol available.`, {
        compartmentId,
        speciesId,
      });
    }
  }

  const beforeInventory = aggregateSystemMatterInventory(system);
  const deltasByCompartment = new Map<CompartmentId, StagedDelta[]>();
  for (const delta of stagedDeltas.values()) {
    const list = deltasByCompartment.get(delta.compartmentId) ?? [];
    list.push(delta);
    deltasByCompartment.set(delta.compartmentId, list);
  }

  const nextCompartments = system.compartments.map((compartment) => {
    const deltas = deltasByCompartment.get(compartment.id);
    if (!deltas) return compartment;
    const nextInventory = inventoryMap(compartment);
    for (const delta of deltas.sort((a, b) => a.speciesId.localeCompare(b.speciesId))) {
      const current = nextInventory.get(delta.speciesId);
      const baseAmount = current?.amountMol ?? 0;
      let nextAmount = baseAmount + delta.deltaMol;
      if (nextAmount < 0 && Math.abs(nextAmount) <= toleranceMol) nextAmount = 0;
      if (!Number.isFinite(nextAmount) || nextAmount < 0) {
        return undefined;
      }
      if (current) {
        nextInventory.set(delta.speciesId, cloneSpeciesAmount(current, nextAmount));
      } else {
        const template = templates.get(delta.speciesId);
        if (!template || nextAmount <= 0) return undefined;
        nextInventory.set(delta.speciesId, cloneSpeciesAmount(template, nextAmount));
      }
    }
    return { ...compartment, species: normalizeSpecies([...nextInventory.values()]) };
  });

  if (nextCompartments.some((compartment) => compartment === undefined)) {
    return reject(system, "NONFINITE_STATE", "Staged matter transfer produced an invalid compartment amount.");
  }

  const nextState: MatterSystemState = {
    ...system,
    compartments: nextCompartments as readonly MatterCompartmentState[],
  };
  const afterInventory = aggregateSystemMatterInventory(nextState);
  if (!sameInventoryWithinTolerance(beforeInventory, afterInventory, toleranceMol)) {
    return reject(system, "CONSERVATION_FAILURE", "Pure matter transfer changed system-wide conserved inventory.");
  }

  return {
    status: "COMMITTED",
    state: nextState,
    transferred: canonicalRequests,
  };
}

export function transferMatter(
  system: MatterSystemState,
  request: MatterTransferRequest,
  options: MatterTransferOptions = {},
): MatterTransferResult {
  return transferMatterBatch(system, [request], options);
}
