import type {
  CoolerInput,
  EnergyJ,
  HeaterInput,
  HeatCapacityJPerK,
  ReactionHeatInput,
  ThermalEnergyLedger,
  ThermalState,
  ThermalStepInput,
  ThermalStepResult,
  ThermostatInput,
  TimeS,
} from "./types";

const ZERO_LEDGER: ThermalEnergyLedger = Object.freeze({
  reactionHeat_J: 0,
  heaterEnergy_J: 0,
  coolerEnergyRemoved_J: 0,
  thermostatEnergy_J: 0,
  environmentHeat_J: 0,
  phaseChangeLatentHeat_J: 0,
  otherExternalEnergy_J: 0,
});

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite`);
  }
}

function assertNonNegative(value: number, name: string): void {
  assertFinite(value, name);
  if (value < 0) {
    throw new RangeError(`${name} must be >= 0`);
  }
}

function assertPositiveTemperature(value: number, name = "temperatureK"): void {
  assertFinite(value, name);
  if (value <= 0) {
    throw new RangeError(`${name} must be > 0 K`);
  }
}

function assertHeatCapacity(value: number, name: string): void {
  assertNonNegative(value, name);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createEmptyThermalEnergyLedger(): ThermalEnergyLedger {
  return { ...ZERO_LEDGER };
}

export function createThermalState(input: {
  temperatureK: number;
  mixtureHeatCapacity_JPerK: number;
  vesselHeatCapacity_JPerK: number;
  cumulativeEnergy?: ThermalEnergyLedger;
}): ThermalState {
  assertPositiveTemperature(input.temperatureK);
  assertHeatCapacity(input.mixtureHeatCapacity_JPerK, "mixtureHeatCapacity_JPerK");
  assertHeatCapacity(input.vesselHeatCapacity_JPerK, "vesselHeatCapacity_JPerK");

  const totalHeatCapacity =
    input.mixtureHeatCapacity_JPerK + input.vesselHeatCapacity_JPerK;
  if (!(totalHeatCapacity > 0)) {
    throw new RangeError("total sensible heat capacity must be > 0 J/K");
  }

  const ledger = input.cumulativeEnergy ?? ZERO_LEDGER;
  validateLedger(ledger);

  return {
    temperatureK: input.temperatureK,
    mixtureHeatCapacity_JPerK: input.mixtureHeatCapacity_JPerK,
    vesselHeatCapacity_JPerK: input.vesselHeatCapacity_JPerK,
    cumulativeEnergy: { ...ledger },
  };
}

export function totalSensibleHeatCapacity_JPerK(
  state: ThermalState,
): HeatCapacityJPerK {
  validateThermalState(state);
  return state.mixtureHeatCapacity_JPerK + state.vesselHeatCapacity_JPerK;
}

export function validateThermalState(state: ThermalState): void {
  assertPositiveTemperature(state.temperatureK);
  assertHeatCapacity(state.mixtureHeatCapacity_JPerK, "mixtureHeatCapacity_JPerK");
  assertHeatCapacity(state.vesselHeatCapacity_JPerK, "vesselHeatCapacity_JPerK");
  if (
    state.mixtureHeatCapacity_JPerK + state.vesselHeatCapacity_JPerK <=
    0
  ) {
    throw new RangeError("total sensible heat capacity must be > 0 J/K");
  }
  validateLedger(state.cumulativeEnergy);
}

export function validateLedger(ledger: ThermalEnergyLedger): void {
  assertFinite(ledger.reactionHeat_J, "reactionHeat_J");
  assertNonNegative(ledger.heaterEnergy_J, "heaterEnergy_J");
  assertNonNegative(ledger.coolerEnergyRemoved_J, "coolerEnergyRemoved_J");
  assertFinite(ledger.thermostatEnergy_J, "thermostatEnergy_J");
  assertFinite(ledger.environmentHeat_J, "environmentHeat_J");
  assertFinite(ledger.phaseChangeLatentHeat_J, "phaseChangeLatentHeat_J");
  assertFinite(ledger.otherExternalEnergy_J, "otherExternalEnergy_J");
}

export function integrateHeaterEnergy(
  heater: HeaterInput | undefined,
  dtS: TimeS,
): EnergyJ {
  assertNonNegative(dtS, "dtS");
  if (!heater || !heater.enabled) return 0;
  assertNonNegative(heater.powerW, "heater.powerW");
  return heater.powerW * dtS;
}

export function integrateCoolerEnergyRemoved(
  cooler: CoolerInput | undefined,
  dtS: TimeS,
): EnergyJ {
  assertNonNegative(dtS, "dtS");
  if (!cooler || !cooler.enabled) return 0;
  assertNonNegative(cooler.extractionPowerW, "cooler.extractionPowerW");
  return cooler.extractionPowerW * dtS;
}

export function reactionHeatToSystem(input: ReactionHeatInput): EnergyJ {
  assertNonNegative(input.reactionExtentMol, "reactionExtentMol");
  assertFinite(input.deltaH_JPerMolExtent, "deltaH_JPerMolExtent");
  return -input.deltaH_JPerMolExtent * input.reactionExtentMol;
}

/**
 * Computes explicit thermostat energy exchange. Positive values add energy,
 * negative values remove energy. The controller never mutates temperature.
 */
export function computeThermostatEnergyExchange(
  state: ThermalState,
  thermostat: ThermostatInput | undefined,
  dtS: TimeS,
): EnergyJ {
  validateThermalState(state);
  assertNonNegative(dtS, "dtS");
  if (!thermostat || !thermostat.enabled || dtS === 0) return 0;

  assertPositiveTemperature(thermostat.targetTemperatureK, "thermostat.targetTemperatureK");
  assertNonNegative(thermostat.maxHeatingPowerW, "thermostat.maxHeatingPowerW");
  assertNonNegative(thermostat.maxCoolingPowerW, "thermostat.maxCoolingPowerW");
  assertNonNegative(thermostat.proportionalGainWPerK, "thermostat.proportionalGainWPerK");

  const errorK = thermostat.targetTemperatureK - state.temperatureK;
  if (errorK === 0 || thermostat.proportionalGainWPerK === 0) return 0;

  const requestedPowerW = thermostat.proportionalGainWPerK * errorK;
  const boundedPowerW = clamp(
    requestedPowerW,
    -thermostat.maxCoolingPowerW,
    thermostat.maxHeatingPowerW,
  );

  const powerLimitedEnergyJ = boundedPowerW * dtS;
  const exactTargetEnergyJ =
    totalSensibleHeatCapacity_JPerK(state) * errorK;

  // Do not overshoot the target within this simple controller skeleton.
  if (errorK > 0) {
    return Math.min(powerLimitedEnergyJ, exactTargetEnergyJ);
  }
  return Math.max(powerLimitedEnergyJ, exactTargetEnergyJ);
}

export function applySensibleEnergy(
  state: ThermalState,
  energyDelta_J: EnergyJ,
): ThermalState {
  validateThermalState(state);
  assertFinite(energyDelta_J, "energyDelta_J");

  const heatCapacity = totalSensibleHeatCapacity_JPerK(state);
  const nextTemperatureK = state.temperatureK + energyDelta_J / heatCapacity;
  assertPositiveTemperature(nextTemperatureK, "nextTemperatureK");

  return {
    ...state,
    temperatureK: nextTemperatureK,
    cumulativeEnergy: { ...state.cumulativeEnergy },
  };
}

export function stepThermalState(
  state: ThermalState,
  input: ThermalStepInput,
): ThermalStepResult {
  validateThermalState(state);
  assertNonNegative(input.dtS, "dtS");

  const reactionHeat_J = input.reactionHeat
    ? reactionHeatToSystem(input.reactionHeat)
    : 0;
  const heaterEnergy_J = integrateHeaterEnergy(input.heater, input.dtS);
  const coolerEnergyRemoved_J = integrateCoolerEnergyRemoved(
    input.cooler,
    input.dtS,
  );
  const thermostatEnergy_J = computeThermostatEnergyExchange(
    state,
    input.thermostat,
    input.dtS,
  );
  const environmentHeat_J = input.environmentHeat_J ?? 0;
  const otherExternalEnergy_J = input.otherExternalEnergy_J ?? 0;
  assertFinite(environmentHeat_J, "environmentHeat_J");
  assertFinite(otherExternalEnergy_J, "otherExternalEnergy_J");

  // Latent heat is intentionally not implemented in this Phase 1 primitive.
  const sensibleEnergyDelta_J =
    reactionHeat_J +
    heaterEnergy_J -
    coolerEnergyRemoved_J +
    thermostatEnergy_J +
    environmentHeat_J +
    otherExternalEnergy_J;

  const temperatureUpdated = applySensibleEnergy(
    state,
    sensibleEnergyDelta_J,
  );

  const cumulativeEnergy: ThermalEnergyLedger = {
    reactionHeat_J: state.cumulativeEnergy.reactionHeat_J + reactionHeat_J,
    heaterEnergy_J: state.cumulativeEnergy.heaterEnergy_J + heaterEnergy_J,
    coolerEnergyRemoved_J:
      state.cumulativeEnergy.coolerEnergyRemoved_J + coolerEnergyRemoved_J,
    thermostatEnergy_J:
      state.cumulativeEnergy.thermostatEnergy_J + thermostatEnergy_J,
    environmentHeat_J:
      state.cumulativeEnergy.environmentHeat_J + environmentHeat_J,
    phaseChangeLatentHeat_J: state.cumulativeEnergy.phaseChangeLatentHeat_J,
    otherExternalEnergy_J:
      state.cumulativeEnergy.otherExternalEnergy_J + otherExternalEnergy_J,
  };

  validateLedger(cumulativeEnergy);

  return {
    state: {
      ...temperatureUpdated,
      cumulativeEnergy,
    },
    stepEnergyDelta_J: sensibleEnergyDelta_J,
    sensibleEnergyDelta_J,
  };
}
