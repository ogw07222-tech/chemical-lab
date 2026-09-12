import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LaboratoryWorkspace } from '../../src/ui/App';
import { MockLaboratoryProvider } from '../../src/ui/provider';
import type { LaboratoryProviderValue } from '../../src/ui/types';
import { celsiusToKelvin, litersToCubicMeters } from '../../src/ui/units';

function renderLab() { return render(<MockLaboratoryProvider><LaboratoryWorkspace /></MockLaboratoryProvider>); }
function renderReactionLab() { return render(<MockLaboratoryProvider scenario="reaction-network"><LaboratoryWorkspace /></MockLaboratoryProvider>); }
function workbench() { return screen.getByRole('main',{name:'실험실 작업대'}); }

describe('LaboratoryWorkspace workbench refinement', () => {
  it('renders the catalog, clean workbench, inspector and experiment console', () => {
    renderLab();
    expect(screen.getByRole('complementary',{name:'도감'})).toBeInTheDocument();
    expect(workbench()).toBeInTheDocument();
    expect(screen.getByRole('complementary',{name:'물질 정보'})).toBeInTheDocument();
    expect(screen.getByRole('region',{name:'실험 콘솔'})).toBeInTheDocument();
    expect(within(workbench()).getByLabelText('주 용기')).toBeInTheDocument();
    expect(within(workbench()).getByRole('region',{name:'반응 활동'})).toBeInTheDocument();
  });

  it('normal catalog exposes starters without leaking undiscovered species', () => {
    renderLab(); const catalog=screen.getByRole('complementary',{name:'도감'});
    expect(within(catalog).getByText('수소')).toBeInTheDocument();
    expect(within(catalog).getByText('산소')).toBeInTheDocument();
    expect(within(catalog).getByText('질소')).toBeInTheDocument();
    expect(within(catalog).queryByText('물')).not.toBeInTheDocument();
  });

  it('uses compact structural notation in the catalog', () => {
    renderLab(); const catalog=screen.getByRole('complementary',{name:'도감'});
    expect(within(catalog).getByText('H-H')).toBeInTheDocument();
    expect(within(catalog).getByText('O=O')).toBeInTheDocument();
    expect(within(catalog).getByText('N≡N')).toBeInTheDocument();
  });

  it('collapses and restores the catalog without losing access state', () => {
    renderLab(); const catalog=screen.getByRole('complementary',{name:'도감'});
    fireEvent.click(within(catalog).getByRole('button',{name:'도감 접기'}));
    expect(screen.getByRole('button',{name:'도감 펼치기'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'도감 펼치기'}));
    const reopened=screen.getByRole('complementary',{name:'도감'});
    expect(within(reopened).getByLabelText('물질 검색')).toBeInTheDocument();
    expect(within(reopened).getByText('수소')).toBeInTheDocument();
  });

  it('collapses conditions into a readable summary and restores controls', () => {
    renderLab(); const consoleRegion=screen.getByRole('region',{name:'실험 콘솔'});
    fireEvent.click(within(consoleRegion).getByRole('button',{name:'실험 조건 접기'}));
    const collapsed=screen.getByRole('region',{name:'실험 콘솔'});
    expect(within(collapsed).getByRole('button',{name:'실험 조건 펼치기'})).toBeInTheDocument();
    expect(within(collapsed).getByText(/온도 25 °C/)).toBeInTheDocument();
    expect(within(collapsed).getByText(/압력 1.00 atm/)).toBeInTheDocument();
    fireEvent.click(within(collapsed).getByRole('button',{name:'실험 조건 펼치기'}));
    const restored=screen.getByRole('region',{name:'실험 콘솔'});
    expect(within(restored).getByLabelText('온도')).toBeInTheDocument();
    expect(within(restored).getByLabelText('압력')).toBeInTheDocument();
    expect(within(restored).getByLabelText('부피')).toBeInTheDocument();
  });

  it('developer mode exposes supported catalog species without affecting normal mode', () => {
    renderLab(); const catalog=screen.getByRole('complementary',{name:'도감'});
    expect(within(catalog).queryByText('메테인')).not.toBeInTheDocument();
    fireEvent.click(within(catalog).getByLabelText('Developer Mode'));
    expect(within(catalog).getByText('메테인')).toBeInTheDocument();
  });

  it('adds a finite mol amount through the provider', () => {
    renderLab(); const catalog=screen.getByRole('complementary',{name:'도감'});
    fireEvent.change(within(catalog).getByLabelText('추가할 양'),{target:{value:'0.25'}});
    fireEvent.click(within(catalog).getByRole('button',{name:/실험실에 추가/}));
    const vessel=within(workbench()).getByLabelText('주 용기');
    expect(within(vessel).getByText(/0.250 mol/)).toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const experimentTimeline=within(workbench()).getByRole('region',{name:'실험 이벤트'});
    expect(within(experimentTimeline).getByText(/Added 0.250 mol H₂/)).toBeInTheDocument();
  });

  it('uses controller targets without directly mutating actual temperature or pressure', () => {
    renderLab(); const consoleRegion=screen.getByRole('region',{name:'실험 콘솔'});
    expect(within(consoleRegion).getByText(/실제 298.1 K \/ 25.0 °C/)).toBeInTheDocument();
    fireEvent.change(within(consoleRegion).getByLabelText('온도'),{target:{value:'37'}});
    expect(within(consoleRegion).getByText(/실제 298.1 K \/ 25.0 °C/)).toBeInTheDocument();
    fireEvent.change(within(consoleRegion).getByLabelText('압력'),{target:{value:'2'}});
    expect(within(consoleRegion).getByText(/실제 1.00 atm/)).toBeInTheDocument();
  });

  it('supports mix, stir, pause and reset provider commands', () => {
    renderLab(); const consoleRegion=screen.getByRole('region',{name:'실험 콘솔'});
    fireEvent.click(within(consoleRegion).getByRole('button',{name:/혼합/}));
    fireEvent.click(within(consoleRegion).getByRole('button',{name:/교반/}));
    fireEvent.click(within(consoleRegion).getByRole('button',{name:/반응 정지/}));
    fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const experimentTimeline=within(workbench()).getByRole('region',{name:'실험 이벤트'});
    expect(within(experimentTimeline).getByText(/Mix request accepted/)).toBeInTheDocument();
    expect(within(experimentTimeline).getByText(/Stir request accepted/)).toBeInTheDocument();
    fireEvent.click(within(consoleRegion).getByRole('button',{name:/초기화/}));
    expect(screen.getByText('STOPPED')).toBeInTheDocument();
  });

  it('disposes selected vessel material only through provider command', () => {
    renderLab(); const catalog=screen.getByRole('complementary',{name:'도감'}); const consoleRegion=screen.getByRole('region',{name:'실험 콘솔'});
    fireEvent.click(within(catalog).getByRole('button',{name:/실험실에 추가/}));
    const vessel=within(workbench()).getByLabelText('주 용기');
    expect(within(vessel).getByText(/1.000 mol/)).toBeInTheDocument();
    fireEvent.click(within(consoleRegion).getByRole('button',{name:'선택 물질 폐기'}));
    fireEvent.click(within(consoleRegion).getByRole('button',{name:'폐기 확인'}));
    fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const experimentTimeline=within(workbench()).getByRole('region',{name:'실험 이벤트'});
    expect(within(experimentTimeline).getByText(/Disposed H₂ from vessel/)).toBeInTheDocument();
  });

  it('confirms the mock unknown before catalog unlock feedback', () => {
    renderLab(); const catalog=screen.getByRole('complementary',{name:'도감'});
    expect(within(catalog).queryByText('물')).not.toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole('button',{name:'분석'}));
    expect(within(catalog).getByText('물')).toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    expect(within(within(workbench()).getByRole('region',{name:'실험 이벤트'})).getByText(/Identity confirmed: Water/)).toBeInTheDocument();
  });

  it('provides free-form notes without interpreting note truth', () => {
    renderLab(); const inspector=screen.getByRole('complementary',{name:'물질 정보'});
    fireEvent.click(within(inspector).getByRole('button',{name:'내 메모'}));
    const notes=within(inspector).getByLabelText('내 메모');
    fireEvent.change(notes,{target:{value:'가열하면 변화가 보이는 것 같음'}});
    expect(notes).toHaveValue('가열하면 변화가 보이는 것 같음');
    expect(within(inspector).getByText(/자동 해석\/판정 없음/)).toBeInTheDocument();
  });

  it('centralizes representative SI conversions and keeps dispatch typed', () => {
    expect(litersToCubicMeters(1)).toBeCloseTo(0.001); expect(celsiusToKelvin(25)).toBeCloseTo(298.15);
    const dispatch: LaboratoryProviderValue['dispatch']=vi.fn(); dispatch({type:'ChangeVolume',vesselId:'v',targetVolumeM3:0.001}); expect(dispatch).toHaveBeenCalled();
  });

  it('projects authoritative multi-species vessel composition with opaque unknown identity', () => {
    renderReactionLab(); const vessel=within(workbench()).getByLabelText('주 용기');
    expect(within(vessel).getByText(/H₂ · 0.350 mol/)).toBeInTheDocument();
    expect(within(vessel).getByText(/Unknown α · 0.100 mol/)).toBeInTheDocument();
    expect(within(workbench()).queryByText(/generated:fixture-water/)).not.toBeInTheDocument();
  });

  it('shows latest committed reaction and preserves 2-step provider timeline ordering', () => {
    renderReactionLab(); const activity=within(workbench()).getByRole('region',{name:'반응 활동'});
    expect(within(activity).getByText(/반응 커밋됨/)).toBeInTheDocument();
    expect(within(activity).getByText(/≈ 근사/)).toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const reactionTimeline=within(workbench()).getByRole('region',{name:'반응 타임라인'});
    const step1=within(reactionTimeline).getByLabelText('반응 단계 1'); const step2=within(reactionTimeline).getByLabelText('반응 단계 2');
    expect(step1).toHaveTextContent('H₂ → Unknown α');
    expect(step2).toHaveTextContent('Unknown α · ≈ 0.100 mol → O₂ · ≈ 0.050 mol');
    expect(step1).toHaveTextContent('fixture-step-1 / seq 0');
    expect(step2).toHaveTextContent('fixture-step-2 / seq 0');
    expect(step1.compareDocumentPosition(step2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not leak generated identity in normal mode and exposes internals only in DEV diagnostics', () => {
    renderReactionLab(); fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const reactionTimeline=within(workbench()).getByRole('region',{name:'반응 타임라인'});
    expect(within(reactionTimeline).queryByText(/generated:fixture-water/)).not.toBeInTheDocument();
    const catalog=screen.getByRole('complementary',{name:'도감'}); fireEvent.click(within(catalog).getByLabelText('Developer Mode'));
    const diagnostics=within(workbench()).getByLabelText('Developer reaction diagnostics');
    expect(within(diagnostics).getAllByText(/generated:fixture-water/).length).toBeGreaterThan(0);
  });

  it('does not show fake numeric heat or exact amounts for OPEN reaction facts', () => {
    renderReactionLab(); fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const reactionTimeline=within(workbench()).getByRole('region',{name:'반응 타임라인'}); const step1=within(reactionTimeline).getByLabelText('반응 단계 1');
    expect(step1).toHaveTextContent('열 데이터 미확정');
    expect(step1).toHaveTextContent('정밀도 미확정');
    expect(step1).not.toHaveTextContent('123.4 J');
    expect(step1).not.toHaveTextContent('0.200 mol');
  });

  it('marks approximate reaction amounts and heat rather than presenting false exactness', () => {
    renderReactionLab(); fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const reactionTimeline=within(workbench()).getByRole('region',{name:'반응 타임라인'}); const step2=within(reactionTimeline).getByLabelText('반응 단계 2');
    expect(step2).toHaveTextContent('≈ 0.100 mol');
    expect(step2).toHaveTextContent('≈ 42.0 J');
    expect(step2).toHaveTextContent('≈ 근사');
  });

  it('de-duplicates repeated provider delivery by stable event id', () => {
    renderReactionLab(); fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const reactionTimeline=within(workbench()).getByRole('region',{name:'반응 타임라인'});
    expect(within(reactionTimeline).getAllByLabelText(/반응 단계/)).toHaveLength(2);
  });

  it('reprojects opaque unknown only after provider discovery confirmation', () => {
    renderReactionLab(); const vessel=within(workbench()).getByLabelText('주 용기');
    expect(within(vessel).getByText(/Unknown α/)).toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole('button',{name:'분석'}));
    expect(within(vessel).queryByText(/Unknown α/)).not.toBeInTheDocument();
    expect(within(vessel).getByText(/H₂O · 0.100 mol/)).toBeInTheDocument();
    fireEvent.click(within(workbench()).getByRole('button',{name:'타임라인'}));
    const step1=within(within(workbench()).getByRole('region',{name:'반응 타임라인'})).getByLabelText('반응 단계 1');
    expect(step1).toHaveTextContent('H₂ → H₂O');
  });

  it('keeps T and P simulation-authoritative while reaction activity is visible', () => {
    renderReactionLab(); const main=workbench(); const consoleRegion=screen.getByRole('region',{name:'실험 콘솔'});
    expect(within(main).getByText(/298.1 K \/ 25.0 °C/)).toBeInTheDocument();
    fireEvent.change(within(consoleRegion).getByLabelText('온도'),{target:{value:'80'}}); fireEvent.change(within(consoleRegion).getByLabelText('압력'),{target:{value:'3'}});
    expect(within(main).getByText(/298.1 K \/ 25.0 °C/)).toBeInTheDocument();
    expect(within(consoleRegion).getByText(/실제 1.00 atm/)).toBeInTheDocument();
  });
});
