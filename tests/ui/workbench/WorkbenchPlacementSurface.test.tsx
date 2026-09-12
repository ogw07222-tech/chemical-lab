import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  APPARATUS_TYPES,
  WorkbenchPlacementSurface,
  WorkbenchShell,
  type ApparatusInstance,
  type ApparatusPlacement,
} from '../../../src/ui/workbench';

const apparatus: ApparatusInstance[] = [
  { id: 'beaker-1', type: 'BEAKER' },
  { id: 'plate-1', type: 'HOT_PLATE' },
];

const placements: ApparatusPlacement[] = [
  { apparatusId: 'beaker-1', position: { xPercent: 25, yPercent: 40 }, zIndex: 2 },
  { apparatusId: 'plate-1', slotId: 'bench-right', zIndex: 4 },
];

describe('Workbench placement boundary', () => {
  it('exports the agreed initial apparatus vocabulary', () => {
    expect(APPARATUS_TYPES).toContain('BEAKER');
    expect(APPARATUS_TYPES).toContain('SEALED_VESSEL');
    expect(APPARATUS_TYPES).toContain('ANALYSIS_INSTRUMENT');
    expect(APPARATUS_TYPES).toHaveLength(16);
  });

  it('renders typed apparatus children on the placement surface', () => {
    render(
      <WorkbenchPlacementSurface
        apparatus={apparatus}
        placements={placements}
        slots={[{ id: 'bench-right', position: { xPercent: 75, yPercent: 55 } }]}
        renderApparatus={({ instance }) => <span>{instance.id}</span>}
      />,
    );
    expect(screen.getByRole('region', { name: '기구 배치 영역' })).toBeInTheDocument();
    expect(screen.getByText('beaker-1')).toBeInTheDocument();
    expect(screen.getByText('plate-1')).toBeInTheDocument();
  });

  it('owns only UI selection and focus presentation state', () => {
    render(
      <WorkbenchPlacementSurface
        apparatus={apparatus}
        placements={placements}
        slots={[{ id: 'bench-right', position: { xPercent: 75, yPercent: 55 } }]}
        renderApparatus={({ instance, selected, focused }) => (
          <span>{instance.id}:{selected ? 'selected' : 'idle'}:{focused ? 'focused' : 'blurred'}</span>
        )}
      />,
    );
    const beaker = screen.getByRole('button', { name: 'BEAKER 기구 beaker-1' });
    fireEvent.click(beaker);
    expect(beaker).toHaveClass('selected');
    expect(beaker).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('beaker-1:selected:blurred')).toBeInTheDocument();
    fireEvent.focus(beaker);
    expect(beaker).toHaveClass('focused');
    expect(screen.getByText('beaker-1:selected:focused')).toBeInTheDocument();
    expect(beaker).toHaveStyle({ left: '25%', top: '40%', zIndex: '1002' });
  });

  it('supports controlled selection/focus callbacks for later 05B integration', () => {
    const onSelected = vi.fn();
    const onFocused = vi.fn();
    render(
      <WorkbenchPlacementSurface
        apparatus={apparatus}
        placements={placements}
        selectedApparatusId="plate-1"
        focusedApparatusId="plate-1"
        onSelectedApparatusChange={onSelected}
        onFocusedApparatusChange={onFocused}
        renderApparatus={({ instance }) => <span>{instance.id}</span>}
      />,
    );
    const beaker = screen.getByRole('button', { name: 'BEAKER 기구 beaker-1' });
    fireEvent.click(beaker);
    fireEvent.focus(beaker);
    expect(onSelected).toHaveBeenCalledWith('beaker-1');
    expect(onFocused).toHaveBeenCalledWith('beaker-1');
    expect(screen.getByRole('button', { name: 'HOT_PLATE 기구 plate-1' })).toHaveClass('selected', 'focused');
  });

  it('preserves the Workbench semantic main region around the surface', () => {
    render(
      <WorkbenchShell
        title="실험 A"
        status="298 K"
        placementSurface={<WorkbenchPlacementSurface baseLayer={<div>legacy vessel layer</div>} />}
      >
        <section aria-label="하단 분석">analysis</section>
      </WorkbenchShell>,
    );
    const main = screen.getByRole('main', { name: '실험실 작업대' });
    expect(main).toHaveTextContent('실험 A');
    expect(main).toHaveTextContent('legacy vessel layer');
    expect(screen.getByRole('region', { name: '하단 분석' })).toBeInTheDocument();
  });
});
