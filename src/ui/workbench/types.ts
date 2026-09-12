import type { ReactNode } from 'react';

export type ApparatusId = string;

export const APPARATUS_TYPES = [
  'BEAKER',
  'FLASK',
  'SEALED_VESSEL',
  'HOT_PLATE',
  'HEATING_BATH',
  'HOT_AIR_CHAMBER',
  'COOLING_BATH',
  'MAGNETIC_STIRRER',
  'FILTER_APPARATUS',
  'GAS_COLLECTOR',
  'CONDENSER',
  'VACUUM_PUMP',
  'POWER_SUPPLY',
  'TEMPERATURE_PROBE',
  'PRESSURE_SENSOR',
  'ANALYSIS_INSTRUMENT',
] as const;

export type ApparatusType = (typeof APPARATUS_TYPES)[number];

export interface ApparatusInstance {
  id: ApparatusId;
  type: ApparatusType;
}

export interface WorkbenchPosition {
  xPercent: number;
  yPercent: number;
}

export interface WorkbenchSlot {
  id: string;
  position: WorkbenchPosition;
}

export interface ApparatusPlacement {
  apparatusId: ApparatusId;
  slotId?: string;
  position?: WorkbenchPosition;
  zIndex?: number;
}

export interface ApparatusRenderContext {
  instance: ApparatusInstance;
  placement: ApparatusPlacement;
  selected: boolean;
  focused: boolean;
  select: () => void;
  focus: () => void;
}

export type ApparatusChildRenderer = (context: ApparatusRenderContext) => ReactNode;
