import { createContext, type ReactNode, useContext, useMemo, useReducer } from 'react';
import type { Phase3BProviderProjection } from '../integration/phase3b-reversible-arbitration';
import { projectPhase3BReactionUi, type PlayerSpeciesKnowledgeResolver } from './reactionProjection';
import type { LaboratoryCommand, LaboratoryEvent, LaboratoryProviderValue, LaboratorySnapshot, PhaseDiagramViewModel, SubstanceSummary } from './types';

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

const UNKNOWN_SPECIES_BY_OBSERVATION: Readonly<Record<string, string>> = { 'fixture-unknown-1': 'h2o' };
const GENERATED_FIXTURE_REF = 'generated:fixture-water';
const REVERSIBLE_FIXTURE_PAIR_ID = 'internal:fixture-reversible-pair';

// Rendering fixture using the current production Phase 3B provider-facing projection.
// Values are supplied as provider facts; UI code must not reconstruct or infer them.
const REACTION_NETWORK_PROVIDER_FIXTURE: Phase3BProviderProjection = {
  authoritativeVesselComposition: [
    { speciesRef: 'h2', amountMol: 0.35, phase: 'gas', phaseStateId: 'fixture-h2-gas' },
    { speciesRef: GENERATED_FIXTURE_REF, amountMol: 0.1, phase: 'unknown', phaseStateId: 'fixture-unknown-phase' },
  ],
  activeReactionEvents: [
    {
      eventId: 'reaction-step-2', timestepId: 'fixture-step-2', sequence: 0, candidateId: 'fixture-candidate-2',
      startTimeS: 1, endTimeS: 2, extentMol: 0.1,
      consumed: [{ speciesRef: GENERATED_FIXTURE_REF, amountMol: 0.1 }],
      produced: [{ speciesRef: 'o2', amountMol: 0.05 }],
      reactionHeat_J: 42,
      scientificStatus: 'APPROXIMATED',
      reasonCodes: ['SELECTED', 'COARSE_RELATIVE_RATE_EXTENT', 'REACTION_HEAT_APPLIED'],
      reversiblePairId: REVERSIBLE_FIXTURE_PAIR_ID,
      channelDirection: 'FORWARD',
      equilibriumDirection: 'FORWARD',
      equilibriumScientificStatus: 'APPROXIMATED',
      equilibriumDrivingStrength: 0.625,
      lnQOverK: -0.981,
      reactionQuotientQ: 0.25,
      equilibriumConstantK: 0.667,
    },
  ],
  timelineEvents: [
    {
      eventId: 'reaction-step-1', timestepId: 'fixture-step-1', sequence: 0, candidateId: 'fixture-candidate-1',
      startTimeS: 0, endTimeS: 1, extentMol: 0.2,
      consumed: [{ speciesRef: 'h2', amountMol: 0.2 }],
      produced: [{ speciesRef: GENERATED_FIXTURE_REF, amountMol: 0.1 }],
      reactionHeat_J: 123.4,
      scientificStatus: 'OPEN',
      reasonCodes: ['SELECTED', 'MISSING_REACTION_ENTHALPY'],
    },
    {
      eventId: 'reaction-step-2', timestepId: 'fixture-step-2', sequence: 0, candidateId: 'fixture-candidate-2',
      startTimeS: 1, endTimeS: 2, extentMol: 0.1,
      consumed: [{ speciesRef: GENERATED_FIXTURE_REF, amountMol: 0.1 }],
      produced: [{ speciesRef: 'o2', amountMol: 0.05 }],
      reactionHeat_J: 42,
      scientificStatus: 'APPROXIMATED',
      reasonCodes: ['SELECTED', 'COARSE_RELATIVE_RATE_EXTENT', 'REACTION_HEAT_APPLIED'],
      reversiblePairId: REVERSIBLE_FIXTURE_PAIR_ID,
      channelDirection: 'FORWARD',
      equilibriumDirection: 'FORWARD',
      equilibriumScientificStatus: 'APPROXIMATED',
      equilibriumDrivingStrength: 0.625,
      lnQOverK: -0.981,
      reactionQuotientQ: 0.25,
      equilibriumConstantK: 0.667,
    },
    // Duplicate provider delivery is intentional: UI projection must de-duplicate by eventId.
    {
      eventId: 'reaction-step-2', timestepId: 'fixture-step-2', sequence: 0, candidateId: 'fixture-candidate-2',
      startTimeS: 1, endTimeS: 2, extentMol: 0.1,
      consumed: [{ speciesRef: GENERATED_FIXTURE_REF, amountMol: 0.1 }],
      produced: [{ speciesRef: 'o2', amountMol: 0.05 }],
      reactionHeat_J: 42,
      scientificStatus: 'APPROXIMATED',
      reasonCodes: ['SELECTED', 'COARSE_RELATIVE_RATE_EXTENT', 'REACTION_HEAT_APPLIED'],
      reversiblePairId: REVERSIBLE_FIXTURE_PAIR_ID,
      channelDirection: 'FORWARD',
      equilibriumDirection: 'FORWARD',
      equilibriumScientificStatus: 'APPROXIMATED',
      equilibriumDrivingStrength: 0.625,
      lnQOverK: -0.981,
      reactionQuotientQ: 0.25,
      equilibriumConstantK: 0.667,
    },
  ],
  reversiblePairs: [
    {
      reversiblePairId: REVERSIBLE_FIXTURE_PAIR_ID,
      equilibriumDirection: 'FORWARD',
      equilibriumScientificStatus: 'APPROXIMATED',
      selectedChannelDirection: 'FORWARD',
      drivingStrength: 0.625,
      maxNetProgressFraction: 0.625,
      preventEquilibriumCrossing: true,
      maxExtentTowardEquilibriumMol: 0.08,
      lnQOverK: -0.981,
      reactionQuotientQ: 0.25,
      equilibriumConstantK: 0.667,
      reasonCodes: ['THERMODYNAMIC_DRIVE_SUPPORTED', 'APPROXIMATED_DRIVING_MODULATION', 'EQUILIBRIUM_CROSSING_BOUND_SUPPORTED'],
    },
  ],
};

