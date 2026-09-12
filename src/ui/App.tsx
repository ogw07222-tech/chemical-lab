import { useMemo, useState } from 'react';
import { DeveloperEquilibriumDiagnostics, EquilibriumDetails, EquilibriumInlineStatus } from './chemistry/equilibrium/EquilibriumPresentation';
import { useLaboratory } from './provider';
import { selectCurrentUnknown, selectSpecies, selectVisibleInventory } from './selectors';
import type { PhaseDiagramViewModel, ReactionProgressView, ReactionSpeciesView, ScientificStatus, SubstanceSummary, VesselContentView } from './types';
import { celsiusToKelvin, cubicMetersToLiters, formatPressure, formatTemperature, litersToCubicMeters, pascalsToAtmospheres } from './units';
import { WorkbenchPlacementSurface, WorkbenchShell } from './workbench';
import './styles.css';

const ANALYSIS_TABS = ['구성', '생성물', '그래프', '상', '평형', '타임라인', '실험 기록'] as const;
type AnalysisTab = typeof ANALYSIS_TABS[number];
type CatalogFilter = 'all' | 'element' | 'compound' | 'favorite';
type InspectorTab = 'info' | 'notes';
type MobileView = 'catalog' | 'lab' | 'info' | 'controls' | 'notes';

const STRUCTURE_NOTATION: Record<string, string> = {
  'H₂': 'H-H', 'O₂': 'O=O', 'N₂': 'N≡N', 'H₂O': 'H-O-H', 'CO': 'C≡O', 'CO₂': 'O=C=O',
  'CH₄': 'H\n |\nH-C-H\n |\n H', 'NH₃': ' H\n |\nH-N-H', 'NaCl': 'Na⁺ · Cl⁻', 'NaOH': 'Na⁺ · OH⁻', 'CuSO₄': 'Cu²⁺ · SO₄²⁻',
};

function structureNotation(substance?: SubstanceSummary) { return substance ? STRUCTURE_NOTATION[substance.formula] ?? substance.formula : '—'; }
function statusLabel(status: ScientificStatus) {
  if (status === 'VERIFIED') return '검증됨';
  if (status === 'APPROXIMATED') return '≈ 근사';
  if (status === 'EMPIRICAL') return '경험값';
  if (status === 'GAMEPLAY_SIMPLIFICATION') return '모델 단순화';
  return '정밀도 미확정';
}
function contentIdentity(content: VesselContentView) { return content.identityConfirmed ? content.displayIdentity : content.opaqueLabel ?? 'Unknown substance'; }
function reactionIdentity(participant: ReactionSpeciesView) { return participant.displayIdentity || 'Unknown substance'; }
function reactionParticipantText(participant: ReactionSpeciesView, status: ScientificStatus) {
  const identity = reactionIdentity(participant);
  if (status === 'OPEN') return identity;
  return `${identity} · ${status === 'APPROXIMATED' ? '≈ ' : ''}${participant.amountMol.toFixed(3)} mol`;
}

function TopBar() {
  const { snapshot, dispatch } = useLaboratory(); const running = snapshot.simulationStatus === 'running';
  return <header className="lab-topbar"><div className="brand">CHEM LAB</div><nav className="top-nav" aria-label="주요 메뉴"><button className="active">실험실</button><button disabled>기록</button><button disabled>설정</button></nav><div className="top-status"><span>{snapshot.simulationTimeS.toFixed(1)} s</span><span className={`status-dot ${snapshot.simulationStatus}`}/><strong>{snapshot.simulationStatus.toUpperCase()}</strong><button className="run-button" onClick={() => dispatch({ type: running ? 'PauseSimulation' : 'Run', vesselId: snapshot.vesselId })}>{running ? '정지' : '실행'}</button></div></header>;
}

function StructurePreview({ substance, compact = false }: { substance?: SubstanceSummary; compact?: boolean }) {
  return <div className={`structure-preview ${compact ? 'compact' : ''}`} aria-label={substance ? `${substance.koreanName ?? substance.name} 구조식` : '선택된 물질 없음'}><pre>{structureNotation(substance)}</pre></div>;
}

