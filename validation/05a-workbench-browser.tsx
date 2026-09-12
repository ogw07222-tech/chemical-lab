import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/ui/styles.css';
import {
  WorkbenchPlacementSurface,
  WorkbenchShell,
  type ApparatusInstance,
  type ApparatusPlacement,
} from '../src/ui/workbench';

const apparatus: ApparatusInstance[] = [
  { id: 'beaker-validate', type: 'BEAKER' },
  { id: 'plate-validate', type: 'HOT_PLATE' },
];

const placements: ApparatusPlacement[] = [
  { apparatusId: 'beaker-validate', position: { xPercent: 25, yPercent: 40 }, zIndex: 2 },
  { apparatusId: 'plate-validate', position: { xPercent: 75, yPercent: 60 }, zIndex: 4 },
];

function App() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#e8e7e2',
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: '1fr',
      }}
    >
      <style>{`
        .lab-center {
          grid-column: 1 !important;
          grid-row: 1 !important;
          min-width: 0 !important;
          min-height: 0 !important;
          height: 100% !important;
        }
        .workbench-placement-surface {
          min-height: 360px !important;
        }
      `}</style>
      <WorkbenchShell
        title="05A validation"
        status="layout-only"
        placementSurface={(
          <WorkbenchPlacementSurface
            apparatus={apparatus}
            placements={placements}
            renderApparatus={({ instance, selected, focused }) => (
              <div
                data-rendered-apparatus={instance.id}
                style={{ width: 96, height: 72, display: 'grid', placeItems: 'center', border: '1px solid currentColor', background: '#f7f6f2' }}
              >
                {instance.type}:{selected ? 'selected' : 'idle'}:{focused ? 'focused' : 'blurred'}
              </div>
            )}
          />
        )}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
