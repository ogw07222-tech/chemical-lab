import {
  conservationVectorFromMolecule,
  type SpeciesId,
  type SpeciesState,
} from "../molecular";
import type {
  CompartmentId,
  MatterCompartmentState,
  MatterConnectionKind,
  MatterConnectionState,
  MatterSystemState,
  MatterTransferFailureReason,
  MatterTransferOptions,
  MatterTransferRequest,
  MatterTransferResult,
  SystemMatterInventory,
} from "./types";

// Reuses the established reaction-progression default amount tolerance.
const DEFAULT_AMOUNT_TOLERANCE_MOL = 1e-12;
const SUPPORTED_CONNECTION_KINDS = new Set<MatterConnectionKind>(["GAS", "LIQUID"]);

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

interface CanonicalSpeciesContribution {
  compartmentId: CompartmentId;
  species: SpeciesState;
}

function sortedRecord(entries: Iterable<readonly [string, number]>): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b))));
}

function normalizeSpecies(species: readonly SpeciesState[]): readonly SpeciesState[] {
  return [...species].sort((a, b) => a.id.localeCompare(b.id));
}

function cloneSpeciesAmount(state: SpeciesState, amountMol: number): SpeciesState {
  const next: SpeciesState = { ...state, amountMol };
  delete (next as { concentrationMolPerM3?: number }).concentrationMolPerM3;
  return next;
}

function reject(
  state: MatterSystemState,
  reasonCode: MatterTransferFailureReason,
  message: string,
  details: { requestIndex?: number; speciesId?: SpeciesId; compartmentId?: CompartmentId } = {},
): MatterTransferResult {
  return { status: "REJECTED", state, reasonCode, message, ...details };
}

function isSupportedConnectionKind(kind: unknown): kind is MatterConnectionKind {
  return typeof kind === "string" && SUPPORTED_CONNECTION_KINDS.has(kind as MatterConnectionKind);
}

function validateCompartment(compartment: MatterCompartmentState): StateValidationFailure | undefined {
  if (!compartment.id) return { reasonCode: "NONFINITE_STATE", message: "Compartment id must be non-empty." };
  if (compartment.volumeM3 !== undefined && (!Number.isFinite(compartment.volumeM3) || compartment.volumeM3 < 0)) {
    return { reasonCode: "NONFINITE_STATE", message: `Invalid volumeM3 for ${compartment.id}.`, compartmentId: compartment.id };
  }
  const seen = new Set<SpeciesId>();
  for (const species of compartment.species) {
    if (!species.id || !species.molecule.canonicalKey) {
      return { reasonCode: "UNKNOWN_SPECIES", message: `Invalid species identity in ${compartment.id}.`, compartmentId: compartment.id, speciesId: species.id };
    }
    if (seen.has(species.id)) {
      return { reasonCode: "DUPLICATE_SPECIES", message: `Duplicate species ${species.id} in ${compartment.id}.`, compartmentId: compartment.id, speciesId: species.id };
    }
    seen.add(species.id);
    if (!Number.isFinite(species.amountMol) || species.amountMol < 0) {
      return { reasonCode: "NONFINITE_STATE", message: `Invalid amount for ${species.id}.`, compartmentId: compartment.id, speciesId: species.id };
    }
  }
  return undefined;
}

function validateSystem(system: MatterSystemState): StateValidationFailure | undefined {
  const compartmentIds = new Set<CompartmentId>();
  const identities = new Map<SpeciesId, string>();
  for (const compartment of system.compartments) {
    if (compartmentIds.has(compartment.id)) {
      return { reasonCode: "DUPLICATE_COMPARTMENT", message: `Duplicate compartment ${compartment.id}.`, compartmentId: compartment.id };
    }
    compartmentIds.add(compartment.id);
    const failure = validateCompartment(compartment);
    if (failure) return failure;
    for (const species of compartment.species) {
      const prior = identities.get(species.id);
      if (prior !== undefined && prior !== species.molecule.canonicalKey) {
        return { reasonCode: "SPECIES_IDENTITY_CONFLICT", message: `SpeciesId ${species.id} has conflicting identities.`, compartmentId: compartment.id, speciesId: species.id };
      }
      identities.set(species.id, species.molecule.canonicalKey);
    }
  }
  const connectionIds = new Set<string>();
  for (const connection of system.connections ?? []) {
    if (!connection.id || connectionIds.has(connection.id)) {
      return { reasonCode: "DUPLICATE_CONNECTION", message: `Connection id must be non-empty and unique: ${connection.id}.` };
    }
    connectionIds.add(connection.id);
    if (!isSupportedConnectionKind(connection.kind)) {
      return {
        reasonCode: "INVALID_CONNECTION_KIND",
        message: `Connection ${connection.id} has unsupported kind: ${String(connection.kind)}.`,
      };
    }
    if (!compartmentIds.has(connection.sourceCompartmentId) || !compartmentIds.has(connection.destinationCompartmentId)) {
      return { reasonCode: "INVALID_CONNECTION", message: `Connection ${connection.id} references a missing compartment.` };
    }
  }
  return undefined;
}

