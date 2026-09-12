export type SimulationStatus = 'stopped' | 'paused' | 'running' | 'stable' | 'error';
export type Phase = 'gas' | 'liquid' | 'solid' | 'aqueous' | 'multiphase' | 'unknown';
export type ScientificStatus = 'VERIFIED' | 'APPROXIMATED' | 'EMPIRICAL' | 'GAMEPLAY_SIMPLIFICATION' | 'OPEN';
export type ReactionDisplayPrecision = 'KNOWN' | 'APPROXIMATED' | 'OPEN';
export type ReactionConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNASSESSED';
export type SubstanceCategory = 'element' | 'compound';

export interface MoleculeAtomView { id: string; element: string; formalCharge: number; }
export interface MoleculeBondView { id: string; from: string; to: string; order: 1 | 2 | 3; }
export interface MoleculeGraphViewModel { atoms: MoleculeAtomView[]; bonds: MoleculeBondView[]; reactiveSiteAtomIds?: string[]; }

export interface SubstanceSummary {
  speciesId: string;
  name: string;
  koreanName?: string;
  formula: string;
  category?: SubstanceCategory;
  description?: string;
  scientificStatus: ScientificStatus;
  graph?: MoleculeGraphViewModel;
}

export interface VesselContentView {
  speciesId?: string;
  displayIdentity: string;
  opaqueLabel?: string;
  amountMol: number;
  phase: Phase;
  identityConfirmed: boolean;
}
export interface UnknownObservation { observationId: string; label: string; analysisState: 'unanalysed' | 'pending' | 'confirmed'; }
export interface EncyclopediaEntry { speciesId: string; firstDiscoveryLabel: string; knownProperties: string[]; phaseInfo?: string; }

export interface PhasePointView { temperatureK: number; pressurePa: number; }
export interface PhaseBoundaryView { id: string; between: [Phase, Phase]; samples: PhasePointView[]; }
export interface PhaseDiagramViewModel {
  speciesId: string;
  status: ScientificStatus;
  fixtureLabel?: string;
  temperatureRangeK: [number, number];
  pressureRangePa: [number, number];
  boundaries: PhaseBoundaryView[];
  triplePoint?: PhasePointView;
  criticalPoint?: PhasePointView;
  currentState?: { temperatureK: number; pressurePa: number; phase: Phase };
}

export interface ReactionSpeciesProjection {
  referenceId: string;
  displayIdentity: string;
  opaqueLabel?: string;
  identityConfirmed: boolean;
  knownSpeciesId?: string;
  amountMol?: number;
}

export interface ReactionHeatProjection {
  displayPrecision: ReactionDisplayPrecision;
  status: 'reported' | 'unavailable';
  coverage?: 'COMPLETE' | 'PARTIAL' | 'NONE';
  deltaJ?: number;
  label?: string;
  scientificStatus?: ScientificStatus;
  confidence?: ReactionConfidence;
}

export interface ReactionObservableProjection {
  kind: 'gas-evolution' | 'phase-change' | 'temperature-change' | 'other';
  displayPrecision: ReactionDisplayPrecision;
  label: string;
}

/**
 * Player-facing projection of one authoritative simulation reaction fact.
 * It is deliberately distinct from the engine's internal ReactionProgressEvent.
 */
export interface ReactionProgressProjection {
  id: string;
  timelineOrder: number;
  timestepId: string;
  sourceSequence: number;
  startTimeS: number;
  endTimeS: number;
  kind: 'reaction-progress';
  stepIndex: number;
  state: 'detected' | 'progressing' | 'completed' | 'equilibrium' | 'stalled';
  displayPrecision: ReactionDisplayPrecision;
  scientificStatus: ScientificStatus;
  confidence: ReactionConfidence;
  activityLabel: string;
  consumed: ReactionSpeciesProjection[];
  produced: ReactionSpeciesProjection[];
  reactionHeat?: ReactionHeatProjection;
  observables?: ReactionObservableProjection[];
}

export interface ReactionActivityProjection {
  eventId: string;
  simulationTimeS: number;
  state: ReactionProgressProjection['state'];
  displayPrecision: ReactionDisplayPrecision;
  scientificStatus: ScientificStatus;
  confidence: ReactionConfidence;
  label: string;
}

export interface LaboratorySnapshot {
  experimentName: string;
  vesselId: string;
  capacityM3: number;
  volumeM3: number;
  temperatureK: number;
  pressurePa: number;
  simulationTimeS: number;
  simulationStatus: SimulationStatus;
  simulationSpeed: number;
  contents: VesselContentView[];
  unknownObservations: UnknownObservation[];
  unlockedSpeciesIds: string[];
  favoriteSpeciesIds: string[];
  encyclopedia: EncyclopediaEntry[];
  developerMode: boolean;
  controls: {
    heaterPowerW: number;
    coolerPowerW: number;
    thermostatEnabled: boolean;
    thermostatTargetK: number;
    requestedPressurePa: number;
    requestedVolumeM3: number;
  };
}

export type LaboratoryCommand =
  | { type: 'AddSubstance'; vesselId: string; speciesId: string; amountMol: number }
  | { type: 'RemoveSubstance'; vesselId: string; speciesId: string }
  | { type: 'SetHeaterPower'; vesselId: string; powerW: number }
  | { type: 'SetCoolerPower'; vesselId: string; powerW: number }
  | { type: 'SetThermostat'; vesselId: string; enabled: boolean; targetTemperatureK: number }
  | { type: 'SetPressureTarget'; vesselId: string; targetPressurePa: number }
  | { type: 'ChangeVolume'; vesselId: string; targetVolumeM3: number }
  | { type: 'Mix'; vesselId: string }
  | { type: 'Stir'; vesselId: string }
  | { type: 'Run'; vesselId: string }
  | { type: 'PauseSimulation'; vesselId: string }
  | { type: 'ResetExperiment'; vesselId: string }
  | { type: 'SetSimulationSpeed'; vesselId: string; speed: number }
  | { type: 'ToggleFavorite'; speciesId: string }
  | { type: 'AnalyzeUnknown'; observationId: string }
  | { type: 'SetDeveloperMode'; enabled: boolean };

export interface LaboratoryEvent {
  id: string;
  timelineOrder: number;
  simulationTimeS: number;
  kind: 'command-accepted' | 'command-rejected' | 'observation' | 'discovery';
  message: string;
}

export interface LaboratoryProviderValue {
  snapshot: LaboratorySnapshot;
  catalog: SubstanceSummary[];
  events: LaboratoryEvent[];
  reactionActivity?: ReactionActivityProjection;
  reactionEvents: ReactionProgressProjection[];
  phaseDiagrams: Record<string, PhaseDiagramViewModel | undefined>;
  dispatch(command: LaboratoryCommand): void;
}
