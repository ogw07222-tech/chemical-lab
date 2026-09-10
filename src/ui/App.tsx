import { useMemo, useState } from 'react';
import { useLaboratory } from './provider';
import type { SubstanceSummary } from './types';
import './styles.css';

function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

function ExperimentStatusBar() {
  const { snapshot, dispatch } = useLaboratory();
  return <header className="status-bar">
    <div className={`status-pill ${snapshot.simulationStatus}`}>{snapshot.simulationStatus.toUpperCase()}</div>
    <Metric label="Temperature" value={`${snapshot.temperatureK.toFixed(1)} K`} />
    <Metric label="Pressure" value={`${snapshot.pressureKPa.toFixed(1)} kPa`} />
    <Metric label="Volume" value={`${snapshot.volumeL.toFixed(2)} L`} />
    <Metric label="Time" value={`${snapshot.simulationTimeS.toFixed(1)} s`} />
    <div className="status-actions">
      <button onClick={() => dispatch({ type: 'Run', vesselId: snapshot.vesselId })}>Run</button>
      <button onClick={() => dispatch({ type: 'PauseSimulation', vesselId: snapshot.vesselId })}>Pause</button>
      <button className="ghost" onClick={() => dispatch({ type: 'ResetExperiment', vesselId: snapshot.vesselId })}>Reset</button>
    </div>
  </header>;
}

function InventoryPanel({ selected, onSelect }: { selected: SubstanceSummary; onSelect: (s: SubstanceSummary) => void }) {
  const { snapshot, catalog, dispatch } = useLaboratory();
  const [query, setQuery] = useState('');
  const [amount, setAmount] = useState(0.25);
  const filtered = catalog.filter((s) => `${s.name} ${s.formula}`.toLowerCase().includes(query.toLowerCase()));
  return <aside className="panel inventory-panel">
    <div className="panel-heading"><div><span className="eyebrow">MATERIALS</span><h2>Inventory</h2></div><span className="count">{catalog.length}</span></div>
    <input aria-label="Search substances" className="search" placeholder="Search substance…" value={query} onChange={(e) => setQuery(e.target.value)} />
    <div className="substance-list">{filtered.map((s) => <button key={s.speciesId} className={`substance-card ${selected.speciesId === s.speciesId ? 'selected' : ''}`} onClick={() => onSelect(s)}><span className="formula">{s.formula}</span><span><strong>{s.name}</strong><small>{s.defaultPhase}</small></span></button>)}</div>
    <div className="add-box"><label>Amount <span>{amount.toFixed(2)} mol</span></label><input aria-label="Amount" type="range" min="0.05" max="2" step="0.05" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /><button className="primary" onClick={() => dispatch({ type: 'AddSubstance', vesselId: snapshot.vesselId, speciesId: selected.speciesId, amountMol: amount })}>Add {selected.formula} to vessel</button></div>
  </aside>;
}

function MoleculeGraphView({ substance }: { substance: SubstanceSummary }) {
  return <div className="molecule-view" aria-label="Molecule structure viewer"><div className="molecule-placeholder">{substance.formula}</div><div><strong>{substance.name}</strong><p>2D MolecularGraph adapter ready. Graph geometry awaits the merged 01 contract.</p></div></div>;
}

function VesselWorkspace({ selected }: { selected: SubstanceSummary }) {
  const { snapshot } = useLaboratory();
  const total = snapshot.contents.reduce((sum, item) => sum + item.amountMol, 0);
  return <main className="vessel-workspace panel">
    <div className="panel-heading"><div><span className="eyebrow">REACTION VESSEL</span><h2>Primary vessel</h2></div><span className="capacity">{snapshot.volumeL.toFixed(2)} / {snapshot.capacityL.toFixed(2)} L</span></div>
    <div className="vessel-stage"><div className={`vessel ${snapshot.simulationStatus === 'running' ? 'active' : ''}`}><div className="liquid-fill" style={{ height: `${Math.min(78, 24 + total * 18)}%` }} /><div className="vessel-label">{snapshot.contents.length ? `${snapshot.contents.length} species` : 'Empty'}</div></div><div className="vessel-summary"><span className="eyebrow">LIVE COMPOSITION</span>{snapshot.contents.length === 0 ? <p>No material in vessel.</p> : snapshot.contents.map((c) => <div key={c.speciesId} className="composition-chip"><strong>{c.formula}</strong><span>{c.amountMol.toFixed(2)} mol</span></div>)}</div></div>
    <MoleculeGraphView substance={selected} />
  </main>;
}