export function createMatterCompartment(
  input: Omit<MatterCompartmentState, "species"> & { species?: readonly SpeciesState[] },
): MatterCompartmentState {
  const compartment: MatterCompartmentState = { ...input, species: normalizeSpecies(input.species ?? []) };
  const failure = validateCompartment(compartment);
  if (failure) throw new Error(`${failure.reasonCode}:${failure.message}`);
  return compartment;
}

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

function canonicalSpeciesContributions(system: MatterSystemState): readonly CanonicalSpeciesContribution[] {
  const contributions: CanonicalSpeciesContribution[] = [];
  for (const compartment of system.compartments) {
    for (const species of compartment.species) {
      contributions.push({ compartmentId: compartment.id, species });
    }
  }
  return contributions.sort((a, b) =>
    a.compartmentId.localeCompare(b.compartmentId)
    || a.species.id.localeCompare(b.species.id)
    || a.species.molecule.canonicalKey.localeCompare(b.species.molecule.canonicalKey));
}

export function aggregateSystemSpeciesAmounts(system: MatterSystemState): Readonly<Record<SpeciesId, number>> {
  const amounts = new Map<SpeciesId, number>();
  for (const { species } of canonicalSpeciesContributions(system)) {
    amounts.set(species.id, (amounts.get(species.id) ?? 0) + species.amountMol);
  }
  return sortedRecord(amounts.entries());
}

export function aggregateSystemElementInventory(system: MatterSystemState): Readonly<Record<string, number>> {
  const elements = new Map<string, number>();
  for (const { species } of canonicalSpeciesContributions(system)) {
    const vector = conservationVectorFromMolecule(species.molecule, species.amountMol);
    for (const element of Object.keys(vector.elements).sort()) {
      elements.set(element, (elements.get(element) ?? 0) + (vector.elements[element] ?? 0));
    }
  }
  return sortedRecord(elements.entries());
}

export function aggregateSystemAtomAmountMol(system: MatterSystemState): number {
  let total = 0;
  for (const { species } of canonicalSpeciesContributions(system)) {
    total += species.molecule.graph.atoms.length * species.amountMol;
  }
  return total;
}

export function aggregateSystemNetChargeAmountMol(system: MatterSystemState): number {
  let total = 0;
  for (const { species } of canonicalSpeciesContributions(system)) {
    total += species.molecule.netCharge * species.amountMol;
  }
  return total;
}

export function aggregateSystemMatterInventory(system: MatterSystemState): SystemMatterInventory {
  return {
    speciesAmountsMol: aggregateSystemSpeciesAmounts(system),
    elementsMol: aggregateSystemElementInventory(system),
    atomAmountMol: aggregateSystemAtomAmountMol(system),
    netChargeAmountMol: aggregateSystemNetChargeAmountMol(system),
  };
}

function inventoryMap(compartment: MatterCompartmentState): Map<SpeciesId, SpeciesState> {
  return new Map(compartment.species.map((species) => [species.id, species] as const));
}

function canonicalRequest(request: MatterTransferRequest): MatterTransferRequest {
  return { ...request, species: [...request.species].sort((a, b) => a.speciesId.localeCompare(b.speciesId)) };
}

function requestKey(request: MatterTransferRequest): string {
  return [
    request.sourceCompartmentId,
    request.destinationCompartmentId,
    request.connectionId ?? "",
    request.species.map((entry) => `${entry.speciesId}:${entry.amountMol}`).join("|"),
  ].join("\u0000");
}

