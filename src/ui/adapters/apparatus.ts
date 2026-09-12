import type { ApparatusProviderFacts, ApparatusUiIntent } from '../apparatus';
import type { LaboratoryCommand } from '../types';
import type { ApparatusProviderProjection } from '../providers/apparatus';
import type { ApparatusIntentSupport } from '../shared/apparatus';

export interface ApparatusIntentMappingResult {
  status: ApparatusIntentSupport['status'];
  reason: string;
  command?: LaboratoryCommand;
}

export function projectApparatusFacts(projection: ApparatusProviderProjection | undefined): ApparatusProviderFacts | undefined {
  if (!projection) return undefined;
  return {
    currentTemperature: projection.measurements?.currentTemperature,
    currentRpm: projection.measurements?.currentRpm,
    currentPressure: projection.measurements?.currentPressure,
    currentVoltage: projection.measurements?.currentVoltage,
    currentCurrent: projection.measurements?.currentCurrent,
    connectedVessel: projection.connections?.connectedVessel,
    inputConnection: projection.connections?.inputConnection,
    collectedAmount: projection.measurements?.collectedAmount,
    composition: projection.composition,
    status: projection.status,
  };
}

export function mapApparatusIntentToLaboratoryCommand(
  intent: ApparatusUiIntent,
  projection: ApparatusProviderProjection | undefined,
): ApparatusIntentMappingResult {
  const support = projection?.intentSupport?.[intent.type];

  if (support && support.status !== 'SUPPORTED') {
    return {
      status: support.status,
      reason: support.reason ?? `Provider does not currently support ${intent.type}.`,
    };
  }

  // LaboratoryCommand currently has vessel-global controls only. None of those commands
  // is an exact apparatusId-addressed backend command, so 05D must not translate an
  // apparatus request into a different simulation contract.
  return {
    status: 'UNSUPPORTED',
    reason: `No authoritative apparatus command mapping exists for ${intent.type}.`,
  };
}
