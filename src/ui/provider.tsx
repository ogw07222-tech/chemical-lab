import { createContext, type ReactNode, useContext, useMemo, useReducer } from 'react';
import type { LaboratoryCommand, LaboratoryEvent, LaboratoryProviderValue, LaboratorySnapshot, PhaseDiagramViewModel, SubstanceSummary } from './types';

const CATALOG: SubstanceSummary[] = [
  ['h2', 'Hydrogen', 'H₂'], ['o2', 'Oxygen', 'O₂'], ['n2', 'Nitrogen', 'N₂'], ['h2o', 'Water', 'H₂O'],
  ['co', 'Carbon monoxide', 'CO'], ['co2', 'Carbon dioxide', 'CO₂'], ['ch4', 'Methane', 'CH₄'], ['nh3', 'Ammonia', 'NH₃'],
].map(([speciesId, name, formula]) => ({ speciesId, name, formula, scientificStatus: 'OPEN' as const }));

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

const initialSnapshot: LaboratorySnapshot = {
  experimentName: 'Untitled experiment', vesselId: 'vessel-1', capacityM3: 0.002, volumeM3: 0.001,
  temperatureK: 298.15, pressurePa: 101325, simulationTimeS: 0, simulationStatus: 'stopped', simulationSpeed: 1,
  contents: [],
  unknownObservations: [{ observationId: 'fixture-unknown-1', label: 'Unknown substance detected', analysisState: 'unanalysed', confirmedSpeciesId: 'h2o' }],
  unlockedSpeciesIds: ['h2', 'o2', 'n2'], favoriteSpeciesIds: [], encyclopedia: [], developerMode: false,
  controls: { heaterPowerW: 0, coolerPowerW: 0, thermostatEnabled: false, thermostatTargetK: 298.15, requestedVolumeM3: 0.001 },
};

interface MockState { snapshot: LaboratorySnapshot; events: LaboratoryEvent[]; eventCounter: number; }
const initialState: MockState = { snapshot: initialSnapshot, events: [], eventCounter: 0 };
function appendEvent(state: MockState, message: string, kind: LaboratoryEvent['kind'] = 'command-accepted'): MockState {
  const eventCounter = state.eventCounter + 1;
  const event: LaboratoryEvent = { id: `mock-${eventCounter}`, simulationTimeS: state.snapshot.simulationTimeS, kind, message };
  return { ...state, eventCounter, events: [event, ...state.events].slice(0, 30) };
}
function finiteNonNegative(value: number) { return Number.isFinite(value) && value >= 0; }

