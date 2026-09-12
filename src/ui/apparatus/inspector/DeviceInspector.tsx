import { forwardRef } from 'react';
import type { ApparatusType } from '../../workbench';
import { getApparatusCatalogEntry } from '../catalog/catalog';
import type {
  ApparatusControlState,
  ApparatusIntentSupportMap,
  ApparatusProviderFact,
  ApparatusProviderFacts,
  ApparatusUiIntent,
  ApparatusValveState,
} from '../types';

export interface DeviceInspectorProps {
  apparatusId: string;
  type: ApparatusType;
  controlState?: ApparatusControlState;
  providerFacts?: ApparatusProviderFacts;
  intentSupport?: ApparatusIntentSupportMap;
  onControlStateChange?: (next: ApparatusControlState) => void;
  onIntent?: (intent: ApparatusUiIntent) => void;
  onRequestClose?: () => void;
}

function factText<T>(fact: ApparatusProviderFact<T> | undefined): string {
  if (!fact) return 'UNAVAILABLE';
  if (fact.status !== 'AVAILABLE' || fact.value === undefined) return fact.status;
  return `${String(fact.value)}${fact.unit ? ` ${fact.unit}` : ''}`;
}

function CurrentFact({ label, fact }: { label: string; fact?: ApparatusProviderFact<unknown> }) {
  return <div className="apparatus-fact-row"><dt>{label}</dt><dd>{factText(fact)}</dd></div>;
}

function supportState(intentSupport: ApparatusIntentSupportMap | undefined, type: ApparatusUiIntent['type']) {
  const support = intentSupport?.[type];
  return {
    disabled: support !== undefined && support.status !== 'SUPPORTED',
    reason: support && support.status !== 'SUPPORTED' ? support.reason ?? support.status : undefined,
  };
}

function NumberTarget({ label, unit, value, disabled, reason, onChange }: { label: string; unit: string; value: number; disabled?: boolean; reason?: string; onChange: (value: number) => void }) {
  const reasonId = reason ? `${label.replace(/\s+/g, '-').toLowerCase()}-reason` : undefined;
  return <label className="apparatus-target"><span>{label}</span><span><input aria-label={label} aria-describedby={reasonId} disabled={disabled} type="number" value={value} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) onChange(next); }} /><b>{unit}</b></span>{reason ? <small id={reasonId}>{reason}</small> : null}</label>;
}