const initialSnapshot: LaboratorySnapshot = {
  experimentName: 'Untitled experiment', vesselId: 'vessel-1', capacityM3: 0.002, volumeM3: 0.001,
  temperatureK: 298.15, pressurePa: 101325, simulationTimeS: 0, simulationStatus: 'stopped', simulationSpeed: 1,
  contents: [],
  unknownObservations: [{ observationId: 'fixture-unknown-1', label: 'Unknown substance detected', analysisState: 'unanalysed' }],
  unlockedSpeciesIds: ['h2', 'o2', 'n2'], favoriteSpeciesIds: [], encyclopedia: [], developerMode: false,
  controls: { heaterPowerW: 0, coolerPowerW: 0, thermostatEnabled: false, thermostatTargetK: 298.15, requestedPressurePa: 101325, requestedVolumeM3: 0.001 },
};

export type MockLaboratoryScenario = 'default' | 'reaction-network';
interface MockState { snapshot: LaboratorySnapshot; events: LaboratoryEvent[]; eventCounter: number; scenario: MockLaboratoryScenario; generatedIdentityConfirmed: boolean; }
function createInitialState(scenario: MockLaboratoryScenario): MockState {
  return {
    snapshot: scenario === 'reaction-network' ? { ...initialSnapshot, simulationTimeS: 2, simulationStatus: 'running' } : initialSnapshot,
    events: [], eventCounter: 0, scenario, generatedIdentityConfirmed: false,
  };
}
function appendEvent(state: MockState, message: string, kind: LaboratoryEvent['kind'] = 'command-accepted'): MockState {
  const eventCounter = state.eventCounter + 1;
  const event: LaboratoryEvent = { id: `mock-${eventCounter}`, simulationTimeS: state.snapshot.simulationTimeS, kind, message };
  return { ...state, eventCounter, events: [event, ...state.events].slice(0, 30) };
}
function finiteNonNegative(value: number) { return Number.isFinite(value) && value >= 0; }

