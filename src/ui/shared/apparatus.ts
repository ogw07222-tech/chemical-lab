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

export type ApparatusIntentType =
  | 'SetApparatusEnabled'
  | 'SetApparatusTemperatureTarget'
  | 'SetApparatusPowerTarget'
  | 'SetApparatusRpmTarget'
  | 'SetApparatusPressureTarget'
  | 'SetApparatusValveState'
  | 'SetApparatusVoltageTarget'
  | 'SetApparatusCurrentTarget';

export type ApparatusIntentSupportStatus = 'SUPPORTED' | 'UNSUPPORTED' | 'UNAVAILABLE' | 'OPEN';

export interface ApparatusIntentSupport {
  status: ApparatusIntentSupportStatus;
  reason?: string;
}

export type ApparatusIntentSupportMap = Readonly<Partial<Record<ApparatusIntentType, ApparatusIntentSupport>>>;
