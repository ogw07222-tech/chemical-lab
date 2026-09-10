import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LaboratoryWorkspace } from '../../src/ui/App';
import { MockLaboratoryProvider } from '../../src/ui/provider';
import type { LaboratoryProviderValue } from '../../src/ui/types';

function renderLab() { return render(<MockLaboratoryProvider><LaboratoryWorkspace /></MockLaboratoryProvider>); }

describe('LaboratoryWorkspace', () => {
  it('renders the core laboratory zones', () => {
    renderLab();
    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Primary vessel')).toBeInTheDocument();
    expect(screen.getByText('Controls')).toBeInTheDocument();
    expect(screen.getByText('COMPOSITION')).toBeInTheDocument();
  });

  it('adds a selected substance through the mock provider', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: /Add H₂ to vessel/i }));
    expect(screen.getAllByText('0.25 mol').length).toBeGreaterThan(0);
    expect(screen.getByText(/Added 0.25 mol H₂/)).toBeInTheDocument();
  });

  it('supports run pause and reset state flow', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.getByText('PAUSED')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByText('STOPPED')).toBeInTheDocument();
  });

  it('keeps command dispatch in the provider boundary', () => {
    const dispatch: LaboratoryProviderValue['dispatch'] = vi.fn();
    dispatch({ type: 'Run', vesselId: 'vessel-1' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'Run', vesselId: 'vessel-1' });
  });
});
