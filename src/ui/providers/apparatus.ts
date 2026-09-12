import type { ScientificStatus } from '../types';
import type { ApparatusId, ApparatusType } from '../workbench';
import type {
  ApparatusIntentSupportMap,
  ApparatusProviderFact,
} from '../shared/apparatus';

export interface ApparatusProviderMeasurements {
  currentTemperature?: ApparatusProviderFact;
  currentRpm?: ApparatusProviderFact;
  currentPressure?: ApparatusProviderFact;
  currentVoltage?: ApparatusProviderFact;
  currentCurrent?: ApparatusProviderFact;
  collectedAmount?: ApparatusProviderFact;
}

export interface ApparatusProviderConnections {
  connectedVessel?: ApparatusProviderFact<string>;
  inputConnection?: ApparatusProviderFact<string>;
}

export interface ApparatusProviderProjection {
  apparatusId: ApparatusId;
  apparatusType: ApparatusType;
  measurements?: ApparatusProviderMeasurements;
  connections?: ApparatusProviderConnections;
  composition?: ApparatusProviderFact<string>;
  status?: ApparatusProviderFact<string>;
  scientificStatus?: ScientificStatus;
  intentSupport?: ApparatusIntentSupportMap;
}

export interface ApparatusProviderState {
  projections: readonly ApparatusProviderProjection[];
}