function AddSubstanceControl({ selected }: { selected?: SubstanceSummary }) {
  const { snapshot, dispatch } = useLaboratory(); const [amount, setAmount] = useState(1); const finite = Number.isFinite(amount) && amount > 0;
  if (!selected) return null;
  return <div className="add-control"><div className="section-label">추가할 양</div><div className="amount-row"><input aria-label="추가할 양" type="number" min="0.001" step="0.1" value={amount} onChange={(e) => setAmount(Number(e.target.value))}/><select aria-label="추가 단위" value="mol" disabled><option value="mol">mol</option></select></div><button className="primary-action" disabled={!finite} onClick={() => dispatch({ type: 'AddSubstance', vesselId: snapshot.vesselId, speciesId: selected.speciesId, amountMol: amount })}>＋ 실험실에 추가</button></div>;
}

function SubstanceCatalog({ selectedId, onSelect, collapsed, onToggle }: { selectedId?: string; onSelect: (id: string) => void; collapsed: boolean; onToggle: () => void }) {
  const lab = useLaboratory(); const [query, setQuery] = useState(''); const [filter, setFilter] = useState<CatalogFilter>('all'); const visible = selectVisibleInventory(lab);
  const filtered = visible.filter((item) => { const text = `${item.koreanName ?? ''} ${item.name} ${item.formula}`.toLowerCase(); if (!text.includes(query.toLowerCase())) return false; if (filter === 'favorite') return lab.snapshot.favoriteSpeciesIds.includes(item.speciesId); if (filter === 'element' || filter === 'compound') return item.category === filter; return true; });
  const selected = selectSpecies(visible, selectedId) ?? visible[0];
  if (collapsed) return <aside className="catalog-panel collapsed" aria-label="도감"><button className="panel-rail-toggle" aria-label="도감 펼치기" onClick={onToggle}><span>›</span><b>도감</b></button></aside>;
  return <aside className="catalog-panel" aria-label="도감"><div className="catalog-head"><div className="panel-title-row"><h1>도감</h1><button className="collapse-button" aria-label="도감 접기" onClick={onToggle}>‹</button></div><label className="dev-switch"><input aria-label="Developer Mode" type="checkbox" checked={lab.snapshot.developerMode} onChange={(e) => lab.dispatch({ type: 'SetDeveloperMode', enabled: e.target.checked })}/><span>DEV</span></label></div><div className="search-wrap"><span>⌕</span><input aria-label="물질 검색" placeholder="물질 검색..." value={query} onChange={(e) => setQuery(e.target.value)}/></div><div className="catalog-filters" role="tablist">{([['all','전체'],['element','원소'],['compound','화합물'],['favorite','즐겨찾기']] as const).map(([key,label]) => <button key={key} className={filter===key?'active':''} onClick={() => setFilter(key)}>{label}</button>)}</div><div className="catalog-list">{filtered.map((item) => <div key={item.speciesId} className={`catalog-item ${selected?.speciesId===item.speciesId?'selected':''}`}><button className="catalog-select" onClick={() => onSelect(item.speciesId)}><StructurePreview substance={item} compact/><span className="catalog-copy"><strong>{item.koreanName ?? item.name}</strong><small>{item.formula}</small></span><span className="chevron">›</span></button><button aria-label={`Favorite ${item.name}`} className="favorite-button" onClick={() => lab.dispatch({ type: 'ToggleFavorite', speciesId: item.speciesId })}>{lab.snapshot.favoriteSpeciesIds.includes(item.speciesId) ? '★' : '☆'}</button></div>)}</div><AddSubstanceControl selected={selected}/></aside>;
}

