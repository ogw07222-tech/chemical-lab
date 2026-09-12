import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  APPARATUS_CATALOG,
  ApparatusCatalog,
  ApparatusVisual,
  ApparatusWorkspaceLayer,
  DeviceInspector,
  type ApparatusControlState,
} from '../../../src/ui/apparatus';
import type { ApparatusInstance, ApparatusPlacement } from '../../../src/ui/workbench';

const apparatus: ApparatusInstance[] = [
  { id: 'beaker-1', type: 'BEAKER' },
  { id: 'hot-plate-1', type: 'HOT_PLATE' },
  { id: 'stirrer-1', type: 'MAGNETIC_STIRRER' },
  { id: 'vacuum-1', type: 'VACUUM_PUMP' },
  { id: 'power-1', type: 'POWER_SUPPLY' },
];

const placements: ApparatusPlacement[] = apparatus.map((instance, index) => ({
  apparatusId: instance.id,
  position: { xPercent: 12 + index * 17, yPercent: 52 },
  zIndex: index + 1,
}));

describe('05B apparatus catalog and visuals', () => {
  it('contains the complete initial apparatus vocabulary with the agreed tiers', () => {
    expect(APPARATUS_CATALOG).toHaveLength(16);
    expect(APPARATUS_CATALOG.filter((entry) => entry.tier === 1).map((entry) => entry.type)).toEqual([
      'BEAKER', 'FLASK', 'SEALED_VESSEL', 'HOT_PLATE', 'MAGNETIC_STIRRER',
    ]);
    expect(APPARATUS_CATALOG.filter((entry) => entry.tier === 2)).toHaveLength(5);
    expect(APPARATUS_CATALOG.filter((entry) => entry.tier === 3)).toHaveLength(6);
  });

  it('renders Tier 1 apparatus as simple presentation geometry', () => {
    const { container } = render(<>{APPARATUS_CATALOG.filter((entry) => entry.tier === 1).map((entry) => <ApparatusVisual key={entry.type} type={entry.type} />)}</>);
    expect(screen.getByLabelText('Beaker visual')).toBeInTheDocument();
    expect(screen.getByLabelText('Flask visual')).toBeInTheDocument();
    expect(screen.getByLabelText('Sealed Vessel visual')).toBeInTheDocument();
    expect(screen.getByLabelText('Hot Plate visual')).toBeInTheDocument();
    expect(screen.getByLabelText('Magnetic Stirrer visual')).toBeInTheDocument();
    expect(container.querySelector('.shape-beaker')).toBeInTheDocument();
    expect(container.querySelector('.shape-hot-plate')).toBeInTheDocument();
  });

  it('emits a typed apparatus creation request without owning placement', () => {
    const onCreateRequest = vi.fn();
    render(<ApparatusCatalog onCreateRequest={onCreateRequest} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Hot Plate' }));
    expect(onCreateRequest).toHaveBeenCalledWith('HOT_PLATE');
  });
});

describe('05B placement composition and selection', () => {
  it('uses the 05A placement surface and switches Device Inspector by selected apparatus', () => {
    render(<ApparatusWorkspaceLayer apparatus={apparatus} placements={placements} />);
    expect(screen.getByRole('region', { name: '기구 배치 영역' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('group', { name: 'HOT_PLATE 기구' }));
    expect(screen.getByRole('complementary', { name: 'Device Inspector' })).toHaveTextContent('Hot Plate');
    expect(screen.getByLabelText('Target Temperature')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('group', { name: 'BEAKER 기구' }));
    expect(screen.getByRole('complementary', { name: 'Device Inspector' })).toHaveTextContent('Beaker');
    expect(screen.queryByLabelText('Target Temperature')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Power')).not.toBeInTheDocument();
  });

  it('preserves stable instance ids for multiple apparatus of the same type', () => {
    render(<ApparatusWorkspaceLayer apparatus={[{ id: 'beaker-1', type: 'BEAKER' }, { id: 'beaker-2', type: 'BEAKER' }]} />);
    const groups = screen.getAllByRole('group', { name: 'BEAKER 기구' });
    expect(groups[0]).toHaveAttribute('data-apparatus-id', 'beaker-1');
    expect(groups[1]).toHaveAttribute('data-apparatus-id', 'beaker-2');
    fireEvent.click(groups[1]);
    expect(screen.getByRole('complementary', { name: 'Device Inspector' })).toHaveTextContent('beaker-2');
  });
});

describe('05B Device Inspector intent contract', () => {
  it('dispatches Hot Plate enabled and target-temperature intents', () => {
    const onIntent = vi.fn();
    const onControlStateChange = vi.fn();
    render(<DeviceInspector apparatusId="hot-plate-1" type="HOT_PLATE" onIntent={onIntent} onControlStateChange={onControlStateChange} />);
    fireEvent.click(screen.getByLabelText('Power'));
    fireEvent.change(screen.getByLabelText('Target Temperature'), { target: { value: '120' } });
    expect(onIntent).toHaveBeenCalledWith({ type: 'SetApparatusEnabled', apparatusId: 'hot-plate-1', enabled: true });
    expect(onIntent).toHaveBeenCalledWith({ type: 'SetApparatusTemperatureTarget', apparatusId: 'hot-plate-1', targetTemperatureC: 120 });
  });

  it('dispatches stirrer RPM and vacuum pressure target intents', () => {
    const stirIntent = vi.fn();
    const vacuumIntent = vi.fn();
    const { unmount } = render(<DeviceInspector apparatusId="stirrer-1" type="MAGNETIC_STIRRER" onIntent={stirIntent} />);
    fireEvent.change(screen.getByLabelText('Target RPM'), { target: { value: '750' } });
    expect(stirIntent).toHaveBeenCalledWith({ type: 'SetApparatusRpmTarget', apparatusId: 'stirrer-1', targetRpm: 750 });
    unmount();
    render(<DeviceInspector apparatusId="vacuum-1" type="VACUUM_PUMP" onIntent={vacuumIntent} />);
    fireEvent.change(screen.getByLabelText('Target Pressure'), { target: { value: '35' } });
    expect(vacuumIntent).toHaveBeenCalledWith({ type: 'SetApparatusPressureTarget', apparatusId: 'vacuum-1', targetPressureKPa: 35 });
  });

  it('dispatches power-supply voltage/current intents and gas-collector valve intent', () => {
    const powerIntent = vi.fn();
    const gasIntent = vi.fn();
    const { unmount } = render(<DeviceInspector apparatusId="power-1" type="POWER_SUPPLY" onIntent={powerIntent} />);
    fireEvent.change(screen.getByLabelText('Voltage Target'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Current Target'), { target: { value: '0.5' } });
    expect(powerIntent).toHaveBeenCalledWith({ type: 'SetApparatusVoltageTarget', apparatusId: 'power-1', targetVoltageV: 12 });
    expect(powerIntent).toHaveBeenCalledWith({ type: 'SetApparatusCurrentTarget', apparatusId: 'power-1', targetCurrentA: 0.5 });
    unmount();
    render(<DeviceInspector apparatusId="collector-1" type="GAS_COLLECTOR" onIntent={gasIntent} />);
    fireEvent.change(screen.getByLabelText('Valve'), { target: { value: 'OPEN' } });
    expect(gasIntent).toHaveBeenCalledWith({ type: 'SetApparatusValveState', apparatusId: 'collector-1', valveState: 'OPEN' });
  });

  it('never copies a setpoint into a missing provider current-state fact', () => {
    const state: ApparatusControlState = { enabled: true, targetRpm: 1234 };
    render(<DeviceInspector apparatusId="stirrer-1" type="MAGNETIC_STIRRER" controlState={state} />);
    expect(screen.getByLabelText('Target RPM')).toHaveValue(1234);
    const currentState = screen.getByRole('region', { name: 'Current State' });
    expect(within(currentState).getByText('Current RPM')).toBeInTheDocument();
    expect(within(currentState).getAllByText('UNAVAILABLE')).toHaveLength(2);
    expect(currentState).not.toHaveTextContent('1234');
  });

  it('shows explicit provider status instead of fabricating a current number', () => {
    render(<DeviceInspector apparatusId="vacuum-1" type="VACUUM_PUMP" controlState={{ targetPressureKPa: 40 }} providerFacts={{ currentPressure: { status: 'NOT_CONNECTED' }, connectedVessel: { status: 'UNSUPPORTED' } }} />);
    const currentState = screen.getByRole('region', { name: 'Current State' });
    expect(currentState).toHaveTextContent('NOT_CONNECTED');
    expect(currentState).toHaveTextContent('UNSUPPORTED');
    expect(currentState).not.toHaveTextContent('40 kPa');
  });
});
