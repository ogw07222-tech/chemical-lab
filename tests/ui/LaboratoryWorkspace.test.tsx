import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LaboratoryWorkspace } from '../../src/ui/App';
import { MockLaboratoryProvider } from '../../src/ui/provider';
import type { LaboratoryProviderValue } from '../../src/ui/types';
import { celsiusToKelvin, litersToCubicMeters } from '../../src/ui/units';

function renderLab() { return render(<MockLaboratoryProvider><LaboratoryWorkspace /></MockLaboratoryProvider>); }
function renderReactionLab() { return render(<MockLaboratoryProvider scenario="reaction-network"><LaboratoryWorkspace /></MockLaboratoryProvider>); }

describe('LaboratoryWorkspace workbench refinement', () => {
  it('renders the catalog, clean workbench, inspector and experiment console', () => {
    renderLab();
    expect(screen.getByRole('complementary',{name:'도감'})).toBeInTheDocument();
    expect(screen.getByRole('main',{name:'실험실 작업대'})).toBeInTheDocument();
    expect(screen.getByRole('complementary',{name:'물질 정보'})).toBeInTheDocument();
    expect(screen.getByRole('region',{name:'실험 콘솔'})).toBeInTheDocument();
    expect(screen.getByLabelText('주 용기')).toBeInTheDocument();
    expect(screen.getByRole('region',{name:'반응 활동'})).toBeInTheDocument();
    expect(screen.queryByText(/작은 혼합이/)).not.toBeInTheDocument();
  });

  it('normal catalog exposes starters without leaking undiscovered species', () => {
    renderLab();
    const catalog=screen.getByRole('complementary',{name:'도감'});
    expect(within(catalog).getByText('수소')).toBeInTheDocument();
    expect(within(catalog).getByText('산소')).toBeInTheDocument();
    expect(within(catalog).getByText('질소')).toBeInTheDocument();
    expect(within(catalog).queryByText('물')).not.toBeInTheDocument();
  });

  it('uses compact structural notation in the catalog', () => {
    renderLab();
    const catalog=screen.getByRole('complementary',{name:'도감'});
    expect(within(catalog).getByText('H-H')).toBeInTheDocument();
    expect(within(catalog).getByText('O=O')).toBeInTheDocument();
    expect(within(catalog).getByText('N≡N')).toBeInTheDocument();
  });

  it('collapses and restores the catalog without losing access state', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button',{name:'도감 접기'}));
    expect(screen.getByRole('button',{name:'도감 펼치기'})).toBeInTheDocument();
    expect(screen.queryByLabelText('물질 검색')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'도감 펼치기'}));
    expect(screen.getByLabelText('물질 검색')).toBeInTheDocument();
    const catalog=screen.getByRole('complementary',{name:'도감'});
    expect(within(catalog).getByText('수소')).toBeInTheDocument();
  });

  it('collapses conditions into a readable summary and restores controls', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button',{name:'실험 조건 접기'}));
    expect(screen.getByRole('button',{name:'실험 조건 펼치기'})).toBeInTheDocument();
    expect(screen.getByText(/온도 25 °C/)).toBeInTheDocument();
    expect(screen.getByText(/압력 1.00 atm/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'실험 조건 펼치기'}));
    expect(screen.getByLabelText('온도')).toBeInTheDocument();
    expect(screen.getByLabelText('압력')).toBeInTheDocument();
    expect(screen.getByLabelText('부피')).toBeInTheDocument();
  });

  it('developer mode exposes all supported species', () => {
    renderLab();
    fireEvent.click(screen.getByLabelText('Developer Mode'));
    expect(screen.getByText('메테인')).toBeInTheDocument();
  });

  it('adds a finite mol amount through the provider', () => {
    renderLab();
    fireEvent.change(screen.getByLabelText('추가할 양'),{target:{value:'0.25'}});
    fireEvent.click(screen.getByRole('button',{name:/실험실에 추가/}));
    const vessel=screen.getByLabelText('주 용기');
    expect(within(vessel).getByText(/0.250 mol/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'타임라인'}));
    expect(screen.getByText(/Added 0.250 mol H₂/)).toBeInTheDocument();
  });

  it('uses controller targets without directly mutating actual temperature or pressure', () => {
    renderLab();
    expect(screen.getByText(/실제 298.1 K \/ 25.0 °C/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('온도'),{target:{value:'37'}});
    expect(screen.getByText(/실제 298.1 K \/ 25.0 °C/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('압력'),{target:{value:'2'}});
    expect(screen.getByText(/실제 1.00 atm/)).toBeInTheDocument();
  });

  it('supports mix, stir, pause and reset provider commands', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button',{name:/혼합/}));
    fireEvent.click(screen.getByRole('button',{name:/교반/}));
    fireEvent.click(screen.getByRole('button',{name:/반응 정지/}));
    fireEvent.click(screen.getByRole('button',{name:'타임라인'}));
    expect(screen.getByText(/Mix request accepted/)).toBeInTheDocument();
    expect(screen.getByText(/Stir request accepted/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/초기화/}));
    expect(screen.getByText('STOPPED')).toBeInTheDocument();
  });

  it('disposes selected vessel material only through provider command', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button',{name:/실험실에 추가/}));
    const vessel=screen.getByLabelText('주 용기');
    expect(within(vessel).getByText(/1.000 mol/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'선택 물질 폐기'}));
    fireEvent.click(screen.getByRole('button',{name:'폐기 확인'}));
    fireEvent.click(screen.getByRole('button',{name:'타임라인'}));
    expect(screen.getByText(/Disposed H₂ from vessel/)).toBeInTheDocument();
  });

  it('confirms the mock unknown before catalog unlock feedback', () => {
    renderLab();
    expect(screen.queryByText('물')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'분석'}));
    expect(screen.getByText('물')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'타임라인'}));
    expect(screen.getByText(/Identity confirmed: Water/)).toBeInTheDocument();
  });

  it('provides free-form notes without interpreting note truth', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button',{name:'내 메모'}));
    const notes=screen.getByLabelText('내 메모');
    fireEvent.change(notes,{target:{value:'가열하면 변화가 보이는 것 같음'}});
    expect(notes).toHaveValue('가열하면 변화가 보이는 것 같음');
    expect(screen.getByText(/자동 해석\/판정 없음/)).toBeInTheDocument();
  });

  it('centralizes representative SI conversions and keeps dispatch typed', () => {
    expect(litersToCubicMeters(1)).toBeCloseTo(0.001);
    expect(celsiusToKelvin(25)).toBeCloseTo(298.15);
    const dispatch: LaboratoryProviderValue['dispatch']=vi.fn();
    dispatch({type:'ChangeVolume',vesselId:'v',targetVolumeM3:0.001});
    expect(dispatch).toHaveBeenCalled();
  });

  it('projects current multi-species composition in the primary vessel without leaking unknown identity', () => {
    renderReactionLab();
    const vessel=screen.getByLabelText('주 용기');
    expect(within(vessel).getByText(/H₂ · 0.350 mol/)).toBeInTheDocument();
    expect(within(vessel).getByText(/Unknown α · 0.100 mol/)).toBeInTheDocument();
    expect(screen.queryByText('hidden mock identity')).not.toBeInTheDocument();
  });

  it('shows latest reaction activity and deterministic multi-step event order from provider history', () => {
    renderReactionLab();
    const activity=screen.getByRole('region',{name:'반응 활동'});
    expect(within(activity).getByText(/반응 진행 감지/)).toBeInTheDocument();
    expect(within(activity).getByText(/≈ 근사/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button',{name:'타임라인'}));
    const workbench=screen.getByRole('main',{name:'실험실 작업대'});
    const step1=within(workbench).getByLabelText('반응 단계 1');
    const step2=within(workbench).getByLabelText('반응 단계 2');
    expect(step1).toHaveTextContent('H₂ → Unknown α');
    expect(step1).toHaveTextContent('정밀도 미확정');
    expect(step1).not.toHaveTextContent('mol');
    expect(step2).toHaveTextContent('Unknown α · ≈ 0.100 mol → O₂ · ≈ 0.050 mol');
    expect(step1.compareDocumentPosition(step2) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('reprojects unknown reaction references only after provider discovery confirmation', () => {
    renderReactionLab();
    const vessel=screen.getByLabelText('주 용기');
    expect(within(vessel).getByText(/Unknown α/)).toBeInTheDocument();
    expect(within(vessel).queryByText(/H₂O/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button',{name:'분석'}));
    expect(within(vessel).queryByText(/Unknown α/)).not.toBeInTheDocument();
    expect(within(vessel).getByText(/H₂O · 0.100 mol/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button',{name:'타임라인'}));
    const workbench=screen.getByRole('main',{name:'실험실 작업대'});
    expect(within(workbench).getByLabelText('반응 단계 1')).toHaveTextContent('H₂ → H₂O');
  });

  it('keeps T and P simulation-authoritative while reaction projections are visible', () => {
    renderReactionLab();
    const workbench=screen.getByRole('main',{name:'실험실 작업대'});
    expect(within(workbench).getByText(/298.1 K \/ 25.0 °C/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('온도'),{target:{value:'80'}});
    fireEvent.change(screen.getByLabelText('압력'),{target:{value:'3'}});
    expect(within(workbench).getByText(/298.1 K \/ 25.0 °C/)).toBeInTheDocument();
    expect(screen.getByText(/실제 1.00 atm/)).toBeInTheDocument();
  });
});
