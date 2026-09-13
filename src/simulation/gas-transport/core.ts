import type {
  MatterCompartmentState,
  MatterConnectionState,
  MatterSystemState,
  MatterTransferRequest,
} from "../compartment";
import type { ScientificStatus, SpeciesId, SpeciesState } from "../molecular";
import type {
  GasCompartmentThermodynamicInput,
  GasConnectionTransportModel,
  GasPressureEvaluation,
  GasThermodynamicReasonCode,
  GasTransportConnectionDiagnostic,
  GasTransportContribution,
  GasTransportContributionKind,
  GasTransportEvaluation,
  GasTransportReasonCode,
  GasTransportSolverInput,
} from "./types";

export const IDEAL_GAS_CONSTANT_J_PER_MOL_K = 8.31446261815324;

const STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

function worstStatus(values: readonly ScientificStatus[]): ScientificStatus {
  return values.reduce(
    (worst, value) => STATUS_ORDER[value] > STATUS_ORDER[worst] ? value : worst,
    "VERIFIED",
  );
}

function sortedRecord(entries: Iterable<readonly [string, number]>): Readonly<Record<string, number>> {
  return Object.freeze(Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b))));
}

function gasSpecies(compartment: MatterCompartmentState): readonly SpeciesState[] {
  return compartment.species
    .filter((species) => species.phaseState.phase === "gas")
    .sort((a, b) => a.id.localeCompare(b.id));
}

function openPressure(
  compartmentId: string,
  reasonCode: GasThermodynamicReasonCode,
): GasPressureEvaluation {
  return {
    compartmentId,
    model: "OPEN",
    scientificStatus: "OPEN",
    reasonCodes: [reasonCode],
    partialPressuresPa: Object.freeze({}),
    moleFractions: Object.freeze({}),
  };
}

/**
 * Ideal-gas baseline for gas-phase species only. This reads matter state but
 * never mutates it. A zero-gas compartment is valid and evaluates to 0 Pa.
 */
export function evaluateIdealGasCompartment(
  compartment: MatterCompartmentState,
  thermodynamicInput: GasCompartmentThermodynamicInput | undefined,
): GasPressureEvaluation {
  const volumeM3 = compartment.volumeM3;
  if (volumeM3 === undefined) return openPressure(compartment.id, "MISSING_VOLUME");
  if (!Number.isFinite(volumeM3) || volumeM3 <= 0) return openPressure(compartment.id, "INVALID_VOLUME");
  if (!thermodynamicInput) return openPressure(compartment.id, "MISSING_TEMPERATURE");
  const temperatureK = thermodynamicInput.temperatureK;
  if (!Number.isFinite(temperatureK) || temperatureK <= 0) return openPressure(compartment.id, "INVALID_TEMPERATURE");

  const species = gasSpecies(compartment);
  let totalGasAmountMol = 0;
  for (const entry of species) {
    if (!Number.isFinite(entry.amountMol) || entry.amountMol < 0) {
      return openPressure(compartment.id, "NONFINITE_GAS_AMOUNT");
    }
    totalGasAmountMol += entry.amountMol;
  }
  if (!Number.isFinite(totalGasAmountMol)) return openPressure(compartment.id, "NONFINITE_GAS_AMOUNT");

  const pressureScalePaPerMol = IDEAL_GAS_CONSTANT_J_PER_MOL_K * temperatureK / volumeM3;
  const pressurePa = totalGasAmountMol * pressureScalePaPerMol;
  if (!Number.isFinite(pressurePa)) return openPressure(compartment.id, "NONFINITE_GAS_AMOUNT");

  const partial = new Map<SpeciesId, number>();
  const fractions = new Map<SpeciesId, number>();
  for (const entry of species) {
    const partialPressurePa = entry.amountMol * pressureScalePaPerMol;
    if (!Number.isFinite(partialPressurePa)) return openPressure(compartment.id, "NONFINITE_GAS_AMOUNT");
    partial.set(entry.id, partialPressurePa);
    fractions.set(entry.id, totalGasAmountMol > 0 ? entry.amountMol / totalGasAmountMol : 0);
  }

  return {
    compartmentId: compartment.id,
    model: "IDEAL_GAS",
    scientificStatus: "APPROXIMATED",
    reasonCodes: ["IDEAL_GAS_SUPPORTED"],
    volumeM3,
    temperatureK,
    totalGasAmountMol,
    pressurePa,
    partialPressuresPa: sortedRecord(partial.entries()),
    moleFractions: sortedRecord(fractions.entries()),
  };
}