function PhaseDiagram({ data }: { data?: PhaseDiagramViewModel }) {
  if (!data) return <div className="analysis-empty">상 경계 데이터가 연결되지 않았습니다.</div>;
  const [t0,t1]=data.temperatureRangeK; const [p0,p1]=data.pressureRangePa; const x=(t:number)=>((t-t0)/(t1-t0))*100; const y=(p:number)=>100-((p-p0)/(p1-p0))*100;
  return <div className="phase-sheet">{data.fixtureLabel && <p className="fixture-note">{data.fixtureLabel}</p>}<svg viewBox="0 0 100 100" role="img" aria-label="Phase diagram"><rect x="0" y="0" width="100" height="100" className="phase-bg"/>{data.boundaries.map((b)=><polyline key={b.id} points={b.samples.map((s)=>`${x(s.temperatureK)},${y(s.pressurePa)}`).join(' ')} className="phase-line"/>)}{data.currentState&&<circle cx={x(data.currentState.temperatureK)} cy={y(data.currentState.pressurePa)} r="2.5" className="current-point"/>}</svg></div>;
}

function ReactionTimelineEvent({ event }: { event: ReactionProgressView }) {
  const consumed = event.consumed.length ? event.consumed.map((item) => reactionParticipantText(item, event.scientificStatus)).join(' + ') : '—';
  const produced = event.produced.length ? event.produced.map((item) => reactionParticipantText(item, event.scientificStatus)).join(' + ') : '—';
  return <div aria-label={`반응 단계 ${event.timelineOrder + 1}`}><time>{event.endTimeS.toFixed(1)}s</time><span><strong>Step {event.timelineOrder + 1}</strong> · {consumed} → {produced} · {statusLabel(event.scientificStatus)} · {event.reactionHeat.label}{event.equilibrium && <> · <EquilibriumInlineStatus value={event.equilibrium}/></>}<small> · {event.timestepId} / seq {event.sourceSequence}</small></span></div>;
}

function WorkbenchAnalysis({ selected }: { selected?: SubstanceSummary }) {
  const lab = useLaboratory(); const [tab,setTab] = useState<AnalysisTab>('구성'); const diagram=selected?lab.phaseDiagrams[selected.speciesId]:undefined;
  return <section className="analysis-drawer"><nav>{ANALYSIS_TABS.map((name)=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}>{name}</button>)}</nav><div className="analysis-body">
    {tab==='구성' && <table><thead><tr><th>물질</th><th>상태</th><th>양</th></tr></thead><tbody>{lab.snapshot.contents.length?lab.snapshot.contents.map((c,i)=><tr key={c.speciesId ?? c.opaqueLabel ?? i}><td>{contentIdentity(c)}</td><td>{c.phase}</td><td>{c.amountMol.toFixed(3)} mol</td></tr>):<tr><td colSpan={3}>실험 용기가 비어 있습니다.</td></tr>}</tbody></table>}
    {tab==='생성물' && <p>권위 있는 관찰/분석 결과가 확인된 물질만 여기에 표시됩니다.</p>}
    {tab==='그래프' && <p>시계열 데이터 어댑터 대기 중: species / T / P / concentration / activity.</p>}
    {tab==='상' && <PhaseDiagram data={diagram}/>} 
    {tab==='평형' && <><EquilibriumDetails pairs={lab.reversiblePairs}/>{lab.snapshot.developerMode && <DeveloperEquilibriumDiagnostics diagnostics={lab.reactionDeveloperDiagnostics}/>}</>}
    {tab==='타임라인' && <div className="timeline"><section aria-label="반응 타임라인">{lab.reactionEvents.length ? lab.reactionEvents.map((event)=><ReactionTimelineEvent key={event.id} event={event}/>) : <p>기록된 반응 이벤트가 없습니다.</p>}</section><section aria-label="실험 이벤트">{lab.events.length ? lab.events.map((event)=><div key={event.id}><time>{event.simulationTimeS.toFixed(1)}s</time><span>{event.message}</span></div>) : <p>기록된 실험 이벤트가 없습니다.</p>}</section>{lab.snapshot.developerMode && lab.reactionDeveloperDiagnostics && <details aria-label="Developer reaction diagnostics"><summary>DEV reaction diagnostics</summary>{lab.reactionDeveloperDiagnostics.events.map((event)=><div key={event.eventId}><code>{event.candidateId}</code><small> consumed: {event.consumedSpeciesRefs.join(', ') || '—'} · produced: {event.producedSpeciesRefs.join(', ') || '—'}</small></div>)}</details>}</div>}
    {tab==='실험 기록' && <p>{lab.reactionEvents.length + lab.events.length}개의 provider 이벤트가 표시됩니다. 저장/재생 어댑터는 추후 연결됩니다.</p>}
  </div></section>;
}