function reducer(state: MockState, command: LaboratoryCommand): MockState {
  const s = state.snapshot;
  switch (command.type) {
    case 'AddSubstance': {
      if (!Number.isFinite(command.amountMol) || command.amountMol <= 0 || !s.unlockedSpeciesIds.includes(command.speciesId) && !s.developerMode) return appendEvent(state, 'Add request rejected by mock provider', 'command-rejected');
      const known = CATALOG.find((item) => item.speciesId === command.speciesId); if (!known) return state;
      const existing = s.contents.find((entry) => entry.speciesId === command.speciesId && entry.identityConfirmed);
      const contents = existing ? s.contents.map((entry) => entry === existing ? { ...entry, amountMol: entry.amountMol + command.amountMol } : entry)
        : [...s.contents, { speciesId: known.speciesId, displayIdentity: known.formula, amountMol: command.amountMol, phase: 'unknown' as const, identityConfirmed: true }];
      return appendEvent({ ...state, snapshot: { ...s, contents } }, `Added ${command.amountMol.toFixed(3)} mol ${known.formula}`);
    }
    case 'SetHeaterPower': if (!finiteNonNegative(command.powerW)) return state; return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, heaterPowerW: command.powerW } } }, `Heater request ${command.powerW.toFixed(0)} W`);
    case 'SetCoolerPower': if (!finiteNonNegative(command.powerW)) return state; return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, coolerPowerW: command.powerW } } }, `Cooler request ${command.powerW.toFixed(0)} W`);
    case 'SetThermostat': if (!Number.isFinite(command.targetTemperatureK) || command.targetTemperatureK <= 0) return state; return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, thermostatEnabled: command.enabled, thermostatTargetK: command.targetTemperatureK } } }, `Thermostat ${command.enabled ? 'enabled' : 'disabled'}`);
    case 'ChangeVolume': if (!Number.isFinite(command.targetVolumeM3) || command.targetVolumeM3 <= 0) return state; { const target = Math.min(s.capacityM3, command.targetVolumeM3); return appendEvent({ ...state, snapshot: { ...s, volumeM3: target, controls: { ...s.controls, requestedVolumeM3: target } } }, 'Volume request updated'); }
    case 'Run': return appendEvent({ ...state, snapshot: { ...s, simulationStatus: 'running' } }, 'Simulation running');
    case 'PauseSimulation': return appendEvent({ ...state, snapshot: { ...s, simulationStatus: 'paused' } }, 'Simulation paused');
    case 'SetSimulationSpeed': return appendEvent({ ...state, snapshot: { ...s, simulationSpeed: command.speed } }, `Simulation speed ×${command.speed}`);
    case 'ToggleFavorite': { const ids = s.favoriteSpeciesIds.includes(command.speciesId) ? s.favoriteSpeciesIds.filter((id) => id !== command.speciesId) : [...s.favoriteSpeciesIds, command.speciesId]; return { ...state, snapshot: { ...s, favoriteSpeciesIds: ids } }; }
    case 'SetDeveloperMode': return appendEvent({ ...state, snapshot: { ...s, developerMode: command.enabled } }, `Developer Mode ${command.enabled ? 'enabled' : 'disabled'}`);
    case 'AnalyzeUnknown': {
      const target = s.unknownObservations.find((item) => item.observationId === command.observationId); if (!target || !target.confirmedSpeciesId) return state;
      const species = CATALOG.find((item) => item.speciesId === target.confirmedSpeciesId); if (!species) return state;
      const unlocked = s.unlockedSpeciesIds.includes(species.speciesId) ? s.unlockedSpeciesIds : [...s.unlockedSpeciesIds, species.speciesId];
      const encyclopedia = s.encyclopedia.some((e) => e.speciesId === species.speciesId) ? s.encyclopedia : [...s.encyclopedia, { speciesId: species.speciesId, firstDiscoveryLabel: 'Mock analyzer fixture', knownProperties: [], phaseInfo: 'Authoritative phase data not connected' }];
      const unknownObservations = s.unknownObservations.map((item) => item.observationId === command.observationId ? { ...item, analysisState: 'confirmed' as const } : item);
      return appendEvent({ ...state, snapshot: { ...s, unlockedSpeciesIds: unlocked, encyclopedia, unknownObservations } }, `Identity confirmed: ${species.name}. Encyclopedia registered; inventory unlocked.`, 'discovery');
    }
    case 'ResetExperiment': return { snapshot: { ...initialSnapshot, developerMode: s.developerMode }, eventCounter: state.eventCounter + 1, events: [{ id: `mock-${state.eventCounter + 1}`, simulationTimeS: 0, kind: 'command-accepted', message: 'Experiment reset' }] };
  }
}

const LaboratoryContext = createContext<LaboratoryProviderValue | null>(null);
export function MockLaboratoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const phaseDiagrams = useMemo<Record<string, PhaseDiagramViewModel | undefined>>(() => ({ h2: { ...PHASE_FIXTURE, currentState: { temperatureK: state.snapshot.temperatureK, pressurePa: state.snapshot.pressurePa, phase: 'unknown' } } }), [state.snapshot.temperatureK, state.snapshot.pressurePa]);
  const value = useMemo<LaboratoryProviderValue>(() => ({ snapshot: state.snapshot, catalog: CATALOG, events: state.events, phaseDiagrams, dispatch }), [state, phaseDiagrams]);
  return <LaboratoryContext.Provider value={value}>{children}</LaboratoryContext.Provider>;
}
export function useLaboratory() { const value = useContext(LaboratoryContext); if (!value) throw new Error('useLaboratory must be used inside a LaboratoryProvider'); return value; }