export function idealGasPartialPressurePa(
  evaluation: GasPressureEvaluation,
  speciesId: SpeciesId,
): number | undefined {
  if (evaluation.model !== "IDEAL_GAS") return undefined;
  return evaluation.partialPressuresPa[speciesId] ?? 0;
}

function requireUniqueById<T extends { connectionId?: string; compartmentId?: string }>(
  values: readonly T[],
  kind: "connectionId" | "compartmentId",
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = value[kind];
    if (!id || result.has(id)) throw new RangeError(`${kind} values must be non-empty and unique.`);
    result.set(id, value);
  }
  return result;
}

function validConductance(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}

function validateConnectionModel(model: GasConnectionTransportModel): boolean {
  if (!validConductance(model.bulkMolarConductanceMolPerSPaS)) return false;
  if (!validConductance(model.diffusiveMolarConductanceMolPerSPaS)) return false;
  for (const value of Object.values(model.speciesDiffusiveMolarConductanceMolPerSPaS ?? {})) {
    if (!validConductance(value)) return false;
  }
  return true;
}

function pressureSlopePaPerMol(evaluation: GasPressureEvaluation): number | undefined {
  if (
    evaluation.model !== "IDEAL_GAS" ||
    evaluation.temperatureK === undefined ||
    evaluation.volumeM3 === undefined
  ) return undefined;
  const value = IDEAL_GAS_CONSTANT_J_PER_MOL_K * evaluation.temperatureK / evaluation.volumeM3;
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * Exact relaxation amount for the linear two-compartment conductance model:
 * d(n)/dt = G * deltaP and d(deltaP)/dn = -(slopeSource+slopeDestination).
 * This closed form cannot cross the pairwise pressure-equality boundary for any
 * finite dt and avoids transport micro-substeps.
 */
function relaxedAmountMol(
  deltaPressurePa: number,
  conductanceMolPerSPaS: number,
  sourceSlopePaPerMol: number,
  destinationSlopePaPerMol: number,
  dtS: number,
): number {
  if (!(deltaPressurePa > 0) || conductanceMolPerSPaS === 0) return 0;
  const slope = sourceSlopePaPerMol + destinationSlopePaPerMol;
  if (!Number.isFinite(slope) || slope <= 0) return 0;
  const equilibriumExtentMol = deltaPressurePa / slope;
  const exponent = -conductanceMolPerSPaS * slope * dtS;
  const relaxation = exponent < -745 ? 1 : -Math.expm1(exponent);
  const amount = equilibriumExtentMol * Math.min(1, Math.max(0, relaxation));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

interface MutableDiagnostic {
  connectionId: string;
  scientificStatus: ScientificStatus;
  reasons: Set<GasTransportReasonCode>;
  sourcePressurePa?: number;
  destinationPressurePa?: number;
  desiredBulkAmountMol?: number;
  boundedBulkAmountMol?: number;
}

function sourceSpeciesAmount(system: MatterSystemState, compartmentId: string, speciesId: string): number {
  const compartment = system.compartments.find((entry) => entry.id === compartmentId);
  return compartment?.species.find((entry) => entry.id === speciesId)?.amountMol ?? 0;
}

function contributionKey(entry: GasTransportContribution): string {
  return [entry.sourceCompartmentId, entry.speciesId, entry.connectionId, entry.kind, entry.destinationCompartmentId].join("\u0000");
}

function availabilityKey(entry: GasTransportContribution): string {
  return `${entry.sourceCompartmentId}\u0000${entry.speciesId}`;
}

/** Proportionally normalizes competing outgoing demands from the same source/species snapshot. */
function normalizeSourceAvailability(
  system: MatterSystemState,
  raw: readonly GasTransportContribution[],
  diagnostics: Map<string, MutableDiagnostic>,
): readonly GasTransportContribution[] {
  const sorted = [...raw].sort((a, b) => contributionKey(a).localeCompare(contributionKey(b)));
  const grouped = new Map<string, GasTransportContribution[]>();
  for (const entry of sorted) {
    const key = availabilityKey(entry);
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  const result: GasTransportContribution[] = [];
  for (const [key, entries] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const separator = key.indexOf("\u0000");
    const compartmentId = key.slice(0, separator);
    const speciesId = key.slice(separator + 1);
    const availableMol = sourceSpeciesAmount(system, compartmentId, speciesId);
    const totalDemandMol = entries.reduce((sum, entry) => sum + entry.amountMol, 0);
    const scale = totalDemandMol > availableMol && totalDemandMol > 0 ? availableMol / totalDemandMol : 1;
    let remainingMol = availableMol;
    for (const entry of entries) {
      const scaled = Math.min(remainingMol, entry.amountMol * scale);
      if (scaled > 0 && Number.isFinite(scaled)) {
        result.push({ ...entry, amountMol: scaled });
        remainingMol = Math.max(0, remainingMol - scaled);
      }
      if (scale < 1) diagnostics.get(entry.connectionId)?.reasons.add("SOURCE_AVAILABILITY_NORMALIZED");
    }
  }
  return result;
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

function modelDiffusiveConductance(
  model: GasConnectionTransportModel,
  speciesId: SpeciesId,
): number | undefined {
  const specific = model.speciesDiffusiveMolarConductanceMolPerSPaS?.[speciesId];
  return specific ?? model.diffusiveMolarConductanceMolPerSPaS;
}

function connectionDiagnostic(
  connection: MatterConnectionState,
  status: ScientificStatus = "APPROXIMATED",
): MutableDiagnostic {
  return { connectionId: connection.id, scientificStatus: status, reasons: new Set() };
}

function immutableDiagnostic(value: MutableDiagnostic): GasTransportConnectionDiagnostic {
  return {
    connectionId: value.connectionId,
    scientificStatus: value.scientificStatus,
    reasonCodes: [...value.reasons].sort(),
    ...(value.sourcePressurePa === undefined ? {} : { sourcePressurePa: value.sourcePressurePa }),
    ...(value.destinationPressurePa === undefined ? {} : { destinationPressurePa: value.destinationPressurePa }),
    ...(value.desiredBulkAmountMol === undefined ? {} : { desiredBulkAmountMol: value.desiredBulkAmountMol }),
    ...(value.boundedBulkAmountMol === undefined ? {} : { boundedBulkAmountMol: value.boundedBulkAmountMol }),
  };
}

/**
 * Phase 4A-2 well-mixed gas transport amount solver. The returned requests are
 * intended for 01 transferMatterBatch(); this function never commits matter.
 * Existing directed GAS topology is respected exactly. Reverse physical flow
 * requires a separately enabled reverse directed connection.
 */
export function evaluateGasTransport(input: GasTransportSolverInput): GasTransportEvaluation {
  if (!Number.isFinite(input.dtS) || input.dtS <= 0) throw new RangeError("dtS must be finite and > 0.");

  const thermodynamicInputs = requireUniqueById(input.thermodynamicInputs, "compartmentId");
  const connectionModels = requireUniqueById(input.connectionModels, "connectionId");
  const compartments = new Map(input.system.compartments.map((entry) => [entry.id, entry] as const));
  const pressureCache = new Map<string, GasPressureEvaluation>();
  const pressureFor = (compartment: MatterCompartmentState): GasPressureEvaluation => {
    const cached = pressureCache.get(compartment.id);
    if (cached) return cached;
    const value = evaluateIdealGasCompartment(compartment, thermodynamicInputs.get(compartment.id));
    pressureCache.set(compartment.id, value);
    return value;
  };

  const raw: GasTransportContribution[] = [];
  const diagnostics = new Map<string, MutableDiagnostic>();
  const connections = [...(input.system.connections ?? [])].sort((a, b) => a.id.localeCompare(b.id));

  for (const connection of connections) {
    const diagnostic = connectionDiagnostic(connection);
    diagnostics.set(connection.id, diagnostic);
    if (!connection.enabled) {
      diagnostic.reasons.add("DISABLED_CONNECTION");
      continue;
    }
    if (connection.kind !== "GAS") {
      diagnostic.reasons.add("NON_GAS_CONNECTION");
      continue;
    }
    const model = connectionModels.get(connection.id);
    if (!model) {
      diagnostic.scientificStatus = "OPEN";
      diagnostic.reasons.add("MISSING_CONNECTION_MODEL");
      continue;
    }
    if (!validateConnectionModel(model)) {
      diagnostic.scientificStatus = "OPEN";
      diagnostic.reasons.add("INVALID_CONDUCTANCE");
      continue;
    }
    const source = compartments.get(connection.sourceCompartmentId);
    const destination = compartments.get(connection.destinationCompartmentId);
    if (!source || !destination) {
      diagnostic.scientificStatus = "OPEN";
      diagnostic.reasons.add("OPEN_THERMODYNAMIC_ENDPOINT");
      continue;
    }
    const sourceGas = pressureFor(source);
    const destinationGas = pressureFor(destination);
    diagnostic.sourcePressurePa = sourceGas.pressurePa;
    diagnostic.destinationPressurePa = destinationGas.pressurePa;
    if (sourceGas.model !== "IDEAL_GAS" || destinationGas.model !== "IDEAL_GAS") {
      diagnostic.scientificStatus = "OPEN";
      diagnostic.reasons.add("OPEN_THERMODYNAMIC_ENDPOINT");
      continue;
    }
    const sourceSlope = pressureSlopePaPerMol(sourceGas);
    const destinationSlope = pressureSlopePaPerMol(destinationGas);
    if (sourceSlope === undefined || destinationSlope === undefined) {
      diagnostic.scientificStatus = "OPEN";
      diagnostic.reasons.add("OPEN_THERMODYNAMIC_ENDPOINT");
      continue;
    }
    const contributionStatus = worstStatus([
      "APPROXIMATED",
      sourceGas.scientificStatus,
      destinationGas.scientificStatus,
      model.scientificStatus,
    ]);
    diagnostic.scientificStatus = contributionStatus;
    diagnostic.reasons.add("SUPPORTED_IDEAL_GAS_TRANSPORT");

    const sourceTotalMol = sourceGas.totalGasAmountMol ?? 0;
    if (!(sourceTotalMol > 0)) diagnostic.reasons.add("NO_GAS_SOURCE");

    const bulkConductance = model.bulkMolarConductanceMolPerSPaS ?? 0;
    const deltaPressure = (sourceGas.pressurePa ?? 0) - (destinationGas.pressurePa ?? 0);
    const desiredBulk = relaxedAmountMol(deltaPressure, bulkConductance, sourceSlope, destinationSlope, input.dtS);
    diagnostic.desiredBulkAmountMol = desiredBulk;
    const boundedBulk = Math.min(sourceTotalMol, desiredBulk);
    diagnostic.boundedBulkAmountMol = boundedBulk;
    if (!(deltaPressure > 0) || bulkConductance === 0) diagnostic.reasons.add("ZERO_PRESSURE_GRADIENT");

    if (boundedBulk > 0 && sourceTotalMol > 0) {
      for (const speciesId of Object.keys(sourceGas.moleFractions).sort()) {
        const moleFraction = sourceGas.moleFractions[speciesId] ?? 0;
        const amountMol = boundedBulk * moleFraction;
        if (amountMol > 0 && Number.isFinite(amountMol)) {
          raw.push({
            kind: "BULK_PRESSURE",
            connectionId: connection.id,
            sourceCompartmentId: source.id,
            destinationCompartmentId: destination.id,
            speciesId,
            amountMol,
            scientificStatus: contributionStatus,
          });
        }
      }
    }

    let anyDiffusionGradient = false;
    for (const speciesState of gasSpecies(source)) {
      const conductance = modelDiffusiveConductance(model, speciesState.id);
      if (conductance === undefined || conductance === 0) continue;
      const sourcePartial = sourceGas.partialPressuresPa[speciesState.id] ?? 0;
      const destinationPartial = destinationGas.partialPressuresPa[speciesState.id] ?? 0;
      const deltaPartial = sourcePartial - destinationPartial;
      if (!(deltaPartial > 0)) continue;
      anyDiffusionGradient = true;
      const desired = relaxedAmountMol(deltaPartial, conductance, sourceSlope, destinationSlope, input.dtS);
      const bounded = Math.min(speciesState.amountMol, desired);
      if (bounded > 0 && Number.isFinite(bounded)) {
        raw.push({
          kind: "SPECIES_DIFFUSION",
          connectionId: connection.id,
          sourceCompartmentId: source.id,
          destinationCompartmentId: destination.id,
          speciesId: speciesState.id,
          amountMol: bounded,
          scientificStatus: contributionStatus,
        });
      }
    }
    if (!anyDiffusionGradient) diagnostic.reasons.add("ZERO_DIFFUSION_GRADIENT");
  }

  const contributions = normalizeSourceAvailability(input.system, raw, diagnostics);
  const bulkTransfers = groupRequests(contributions, "BULK_PRESSURE");
  const diffusiveTransfers = groupRequests(contributions, "SPECIES_DIFFUSION");
  const transferRequests = groupRequests(contributions);
  const immutableDiagnostics = [...diagnostics.values()]
    .sort((a, b) => a.connectionId.localeCompare(b.connectionId))
    .map(immutableDiagnostic);
  const statuses = [
    ...immutableDiagnostics.map((entry) => entry.scientificStatus),
    ...contributions.map((entry) => entry.scientificStatus),
  ];

  return {
    scientificStatus: statuses.length > 0 ? worstStatus(statuses) : "APPROXIMATED",
    bulkTransfers,
    diffusiveTransfers,
    transferRequests,
    contributions: [...contributions].sort((a, b) => contributionKey(a).localeCompare(contributionKey(b))),
    diagnostics: immutableDiagnostics,
  };
}