function ReactionActivityStrip() {
  const { reactionActivity } = useLaboratory();
  return <section className="observation-strip reaction-activity-strip" aria-label="반응 활동"><span><strong>반응 활동</strong> {reactionActivity?.label ?? '감지된 반응 없음'}{reactionActivity?.equilibrium && <> · <EquilibriumInlineStatus value={reactionActivity.equilibrium}/></>}</span><span>{reactionActivity ? `${reactionActivity.simulationTimeS.toFixed(1)}s · ${statusLabel(reactionActivity.scientificStatus)}` : 'provider event 없음'}</span></section>;
}

function LabWorkspace({ selected }: { selected?: SubstanceSummary }) {
  const lab = useLaboratory(); const unknown = selectCurrentUnknown(lab);
  const baseLayer = <><div className="workspace-vessel" aria-label="주 용기"><div className="vessel-outline"/><strong>주 용기</strong>{lab.snapshot.contents.length ? lab.snapshot.contents.map((content,index)=><span key={content.speciesId ?? content.opaqueLabel ?? index}>{contentIdentity(content)} · {content.amountMol.toFixed(3)} mol</span>) : <span>비어 있음</span>}</div><div className="counter-edge"/></>;
  return <WorkbenchShell title={lab.snapshot.experimentName} status={<>{formatTemperature(lab.snapshot.temperatureK)} · {formatPressure(lab.snapshot.pressurePa)}</>} placementSurface={<WorkbenchPlacementSurface baseLayer={baseLayer}/>}><ReactionActivityStrip/>{unknown && <div className="observation-strip"><span><strong>관찰</strong> {unknown.label}</span><button onClick={() => lab.dispatch({ type: 'AnalyzeUnknown', observationId: unknown.observationId })}>분석</button></div>}<WorkbenchAnalysis selected={selected}/></WorkbenchShell>;
}

function SubstanceInspector({ selected, forceNotes = false }: { selected?: SubstanceSummary; forceNotes?: boolean }) {
  const lab=useLaboratory(); const [tab,setTab]=useState<InspectorTab>(forceNotes?'notes':'info'); const [notes,setNotes]=useState<Record<string,string>>({}); const currentTab = forceNotes ? 'notes' : tab; const entry=selected?lab.snapshot.encyclopedia.find((e)=>e.speciesId===selected.speciesId):undefined; const content=selected?lab.snapshot.contents.find((c)=>c.speciesId===selected.speciesId):undefined;
  return <aside className="inspector-panel" aria-label="물질 정보"><div className="inspector-tabs"><button className={currentTab==='info'?'active':''} onClick={()=>setTab('info')}>물질 정보</button><button className={currentTab==='notes'?'active':''} onClick={()=>setTab('notes')}>내 메모</button></div>{!selected ? <div className="inspector-empty">도감에서 물질을 선택하세요.</div> : currentTab==='info' ? <div className="reference-sheet"><div className="substance-heading"><StructurePreview substance={selected}/><div><h2>{selected.koreanName ?? selected.name}</h2><strong className="formula-large">{selected.formula}</strong></div></div><dl><dt>종류</dt><dd>{selected.category==='element'?'원소':'화합물'}</dd><dt>현재 상</dt><dd>{content?.phase ?? entry?.phaseInfo ?? '데이터 없음'}</dd><dt>과학 상태</dt><dd>{selected.scientificStatus}</dd><dt>몰 질량</dt><dd>권위 데이터 대기</dd><dt>최초 발견</dt><dd>{entry?.firstDiscoveryLabel ?? '시작 물질 / 미기록'}</dd></dl><section><h3>알려진 물성</h3>{entry?.knownProperties.length?<ul>{entry.knownProperties.map((p)=><li key={p}>{p}</li>)}</ul>:<p>검증된 물성 데이터가 아직 연결되지 않았습니다.</p>}</section><section><h3>설명</h3><p>{selected.description ?? '설명 데이터가 아직 연결되지 않았습니다.'}</p></section><section><h3>구조식</h3><div className="structure-placeholder">{selected.graph ? 'MolecularGraph 연결됨' : structureNotation(selected)}</div></section></div> : <div className="notes-sheet"><label htmlFor={`note-${selected.speciesId}`}>{selected.koreanName ?? selected.name} 메모</label><textarea id={`note-${selected.speciesId}`} aria-label="내 메모" value={notes[selected.speciesId] ?? ''} onChange={(e)=>setNotes((prev)=>({...prev,[selected.speciesId]:e.target.value}))} placeholder="관찰한 점을 자유롭게 기록하세요. 시스템은 이 메모의 정답 여부를 판정하지 않습니다."/><small>UI draft only · 자동 해석/판정 없음</small></div>}</aside>;
}

