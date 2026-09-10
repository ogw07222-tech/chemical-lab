import { createContext, type ReactNode, useContext, useMemo, useReducer } from 'react';
import type { LaboratoryCommand, LaboratoryEvent, LaboratoryProviderValue, LaboratorySnapshot, SubstanceSummary } from './types';

const CATALOG: SubstanceSummary[] = [
  ['h2', 'Hydrogen', 'H₂', 'gas'], ['o2', 'Oxygen', 'O₂', 'gas'], ['n2', 'Nitrogen', 'N₂', 'gas'],
  ['h2o', 'Water', 'H₂O', 'liquid'], ['co', 'Carbon monoxide', 'CO', 'gas'], ['co2', 'Carbon dioxide', 'CO₂', 'gas'],
  ['ch4', 'Methane', 'CH₄', 'gas'], ['nh3', 'Ammonia', 'NH₃', 'gas'],
].map(([speciesId, name, formula, defaultPhase]) => ({ speciesId, name, formula, defaultPhase: defaultPhase as SubstanceSummary['defaultPhase'] }));

const initialSnapshot: LaboratorySnapshot = {
  vesselId: 'vessel-1', capacityL: 2, volumeL: 1, temperatureK: 298.15, pressureKPa: 101.325,
  simulationTimeS: 0, simulationStatus: 'stopped', simulationSpeed: 1, contents: [],
  controls: { thermalIntent: 'off', requestedVolumeL: 1 },
};

interface MockState { snapshot: LaboratorySnapshot; events: LaboratoryEvent[]; eventCounter: number; }
const initialState: MockState = { snapshot: initialSnapshot, events: [], eventCounter: 0 };

function appendEvent(state: MockState, message: string): MockState {
  const eventCounter = state.eventCounter + 1;
  return { ...state, eventCounter, events: [{ id: `mock-${eventCounter}`, simulationTimeS: state.snapshot.simulationTimeS, kind: 'command-accepted', message }, ...state.events].slice(0, 20) };
}

function reducer(state: MockState, command: LaboratoryCommand): MockState {
  const s = state.snapshot;
  switch (command.type) {
    case 'AddSubstance': {
      if (!Number.isFinite(command.amountMol) || command.amountMol <= 0) return state;
      const known = CATALOG.find((item) => item.speciesId === command.speciesId);
      if (!known) return state;
      const existing = s.contents.find((entry) => entry.speciesId === command.speciesId);
      const contents = existing
        ? s.contents.map((entry) => entry.speciesId === command.speciesId ? { ...entry, amountMol: entry.amountMol + command.amountMol } : entry)
        : [...s.contents, { speciesId: known.speciesId, formula: known.formula, amountMol: command.amountMol, phase: known.defaultPhase }];
      return appendEvent({ ...state, snapshot: { ...s, contents } }, `Added ${command.amountMol.toFixed(2)} mol ${known.formula}`);
    }
    case 'Heat': return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, thermalIntent: 'heat' } } }, 'Heating request enabled');
    case 'Cool': return appendEvent({ ...state, snapshot: { ...s, controls: { ...s.controls, thermalIntent: 'cool' } } }, 'Cooling request enabled');
    case 'ChangeVolume': {
      const target = Math.min(s.capacityL, Math.max(0.1, command.targetVolumeL));
      return appendEvent({ ...state, snapshot: { ...s, volumeL: target, controls: { ...s.controls, requestedVolumeL: target } } }, `Volume request set to ${target.toFixed(2)} L`);
    }
    case 'Run': return appendEvent({ ...state, snapshot: { ...s, simulationStatus: 'running' } }, 'Simulation running');
    case 'PauseSimulation': return appendEvent({ ...state, snapshot: { ...s, simulationStatus: 'paused' } }, 'Simulation paused');
    case 'SetSimulationSpeed': return appendEvent({ ...state, snapshot: { ...s, simulationSpeed: command.speed } }, `Simulation speed set to ×${command.speed}`);
    case 'ResetExperiment': {
      const id = state.eventCounter + 1;
      return { snapshot: initialSnapshot, eventCounter: id, events: [{ id: `mock-${id}`, simulationTimeS: 0, kind: 'command-accepted', message: 'Experiment reset' }] };
    }
  }
}

const LaboratoryContext = createContext<LaboratoryProviderValue | null>(null);

export function MockLaboratoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo<LaboratoryProviderValue>(() => ({ snapshot: state.snapshot, catalog: CATALOG, events: state.events, dispatch }), [state]);
  return <LaboratoryContext.Provider value={value}>{children}</LaboratoryContext.Provider>;
}

export function useLaboratory() {
  const value = useContext(LaboratoryContext);
  if (!value) throw new Error('useLaboratory must be used inside a LaboratoryProvider');
  return value;
}
