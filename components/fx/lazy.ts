'use client';

import dynamic from 'next/dynamic';

/** SSR-disabled, code-split wrappers for the heavy visual effects.
 *  Import these from pages instead of the raw components. */
export const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false });
export const ParticleField = dynamic(() => import('./Particles'), { ssr: false });