function ConditionRow({ icon,label,unit,value,min,max,step,onChange,actual }: { icon:string;label:string;unit:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void;actual?:string }) {
  return <div className="condition-row"><span className="condition-icon">{icon}</span><label>{label}</label><div className="numeric-box"><input aria-label={label} type="number" value={Number(value.toFixed(2))} min={min} max={max} step={step} onChange={(e)=>onChange(Number(e.target.value))}/><span>{unit}</span></div><input aria-label={`${label} slider`} type="range" value={value} min={min} max={max} step={step} onChange={(e)=>onChange(Number(e.target.value))}/>{actual&&<small>{actual}</small>}</div>;
}

function ExperimentConsole({ selected, collapsed, onToggle }: { selected?: SubstanceSummary; collapsed: boolean; onToggle: () => void }) {
  const lab=useLaboratory(); const { snapshot, dispatch }=lab; const [confirmDispose,setConfirmDispose]=useState(false); const tempC=snapshot.controls.thermostatTargetK-273.15; const pressureAtm=pascalsToAtmospheres(snapshot.controls.requestedPressurePa); const volumeL=cubicMetersToLiters(snapshot.controls.requestedVolumeM3); const selectedPresent=selected&&snapshot.contents.some((c)=>c.speciesId===selected.speciesId);
  const setTemperature=(c:number)=>{if(Number.isFinite(c)) dispatch({type:'SetThermostat',vesselId:snapshot.vesselId,enabled:true,targetTemperatureK:celsiusToKelvin(c)});}; const setPressure=(atm:number)=>{if(Number.isFinite(atm)&&atm>0) dispatch({type:'SetPressureTarget',vesselId:snapshot.vesselId,targetPressurePa:atm*101325});}; const setVolume=(l:number)=>{if(Number.isFinite(l)&&l>0) dispatch({type:'ChangeVolume',vesselId:snapshot.vesselId,targetVolumeM3:litersToCubicMeters(l)});}; const dispose=()=>{if(selected&&selectedPresent){dispatch({type:'RemoveSubstance',vesselId:snapshot.vesselId,speciesId:selected.speciesId});setConfirmDispose(false);}};
  if (collapsed) return <section className="experiment-console collapsed" aria-label="실험 콘솔"><div className="console-summary"><button className="console-expand" aria-label="실험 조건 펼치기" onClick={onToggle}>⌃ 실험 조건</button><span>온도 {tempC.toFixed(0)} °C</span><span>압력 {pressureAtm.toFixed(2)} atm</span><span>부피 {volumeL.toFixed(2)} L</span><small>실제 {formatTemperature(snapshot.temperatureK)} · {pascalsToAtmospheres(snapshot.pressurePa).toFixed(2)} atm</small></div></section>;
  return <section className="experiment-console" aria-label="실험 콘솔"><button className="console-collapse" aria-label="실험 조건 접기" onClick={onToggle}>⌄</button><div className="conditions"><h2>실험 조건</h2><ConditionRow icon="T" label="온도" unit="°C" value={tempC} min={-100} max={300} step={1} onChange={setTemperature} actual={`실제 ${formatTemperature(snapshot.temperatureK)}`}/><ConditionRow icon="P" label="압력" unit="atm" value={pressureAtm} min={0.1} max={5} step={0.1} onChange={setPressure} actual={`실제 ${pascalsToAtmospheres(snapshot.pressurePa).toFixed(2)} atm`}/><ConditionRow icon="V" label="부피" unit="L" value={volumeL} min={0.1} max={cubicMetersToLiters(snapshot.capacityM3)} step={0.1} onChange={setVolume}/><label className="controller-toggle"><input aria-label="온도 제어" type="checkbox" checked={snapshot.controls.thermostatEnabled} onChange={(e)=>dispatch({type:'SetThermostat',vesselId:snapshot.vesselId,enabled:e.target.checked,targetTemperatureK:snapshot.controls.thermostatTargetK})}/><span>온도 제어</span></label></div><div className="operations"><h2>조작</h2><div className="operation-grid"><button onClick={()=>dispatch({type:'Mix',vesselId:snapshot.vesselId})}>◎ <span>혼합</span></button><button onClick={()=>dispatch({type:'Stir',vesselId:snapshot.vesselId})}>↻ <span>교반</span></button><button onClick={()=>dispatch({type:'PauseSimulation',vesselId:snapshot.vesselId})}>■ <span>반응 정지</span></button><button onClick={()=>dispatch({type:'ResetExperiment',vesselId:snapshot.vesselId})}>↺ <span>초기화</span></button></div></div><div className="disposal"><h2>폐기</h2><div className="trash-icon">⌫</div><strong>{selectedPresent ? `${selected?.koreanName ?? selected?.name} 제거` : '제거할 물질 없음'}</strong><p>현재 선택한 물질을 주 용기에서 제거합니다.</p>{confirmDispose&&selectedPresent?<div className="confirm-row"><button onClick={()=>setConfirmDispose(false)}>취소</button><button className="danger" onClick={dispose}>폐기 확인</button></div>:<button disabled={!selectedPresent} onClick={()=>setConfirmDispose(true)}>선택 물질 폐기</button>}</div></section>;
}