function connectionForRequest(request: MatterTransferRequest, connections: readonly MatterConnectionState[]): MatterConnectionState | undefined {
  return request.connectionId === undefined ? undefined : connections.find((connection) => connection.id === request.connectionId);
}

function conserved(before: SystemMatterInventory, after: SystemMatterInventory, toleranceMol: number): boolean {
  const species = new Set([...Object.keys(before.speciesAmountsMol), ...Object.keys(after.speciesAmountsMol)]);
  for (const id of species) if (Math.abs((before.speciesAmountsMol[id] ?? 0) - (after.speciesAmountsMol[id] ?? 0)) > toleranceMol) return false;
  const elements = new Set([...Object.keys(before.elementsMol), ...Object.keys(after.elementsMol)]);
  for (const element of elements) if (Math.abs((before.elementsMol[element] ?? 0) - (after.elementsMol[element] ?? 0)) > toleranceMol) return false;
  return Math.abs(before.atomAmountMol - after.atomAmountMol) <= toleranceMol
    && Math.abs(before.netChargeAmountMol - after.netChargeAmountMol) <= toleranceMol;
}

export function transferMatterBatch(
  system: MatterSystemState,
  requests: readonly MatterTransferRequest[],
  options: MatterTransferOptions = {},
): MatterTransferResult {
  const toleranceMol = options.amountToleranceMol ?? DEFAULT_AMOUNT_TOLERANCE_MOL;
  if (!Number.isFinite(toleranceMol) || toleranceMol < 0) return reject(system, "INVALID_AMOUNT", "amountToleranceMol must be finite and non-negative.");
  const stateFailure = validateSystem(system);
  if (stateFailure) return reject(system, stateFailure.reasonCode, stateFailure.message, stateFailure);
  if (requests.length === 0) return reject(system, "EMPTY_TRANSFER", "Matter transfer batch must contain at least one request.");

  const compartments = new Map(system.compartments.map((compartment) => [compartment.id, compartment] as const));
  const connections = system.connections ?? [];
  const canonicalRequests = requests.map(canonicalRequest).sort((a, b) => requestKey(a).localeCompare(requestKey(b)));
  const outgoing = new Map<string, number>();
  const deltas = new Map<string, StagedDelta>();
  const templates = new Map<SpeciesId, SpeciesState>();
  for (const compartment of system.compartments) for (const species of compartment.species) templates.set(species.id, species);

  for (let requestIndex = 0; requestIndex < canonicalRequests.length; requestIndex += 1) {
    const request = canonicalRequests[requestIndex]!;
    if (request.sourceCompartmentId === request.destinationCompartmentId) return reject(system, "SAME_COMPARTMENT_TRANSFER", "Source and destination must differ.", { requestIndex });
    const source = compartments.get(request.sourceCompartmentId);
    if (!source) return reject(system, "SOURCE_NOT_FOUND", `Missing source ${request.sourceCompartmentId}.`, { requestIndex, compartmentId: request.sourceCompartmentId });
    const destination = compartments.get(request.destinationCompartmentId);
    if (!destination) return reject(system, "DESTINATION_NOT_FOUND", `Missing destination ${request.destinationCompartmentId}.`, { requestIndex, compartmentId: request.destinationCompartmentId });
    if (request.species.length === 0) return reject(system, "EMPTY_TRANSFER", "Transfer request must contain species.", { requestIndex });

    if (request.connectionId !== undefined) {
      const connection = connectionForRequest(request, connections);
      if (!connection || !connection.enabled || connection.sourceCompartmentId !== source.id || connection.destinationCompartmentId !== destination.id) {
        return reject(system, "INVALID_CONNECTION", `Connection ${request.connectionId} is invalid for this transfer.`, { requestIndex });
      }
    }

    const sourceInventory = inventoryMap(source);
    const destinationInventory = inventoryMap(destination);
    const seen = new Set<SpeciesId>();
    for (const entry of request.species) {
      if (seen.has(entry.speciesId)) return reject(system, "DUPLICATE_SPECIES", `Duplicate ${entry.speciesId} in transfer request.`, { requestIndex, speciesId: entry.speciesId });
      seen.add(entry.speciesId);
      if (!Number.isFinite(entry.amountMol) || entry.amountMol <= 0) return reject(system, "INVALID_AMOUNT", `Transfer amount for ${entry.speciesId} must be finite and > 0.`, { requestIndex, speciesId: entry.speciesId });
      const sourceState = sourceInventory.get(entry.speciesId);
      if (!sourceState) return reject(system, "UNKNOWN_SPECIES", `Source does not contain ${entry.speciesId}.`, { requestIndex, speciesId: entry.speciesId, compartmentId: source.id });
      const destinationState = destinationInventory.get(entry.speciesId);
      if (destinationState && destinationState.molecule.canonicalKey !== sourceState.molecule.canonicalKey) {
        return reject(system, "SPECIES_IDENTITY_CONFLICT", `Destination identity conflicts for ${entry.speciesId}.`, { requestIndex, speciesId: entry.speciesId, compartmentId: destination.id });
      }

      const sourceKey = `${source.id}\u0000${entry.speciesId}`;
      const destinationKey = `${destination.id}\u0000${entry.speciesId}`;
      outgoing.set(sourceKey, (outgoing.get(sourceKey) ?? 0) + entry.amountMol);
      deltas.set(sourceKey, { compartmentId: source.id, speciesId: entry.speciesId, deltaMol: (deltas.get(sourceKey)?.deltaMol ?? 0) - entry.amountMol });
      deltas.set(destinationKey, { compartmentId: destination.id, speciesId: entry.speciesId, deltaMol: (deltas.get(destinationKey)?.deltaMol ?? 0) + entry.amountMol });
    }
  }

  for (const [key, demandMol] of outgoing) {
    const split = key.indexOf("\u0000");
    const compartmentId = key.slice(0, split);
    const speciesId = key.slice(split + 1);
    const availableMol = inventoryMap(compartments.get(compartmentId)!).get(speciesId)?.amountMol;
    if (availableMol === undefined) return reject(system, "UNKNOWN_SPECIES", `Source does not contain ${speciesId}.`, { compartmentId, speciesId });
    if (demandMol - availableMol > toleranceMol) return reject(system, "INSUFFICIENT_AMOUNT", `Requested ${demandMol} mol ${speciesId}; ${availableMol} mol available.`, { compartmentId, speciesId });
  }

  const before = aggregateSystemMatterInventory(system);
  const byCompartment = new Map<CompartmentId, StagedDelta[]>();
  for (const delta of deltas.values()) {
    const list = byCompartment.get(delta.compartmentId) ?? [];
    list.push(delta);
    byCompartment.set(delta.compartmentId, list);
  }

  let invalidStage = false;
  const nextCompartments = system.compartments.map((compartment) => {
    const compartmentDeltas = byCompartment.get(compartment.id);
    if (!compartmentDeltas) return compartment;
    const inventory = inventoryMap(compartment);
    for (const delta of compartmentDeltas.sort((a, b) => a.speciesId.localeCompare(b.speciesId))) {
      const current = inventory.get(delta.speciesId);
      let nextAmount = (current?.amountMol ?? 0) + delta.deltaMol;
      if (nextAmount < 0 && Math.abs(nextAmount) <= toleranceMol) nextAmount = 0;
      if (!Number.isFinite(nextAmount) || nextAmount < 0) { invalidStage = true; continue; }
      if (current) inventory.set(delta.speciesId, cloneSpeciesAmount(current, nextAmount));
      else {
        const template = templates.get(delta.speciesId);
        if (!template || nextAmount <= 0) { invalidStage = true; continue; }
        inventory.set(delta.speciesId, cloneSpeciesAmount(template, nextAmount));
      }
    }
    return { ...compartment, species: normalizeSpecies([...inventory.values()]) };
  });
  if (invalidStage) return reject(system, "NONFINITE_STATE", "Staged transfer produced invalid matter state.");

  const nextState: MatterSystemState = { ...system, compartments: nextCompartments };
  if (!conserved(before, aggregateSystemMatterInventory(nextState), toleranceMol)) {
    return reject(system, "CONSERVATION_FAILURE", "Pure transfer changed system-wide matter inventory.");
  }
  return { status: "COMMITTED", state: nextState, transferred: canonicalRequests };
}

export function transferMatter(
  system: MatterSystemState,
  request: MatterTransferRequest,
  options: MatterTransferOptions = {},
): MatterTransferResult {
  return transferMatterBatch(system, [request], options);
}
