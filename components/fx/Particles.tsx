'use client';

import { useEffect, useMemo, useState } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';
import type { ISourceOptions } from '@tsparticles/engine';
import { useReducedMotion } from './useReducedMotion';

let enginePromise: Promise<void> | null = null;

/** Subtle drifting particle field with link lines. Client-only, lazy engine load,
 *  disabled entirely under reduced motion. `density` scales the particle count. */
export default function ParticleField({ density = 1, className }: { density?: number; className?: string }) {
  const [ready, setReady] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (!enginePromise) enginePromise = initParticlesEngine((engine) => loadSlim(engine));
    enginePromise.then(() => setReady(true));
  }, [reduced]);

  const options = useMemo<ISourceOptions>(
    () => ({
      fullScreen: { enable: false },
      fpsLimit: 60,
      detectRetina: true,
      particles: {
        number: { value: Math.round(46 * density), density: { enable: true } },
        color: { value: ['#7c5cff', '#22d3ee', '#f472b6'] },
        links: { enable: true, color: '#7c5cff', distance: 130, opacity: 0.22, width: 1 },
        move: { enable: true, speed: 0.7, outModes: { default: 'out' } },
        opacity: { value: { min: 0.15, max: 0.5 } },
        size: { value: { min: 1, max: 2.6 } },
      },
      interactivity: {
        events: { onHover: { enable: true, mode: 'grab' } },
        modes: { grab: { distance: 150, links: { opacity: 0.4 } } },
      },
    }),
    [density],
  );

  if (reduced || !ready) return null;
  return (
    <Particles
      id="oms-particles"
      options={options}
      className={className}
      style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}
