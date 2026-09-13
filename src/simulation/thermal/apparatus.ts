import type { ScientificStatus, SpeciesState } from "../molecular";
import {
  applySensibleEnergy,
  totalSensibleHeatCapacity_JPerK,
  validateThermalState,
} from "./thermal";
import type {
  MixtureHeatCapacityEvaluation,
  SpeciesMolarHeatCapacityInput,
  ThermalApparatusEvaluation,
  ThermalBody,
  ThermalBodyId,
  ThermalBodyUpdate,
  ThermalContact,
  ThermalDiagnostic,
  ThermalPowerActuator,
  ThermalReactionSource,
  ThermalReservoirBoundary,
  ThermalTransfer,
} from "./types";

const STATUS_ORDER: Record<ScientificStatus, number> = {
  VERIFIED: 0,
  APPROXIMATED: 1,
  EMPIRICAL: 2,
  GAMEPLAY_SIMPLIFICATION: 3,
  OPEN: 4,
};

function worstStatus(...statuses: ScientificStatus[]): ScientificStatus {
  return statuses.reduce((worst, current) =>
    STATUS_ORDER[current] > STATUS_ORDER[worst] ? current : worst,
  "VERIFIED");
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function relaxationFraction(ratePerS: number, dtS: number): number {
  if (ratePerS === 0 || dtS === 0) return 0;
  const exponent = ratePerS * dtS;
  if (exponent === Number.POSITIVE_INFINITY) return 1;
  const fraction = -Math.expm1(-exponent);
  return Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 1;
}

function add(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function bodyMapOrThrow(bodies: readonly ThermalBody[]): Map<ThermalBodyId, ThermalBody> {
  const map = new Map<ThermalBodyId, ThermalBody>();
  for (const body of [...bodies].sort((a, b) => a.id.localeCompare(b.id))) {
    if (map.has(body.id)) throw new Error(`Duplicate thermal body id: ${body.id}`);
    validateThermalState(body.state);
    map.set(body.id, body);
  }
  return map;
}

export function evaluateMixtureHeatCapacity(
  species: readonly SpeciesState[],
  data: readonly SpeciesMolarHeatCapacityInput[],
): MixtureHeatCapacityEvaluation {
  const records = [...data].sort((a, b) =>
    a.speciesId.localeCompare(b.speciesId) ||
    a.phase.localeCompare(b.phase) ||
    a.source.localeCompare(b.source),
  );
  const included: string[] = [];
  const missing: string[] = [];
  let total = 0;
  let status: ScientificStatus = "VERIFIED";

  for (const entry of [...species].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!finiteNonNegative(entry.amountMol)) {
      missing.push(entry.id);
      status = "OPEN";
      continue;
    }
    if (entry.amountMol === 0) continue;

    const matches = records.filter((record) =>
      record.speciesId === entry.id && record.phase === entry.phaseState.phase,
    );
    if (matches.length !== 1) {
      missing.push(entry.id);
      status = "OPEN";
      continue;
    }

    const record = matches[0]!;
    if (!finitePositive(record.molarHeatCapacity_JPerMolK)) {
      missing.push(entry.id);
      status = "OPEN";
      continue;
    }

    const contribution = entry.amountMol * record.molarHeatCapacity_JPerMolK;
    if (!Number.isFinite(contribution)) {
      missing.push(entry.id);
      status = "OPEN";
      continue;
    }
    total += contribution;
    if (!Number.isFinite(total)) {
      return {
        scientificStatus: "OPEN",
        includedSpeciesIds: included,
        missingSpeciesIds: [...new Set([...missing, entry.id])].sort(),
      };
    }
    included.push(entry.id);
    status = worstStatus(status, record.scientificStatus);
  }

  if (missing.length > 0 || !(total > 0)) {
    return {
      scientificStatus: "OPEN",
      includedSpeciesIds: [...new Set(included)].sort(),
      missingSpeciesIds: [...new Set(missing)].sort(),
    };
  }

  return {
    heatCapacity_JPerK: total,
    scientificStatus: status,
    includedSpeciesIds: [...new Set(included)].sort(),
    missingSpeciesIds: [],
  };
}

type RawInternalTransfer = ThermalTransfer & {
  sourceTemperatureK: number;
  destinationTemperatureK: number;
};

function evaluateFiniteContacts(
  bodyMap: Map<ThermalBodyId, ThermalBody>,
  contacts: readonly ThermalContact[],
  dtS: number,
  diagnostics: ThermalDiagnostic[],
): RawInternalTransfer[] {
  const raw: RawInternalTransfer[] = [];

  for (const contact of [...contacts].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!contact.enabled) continue;
    if (!finiteNonNegative(contact.conductanceWPerK)) {
      diagnostics.push({ id: contact.id, scientificStatus: "OPEN", reasonCodes: ["INVALID_CONDUCTANCE"] });
      continue;
    }
    if (contact.conductanceWPerK === 0 || dtS === 0) continue;

    const a = bodyMap.get(contact.bodyAId);
    const b = bodyMap.get(contact.bodyBId);
    if (!a || !b || a.id === b.id) {
      diagnostics.push({ id: contact.id, scientificStatus: "OPEN", reasonCodes: ["INVALID_THERMAL_CONTACT"] });
      continue;
    }

    const ta = a.state.temperatureK;
    const tb = b.state.temperatureK;
    if (ta === tb) continue;
    const ca = totalSensibleHeatCapacity_JPerK(a.state);
    const cb = totalSensibleHeatCapacity_JPerK(b.state);
    const inverseCapacitySum = 1 / ca + 1 / cb;
    const equilibriumEnergyJ = Math.abs(ta - tb) / inverseCapacitySum;
    const ratePerS = contact.conductanceWPerK * inverseCapacitySum;
    const energyJ = equilibriumEnergyJ * relaxationFraction(ratePerS, dtS);
    if (!(energyJ > 0) || !Number.isFinite(energyJ)) {
      diagnostics.push({ id: contact.id, scientificStatus: "OPEN", reasonCodes: ["NONFINITE_CONTACT_ENERGY"] });
      continue;
    }

    const hot = ta > tb ? a : b;
    const cold = ta > tb ? b : a;
    raw.push({
      id: contact.id,
      sourceId: hot.id,
      destinationId: cold.id,
      energyJ,
      mechanism: contact.mechanism,
      scientificStatus: contact.scientificStatus,
      sourceTemperatureK: hot.state.temperatureK,
      destinationTemperatureK: cold.state.temperatureK,
    });
  }

  return raw;
}

