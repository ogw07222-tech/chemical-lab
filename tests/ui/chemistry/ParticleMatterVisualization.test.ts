import { describe, expect, it } from 'vitest';
import type { Phase3AProviderProjection } from '../../../src/integration/phase3a-reaction-network';
import { animatedParticlePosition } from '../../../src/ui/chemistry/matter/MatterParticleCanvas';
import {
  buildMatterVisualModel,
  MAX_PARTICLES_PER_VESSEL,
  regionBoundsForPhase,
  visualParticleCount,
  visualizationColorForKey,
} from '../../../src/ui/chemistry/matter/model';
import { projectPhase3AReactionUi } from '../../../src/ui/reactionProjection';
import type { VesselContentView } from '../../../src/ui/types';

function content(
  visualizationKey: string,
  phase: VesselContentView['phase'],
  amountMol = 1,
  displayIdentity = 'Known',
): VesselContentView {
  return {
    speciesId: 'known-species',
    visualizationKey,
    displayIdentity,
    amountMol,
    phase,
    identityConfirmed: true,
  };
}

describe('particle matter visualization model', () => {
  it('assigns the same deterministic visualization color to the same species key', () => {
    expect(visualizationColorForKey('known:h2o')).toBe(visualizationColorForKey('known:h2o'));
  });

  it('keeps the same species color across gas, liquid, and solid phases', () => {
    const model = buildMatterVisualModel('vessel-1', [
      content('known:h2o', 'gas'),
      content('known:h2o', 'liquid'),
      content('known:h2o', 'solid'),
    ]);
    const colors = new Set(model.regions.flatMap((region) => region.particles.map((particle) => particle.color)));
    expect(colors.size).toBe(1);
  });

  it('encodes phase primarily through density policy: gas < liquid < solid', () => {
    expect(visualParticleCount(1, 'GAS')).toBeLessThan(visualParticleCount(1, 'LIQUID'));
    expect(visualParticleCount(1, 'LIQUID')).toBeLessThan(visualParticleCount(1, 'SOLID'));
  });

  it('initializes the same snapshot deterministically without rerender flicker', () => {
    const contents = [content('known:a', 'gas', 0.4), content('known:b', 'liquid', 0.8)];
    expect(buildMatterVisualModel('vessel-1', contents)).toEqual(buildMatterVisualModel('vessel-1', contents));
  });

  it('uses independent deterministic seeds for different vessels', () => {
    const contents = [content('known:a', 'gas')];
    const first = buildMatterVisualModel('vessel-1', contents).regions[0]!.particles[0]!;
    const second = buildMatterVisualModel('vessel-2', contents).regions[0]!.particles[0]!;
    expect([first.x, first.y]).not.toEqual([second.x, second.y]);
    expect(first.color).toBe(second.color);
  });

  it('renders mixtures as multiple visual species in the same phase region', () => {
    const model = buildMatterVisualModel('vessel-1', [content('known:a', 'liquid'), content('known:b', 'liquid')]);
    const liquid = model.regions.find((region) => region.phase === 'LIQUID')!;
    expect(new Set(liquid.particles.map((particle) => particle.visualKey))).toEqual(new Set(['known:a', 'known:b']));
  });

  it('handles an empty vessel without particles', () => {
    expect(buildMatterVisualModel('empty-vessel', [])).toEqual({ vesselId: 'empty-vessel', regions: [], totalParticles: 0 });
  });

  it('supports one species in multiple provider-supplied phase regions', () => {
    const model = buildMatterVisualModel('vessel-1', [content('known:h2o', 'gas'), content('known:h2o', 'liquid')]);
    expect(model.regions.map((region) => region.phase)).toEqual(['GAS', 'LIQUID']);
  });

  it('hard-caps representative particle count', () => {
    const model = buildMatterVisualModel('vessel-1', Array.from({ length: 20 }, (_, index) => content(`known:${index}`, 'solid', 100)));
    expect(model.totalParticles).toBeLessThanOrEqual(MAX_PARTICLES_PER_VESSEL);
  });

  it('reduced motion freezes animated particles at deterministic base positions', () => {
    const model = buildMatterVisualModel('vessel-1', [content('known:a', 'gas')]);
    const particle = model.regions[0]!.particles[0]!;
    expect(animatedParticlePosition(particle, regionBoundsForPhase('GAS'), 123.4, true)).toEqual({ x: particle.x, y: particle.y });
  });
});

describe('player-safe visualization key projection', () => {
  it('uses opaque unknownRef rather than hidden generated SpeciesId', () => {
    const hiddenSpeciesId = 'generated:secret-molecular-identity';
    const provider: Phase3AProviderProjection = {
      authoritativeVesselComposition: [{ speciesRef: hiddenSpeciesId, amountMol: 0.5, phase: 'liquid', phaseStateId: 'internal-phase' }],
      activeReactionEvents: [],
      timelineEvents: [],
    };
    const view = projectPhase3AReactionUi(provider, () => ({
      unknownRef: 'anonymous-visual-a',
      displayLabel: 'Unknown α',
      identityConfirmed: false,
    }));
    expect(view.contents[0]?.visualizationKey).toBe('unknown:anonymous-visual-a');
    expect(view.contents[0]).not.toHaveProperty('speciesId');
    expect(JSON.stringify(view.contents)).not.toContain(hiddenSpeciesId);
  });
});