export function LaboratoryWorkspace() {
  const lab=useLaboratory(); const visible=selectVisibleInventory(lab); const [selectedId,setSelectedId]=useState<string>(); const selected=useMemo(()=>selectSpecies(visible,selectedId)??visible[0],[visible,selectedId]); const [mobileView,setMobileView]=useState<MobileView>('lab'); const [catalogOpen,setCatalogOpen]=useState(true); const [consoleOpen,setConsoleOpen]=useState(true);
  return <div className="lab-shell"><TopBar/><nav className="mobile-nav">{([['catalog','도감'],['lab','실험실'],['info','정보'],['controls','조작'],['notes','메모']] as const).map(([key,label])=><button key={key} className={mobileView===key?'active':''} onClick={()=>{setMobileView(key); if(key==='catalog') setCatalogOpen(true); if(key==='controls') setConsoleOpen(true);}}>{label}</button>)}</nav><div className={`lab-layout mobile-${mobileView} ${catalogOpen?'':'catalog-collapsed'} ${consoleOpen?'':'console-collapsed'}`}><SubstanceCatalog selectedId={selected?.speciesId} onSelect={setSelectedId} collapsed={!catalogOpen} onToggle={()=>setCatalogOpen((value)=>!value)}/><LabWorkspace selected={selected}/><SubstanceInspector selected={selected} forceNotes={mobileView==='notes'}/><ExperimentConsole selected={selected} collapsed={!consoleOpen} onToggle={()=>setConsoleOpen((value)=>!value)}/></div></div>;
}
