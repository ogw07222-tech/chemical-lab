import { useEffect, useMemo, useRef, useState } from 'react';
import type { VesselContentView } from '../../types';
import { buildMatterVisualModel, PARTICLE_RADIUS_CSS_PX, type MatterVisualParticle, type MatterVisualRegionBounds } from './model';
import './matter-particles.css';

export interface MatterParticleCanvasProps {
  vesselId: string;
  contents: readonly VesselContentView[];
  ariaLabel?: string;
}

export function animatedParticlePosition(particle: MatterVisualParticle, bounds: MatterVisualRegionBounds, timeS: number, reducedMotion: boolean) {
  if (reducedMotion || particle.motionClass === 'STATIC') return { x: particle.x, y: particle.y };
  const amplitude = particle.motionClass === 'HIGH' ? 0.045 : 0.006;
  const dx = Math.sin(timeS * particle.frequency * 2.1 + particle.phaseOffset) * amplitude;
  const dy = Math.cos(timeS * particle.frequency * 1.7 + particle.phaseOffset * 0.7) * amplitude;
  return {
    x: Math.min(bounds.x1, Math.max(bounds.x0, particle.x + dx)),
    y: Math.min(bounds.y1, Math.max(bounds.y0, particle.y + dy)),
  };
}

export function MatterParticleCanvas({ vesselId, contents, ariaLabel = '용기 내부 대표 입자 시각화' }: MatterParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const model = useMemo(() => buildMatterVisualModel(vesselId, contents), [vesselId, contents]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (timestamp: number) => {
      context.clearRect(0, 0, width, height);
      const timeS = timestamp / 1000;
      for (const region of model.regions) {
        for (const particle of region.particles) {
          const position = animatedParticlePosition(particle, region.bounds, timeS, reducedMotion);
          context.beginPath();
          context.fillStyle = particle.color;
          context.arc(position.x * width, position.y * height, PARTICLE_RADIUS_CSS_PX, 0, Math.PI * 2);
          context.fill();
        }
      }
      if (visible && !reducedMotion) frame = requestAnimationFrame(draw);
    };

    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize);
    observer?.observe(host);
    resize();
    draw(0);
    return () => {
      observer?.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [model, reducedMotion, visible]);

  const summary = contents.length === 0
    ? '비어 있음'
    : contents.map((content) => `${content.identityConfirmed ? content.displayIdentity : content.opaqueLabel ?? 'Unknown substance'} ${content.phase}`).join(', ');

  return (
    <div ref={hostRef} className="matter-particle-host">
      <canvas ref={canvasRef} className="matter-particle-canvas" aria-label={ariaLabel} role="img" />
      <span className="matter-particle-accessible">{summary}. 입자는 실제 분자 수가 아닌 대표 시각화입니다.</span>
    </div>
  );
}
