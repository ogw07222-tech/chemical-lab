import type { MatterTransferRequest } from "../compartment";
import type { SpeciesId } from "../molecular";
import { evaluateGasTransport as evaluateGasTransportRaw, evaluateIdealGasCompartment, IDEAL_GAS_CONSTANT_J_PER_MOL_K } from "./core";
import type {
  GasPressureEvaluation,
  GasTransportContribution,
  GasTransportContributionKind,
  GasTransportEvaluation,
  GasTransportSolverInput,
} from "./types";

function contributionKey(entry: GasTransportContribution): string {
  return [entry.sourceCompartmentId, entry.speciesId, entry.connectionId, entry.kind, entry.destinationCompartmentId].join("\u0000");
}

function groupRequests(
  contributions: readonly GasTransportContribution[],
  kind?: GasTransportContributionKind,
): readonly MatterTransferRequest[] {
  const groups = new Map<string, {
    sourceCompartmentId: string;
    destinationCompartmentId: string;
    connectionId: string;
    species: Map<SpeciesId, number>;
  }>();

  for (const entry of contributions) {
    if (kind !== undefined && entry.kind !== kind) continue;
    const key = `${entry.sourceCompartmentId}\u0000${entry.destinationCompartmentId}\u0000${entry.connectionId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        sourceCompartmentId: entry.sourceCompartmentId,
        destinationCompartmentId: entry.destinationCompartmentId,
        connectionId: entry.connectionId,
        species: new Map(),
      };
      groups.set(key, group);
    }
    group.species.set(entry.speciesId, (group.species.get(entry.speciesId) ?? 0) + entry.amountMol);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => ({
      sourceCompartmentId: group.sourceCompartmentId,
      destinationCompartmentId: group.destinationCompartmentId,
      connectionId: group.connectionId,
      species: [...group.species.entries()]
        .filter(([, amountMol]) => amountMol > 0 && Number.isFinite(amountMol))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([speciesId, amountMol]) => ({ speciesId, amountMol })),
    }))
    .filter((request) => request.species.length > 0);
}

function pressureSlopePaPerMol(evaluation: GasPressureEvaluation): number | undefined {
  if (
    evaluation.model !== "IDEAL_GAS" ||
    evaluation.temperatureK === undefined ||
    evaluation.volumeM3 === undefined
  ) return undefined;
  const slope = IDEAL_GAS_CONSTANT_J_PER_MOL_K * evaluation.temperatureK / evaluation.volumeM3;
  return Number.isFinite(slope) && slope > 0 ? slope : undefined;
}

class UnionFind {
  private readonly parent = new Map<string, string>();

  add(id: string): void {
    if (!this.parent.has(id)) this.parent.set(id, id);
  }

  find(id: string): string {
    this.add(id);
    const parent = this.parent.get(id)!;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (ra.localeCompare(rb) <= 0) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
  }
}

interface SnapshotThermodynamics {
  pressure: Map<string, GasPressureEvaluation>;
  slope: Map<string, number>;
}

function buildSnapshotThermodynamics(input: GasTransportSolverInput): SnapshotThermodynamics {
  const thermo = new Map(input.thermodynamicInputs.map((entry) => [entry.compartmentId, entry] as const));
  const pressure = new Map<string, GasPressureEvaluation>();
  const slope = new Map<string, number>();
  for (const compartment of [...input.system.compartments].sort((a, b) => a.id.localeCompare(b.id))) {
    const evaluation = evaluateIdealGasCompartment(compartment, thermo.get(compartment.id));
    pressure.set(compartment.id, evaluation);
    const value = pressureSlopePaPerMol(evaluation);
    if (value !== undefined) slope.set(compartment.id, value);
  }
  return { pressure, slope };
}

function amountDeltaByCompartment(
  contributions: readonly GasTransportContribution[],
): {
  total: Map<string, number>;
  species: Map<string, Map<SpeciesId, number>>;
} {
  const total = new Map<string, number>();
  const species = new Map<string, Map<SpeciesId, number>>();
  const add = (compartmentId: string, speciesId: SpeciesId, amountMol: number): void => {
    total.set(compartmentId, (total.get(compartmentId) ?? 0) + amountMol);
    let bySpecies = species.get(compartmentId);
    if (!bySpecies) {
      bySpecies = new Map();
      species.set(compartmentId, bySpecies);
    }
    bySpecies.set(speciesId, (bySpecies.get(speciesId) ?? 0) + amountMol);
  };
  for (const entry of contributions) {
    add(entry.sourceCompartmentId, entry.speciesId, -entry.amountMol);
    add(entry.destinationCompartmentId, entry.speciesId, entry.amountMol);
  }
  return { total, species };
}

function signPreservingScale(initialDelta: number, deltaAtUnitScale: number): number {
  if (!Number.isFinite(initialDelta) || !Number.isFinite(deltaAtUnitScale) || initialDelta === 0) return 1;
  if (initialDelta > 0 && initialDelta + deltaAtUnitScale < 0 && deltaAtUnitScale < 0) {
    return Math.max(0, Math.min(1, initialDelta / -deltaAtUnitScale));
  }
  if (initialDelta < 0 && initialDelta + deltaAtUnitScale > 0 && deltaAtUnitScale > 0) {
    return Math.max(0, Math.min(1, -initialDelta / deltaAtUnitScale));
  }
  return 1;
}

/**
 * Applies one deterministic analytic scale per connected gas-transport component.
 * The scale is derived from the immutable pre-commit snapshot and guarantees that
 * the final combined bulk+diffusion allocation cannot reverse any non-zero total
 * or species partial-pressure ordering on an enabled GAS connection.
 */
function enforceCombinedEquilibriumEnvelope(
  input: GasTransportSolverInput,
  normalized: readonly GasTransportContribution[],
): {
  contributions: readonly GasTransportContribution[];
  limitedConnectionIds: ReadonlySet<string>;
} {
  if (normalized.length === 0) return { contributions: [], limitedConnectionIds: new Set() };

  const enabledGasConnections = [...(input.system.connections ?? [])]
    .filter((connection) => connection.enabled && connection.kind === "GAS")
    .sort((a, b) => a.id.localeCompare(b.id));
  const uf = new UnionFind();
  for (const connection of enabledGasConnections) {
    uf.union(connection.sourceCompartmentId, connection.destinationCompartmentId);
  }

  const byComponent = new Map<string, GasTransportContribution[]>();
  for (const entry of [...normalized].sort((a, b) => contributionKey(a).localeCompare(contributionKey(b)))) {
    const root = uf.find(entry.sourceCompartmentId);
    const list = byComponent.get(root) ?? [];
    list.push(entry);
    byComponent.set(root, list);
  }

  const snapshot = buildSnapshotThermodynamics(input);
  const connectionByComponent = new Map<string, typeof enabledGasConnections>();
  for (const connection of enabledGasConnections) {
    const root = uf.find(connection.sourceCompartmentId);
    const list = connectionByComponent.get(root) ?? [];
    connectionByComponent.set(root, [...list, connection]);
  }

  const result: GasTransportContribution[] = [];
  const limitedConnectionIds = new Set<string>();

  for (const [root, entries] of [...byComponent.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const deltas = amountDeltaByCompartment(entries);
    let scale = 1;
    const constraints = connectionByComponent.get(root) ?? [];

    for (const connection of constraints) {
      const sourcePressure = snapshot.pressure.get(connection.sourceCompartmentId);
      const destinationPressure = snapshot.pressure.get(connection.destinationCompartmentId);
      const sourceSlope = snapshot.slope.get(connection.sourceCompartmentId);
      const destinationSlope = snapshot.slope.get(connection.destinationCompartmentId);
      if (
        sourcePressure?.model !== "IDEAL_GAS" ||
        destinationPressure?.model !== "IDEAL_GAS" ||
        sourceSlope === undefined ||
        destinationSlope === undefined
      ) continue;

      const initialTotalDelta = (sourcePressure.pressurePa ?? 0) - (destinationPressure.pressurePa ?? 0);
      const totalDeltaAtUnitScale =
        sourceSlope * (deltas.total.get(connection.sourceCompartmentId) ?? 0) -
        destinationSlope * (deltas.total.get(connection.destinationCompartmentId) ?? 0);
      scale = Math.min(scale, signPreservingScale(initialTotalDelta, totalDeltaAtUnitScale));

      const speciesIds = new Set<SpeciesId>([
        ...Object.keys(sourcePressure.partialPressuresPa),
        ...Object.keys(destinationPressure.partialPressuresPa),
      ]);
      for (const speciesId of [...speciesIds].sort()) {
        const initialPartialDelta =
          (sourcePressure.partialPressuresPa[speciesId] ?? 0) -
          (destinationPressure.partialPressuresPa[speciesId] ?? 0);
        const speciesDeltaAtUnitScale =
          sourceSlope * (deltas.species.get(connection.sourceCompartmentId)?.get(speciesId) ?? 0) -
          destinationSlope * (deltas.species.get(connection.destinationCompartmentId)?.get(speciesId) ?? 0);
        scale = Math.min(scale, signPreservingScale(initialPartialDelta, speciesDeltaAtUnitScale));
      }
    }

    if (scale < 1) {
      for (const connection of constraints) limitedConnectionIds.add(connection.id);
    }
    for (const entry of entries) {
      const amountMol = entry.amountMol * scale;
      if (amountMol > 0 && Number.isFinite(amountMol)) result.push({ ...entry, amountMol });
    }
  }

  return {
    contributions: result.sort((a, b) => contributionKey(a).localeCompare(contributionKey(b))),
    limitedConnectionIds,
  };
}

function finalBulkAmountByConnection(contributions: readonly GasTransportContribution[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const entry of contributions) {
    if (entry.kind !== "BULK_PRESSURE") continue;
    result.set(entry.connectionId, (result.get(entry.connectionId) ?? 0) + entry.amountMol);
  }
  return result;
}

/**
 * Public Phase 4A-2 evaluator. The raw solver first performs its canonical
 * source/species availability normalization. This wrapper then applies the
 * shared combined-mechanism equilibrium envelope once and rebuilds every public
 * transfer view and final diagnostic from that same final contribution set.
 */
export function evaluateGasTransport(input: GasTransportSolverInput): GasTransportEvaluation {
  const raw = evaluateGasTransportRaw(input);
  const stabilized = enforceCombinedEquilibriumEnvelope(input, raw.contributions);
  const contributions = stabilized.contributions;
  const bulkTransfers = groupRequests(contributions, "BULK_PRESSURE");
  const diffusiveTransfers = groupRequests(contributions, "SPECIES_DIFFUSION");
  const transferRequests = groupRequests(contributions);
  const finalBulk = finalBulkAmountByConnection(contributions);

  const diagnostics = raw.diagnostics.map((diagnostic) => {
    const reasonCodes = new Set(diagnostic.reasonCodes);
    if (stabilized.limitedConnectionIds.has(diagnostic.connectionId)) {
      reasonCodes.add("COMBINED_EQUILIBRIUM_NORMALIZED");
    }
    return {
      ...diagnostic,
      reasonCodes: [...reasonCodes].sort(),
      ...(diagnostic.boundedBulkAmountMol === undefined
        ? {}
        : { boundedBulkAmountMol: finalBulk.get(diagnostic.connectionId) ?? 0 }),
    };
  });

  return {
    ...raw,
    bulkTransfers,
    diffusiveTransfers,
    transferRequests,
    contributions,
    diagnostics,
  };
}