function EnvironmentPanel() {
  const { snapshot, dispatch } = useLaboratory();
  return <aside className="panel environment-panel">
    <div className="panel-heading"><div><span className="eyebrow">ENVIRONMENT</span><h2>Controls</h2></div></div>
    <section className="control-group"><h3>Thermal control</h3><p className="hint">Command intent only; mock UI does not calculate thermodynamics.</p><div className="segmented"><button className={snapshot.controls.thermalIntent === 'heat' ? 'active' : ''} onClick={() => dispatch({ type: 'Heat', vesselId: snapshot.vesselId, mode: 'request', value: 1 })}>Heat</button><button className={snapshot.controls.thermalIntent === 'cool' ? 'active' : ''} onClick={() => dispatch({ type: 'Cool', vesselId: snapshot.vesselId, mode: 'request', value: 1 })}>Cool</button></div></section>
    <section className="control-group"><h3>Volume</h3><label>Target <span>{snapshot.controls.requestedVolumeL.toFixed(2)} L</span></label><input aria-label="Volume" type="range" min="0.1" max={snapshot.capacityL} step="0.1" value={snapshot.controls.requestedVolumeL} onChange={(e) => dispatch({ type: 'ChangeVolume', vesselId: snapshot.vesselId, targetVolumeL: Number(e.target.value) })} /></section>
    <section className="control-group"><h3>Pressure</h3><div className="instrument-readout"><span>Gauge</span><strong>{snapshot.pressureKPa.toFixed(1)} kPa</strong></div><p className="hint">Read-only until apparatus-mediated pressure control is finalized.</p></section>
    <section className="control-group"><h3>Simulation speed</h3><div className="segmented speed">{[0.5, 1, 2, 4].map((speed) => <button key={speed} className={snapshot.simulationSpeed === speed ? 'active' : ''} onClick={() => dispatch({ type: 'SetSimulationSpeed', vesselId: snapshot.vesselId, speed })}>×{speed}</button>)}</div></section>
  </aside>;
}

function AnalysisWorkspace() {
  const { snapshot, events } = useLaboratory();
  return <section className="analysis panel"><div className="analysis-grid">
    <div><span className="eyebrow">COMPOSITION</span><table><thead><tr><th>Species</th><th>Phase</th><th>Amount</th></tr></thead><tbody>{snapshot.contents.length ? snapshot.contents.map((c) => <tr key={c.speciesId}><td>{c.formula}</td><td>{c.phase}</td><td>{c.amountMol.toFixed(2)} mol</td></tr>) : <tr><td colSpan={3} className="empty-cell">Add a substance to begin.</td></tr>}</tbody></table></div>
    <div><span className="eyebrow">REACTION TIMELINE</span><div className="timeline">{events.length ? events.slice(0, 5).map((e) => <div key={e.id} className="timeline-row"><span>{e.simulationTimeS.toFixed(1)}s</span><p>{e.message}</p></div>) : <p className="muted">No events yet.</p>}</div></div>
    <div><span className="eyebrow">EXPERIMENT GRAPHS</span><div className="graph-placeholder"><div className="graph-line"/><span>Telemetry adapter placeholder</span></div></div>
    <div><span className="eyebrow">PRODUCT ANALYSIS</span><div className="analysis-card"><strong>Instrument-gated</strong><p>Named products are not inferred by the UI or mock provider.</p></div><span className="eyebrow log-label">EXPERIMENT LOG</span><div className="analysis-card"><strong>{events.length} actions</strong><p>Command history is deterministic and UI-only in this scaffold.</p></div></div>
  </div></section>;
}

export function LaboratoryWorkspace() {
  const { catalog } = useLaboratory();
  const [selectedId, setSelectedId] = useState(catalog[0].speciesId);
  const selected = useMemo(() => catalog.find((s) => s.speciesId === selectedId) ?? catalog[0], [catalog, selectedId]);
  return <div className="app-shell"><ExperimentStatusBar /><div className="workspace-grid"><InventoryPanel selected={selected} onSelect={(s) => setSelectedId(s.speciesId)} /><VesselWorkspace selected={selected} /><EnvironmentPanel /></div><AnalysisWorkspace /></div>;
}
