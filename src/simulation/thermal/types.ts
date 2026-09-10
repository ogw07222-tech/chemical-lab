export type TemperatureK = number;
export type EnergyJ = number;
export type PowerW = number;
export type HeatCapacityJPerK = number;
export type MolarEnergyJPerMol = number;
export type AmountMol = number;
export type TimeS = number;

export interface ThermalEnergyLedger {
  /** Signed heat from reaction progress: positive into the thermal system. */
  reactionHeat_J: EnergyJ;
  /** Positive energy supplied by heaters. */
  heaterEnergy_J: EnergyJ;
  /** Positive magnitude of energy extracted by coolers. */
  coolerEnergyRemoved_J: EnergyJ;
  /** Signed external thermostat exchange: positive supplied, negative removed. */
  thermostatEnergy_J: EnergyJ;
  /** Signed environmental exchange: positive into the system. */
  environmentHeat_J: EnergyJ;
  /** Reserved signed latent-heat accounting extension point. */
  phaseChangeLatentHeat_J: EnergyJ;
  /** Signed explicitly modeled miscellaneous external exchange. */
  otherExternalEnergy_J: EnergyJ;
}

export interface ThermalState {
  temperatureK: TemperatureK;
  mixtureHeatCapacity_JPerK: HeatCapacityJPerK;
  vesselHeatCapacity_JPerK: HeatCapacityJPerK;
  cumulativeEnergy: ThermalEnergyLedger;
}

export interface HeaterInput {
  enabled: boolean;
  powerW: PowerW;
}

export interface CoolerInput {
  enabled: boolean;
  extractionPowerW: PowerW;
}

export type ThermostatControlModel =
  | "BOUNDED_PROPORTIONAL"
  | "IDEALIZED_BOUNDED";

export interface ThermostatInput {
  enabled: boolean;
  targetTemperatureK: TemperatureK;
  maxHeatingPowerW: PowerW;
  maxCoolingPowerW: PowerW;
  proportionalGainWPerK: number;
  controlModel?: ThermostatControlModel;
}

/**
 * Loose coupling boundary for 01 reaction progress.
 * reactionExtentMol is a non-negative forward extent for the reaction as written.
 */
export interface ReactionHeatInput {
  reactionExtentMol: AmountMol;
  deltaH_JPerMolExtent: MolarEnergyJPerMol;
}

export interface ThermalStepInput {
  dtS: TimeS;
  heater?: HeaterInput;
  cooler?: CoolerInput;
  thermostat?: ThermostatInput;
  reactionHeat?: ReactionHeatInput;
  environmentHeat_J?: EnergyJ;
  otherExternalEnergy_J?: EnergyJ;
}

export interface ThermalStepResult {
  state: ThermalState;
  /** Signed net energy delivered to sensible thermal energy this step. */
  stepEnergyDelta_J: EnergyJ;
  /** Alias retained to make the future latent-heat split explicit. */
  sensibleEnergyDelta_J: EnergyJ;
}