function normalizeFiniteContactNetwork(
  bodyMap: Map<ThermalBodyId, ThermalBody>,
  raw: readonly RawInternalTransfer[],
): ThermalTransfer[] {
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  const minimumSinkTemperature = new Map<string, number>();
  const maximumSourceTemperature = new Map<string, number>();

  for (const transfer of raw) {
    add(outgoing, transfer.sourceId, transfer.energyJ);
    add(incoming, transfer.destinationId, transfer.energyJ);
    minimumSinkTemperature.set(
      transfer.sourceId,
      Math.min(minimumSinkTemperature.get(transfer.sourceId) ?? Number.POSITIVE_INFINITY, transfer.destinationTemperatureK),
    );
    maximumSourceTemperature.set(
      transfer.destinationId,
      Math.max(maximumSourceTemperature.get(transfer.destinationId) ?? Number.NEGATIVE_INFINITY, transfer.sourceTemperatureK),
    );
  }

  const outgoingScale = new Map<string, number>();
  const incomingScale = new Map<string, number>();
  for (const [bodyId, requested] of outgoing) {
    const body = bodyMap.get(bodyId)!;
    const capacity = totalSensibleHeatCapacity_JPerK(body.state);
    const floorK = minimumSinkTemperature.get(bodyId)!;
    const capJ = Math.max(0, capacity * (body.state.temperatureK - floorK));
    outgoingScale.set(bodyId, requested > capJ && requested > 0 ? capJ / requested : 1);
  }
  for (const [bodyId, requested] of incoming) {
    const body = bodyMap.get(bodyId)!;
    const capacity = totalSensibleHeatCapacity_JPerK(body.state);
    const ceilingK = maximumSourceTemperature.get(bodyId)!;
    const capJ = Math.max(0, capacity * (ceilingK - body.state.temperatureK));
    incomingScale.set(bodyId, requested > capJ && requested > 0 ? capJ / requested : 1);
  }

  return raw.map((transfer) => ({
    id: transfer.id,
    sourceId: transfer.sourceId,
    destinationId: transfer.destinationId,
    energyJ: transfer.energyJ * Math.min(
      outgoingScale.get(transfer.sourceId) ?? 1,
      incomingScale.get(transfer.destinationId) ?? 1,
    ),
    mechanism: transfer.mechanism,
    scientificStatus: transfer.scientificStatus,
  })).filter((transfer) => transfer.energyJ > 0);
}

