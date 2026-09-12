import { createContext, type ReactNode, useContext, useMemo, useReducer } from 'react';
import type {
  LaboratoryCommand,
  LaboratoryEvent,
  LaboratoryProviderValue,
  LaboratorySnapshot,
  PhaseDiagramViewModel,
  ReactionActivityProjection,
  ReactionProgressProjection,
  ReactionSpeciesProjection,
  SubstanceSummary,
} from './types';

const CATALOG: SubstanceSummary[] = [
  { speciesId: 'h2', name: 'Hydrogen', koreanName: '수소', formula: 'H₂', category: 'element', scientificStatus: 'OPEN', description: '가장 단순한 분자 중 하나. 상세 물성은 권위 데이터 어댑터 연결 후 표시됩니다.' },
  { speciesId: 'o2', name: 'Oxygen', koreanName: '산소', formula: 'O₂', category: 'element', scientificStatus: 'OPEN', description: '산소 분자. 상세 물성은 권위 데이터 어댑터 연결 후 표시됩니다.' },
  { speciesId: 'n2', name: 'Nitrogen', koreanName: '질소', formula: 'N₂', category: 'element', scientificStatus: 'OPEN', description: '질소 분자. 상세 물성은 권위 데이터 어댑터 연결 후 표시됩니다.' },
  { speciesId: 'h2o', name: 'Water', koreanName: '물', formula: 'H₂O', category: 'compound', scientificStatus: 'OPEN' },
  { speciesId: 'co', name: 'Carbon monoxide', koreanName: '일산화 탄소', formula: 'CO', category: 'compound', scientificStatus: 'OPEN' },
  { speciesId: 'co2', name: 'Carbon dioxide', koreanName: '이산화 탄소', formula: 'CO₂', category: 'compound', scientificStatus: 'OPEN' },
  { speciesId: 'ch4', name: 'Methane', koreanName: '메테인', formula: 'CH₄', category: 'compound', scientificStatus: 'OPEN' },
  { speciesId: 'nh3', name: 'Ammonia', koreanName: '암모니아', formula: 'NH₃', category: 'compound', scientificStatus: 'OPEN' },
];

// UI-only illustrative fixture. These points are not chemistry data and must be replaced by a 02/03 adapter in production.
const PHASE_FIXTURE: PhaseDiagramViewModel = {
  speciesId: 'h2', status: 'APPROXIMATED', fixtureLabel: 'UI-only illustrative fixture — not scientific phase data',
  temperatureRangeK: [100, 500], pressureRangePa: [20_000, 250_000],
  boundaries: [
    { id: 'solid-liquid-demo', between: ['solid', 'liquid'], samples: [{ temperatureK: 190, pressurePa: 20_000 }, { temperatureK: 205, pressurePa: 240_000 }] },
    { id: 'liquid-gas-demo', between: ['liquid', 'gas'], samples: [{ temperatureK: 205, pressurePa: 40_000 }, { temperatureK: 390, pressurePa: 230_000 }] },
  ],
  triplePoint: { temperatureK: 200, pressurePa: 35_000 }, criticalPoint: { temperatureK: 400, pressurePa: 235_000 },
};

// Mock-only resolver data. Undiscovered species identity must not cross the normal UI-facing projection boundary.
const UNKNOWN_SPECIES_BY_OBSERVATION: Readonly<Record<string, string>> = { 'fixture-unknown-1': 'h2o' };
const UNKNOWN_REFERENCE_BY_OBSERVATION: Readonly<Record<string, string>> = { 'fixture-unknown-1': 'mock-unknown-a' };

const initialSnapshot: LaboratorySnapshot = {
  experimentName: 'Untitled experiment', vesselId: 'vessel-1', capacityM3: 0.002, volumeM3: 0.001,
  temperatureK: 298.15, pressurePa: 101325, simulationTimeS: 0, simulationStatus: 'stopped', simulationSpeed: 1,
  contents: [],
  unknownObservations: [{ observationId: 'fixture-unknown-1', label: 'Unknown substance detected', analysisState: 'unanalysed' }],
  unlockedSpeciesIds: ['h2', 'o2', 'n2'], favoriteSpeciesIds: [], encyclopedia: [], developerMode: false,
  controls: { heaterPowerW: 0, coolerPowerW: 0, thermostatEnabled: false, thermostatTargetK: 298.15, requestedPressurePa: 101325, requestedVolumeM3: 0.001 },
};

