import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MatterParticleCanvas } from '../../src/ui/chemistry/matter/MatterParticleCanvas';
import type { VesselContentView } from '../../src/ui/types';

function content(key: string, phase: VesselContentView['phase']): VesselContentView {
  return { visualizationKey: key, displayIdentity: key, amountMol: 1, phase, identityConfirmed: true };
}

function Fixture({ id, phase }: { id: string; phase: VesselContentView['phase'] }) {
  return (
    <section data-fixture={id} style={{ width: 320, height: 220, position: 'relative', overflow: 'hidden' }}>
      <MatterParticleCanvas vesselId={`fixture-${id}`} contents={[content('known:fixture-species', phase)]} ariaLabel={`${phase} particle fixture`} />
    </section>
  );
}

function App() {
  return <main><Fixture id="gas" phase="gas" /><Fixture id="liquid" phase="liquid" /><Fixture id="solid" phase="solid" /></main>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
