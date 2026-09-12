import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApparatusWorkspaceLayer, DeviceInspector } from '../../src/ui/apparatus';

describe('05D apparatus accessibility integration', () => {
  it('exposes apparatus as named selectable buttons and moves focus into the inspector', () => {
    render(<ApparatusWorkspaceLayer apparatus={[{ id: 'plate-1', type: 'HOT_PLATE' }]} />);
    const apparatus = screen.getByRole('button', { name: 'HOT_PLATE 기구 plate-1' });
    expect(apparatus).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(apparatus);
    expect(apparatus).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('complementary', { name: 'Hot Plate' })).toHaveFocus();
  });

  it('closes the inspector with Escape and restores focus to the selected apparatus', async () => {
    render(<ApparatusWorkspaceLayer apparatus={[{ id: 'plate-1', type: 'HOT_PLATE' }]} />);
    const apparatus = screen.getByRole('button', { name: 'HOT_PLATE 기구 plate-1' });
    fireEvent.click(apparatus);
    const inspector = screen.getByRole('complementary', { name: 'Hot Plate' });
    fireEvent.keyDown(inspector, { key: 'Escape' });
    await Promise.resolve();
    expect(screen.queryByRole('complementary', { name: 'Hot Plate' })).not.toBeInTheDocument();
    expect(apparatus).toHaveFocus();
  });

  it('disables unavailable controls and communicates the provider reason', () => {
    render(
      <DeviceInspector
        apparatusId="vacuum-1"
        type="VACUUM_PUMP"
        intentSupport={{
          SetApparatusEnabled: { status: 'UNSUPPORTED', reason: 'No apparatus backend command.' },
          SetApparatusPressureTarget: { status: 'UNAVAILABLE', reason: 'Pressure control is not connected.' },
        }}
      />,
    );
    expect(screen.getByLabelText('Power')).toBeDisabled();
    expect(screen.getByLabelText('Target Pressure')).toBeDisabled();
    expect(screen.getByText('No apparatus backend command.')).toBeInTheDocument();
    expect(screen.getByText('Pressure control is not connected.')).toBeInTheDocument();
  });

  it('keeps the placement surface as a named semantic region', () => {
    render(<ApparatusWorkspaceLayer apparatus={[]} />);
    expect(screen.getByRole('region', { name: '기구 배치 영역' })).toBeInTheDocument();
  });
});