export type MockLaboratoryScenario = 'default' | 'reaction-network';

const knownH2: ReactionSpeciesProjection = { referenceId: 'known-h2', displayIdentity: 'H₂', identityConfirmed: true, knownSpeciesId: 'h2' };
const knownO2: ReactionSpeciesProjection = { referenceId: 'known-o2', displayIdentity: 'O₂', identityConfirmed: true, knownSpeciesId: 'o2' };
const unknownA: ReactionSpeciesProjection = { referenceId: 'mock-unknown-a', displayIdentity: 'hidden mock identity', opaqueLabel: 'Unknown α', identityConfirmed: false };

// These are already-projected provider facts. No chemistry is calculated by the UI mock.
// sourceSequence deliberately restarts at 0 in each timestep to prove that timelineOrder,
// not an engine-local per-timestep sequence, controls mixed UI history ordering.
const REACTION_NETWORK_EVENTS: ReactionProgressProjection[] = [
  {
    id: 'reaction-1', timelineOrder: 1, timestepId: 'mock-step-1', sourceSequence: 0, startTimeS: 0, endTimeS: 1,
    kind: 'reaction-progress', stepIndex: 1, state: 'completed', displayPrecision: 'OPEN', scientificStatus: 'OPEN', confidence: 'UNASSESSED', activityLabel: '반응 진행 감지',
    consumed: [knownH2], produced: [unknownA],
    reactionHeat: { displayPrecision: 'OPEN', status: 'unavailable', coverage: 'NONE', label: '반응열 데이터 미확정', scientificStatus: 'OPEN', confidence: 'UNASSESSED' },
  },
  {
    id: 'reaction-2', timelineOrder: 2, timestepId: 'mock-step-2', sourceSequence: 0, startTimeS: 1, endTimeS: 2,
    kind: 'reaction-progress', stepIndex: 2, state: 'progressing', displayPrecision: 'APPROXIMATED', scientificStatus: 'APPROXIMATED', confidence: 'MEDIUM', activityLabel: '반응 진행 감지',
    consumed: [{ ...unknownA, amountMol: 0.1 }], produced: [{ ...knownO2, amountMol: 0.05 }],
    observables: [{ kind: 'gas-evolution', displayPrecision: 'APPROXIMATED', label: '기체 발생 관찰됨' }],
  },
];

interface MockState {
  snapshot: LaboratorySnapshot;
  events: LaboratoryEvent[];
  reactionEvents: ReactionProgressProjection[];
  reactionActivity?: ReactionActivityProjection;
  eventCounter: number;
  scenario: MockLaboratoryScenario;
}

function createInitialState(scenario: MockLaboratoryScenario): MockState {
  if (scenario === 'reaction-network') {
    return {
      scenario,
      eventCounter: 2,
      events: [],
      reactionEvents: REACTION_NETWORK_EVENTS,
      reactionActivity: {
        eventId: 'reaction-2', simulationTimeS: 2, state: 'progressing', displayPrecision: 'APPROXIMATED',
        scientificStatus: 'APPROXIMATED', confidence: 'MEDIUM', label: '반응 진행 감지',
      },
      snapshot: {
        ...initialSnapshot,
        simulationTimeS: 2,
        simulationStatus: 'running',
        contents: [
          { speciesId: 'h2', displayIdentity: 'H₂', amountMol: 0.35, phase: 'gas', identityConfirmed: true },
          { displayIdentity: 'hidden mock identity', opaqueLabel: 'Unknown α', amountMol: 0.1, phase: 'unknown', identityConfirmed: false },
        ],
      },
    };
  }
  return { scenario, snapshot: initialSnapshot, events: [], reactionEvents: [], reactionActivity: undefined, eventCounter: 0 };
}

function appendEvent(state: MockState, message: string, kind: LaboratoryEvent['kind'] = 'command-accepted'): MockState {
  const eventCounter = state.eventCounter + 1;
  const event: LaboratoryEvent = { id: `mock-${eventCounter}`, timelineOrder: eventCounter, simulationTimeS: state.snapshot.simulationTimeS, kind, message };
  return { ...state, eventCounter, events: [event, ...state.events].slice(0, 30) };
}
function finiteNonNegative(value: number) { return Number.isFinite(value) && value >= 0; }