function mockSpeciesResolver(confirmed: boolean): PlayerSpeciesKnowledgeResolver {
  return (speciesRef) => {
    if (speciesRef === 'h2') return { unknownRef: 'known-h2', displayLabel: 'H₂', identityConfirmed: true, knownSpeciesId: 'h2' };
    if (speciesRef === 'o2') return { unknownRef: 'known-o2', displayLabel: 'O₂', identityConfirmed: true, knownSpeciesId: 'o2' };
    if (speciesRef === GENERATED_FIXTURE_REF) {
      return confirmed
        ? { unknownRef: 'unknown-fixture-a', displayLabel: 'H₂O', identityConfirmed: true, knownSpeciesId: 'h2o' }
        : { unknownRef: 'unknown-fixture-a', displayLabel: 'Unknown α', identityConfirmed: false };
    }
    return { unknownRef: 'unknown-fixture-other', displayLabel: 'Unknown substance', identityConfirmed: false };
  };
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
      if (!target || !confirmedSpeciesId) return state;
      const species = CATALOG.find((item) => item.speciesId === confirmedSpeciesId); if (!species) return state;
      const unlocked = s.unlockedSpeciesIds.includes(species.speciesId) ? s.unlockedSpeciesIds : [...s.unlockedSpeciesIds, species.speciesId];
      const encyclopedia = s.encyclopedia.some((e) => e.speciesId === species.speciesId) ? s.encyclopedia : [...s.encyclopedia, { speciesId: species.speciesId, firstDiscoveryLabel: 'Mock analyzer fixture', knownProperties: [], phaseInfo: 'Authoritative phase data not connected' }];
      const unknownObservations = s.unknownObservations.map((item) => item.observationId === command.observationId ? { ...item, analysisState: 'confirmed' as const } : item);
      return appendEvent({ ...state, generatedIdentityConfirmed: state.scenario === 'reaction-network' || state.generatedIdentityConfirmed, snapshot: { ...s, unlockedSpeciesIds: unlocked, encyclopedia, unknownObservations } }, `Identity confirmed: ${species.name}. Encyclopedia registered; catalog unlocked.`, 'discovery');
    }
    case 'ResetExperiment': return { ...createInitialState(state.scenario), snapshot: { ...createInitialState(state.scenario).snapshot, developerMode: s.developerMode }, eventCounter: state.eventCounter + 1, events: [{ id: `mock-${state.eventCounter + 1}`, simulationTimeS: 0, kind: 'command-accepted', message: 'Experiment reset' }] };
  }
}

const LaboratoryContext = createContext<LaboratoryProviderValue | null>(null);
export function MockLaboratoryProvider({ children, scenario = 'default' }: { children: ReactNode; scenario?: MockLaboratoryScenario }) {
  const [state, dispatch] = useReducer(reducer, scenario, createInitialState);
  const reactionUi = useMemo(() => state.scenario === 'reaction-network'
    ? projectPhase3BReactionUi(REACTION_NETWORK_PROVIDER_FIXTURE, mockSpeciesResolver(state.generatedIdentityConfirmed), state.snapshot.developerMode)
    : undefined, [state.scenario, state.generatedIdentityConfirmed, state.snapshot.developerMode]);
  const projectedSnapshot = reactionUi ? { ...state.snapshot, contents: reactionUi.contents } : state.snapshot;
  const phaseDiagrams = useMemo<Record<string, PhaseDiagramViewModel | undefined>>(() => ({ h2: { ...PHASE_FIXTURE, currentState: { temperatureK: projectedSnapshot.temperatureK, pressurePa: projectedSnapshot.pressurePa, phase: 'unknown' } } }), [projectedSnapshot.temperatureK, projectedSnapshot.pressurePa]);
  const value = useMemo<LaboratoryProviderValue>(() => ({
    snapshot: projectedSnapshot,
    catalog: CATALOG,
    events: state.events,
    reactionActivity: reactionUi?.reactionActivity,
    reactionEvents: reactionUi?.reactionEvents ?? [],
    reversiblePairs: reactionUi?.reversiblePairs ?? [],
    reactionDeveloperDiagnostics: reactionUi?.developerDiagnostics,
    phaseDiagrams,
    dispatch,
  }), [projectedSnapshot, state.events, reactionUi, phaseDiagrams]);
  return <LaboratoryContext.Provider value={value}>{children}</LaboratoryContext.Provider>;
}
export function useLaboratory() { const value = useContext(LaboratoryContext); if (!value) throw new Error('useLaboratory must be used inside a LaboratoryProvider'); return value; }
