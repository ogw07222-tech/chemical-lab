export type SimulationStatus = 'stopped' | 'paused' | 'running' | 'stable' | 'error';
export type Phase = 'gas' | 'liquid' | 'solid' | 'aqueous' | 'unknown';

export interface MoleculeAtomView { id: string; element: string; formalCharge: number; }
export interface MoleculeBondView { id: string; from: string; to: string; order: 1 | 2 | 3; }
export interface MoleculeGraphViewModel { atoms: MoleculeAtomView[]; bonds: MoleculeBondView[]; reactiveSiteAtomIds?: string[]; }

export interface SubstanceSummary {
  speciesId: string;
  name: string;
  formula: string;
  defaultPhase: Phase;
  graph?: MoleculeGraphViewModel;
}

export interface VesselContentView { speciesId: string; formula: string; amountMol: number; phase: Phase; }

export interface LaboratorySnapshot {
  vesselId: string;
  capacityL: number;
  volumeL: number;
  temperatureK: number;
  pressureKPa: number;
  simulationTimeS: number;
  simulationStatus: SimulationStatus;
  simulationSpeed: number;
  contents: VesselContentView[];
  controls: { thermalIntent: 'off' | 'heat' | 'cool'; requestedVolumeL: number; };
}

export type LaboratoryCommand =
  | { type: 'AddSubstance'; vesselId: string; speciesId: string; amountMol: number }
  | { type: 'Heat'; vesselId: string; mode: 'request'; value: number }
  | { type: 'Cool'; vesselId: string; mode: 'request'; value: number }
  | { type: 'ChangeVolume'; vesselId: string; targetVolumeL: number }
  | { type: 'Run'; vesselId: string }
  | { type: 'PauseSimulation'; vesselId: string }
  | { type: 'ResetExperiment'; vesselId: string }
  | { type: 'SetSimulationSpeed'; vesselId: string; speed: number };

export interface LaboratoryEvent {
  id: string;
  simulationTimeS: number;
  kind: 'command-accepted' | 'command-rejected' | 'observation';
  message: string;
}

export interface LaboratoryProviderValue {
  snapshot: LaboratorySnapshot;
  catalog: SubstanceSummary[];
  events: LaboratoryEvent[];
  dispatch(command: LaboratoryCommand): void;
}
