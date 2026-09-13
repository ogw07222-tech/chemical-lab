import type { Phase, VesselContentView } from '../../types';

export type MatterVisualPhase = 'GAS' | 'LIQUID' | 'SOLID' | 'OTHER';
export type MatterMotionClass = 'STATIC' | 'LOW' | 'HIGH';

export interface MatterVisualRegionBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MatterVisualParticle {
  id: string;
  visualKey: string;
  color: string;
  phase: MatterVisualPhase;
  motionClass: MatterMotionClass;
  x: number;
  y: number;
  phaseOffset: number;
  frequency: number;
}

export interface MatterVisualRegion {
  id: string;
  phase: MatterVisualPhase;
  bounds: MatterVisualRegionBounds;
  particles: MatterVisualParticle[];
}

export interface MatterVisualModel {
  vesselId: string;
  regions: MatterVisualRegion[];
  totalParticles: number;
}

export const MAX_PARTICLES_PER_VESSEL = 900;
export const PARTICLE_RADIUS_CSS_PX = 0.85;

const VISUALIZATION_PALETTE = [
  '#50748a', '#a36f55', '#6f8065', '#806d8f', '#8c7b4e', '#577d78',
  '#8e6468', '#6e7592', '#9a795f', '#63806f', '#7e6e5a', '#6b7d8b',
] as const;

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function visualizationColorForKey(visualKey: string): string {
  return VISUALIZATION_PALETTE[stableHash(visualKey) % VISUALIZATION_PALETTE.length]!;
}

export function visualPhaseForProviderPhase(phase: Phase): MatterVisualPhase {
  if (phase === 'gas') return 'GAS';
  if (phase === 'liquid' || phase === 'aqueous') return 'LIQUID';
  if (phase === 'solid') return 'SOLID';
  return 'OTHER';
}

export function motionClassForPhase(phase: MatterVisualPhase): MatterMotionClass {
  if (phase === 'GAS') return 'HIGH';
  if (phase === 'LIQUID') return 'LOW';
  return 'STATIC';
}

export function regionBoundsForPhase(phase: MatterVisualPhase): MatterVisualRegionBounds {
  if (phase === 'GAS') return { x0: 0.08, y0: 0.08, x1: 0.92, y1: 0.54 };
  if (phase === 'LIQUID') return { x0: 0.07, y0: 0.5, x1: 0.93, y1: 0.94 };
  if (phase === 'SOLID') return { x0: 0.12, y0: 0.65, x1: 0.88, y1: 0.94 };
  return { x0: 0.1, y0: 0.18, x1: 0.9, y1: 0.9 };
}

export function visualParticleCount(relativePresence: number, phase: MatterVisualPhase): number {
  if (!Number.isFinite(relativePresence) || relativePresence <= 0) return 0;
  const root = Math.sqrt(relativePresence);
  if (phase === 'GAS') return Math.min(120, Math.max(10, Math.round(26 + root * 28)));
  if (phase === 'LIQUID') return Math.min(360, Math.max(80, Math.round(120 + root * 115)));
  if (phase === 'SOLID') return Math.min(460, Math.max(140, Math.round(220 + root * 135)));
  return Math.min(100, Math.max(12, Math.round(32 + root * 24)));
}

function fallbackVisualKey(content: VesselContentView, index: number): string {
  if (content.visualizationKey) return content.visualizationKey;
  if (content.speciesId) return `known:${content.speciesId}`;
  if (content.opaqueLabel) return `opaque:${content.opaqueLabel}`;
  return `anonymous-slot:${index}`;
}

function generateParticle(
  vesselId: string,
  visualKey: string,
  phase: MatterVisualPhase,
  bounds: MatterVisualRegionBounds,
  index: number,
  count: number,
): MatterVisualParticle {
  const seed = stableHash(`${vesselId}|${visualKey}|${phase}|${index}`);
  const random = mulberry32(seed);
  const width = bounds.x1 - bounds.x0;
  const height = bounds.y1 - bounds.y0;
  let x: number;
  let y: number;

  if (phase === 'GAS' || phase === 'OTHER') {
    x = bounds.x0 + random() * width;
    y = bounds.y0 + random() * height;
  } else {
    const columns = Math.max(1, Math.ceil(Math.sqrt(count * (width / height))));
    const rows = Math.max(1, Math.ceil(count / columns));
    const column = index % columns;
    const row = Math.floor(index / columns);
    const jitter = phase === 'SOLID' ? 0.06 : 0.24;
    x = bounds.x0 + ((column + 0.5 + (random() - 0.5) * jitter) / columns) * width;
    y = bounds.y0 + ((row + 0.5 + (random() - 0.5) * jitter) / rows) * height;
  }

  return {
    id: `${visualKey}:${phase}:${index}`,
    visualKey,
    color: visualizationColorForKey(visualKey),
    phase,
    motionClass: motionClassForPhase(phase),
    x,
    y,
    phaseOffset: random() * Math.PI * 2,
    frequency: 0.55 + random() * 0.9,
  };
}

export function buildMatterVisualModel(
  vesselId: string,
  contents: readonly VesselContentView[],
  particleCap = MAX_PARTICLES_PER_VESSEL,
): MatterVisualModel {
  const buckets = new Map<MatterVisualPhase, MatterVisualParticle[]>();
  let remaining = Math.max(0, Math.floor(particleCap));

  contents.forEach((content, contentIndex) => {
    if (remaining <= 0) return;
    const phase = visualPhaseForProviderPhase(content.phase);
    const visualKey = fallbackVisualKey(content, contentIndex);
    const requested = visualParticleCount(content.amountMol, phase);
    const count = Math.min(requested, remaining);
    const bounds = regionBoundsForPhase(phase);
    const bucket = buckets.get(phase) ?? [];
    for (let index = 0; index < count; index += 1) {
      bucket.push(generateParticle(vesselId, visualKey, phase, bounds, index, count));
    }
    buckets.set(phase, bucket);
    remaining -= count;
  });

  const order: MatterVisualPhase[] = ['GAS', 'LIQUID', 'SOLID', 'OTHER'];
  const regions = order
    .filter((phase) => (buckets.get(phase)?.length ?? 0) > 0)
    .map((phase) => ({
      id: `${vesselId}:${phase}`,
      phase,
      bounds: regionBoundsForPhase(phase),
      particles: buckets.get(phase) ?? [],
    }));

  return {
    vesselId,
    regions,
    totalParticles: regions.reduce((sum, region) => sum + region.particles.length, 0),
  };
}
