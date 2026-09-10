import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LaboratoryWorkspace } from '../../src/ui/App';
import { MockLaboratoryProvider } from '../../src/ui/provider';
import type { LaboratoryProviderValue } from '../../src/ui/types';
import { celsiusToKelvin, litersToCubicMeters } from '../../src/ui/units';

function renderLab() { return render(<MockLaboratoryProvider><LaboratoryWorkspace /></MockLaboratoryProvider>); }
describe('LaboratoryWorkspace', () => {
  it('renders PC-first laboratory zones and canonical tabs', () => { renderLab(); expect(screen.getByText('Materials')).toBeInTheDocument(); expect(screen.getByText('Primary vessel')).toBeInTheDocument(); expect(screen.getByText('Environment')).toBeInTheDocument(); expect(screen.getByRole('button',{name:'Phase'})).toBeInTheDocument(); });
  it('normal inventory exposes starters but not all supported species', () => { renderLab(); expect(screen.getByText('Hydrogen')).toBeInTheDocument(); expect(screen.queryByText('Methane')).not.toBeInTheDocument(); });
  it('developer mode exposes all supported species', () => { renderLab(); fireEvent.click(screen.getByLabelText(/Dev/i)); expect(screen.getByText('Methane')).toBeInTheDocument(); });
  it('adds a finite amount through the provider', () => { renderLab(); fireEvent.click(screen.getByRole('button',{name:/Add H₂ to vessel/i})); expect(screen.getByText(/Added 0.250 mol H₂/)).toBeInTheDocument(); });
  it('uses heater power and thermostat commands rather than direct temperature mutation', () => { renderLab(); fireEvent.change(screen.getByLabelText('Heater power'),{target:{value:'250'}}); expect(screen.getByText('250 W')).toBeInTheDocument(); fireEvent.click(screen.getByLabelText('Thermostat')); expect(screen.getByText(/Thermostat enabled/)).toBeInTheDocument(); });
  it('confirms the mock unknown before discovery unlock feedback', () => { renderLab(); expect(screen.queryByText('Water')).not.toBeInTheDocument(); fireEvent.click(screen.getByRole('button',{name:'Analyze'})); expect(screen.getByText(/Identity confirmed: Water/)).toBeInTheDocument(); expect(screen.getByText('Water')).toBeInTheDocument(); });
  it('supports run pause and reset state flow', () => { renderLab(); fireEvent.click(screen.getByRole('button',{name:'Run'})); expect(screen.getByText('RUNNING')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button',{name:'Pause'})); expect(screen.getByText('PAUSED')).toBeInTheDocument(); fireEvent.click(screen.getByRole('button',{name:'Reset experiment'})); expect(screen.getByText('STOPPED')).toBeInTheDocument(); });
  it('centralizes representative SI conversions', () => { expect(litersToCubicMeters(1)).toBeCloseTo(0.001); expect(celsiusToKelvin(25)).toBeCloseTo(298.15); });
  it('keeps dispatch typed at provider boundary', () => { const dispatch: LaboratoryProviderValue['dispatch']=vi.fn(); dispatch({type:'ChangeVolume',vesselId:'v',targetVolumeM3:0.001}); expect(dispatch).toHaveBeenCalled(); });
});