function evaluateReservoirs(
  bodyMap: Map<ThermalBodyId, ThermalBody>,
  boundaries: readonly ThermalReservoirBoundary[],
  dtS: number,
  diagnostics: ThermalDiagnostic[],
): ThermalTransfer[] {
  const raw = [...boundaries].sort((a, b) => a.id.localeCompare(b.id)).flatMap((boundary): ThermalTransfer[] => {
    if (!boundary.enabled) return [];
    if (!finiteNonNegative(boundary.conductanceWPerK) || !finitePositive(boundary.reservoirTemperatureK)) {
      diagnostics.push({ id: boundary.id, scientificStatus: "OPEN", reasonCodes: ["INVALID_RESERVOIR_BOUNDARY"] });
      return [];
    }
    const body = bodyMap.get(boundary.bodyId);
    if (!body) {
      diagnostics.push({ id: boundary.id, scientificStatus: "OPEN", reasonCodes: ["MISSING_THERMAL_BODY"] });
      return [];
    }
    if (boundary.conductanceWPerK === 0 || dtS === 0 || body.state.temperatureK === boundary.reservoirTemperatureK) return [];

    const capacity = totalSensibleHeatCapacity_JPerK(body.state);
    const ratePerS = boundary.conductanceWPerK / capacity;
    const energyMagnitudeJ = capacity * Math.abs(boundary.reservoirTemperatureK - body.state.temperatureK) * relaxationFraction(ratePerS, dtS);
    if (!(energyMagnitudeJ > 0) || !Number.isFinite(energyMagnitudeJ)) {
      diagnostics.push({ id: boundary.id, scientificStatus: "OPEN", reasonCodes: ["NONFINITE_RESERVOIR_ENERGY"] });
      return [];
    }
    const reservoirId = `RESERVOIR:${boundary.id}`;
    return [{
      id: boundary.id,
      sourceId: boundary.reservoirTemperatureK > body.state.temperatureK ? reservoirId : body.id,
      destinationId: boundary.reservoirTemperatureK > body.state.temperatureK ? body.id : reservoirId,
      energyJ: energyMagnitudeJ,
      mechanism: boundary.mechanism,
      scientificStatus: boundary.scientificStatus,
    }];
  });

  const grouped = new Map<string, ThermalTransfer[]>();
  for (const transfer of raw) {
    const bodyId = transfer.sourceId.startsWith("RESERVOIR:") ? transfer.destinationId : transfer.sourceId;
    const list = grouped.get(bodyId) ?? [];
    list.push(transfer);
    grouped.set(bodyId, list);
  }

  const result: ThermalTransfer[] = [];
  for (const [bodyId, transfers] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const body = bodyMap.get(bodyId)!;
    const capacity = totalSensibleHeatCapacity_JPerK(body.state);
    const sourceBoundaries = boundaries.filter((boundary) => boundary.bodyId === bodyId && boundary.enabled);
    const heating = transfers.filter((transfer) => transfer.destinationId === bodyId);
    const cooling = transfers.filter((transfer) => transfer.sourceId === bodyId);
    const heatingRequested = heating.reduce((sum, transfer) => sum + transfer.energyJ, 0);
    const coolingRequested = cooling.reduce((sum, transfer) => sum + transfer.energyJ, 0);
    const maxReservoirT = Math.max(body.state.temperatureK, ...sourceBoundaries.map((entry) => entry.reservoirTemperatureK));
    const minReservoirT = Math.min(body.state.temperatureK, ...sourceBoundaries.map((entry) => entry.reservoirTemperatureK));
    const heatingCap = capacity * (maxReservoirT - body.state.temperatureK);
    const coolingCap = capacity * (body.state.temperatureK - minReservoirT);
    const heatingScale = heatingRequested > heatingCap && heatingRequested > 0 ? heatingCap / heatingRequested : 1;
    const coolingScale = coolingRequested > coolingCap && coolingRequested > 0 ? coolingCap / coolingRequested : 1;
    for (const transfer of transfers) {
      const scale = transfer.destinationId === bodyId ? heatingScale : coolingScale;
      if (transfer.energyJ * scale > 0) result.push({ ...transfer, energyJ: transfer.energyJ * scale });
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}

function evaluateActuators(
  bodyMap: Map<ThermalBodyId, ThermalBody>,
  actuators: readonly ThermalPowerActuator[],
  dtS: number,
  diagnostics: ThermalDiagnostic[],
): ThermalTransfer[] {
  const result: ThermalTransfer[] = [];
  for (const actuator of [...actuators].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!actuator.enabled) continue;
    if (!finiteNonNegative(actuator.powerW) || (actuator.targetTemperatureK !== undefined && !finitePositive(actuator.targetTemperatureK))) {
      diagnostics.push({ id: actuator.id, scientificStatus: "OPEN", reasonCodes: ["INVALID_POWER_ACTUATOR"] });
      continue;
    }
    const body = bodyMap.get(actuator.bodyId);
    if (!body) {
      diagnostics.push({ id: actuator.id, scientificStatus: "OPEN", reasonCodes: ["MISSING_THERMAL_BODY"] });
      continue;
    }
    if (actuator.powerW === 0 || dtS === 0) continue;
    let energyJ = actuator.powerW * dtS;
    if (!Number.isFinite(energyJ)) {
      diagnostics.push({ id: actuator.id, scientificStatus: "OPEN", reasonCodes: ["NONFINITE_EXTERNAL_ENERGY"] });
      continue;
    }

    if (actuator.targetTemperatureK !== undefined) {
      const capacity = totalSensibleHeatCapacity_JPerK(body.state);
      const deltaToTargetK = actuator.targetTemperatureK - body.state.temperatureK;
      if ((actuator.mode === "HEATER" && deltaToTargetK <= 0) || (actuator.mode === "COOLER" && deltaToTargetK >= 0)) continue;
      energyJ = Math.min(energyJ, capacity * Math.abs(deltaToTargetK));
    }
    if (!(energyJ > 0)) continue;

    const externalId = `EXTERNAL:${actuator.id}`;
    result.push({
      id: actuator.id,
      sourceId: actuator.mode === "HEATER" ? externalId : body.id,
      destinationId: actuator.mode === "HEATER" ? body.id : externalId,
      energyJ,
      mechanism: actuator.mode === "HEATER" ? "EXTERNAL_HEATER" : "EXTERNAL_COOLER",
      scientificStatus: actuator.scientificStatus,
    });
  }
  return result;
}

export function evaluateThermalApparatusStep(input: {
  bodies: readonly ThermalBody[];
  contacts?: readonly ThermalContact[];
  reservoirs?: readonly ThermalReservoirBoundary[];
  actuators?: readonly ThermalPowerActuator[];
  reactionSources?: readonly ThermalReactionSource[];
  dtS: number;
}): ThermalApparatusEvaluation {
  if (!finiteNonNegative(input.dtS)) throw new RangeError("dtS must be finite and >= 0");
  const bodyMap = bodyMapOrThrow(input.bodies);
  const diagnostics: ThermalDiagnostic[] = [];
  const internalTransfers = normalizeFiniteContactNetwork(
    bodyMap,
    evaluateFiniteContacts(bodyMap, input.contacts ?? [], input.dtS, diagnostics),
  );
  const reservoirTransfers = evaluateReservoirs(bodyMap, input.reservoirs ?? [], input.dtS, diagnostics);
  const actuatorTransfers = evaluateActuators(bodyMap, input.actuators ?? [], input.dtS, diagnostics);
  const transfers = [...internalTransfers, ...reservoirTransfers, ...actuatorTransfers].sort((a, b) => a.id.localeCompare(b.id) || a.sourceId.localeCompare(b.sourceId) || a.destinationId.localeCompare(b.destinationId));

  const internal = new Map<string, number>();
  const reservoir = new Map<string, number>();
  const heater = new Map<string, number>();
  const cooler = new Map<string, number>();
  const bodyStatus = new Map<string, ScientificStatus>();

  for (const body of bodyMap.values()) bodyStatus.set(body.id, body.scientificStatus);
  for (const transfer of transfers) {
    if (bodyMap.has(transfer.sourceId)) bodyStatus.set(transfer.sourceId, worstStatus(bodyStatus.get(transfer.sourceId) ?? "VERIFIED", transfer.scientificStatus));
    if (bodyMap.has(transfer.destinationId)) bodyStatus.set(transfer.destinationId, worstStatus(bodyStatus.get(transfer.destinationId) ?? "VERIFIED", transfer.scientificStatus));
    if (transfer.mechanism === "CONTACT" || transfer.mechanism === "BATH" || transfer.mechanism === "CONVECTION") {
      add(internal, transfer.sourceId, -transfer.energyJ);
      add(internal, transfer.destinationId, transfer.energyJ);
    } else if (transfer.mechanism === "AMBIENT" || transfer.mechanism === "CONTROLLED_CHAMBER") {
      const bodyId = bodyMap.has(transfer.sourceId) ? transfer.sourceId : transfer.destinationId;
      add(reservoir, bodyId, bodyMap.has(transfer.destinationId) ? transfer.energyJ : -transfer.energyJ);
    } else if (transfer.mechanism === "EXTERNAL_HEATER") {
      add(heater, transfer.destinationId, transfer.energyJ);
    } else if (transfer.mechanism === "EXTERNAL_COOLER") {
      add(cooler, transfer.sourceId, transfer.energyJ);
    }
  }

  const reaction = new Map<string, number>();
  let reactionEnergyJ = 0;
  for (const source of [...(input.reactionSources ?? [])].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!Number.isFinite(source.energyJ) || !bodyMap.has(source.bodyId)) {
      diagnostics.push({ id: source.id, scientificStatus: "OPEN", reasonCodes: ["INVALID_REACTION_HEAT_SOURCE"] });
      continue;
    }
    add(reaction, source.bodyId, source.energyJ);
    reactionEnergyJ += source.energyJ;
    bodyStatus.set(source.bodyId, worstStatus(bodyStatus.get(source.bodyId) ?? "VERIFIED", source.scientificStatus));
  }
  if (!Number.isFinite(reactionEnergyJ)) {
    return { scientificStatus: "OPEN", transfers: [], externalEnergyJ: 0, reactionEnergyJ: 0, bodyUpdates: [], diagnostics: [...diagnostics, { id: "reaction-total", scientificStatus: "OPEN", reasonCodes: ["NONFINITE_REACTION_ENERGY"] }] };
  }

  const externalEnergyJ = [...reservoir.values()].reduce((sum, value) => sum + value, 0)
    + [...heater.values()].reduce((sum, value) => sum + value, 0)
    - [...cooler.values()].reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(externalEnergyJ)) {
    return { scientificStatus: "OPEN", transfers: [], externalEnergyJ: 0, reactionEnergyJ, bodyUpdates: [], diagnostics: [...diagnostics, { id: "external-total", scientificStatus: "OPEN", reasonCodes: ["NONFINITE_EXTERNAL_ENERGY"] }] };
  }

  const updates: ThermalBodyUpdate[] = [];
  for (const body of [...bodyMap.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const internalJ = internal.get(body.id) ?? 0;
    const reservoirJ = reservoir.get(body.id) ?? 0;
    const heaterJ = heater.get(body.id) ?? 0;
    const coolerJ = cooler.get(body.id) ?? 0;
    const reactionJ = reaction.get(body.id) ?? 0;
    const netEnergyJ = internalJ + reservoirJ + heaterJ - coolerJ + reactionJ;
    if (!Number.isFinite(netEnergyJ)) {
      diagnostics.push({ id: body.id, scientificStatus: "OPEN", reasonCodes: ["NONFINITE_BODY_ENERGY"] });
      return { scientificStatus: "OPEN", transfers: [], externalEnergyJ: 0, reactionEnergyJ: 0, bodyUpdates: [], diagnostics };
    }

    let next;
    try {
      next = applySensibleEnergy(body.state, netEnergyJ);
    } catch {
      diagnostics.push({ id: body.id, scientificStatus: "OPEN", reasonCodes: ["INVALID_TEMPERATURE_UPDATE"] });
      return { scientificStatus: "OPEN", transfers: [], externalEnergyJ: 0, reactionEnergyJ: 0, bodyUpdates: [], diagnostics };
    }

    const cumulativeEnergy = {
      ...next.cumulativeEnergy,
      reactionHeat_J: next.cumulativeEnergy.reactionHeat_J + reactionJ,
      heaterEnergy_J: next.cumulativeEnergy.heaterEnergy_J + heaterJ,
      coolerEnergyRemoved_J: next.cumulativeEnergy.coolerEnergyRemoved_J + coolerJ,
      environmentHeat_J: next.cumulativeEnergy.environmentHeat_J + reservoirJ,
      internalTransferHeat_J: (next.cumulativeEnergy.internalTransferHeat_J ?? 0) + internalJ,
    };
    next = { ...next, cumulativeEnergy };

    updates.push({
      bodyId: body.id,
      previousTemperatureK: body.state.temperatureK,
      temperatureK: next.temperatureK,
      netEnergy_J: netEnergyJ,
      internalTransferEnergy_J: internalJ,
      reservoirEnergy_J: reservoirJ,
      heaterEnergy_J: heaterJ,
      coolerEnergyRemoved_J: coolerJ,
      reactionEnergy_J: reactionJ,
      scientificStatus: bodyStatus.get(body.id) ?? body.scientificStatus,
      state: next,
    });
  }

  const statuses = [
    ...updates.map((update) => update.scientificStatus),
    ...diagnostics.map((diagnostic) => diagnostic.scientificStatus),
  ];
  const scientificStatus = statuses.length > 0 ? worstStatus(...statuses) : "VERIFIED";
  return {
    scientificStatus,
    transfers,
    externalEnergyJ,
    reactionEnergyJ,
    bodyUpdates: updates,
    diagnostics,
  };
}
