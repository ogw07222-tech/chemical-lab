import type { ApparatusId, ApparatusInstance, ApparatusType } from '../../workbench';

export type ApparatusTier = 1 | 2 | 3;

export type ApparatusFactStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'NOT_CONNECTED'
  | 'UNSUPPORTED'
  | 'OPEN';

export interface ApparatusProviderFact<T = number> {
  status: ApparatusFactStatus;
  value?: T;
  unit?: string;
}

export interface ApparatusProviderFacts {
  currentTemperature?: ApparatusProviderFact;
  currentRpm?: ApparatusProviderFact;
  currentPressure?: ApparatusProviderFact;
  currentVoltage?: ApparatusProviderFact;
  currentCurrent?: ApparatusProviderFact;
  connectedVessel?: ApparatusProviderFact<string>;
  inputConnection?: ApparatusProviderFact<string>;
  collectedAmount?: ApparatusProviderFact;
  composition?: ApparatusProviderFact<string>;
  status?: ApparatusProviderFact<string>;
}

export type ApparatusControlMode =
  | 'TARGET_TEMPERATURE'
  | 'POWER_OUTPUT'
  | 'TARGET_PRESSURE';

export type ApparatusValveState = 'OPEN' | 'CLOSED';

export interface ApparatusControlState {
  enabled?: boolean;
  controlMode?: ApparatusControlMode;
  targetTemperatureC?: number;
  powerTargetPercent?: number;
  targetRpm?: number;
  targetPressureKPa?: number;
  valveState?: ApparatusValveState;
  targetVoltageV?: number;
  targetCurrentA?: number;
}

export type ApparatusUiIntent =
  | { type: 'SetApparatusEnabled'; apparatusId: ApparatusId; enabled: boolean }
  | { type: 'SetApparatusTemperatureTarget'; apparatusId: ApparatusId; targetTemperatureC: number }
  | { type: 'SetApparatusPowerTarget'; apparatusId: ApparatusId; powerTargetPercent: number }
  | { type: 'SetApparatusRpmTarget'; apparatusId: ApparatusId; targetRpm: number }
  | { type: 'SetApparatusPressureTarget'; apparatusId: ApparatusId; targetPressureKPa: number }
  | { type: 'SetApparatusValveState'; apparatusId: ApparatusId; valveState: ApparatusValveState }
  | { type: 'SetApparatusVoltageTarget'; apparatusId: ApparatusId; targetVoltageV: number }
  | { type: 'SetApparatusCurrentTarget'; apparatusId: ApparatusId; targetCurrentA: number };

export interface ApparatusCatalogEntry {
  type: ApparatusType;
  label: string;
  tier: ApparatusTier;
  category: 'VESSEL' | 'THERMAL' | 'MIXING' | 'TRANSFER' | 'PRESSURE' | 'ELECTRICAL' | 'MEASUREMENT';
  defaultControlState?: ApparatusControlState;
}

export interface ApparatusUiInstance extends ApparatusInstance {
  controlState?: ApparatusControlState;
  providerFacts?: ApparatusProviderFacts;
}
