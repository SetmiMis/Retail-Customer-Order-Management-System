'use client';

import { useEffect, useRef, useState } from 'react';
import { animate } from 'motion';

/** Count-up number for KPI tiles. Respects prefers-reduced-motion (snaps instantly). */
export default function AnimatedNumber({ value, duration = 0.9 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const controls = animate(prev.current, value, {
      duration: reduce ? 0 : duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, duration]);

  return <>{display.toLocaleString('en-IN')}</>;
}