export const DeviceInspector = forwardRef<HTMLElement, DeviceInspectorProps>(function DeviceInspector({ apparatusId, type, controlState, providerFacts, intentSupport, onControlStateChange, onIntent, onRequestClose }, ref) {
  const entry = getApparatusCatalogEntry(type);
  const state = { ...entry?.defaultControlState, ...controlState };
  const patch = (next: Partial<ApparatusControlState>) => onControlStateChange?.({ ...state, ...next });
  const enabledSupport = supportState(intentSupport, 'SetApparatusEnabled');
  const setEnabled = (enabled: boolean) => {
    patch({ enabled });
    onIntent?.({ type: 'SetApparatusEnabled', apparatusId, enabled });
  };
  const headingId = `device-inspector-${apparatusId}`;

  return (
    <aside
      ref={ref}
      className="device-inspector"
      aria-labelledby={headingId}
      tabIndex={-1}
      onKeyDown={(event) => { if (event.key === 'Escape' && onRequestClose) { event.preventDefault(); onRequestClose(); } }}
    >
      <header><span>DEVICE INSPECTOR</span><h2 id={headingId}>{entry?.label ?? type}</h2><small>{apparatusId}</small>{onRequestClose ? <button type="button" aria-label="Close Device Inspector" onClick={onRequestClose}>Close</button> : null}</header>

      {(type === 'HOT_PLATE' || type === 'MAGNETIC_STIRRER' || type === 'VACUUM_PUMP' || type === 'POWER_SUPPLY') && (
        <section aria-label="Status"><h3>STATUS</h3><label className="apparatus-toggle"><input aria-label="Power" type="checkbox" disabled={enabledSupport.disabled} checked={state.enabled ?? false} onChange={(event) => setEnabled(event.target.checked)} /><span>{state.enabled ? 'ON' : 'OFF'}</span>{enabledSupport.reason ? <small>{enabledSupport.reason}</small> : null}</label></section>
      )}

      {type === 'HOT_PLATE' && (
        <>
          <section aria-label="Control Mode"><h3>CONTROL MODE</h3><select aria-label="Control Mode" value={state.controlMode ?? 'TARGET_TEMPERATURE'} onChange={(event) => patch({ controlMode: event.target.value as ApparatusControlState['controlMode'] })}><option value="TARGET_TEMPERATURE">Target Temperature</option><option value="POWER_OUTPUT">Power Output</option></select></section>
          <section aria-label="Setpoint"><h3>SETPOINT</h3>{state.controlMode === 'POWER_OUTPUT' ? (() => { const support = supportState(intentSupport, 'SetApparatusPowerTarget'); return <NumberTarget label="Power Output" unit="%" value={state.powerTargetPercent ?? 0} disabled={support.disabled} reason={support.reason} onChange={(powerTargetPercent) => { patch({ powerTargetPercent }); onIntent?.({ type: 'SetApparatusPowerTarget', apparatusId, powerTargetPercent }); }} />; })() : (() => { const support = supportState(intentSupport, 'SetApparatusTemperatureTarget'); return <NumberTarget label="Target Temperature" unit="°C" value={state.targetTemperatureC ?? 25} disabled={support.disabled} reason={support.reason} onChange={(targetTemperatureC) => { patch({ targetTemperatureC }); onIntent?.({ type: 'SetApparatusTemperatureTarget', apparatusId, targetTemperatureC }); }} />; })()}</section>
          <section aria-label="Current State"><h3>CURRENT STATE</h3><dl><CurrentFact label="Plate Temperature" fact={providerFacts?.currentTemperature} /><CurrentFact label="Connected Vessel" fact={providerFacts?.connectedVessel} /></dl></section>
        </>
      )}

      {type === 'MAGNETIC_STIRRER' && (() => { const support = supportState(intentSupport, 'SetApparatusRpmTarget'); return (
        <><section aria-label="Setpoint"><h3>SETPOINT</h3><NumberTarget label="Target RPM" unit="RPM" value={state.targetRpm ?? 0} disabled={support.disabled} reason={support.reason} onChange={(targetRpm) => { patch({ targetRpm }); onIntent?.({ type: 'SetApparatusRpmTarget', apparatusId, targetRpm }); }} /></section><section aria-label="Current State"><h3>CURRENT STATE</h3><dl><CurrentFact label="Current RPM" fact={providerFacts?.currentRpm} /><CurrentFact label="Attached Vessel" fact={providerFacts?.connectedVessel} /></dl></section></>
      ); })()}

      {type === 'VACUUM_PUMP' && (() => { const support = supportState(intentSupport, 'SetApparatusPressureTarget'); return (
        <><section aria-label="Control Mode"><h3>CONTROL MODE</h3><span className="apparatus-mode-label">Target Pressure</span></section><section aria-label="Setpoint"><h3>SETPOINT</h3><NumberTarget label="Target Pressure" unit="kPa" value={state.targetPressureKPa ?? 101.325} disabled={support.disabled} reason={support.reason} onChange={(targetPressureKPa) => { patch({ targetPressureKPa }); onIntent?.({ type: 'SetApparatusPressureTarget', apparatusId, targetPressureKPa }); }} /></section><section aria-label="Current State"><h3>CURRENT STATE</h3><dl><CurrentFact label="Current Pressure" fact={providerFacts?.currentPressure} /><CurrentFact label="Connected Vessel" fact={providerFacts?.connectedVessel} /></dl></section></>
      ); })()}

      {type === 'POWER_SUPPLY' && (() => { const voltageSupport = supportState(intentSupport, 'SetApparatusVoltageTarget'); const currentSupport = supportState(intentSupport, 'SetApparatusCurrentTarget'); return (
        <><section aria-label="Setpoint"><h3>SETPOINT</h3><NumberTarget label="Voltage Target" unit="V" value={state.targetVoltageV ?? 0} disabled={voltageSupport.disabled} reason={voltageSupport.reason} onChange={(targetVoltageV) => { patch({ targetVoltageV }); onIntent?.({ type: 'SetApparatusVoltageTarget', apparatusId, targetVoltageV }); }} /><NumberTarget label="Current Target" unit="A" value={state.targetCurrentA ?? 0} disabled={currentSupport.disabled} reason={currentSupport.reason} onChange={(targetCurrentA) => { patch({ targetCurrentA }); onIntent?.({ type: 'SetApparatusCurrentTarget', apparatusId, targetCurrentA }); }} /></section><section aria-label="Current State"><h3>CURRENT STATE</h3><dl><CurrentFact label="Voltage" fact={providerFacts?.currentVoltage} /><CurrentFact label="Current" fact={providerFacts?.currentCurrent} /><CurrentFact label="Connected Vessel" fact={providerFacts?.connectedVessel} /></dl></section></>
      ); })()}

      {type === 'GAS_COLLECTOR' && (() => { const support = supportState(intentSupport, 'SetApparatusValveState'); return (
        <><section aria-label="Status"><h3>STATUS</h3><label className="apparatus-target"><span>Valve</span><select aria-label="Valve" disabled={support.disabled} value={state.valveState ?? 'CLOSED'} onChange={(event) => { const valveState = event.target.value as ApparatusValveState; patch({ valveState }); onIntent?.({ type: 'SetApparatusValveState', apparatusId, valveState }); }}><option value="CLOSED">CLOSED</option><option value="OPEN">OPEN</option></select>{support.reason ? <small>{support.reason}</small> : null}</label></section><section aria-label="Connections"><h3>CONNECTIONS</h3><dl><CurrentFact label="Input Connection" fact={providerFacts?.inputConnection} /></dl></section><section aria-label="Current State"><h3>CURRENT STATE</h3><dl><CurrentFact label="Collected Amount" fact={providerFacts?.collectedAmount} /><CurrentFact label="Pressure" fact={providerFacts?.currentPressure} /><CurrentFact label="Composition" fact={providerFacts?.composition} /></dl></section></>
      ); })()}

      {type !== 'HOT_PLATE' && type !== 'MAGNETIC_STIRRER' && type !== 'VACUUM_PUMP' && type !== 'POWER_SUPPLY' && type !== 'GAS_COLLECTOR' && (
        <section aria-label="Current State"><h3>CURRENT STATE</h3><dl><CurrentFact label="Provider Status" fact={providerFacts?.status} /></dl></section>
      )}
    </aside>
  );
});
