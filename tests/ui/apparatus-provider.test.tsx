import { describe, expect, it } from 'vitest';
import { mapApparatusIntentToLaboratoryCommand, projectApparatusFacts } from '../../src/ui/adapters/apparatus';
import type { ApparatusProviderProjection } from '../../src/ui/providers/apparatus';

const baseProjection: ApparatusProviderProjection = {
  apparatusId: 'vacuum-1',
  apparatusType: 'VACUUM_PUMP',
  measurements: {
    currentPressure: { status: 'AVAILABLE', value: 42, unit: 'kPa' },
  },
  connections: {
    connectedVessel: { status: 'NOT_CONNECTED' },
  },
  scientificStatus: 'OPEN',
};

describe('05D apparatus provider boundary', () => {
  it('maps authoritative provider readings without deriving new values', () => {
    expect(projectApparatusFacts(baseProjection)).toEqual({
      currentTemperature: undefined,
      currentRpm: undefined,
      currentPressure: { status: 'AVAILABLE', value: 42, unit: 'kPa' },
      currentVoltage: undefined,
      currentCurrent: undefined,
      connectedVessel: { status: 'NOT_CONNECTED' },
      inputConnection: undefined,
      collectedAmount: undefined,
      composition: undefined,
      status: undefined,
    });
  });

  it('does not fabricate a numeric reading when the provider omits one', () => {
    const facts = projectApparatusFacts({
      apparatusId: 'stirrer-1',
      apparatusType: 'MAGNETIC_STIRRER',
      scientificStatus: 'OPEN',
    });
    expect(facts?.currentRpm).toBeUndefined();
    expect(facts?.currentTemperature).toBeUndefined();
  });

  it('keeps unsupported apparatus intent explicit and emits no LaboratoryCommand', () => {
    const result = mapApparatusIntentToLaboratoryCommand(
      { type: 'SetApparatusPressureTarget', apparatusId: 'vacuum-1', targetPressureKPa: 35 },
      baseProjection,
    );
    expect(result.status).toBe('UNSUPPORTED');
    expect(result.command).toBeUndefined();
    expect(result.reason).toContain('No authoritative apparatus command mapping');
  });

  it('preserves provider-declared unavailable reasons without dispatching a fake command', () => {
    const result = mapApparatusIntentToLaboratoryCommand(
      { type: 'SetApparatusEnabled', apparatusId: 'vacuum-1', enabled: true },
      {
        ...baseProjection,
        intentSupport: {
          SetApparatusEnabled: { status: 'UNAVAILABLE', reason: 'Backend apparatus command not connected.' },
        },
      },
    );
    expect(result).toEqual({
      status: 'UNAVAILABLE',
      reason: 'Backend apparatus command not connected.',
    });
  });
});
