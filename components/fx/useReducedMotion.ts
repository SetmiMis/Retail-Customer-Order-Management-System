'use client';

import { useEffect, useState } from 'react';

/** True when the OS "reduce motion" setting is on. SSR-safe (false until mounted). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** Coarse "is this a low-power / small device" check — used to skip the 3D canvas. */
export function useLowPower(): boolean {
  const [low, setLow] = useState(false);
  useEffect(() => {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
    const small = window.matchMedia('(max-width: 720px)').matches;
    setLow(cores <= 4 || mem <= 4 || small);
  }, []);
  return low;
}
