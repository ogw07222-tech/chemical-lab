import type { ApparatusCatalogEntry } from '../types';

export const APPARATUS_CATALOG: readonly ApparatusCatalogEntry[] = [
  { type: 'BEAKER', label: 'Beaker', tier: 1, category: 'VESSEL' },
  { type: 'FLASK', label: 'Flask', tier: 1, category: 'VESSEL' },
  { type: 'SEALED_VESSEL', label: 'Sealed Vessel', tier: 1, category: 'VESSEL' },
  {
    type: 'HOT_PLATE', label: 'Hot Plate', tier: 1, category: 'THERMAL',
    defaultControlState: { enabled: false, controlMode: 'TARGET_TEMPERATURE', targetTemperatureC: 25, powerTargetPercent: 0 },
  },
  { type: 'MAGNETIC_STIRRER', label: 'Magnetic Stirrer', tier: 1, category: 'MIXING', defaultControlState: { enabled: false, targetRpm: 0 } },
  { type: 'HEATING_BATH', label: 'Heating Bath', tier: 2, category: 'THERMAL' },
  { type: 'HOT_AIR_CHAMBER', label: 'Hot-Air Chamber', tier: 2, category: 'THERMAL' },
  { type: 'COOLING_BATH', label: 'Cooling Bath', tier: 2, category: 'THERMAL' },
  {
    type: 'VACUUM_PUMP', label: 'Vacuum Pump', tier: 2, category: 'PRESSURE',
    defaultControlState: { enabled: false, controlMode: 'TARGET_PRESSURE', targetPressureKPa: 101.325 },
  },
  { type: 'GAS_COLLECTOR', label: 'Gas Collector', tier: 2, category: 'TRANSFER', defaultControlState: { valveState: 'CLOSED' } },
  { type: 'FILTER_APPARATUS', label: 'Filter Apparatus', tier: 3, category: 'TRANSFER' },
  { type: 'CONDENSER', label: 'Condenser', tier: 3, category: 'TRANSFER' },
  {
    type: 'POWER_SUPPLY', label: 'Power Supply', tier: 3, category: 'ELECTRICAL',
    defaultControlState: { enabled: false, targetVoltageV: 0, targetCurrentA: 0 },
  },
  { type: 'TEMPERATURE_PROBE', label: 'Temperature Probe', tier: 3, category: 'MEASUREMENT' },
  { type: 'PRESSURE_SENSOR', label: 'Pressure Sensor', tier: 3, category: 'MEASUREMENT' },
  { type: 'ANALYSIS_INSTRUMENT', label: 'Analysis Instrument', tier: 3, category: 'MEASUREMENT' },
] as const;

export function getApparatusCatalogEntry(type: ApparatusCatalogEntry['type']) {
  return APPARATUS_CATALOG.find((entry) => entry.type === type);
}
