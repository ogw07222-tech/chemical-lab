import { describe, expect, it } from 'vitest';
import {
  buildMatterVisualModel,
  MAX_PARTICLES_PER_VESSEL,
  PARTICLE_RADIUS_CSS_PX,
  regionBoundsForPhase,
  visualParticleCount,
  visualizationColorForKey,
} from '../../src/ui/chemistry/matter/model';
import { animatedParticlePosition } from '../../src/ui/chemistry/matter/MatterParticleCanvas';
import type { VesselContentView } from '../../src/ui/types';

function content(key: string, phase: VesselContentView['phase'], amountMol: number): VesselContentView {
  return {
    visualizationKey: key,
    displayIdentity: key,
    amountMol,
    phase,
    identityConfirmed: true,
  };
}

describe('06C independent particle UI validation', () => {
  it('keeps the representative model bounded for huge and non-finite magnitudes', () => {
    const huge = buildMatterVisualModel('v', Array.from({ length: 100 }, (_, i) => content(`known:${i}`, 'solid', Number.MAX_VALUE)));
    expect(huge.totalParticles).toBeLessThanOrEqual(MAX_PARTICLES_PER_VESSEL);
    expect(buildMatterVisualModel('v', [content('known:x', 'gas', Number.POSITIVE_INFINITY)]).totalParticles).toBe(0);
    expect(buildMatterVisualModel('v', [content('known:x', 'gas', Number.NaN)]).totalParticles).toBe(0);
    expect(buildMatterVisualModel('v', [content('known:x', 'gas', 0)]).totalParticles).toBe(0);
  });

  it('preserves gas < liquid < solid density ordering across representative magnitudes', () => {
    for (const amount of [0.000001, 0.01, 1, 100, 1e12]) {
      const gas = visualParticleCount(amount, 'GAS');
      const liquid = visualParticleCount(amount, 'LIQUID');
      const solid = visualParticleCount(amount, 'SOLID');
      expect(gas).toBeLessThan(liquid);
      expect(liquid).toBeLessThan(solid);
    }
  });

  it('uses a phase-independent microscopic particle radius', () => {
    expect(PARTICLE_RADIUS_CSS_PX).toBe(0.85);
  });

  it('keeps one player-safe visualization key color-stable across vessel and phase', () => {
    const key = 'unknown:opaque-a';
    expect(visualizationColorForKey(key)).toBe(visualizationColorForKey(key));
    const a = buildMatterVisualModel('vessel-a', [content(key, 'gas', 1)]).regions[0]!.particles[0]!;
    const b = buildMatterVisualModel('vessel-b', [content(key, 'solid', 1)]).regions[0]!.particles[0]!;
    expect(a.color).toBe(b.color);
  });

  it('keeps initial layouts deterministic while vessel and species seeds remain independent', () => {
    const fixture = [content('known:a', 'gas', 0.5), content('known:b', 'liquid', 0.5)];
    expect(buildMatterVisualModel('vessel-a', fixture)).toEqual(buildMatterVisualModel('vessel-a', fixture));
    const a = buildMatterVisualModel('vessel-a', [content('known:a', 'gas', 1)]).regions[0]!.particles[0]!;
    const b = buildMatterVisualModel('vessel-b', [content('known:a', 'gas', 1)]).regions[0]!.particles[0]!;
    const c = buildMatterVisualModel('vessel-a', [content('known:b', 'gas', 1)]).regions[0]!.particles[0]!;
    expect([a.x, a.y]).not.toEqual([b.x, b.y]);
    expect([a.x, a.y]).not.toEqual([c.x, c.y]);
  });

  it('keeps solid static and bounds gas/liquid visual-only motion inside their regions', () => {
    for (const phase of ['gas', 'liquid', 'solid'] as const) {
      const model = buildMatterVisualModel('v', [content('known:x', phase, 1)]);
      const region = model.regions[0]!;
      const particle = region.particles[0]!;
      const p0 = animatedParticlePosition(particle, region.bounds, 0, false);
      const p1 = animatedParticlePosition(particle, region.bounds, 17.25, false);
      expect(p1.x).toBeGreaterThanOrEqual(region.bounds.x0);
      expect(p1.x).toBeLessThanOrEqual(region.bounds.x1);
      expect(p1.y).toBeGreaterThanOrEqual(region.bounds.y0);
      expect(p1.y).toBeLessThanOrEqual(region.bounds.y1);
      if (phase === 'solid') expect(p1).toEqual(p0);
    }
  });

  it('reduced motion freezes gas and liquid without removing their particles or phase regions', () => {
    for (const phase of ['GAS', 'LIQUID'] as const) {
      const providerPhase = phase === 'GAS' ? 'gas' : 'liquid';
      const model = buildMatterVisualModel('v', [content('known:x', providerPhase, 1)]);
      const region = model.regions[0]!;
      const particle = region.particles[0]!;
      expect(animatedParticlePosition(particle, regionBoundsForPhase(phase), 999, true)).toEqual({ x: particle.x, y: particle.y });
      expect(region.particles.length).toBeGreaterThan(0);
    }
  });

  it('coexists multi-species fields under one vessel-wide cap', () => {
    const model = buildMatterVisualModel('mix', [
      content('known:a', 'liquid', 100),
      content('known:b', 'liquid', 100),
      content('unknown:opaque-c', 'liquid', 100),
      content('known:d', 'solid', 100),
    ]);
    expect(model.totalParticles).toBeLessThanOrEqual(MAX_PARTICLES_PER_VESSEL);
    const keys = new Set(model.regions.flatMap((r) => r.particles.map((p) => p.visualKey)));
    expect(keys.has('known:a')).toBe(true);
    expect(keys.has('known:b')).toBe(true);
  });
});
