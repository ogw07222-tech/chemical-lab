import type { PhaseKind, ScientificStatus, SpeciesId } from "../molecular";

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
  /** Signed energy moved between explicitly modeled finite thermal bodies. */
  internalTransferHeat_J?: EnergyJ;
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
  /** Single reaction convenience input. Mutually exclusive with reactionHeat_J. */
  reactionHeat?: ReactionHeatInput;
  /** Signed aggregate reaction heat already computed from actual applied extents. */
  reactionHeat_J?: EnergyJ;
  environmentHeat_J?: EnergyJ;
  otherExternalEnergy_J?: EnergyJ;
}

export interface ThermalStepResult {
  state: ThermalState;
  stepEnergyDelta_J: EnergyJ;
  sensibleEnergyDelta_J: EnergyJ;
}

export type ThermalBodyId = string;

export type ThermalBodyKind =
  | "VESSEL"
  | "HOT_PLATE"
  | "BATH_MEDIUM"
  | "CHAMBER_GAS"
  | "LAB_ENVIRONMENT"
  | "OTHER";

export interface ThermalBody {
  id: ThermalBodyId;
  kind: ThermalBodyKind;
  state: ThermalState;
  scientificStatus: ScientificStatus;
  source?: string;
}

export type ThermalContactMechanism = "CONTACT" | "BATH" | "CONVECTION";

export interface ThermalContact {
  id: string;
  bodyAId: ThermalBodyId;
  bodyBId: ThermalBodyId;
  enabled: boolean;
  conductanceWPerK: number;
  mechanism: ThermalContactMechanism;
  scientificStatus: ScientificStatus;
  source?: string;
}

export type ThermalReservoirMechanism = "AMBIENT" | "CONTROLLED_CHAMBER";

export interface ThermalReservoirBoundary {
  id: string;
  bodyId: ThermalBodyId;
  enabled: boolean;
  reservoirTemperatureK: TemperatureK;
  conductanceWPerK: number;
  mechanism: ThermalReservoirMechanism;
  scientificStatus: ScientificStatus;
  source?: string;
}

export type ThermalPowerMode = "HEATER" | "COOLER";
export type ThermalApparatusKind =
  | "HOT_PLATE"
  | "HEATING_BATH"
  | "COOLING_BATH"
  | "HOT_AIR_CHAMBER"
  | "OTHER";

export interface ThermalPowerActuator {
  id: string;
  bodyId: ThermalBodyId;
  enabled: boolean;
  mode: ThermalPowerMode;
  powerW: PowerW;
  targetTemperatureK?: TemperatureK;
  apparatusKind: ThermalApparatusKind;
  scientificStatus: ScientificStatus;
  source?: string;
}

export interface ThermalReactionSource {
  id: string;
  bodyId: ThermalBodyId;
  energyJ: EnergyJ;
  scientificStatus: ScientificStatus;
  source?: string;
}

export type ThermalTransferMechanism =
  | ThermalContactMechanism
  | ThermalReservoirMechanism
  | "EXTERNAL_HEATER"
  | "EXTERNAL_COOLER";

export interface ThermalTransfer {
  id: string;
  sourceId: string;
  destinationId: string;
  energyJ: EnergyJ;
  mechanism: ThermalTransferMechanism;
  scientificStatus: ScientificStatus;
}

export interface ThermalBodyUpdate {
  bodyId: ThermalBodyId;
  previousTemperatureK: TemperatureK;
  temperatureK: TemperatureK;
  netEnergy_J: EnergyJ;
  internalTransferEnergy_J: EnergyJ;
  reservoirEnergy_J: EnergyJ;
  heaterEnergy_J: EnergyJ;
  coolerEnergyRemoved_J: EnergyJ;
  reactionEnergy_J: EnergyJ;
  scientificStatus: ScientificStatus;
  state: ThermalState;
}

export interface ThermalDiagnostic {
  id: string;
  scientificStatus: ScientificStatus;
  reasonCodes: readonly string[];
  /** Optional structured control/audit details; values are observational, not extra physics. */
  details?: Readonly<Record<string, string | number | boolean>>;
}

export interface ThermalApparatusEvaluation {
  scientificStatus: ScientificStatus;
  transfers: readonly ThermalTransfer[];
  externalEnergyJ: EnergyJ;
  reactionEnergyJ: EnergyJ;
  bodyUpdates: readonly ThermalBodyUpdate[];
  diagnostics: readonly ThermalDiagnostic[];
}

export interface SpeciesMolarHeatCapacityInput {
  speciesId: SpeciesId;
  phase: PhaseKind;
  molarHeatCapacity_JPerMolK: number;
  scientificStatus: ScientificStatus;
  source: string;
}

export interface MixtureHeatCapacityEvaluation {
  heatCapacity_JPerK?: HeatCapacityJPerK;
  scientificStatus: ScientificStatus;
  includedSpeciesIds: readonly SpeciesId[];
  missingSpeciesIds: readonly SpeciesId[];
}