function confirmProjectionIdentity(projection: ReactionSpeciesProjection, referenceId: string, species: SubstanceSummary): ReactionSpeciesProjection {
  if (projection.referenceId !== referenceId) return projection;
  return { referenceId: projection.referenceId, displayIdentity: species.formula, identityConfirmed: true, knownSpeciesId: species.speciesId, amountMol: projection.amountMol };
}

function reducer(state: MockState, command: LaboratoryCommand): MockState {
  const s = state.snapshot;
  switch (command.type) {
    case 'AddSubstance': {
      if (!Number.isFinite(command.amountMol) || command.amountMol <= 0 || (!s.unlockedSpeciesIds.includes(command.speciesId) && !s.developerMode)) return appendEvent(state, 'Add request rejected by mock provider', 'command-rejected');
      const known = CATALOG.find((item) => item.speciesId === command.speciesId); if (!known) return state;
      const existing = s.contents.find((entry) => entry.speciesId === command.speciesId && entry.identityConfirmed);
      const contents = existing ? s.contents.map((entry) => entry === existing ? { ...entry, amountMol: entry.amountMol + command.amountMol } : entry)
        : [...s.contents, { speciesId: known.speciesId, displayIdentity: known.formula, amountMol: command.amountMol, phase: 'unknown' as const, identityConfirmed: true }];
      return appendEvent({ ...state, snapshot: { ...s, contents } }, `Added ${command.amountMol.toFixed(3)} mol ${known.formula}`);
    }
    case 'RemoveSubstance': {
      if (!s.contents.some((entry) => entry.speciesId === command.speciesId)) return appendEvent(state, 'Disposal request rejected: substance not present', 'command-rejected');
      const known = CATALOG.find((item) => item.speciesId === command.speciesId);
      const contents = s.contents.filter((entry) => entry.speciesId !== command.speciesId);
      return appendEvent({ ...state, snapshot: { ...s, contents } }, `Disposed ${known?.formula ?? 'selected substance'} from vessel`);
    }
    case 'SetHeaterPower': if (!finiteNonNegative(command.powerW)) return state; return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, heaterPowerW: command.powerW } } }, `Heater request ${command.powerW.toFixed(0)} W`);
    case 'SetCoolerPower': if (!finiteNonNegative(command.powerW)) return state; return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, coolerPowerW: command.powerW } } }, `Cooler request ${command.powerW.toFixed(0)} W`);
    case 'SetThermostat': if (!Number.isFinite(command.targetTemperatureK) || command.targetTemperatureK <= 0) return state; return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, thermostatEnabled: command.enabled, thermostatTargetK: command.targetTemperatureK } } }, `Thermostat ${command.enabled ? 'enabled' : 'disabled'} · target ${command.targetTemperatureK.toFixed(2)} K`);
    case 'SetPressureTarget': if (!Number.isFinite(command.targetPressurePa) || command.targetPressurePa <= 0) return state; return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, requestedPressurePa: command.targetPressurePa } } }, `Pressure target request ${command.targetPressurePa.toFixed(0)} Pa`);
    case 'ChangeVolume': if (!Number.isFinite(command.targetVolumeM3) || command.targetVolumeM3 <= 0) return state; { const target = Math.min(s.capacityM3, command.targetVolumeM3); return appendEvent({ ...state, snapshot: { ...s, volumeM3: target, controls: { ...s.controls, requestedVolumeM3: target } } }, 'Volume request updated'); }
    case 'Mix': return appendEvent(state, 'Mix request accepted');
    case 'Stir': return appendEvent(state, 'Stir request accepted');
    case 'Run': return appendEvent({ ...state, snapshot: { ...s, simulationStatus: 'running' } }, 'Simulation running');
    case 'PauseSimulation': return appendEvent({ ...state, snapshot: { ...s, simulationStatus: 'paused' } }, 'Simulation paused');
    case 'SetSimulationSpeed': return appendEvent({ ...state, snapshot: { ...s, simulationSpeed: command.speed } }, `Simulation speed ×${command.speed}`);
    case 'ToggleFavorite': { const ids = s.favoriteSpeciesIds.includes(command.speciesId) ? s.favoriteSpeciesIds.filter((id) => id !== command.speciesId) : [...s.favoriteSpeciesIds, command.speciesId]; return { ...state, snapshot: { ...s, favoriteSpeciesIds: ids } }; }
    case 'SetDeveloperMode': return appendEvent({ ...state, snapshot: { ...s, developerMode: command.enabled } }, `Developer Mode ${command.enabled ? 'enabled' : 'disabled'}`);
    case 'AnalyzeUnknown': {
      const target = s.unknownObservations.find((item) => item.observationId === command.observationId);
      const confirmedSpeciesId = UNKNOWN_SPECIES_BY_OBSERVATION[command.observationId];
      const referenceId = UNKNOWN_REFERENCE_BY_OBSERVATION[command.observationId];
      if (!target || !confirmedSpeciesId) return state;
      const species = CATALOG.find((item) => item.speciesId === confirmedSpeciesId); if (!species) return state;
      const unlocked = s.unlockedSpeciesIds.includes(species.speciesId) ? s.unlockedSpeciesIds : [...s.unlockedSpeciesIds, species.speciesId];
      const encyclopedia = s.encyclopedia.some((e) => e.speciesId === species.speciesId) ? s.encyclopedia : [...s.encyclopedia, { speciesId: species.speciesId, firstDiscoveryLabel: 'Mock analyzer fixture', knownProperties: [], phaseInfo: 'Authoritative phase data not connected' }];
      const unknownObservations = s.unknownObservations.map((item) => item.observationId === command.observationId ? { ...item, analysisState: 'confirmed' as const } : item);
      const contents = s.contents.map((item) => item.identityConfirmed ? item : { ...item, speciesId: species.speciesId, displayIdentity: species.formula, opaqueLabel: undefined, identityConfirmed: true });
      const reactionEvents = referenceId ? state.reactionEvents.map((event) => ({
        ...event,
        consumed: event.consumed.map((projection) => confirmProjectionIdentity(projection, referenceId, species)),
        produced: event.produced.map((projection) => confirmProjectionIdentity(projection, referenceId, species)),
      })) : state.reactionEvents;
      return appendEvent({ ...state, reactionEvents, snapshot: { ...s, contents, unlockedSpeciesIds: unlocked, encyclopedia, unknownObservations } }, `Identity confirmed: ${species.name}. Encyclopedia registered; catalog unlocked.`, 'discovery');
    }
    case 'ResetExperiment': {
      const reset = createInitialState(state.scenario);
      const timelineOrder = reset.eventCounter + 1;
      return { ...reset, eventCounter: timelineOrder, events: [{ id: `mock-${timelineOrder}`, timelineOrder, simulationTimeS: reset.snapshot.simulationTimeS, kind: 'command-accepted', message: 'Experiment reset' }] };
    }
  }
}

const LaboratoryContext = createContext<LaboratoryProviderValue | null>(null);
export function MockLaboratoryProvider({ children, scenario = 'default' }: { children: ReactNode; scenario?: MockLaboratoryScenario }) {
  const [state, dispatch] = useReducer(reducer, scenario, createInitialState);
  const phaseDiagrams = useMemo<Record<string, PhaseDiagramViewModel | undefined>>(() => ({ h2: { ...PHASE_FIXTURE, currentState: { temperatureK: state.snapshot.temperatureK, pressurePa: state.snapshot.pressurePa, phase: 'unknown' } } }), [state.snapshot.temperatureK, state.snapshot.pressurePa]);
  const value = useMemo<LaboratoryProviderValue>(() => ({ snapshot: state.snapshot, catalog: CATALOG, events: state.events, reactionActivity: state.reactionActivity, reactionEvents: state.reactionEvents, phaseDiagrams, dispatch }), [state, phaseDiagrams]);
  return <LaboratoryContext.Provider value={value}>{children}</LaboratoryContext.Provider>;
}
export function useLaboratory() { const value = useContext(LaboratoryContext); if (!value) throw new Error('useLaboratory must be used inside a LaboratoryProvider'); return value; }
