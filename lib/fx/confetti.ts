import confetti from 'canvas-confetti';

/** Celebratory burst — used on order submit / dispatch complete. No-op under reduced motion. */
export function celebrate(): void {
  if (typeof window === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colors = ['#005a84', '#6ec1e4', '#0693e3', '#ff8f00', '#4fae5a'];
  const fire = (particleRatio: number, opts: confetti.Options) =>
    confetti({ origin: { y: 0.7 }, colors, ...opts, particleCount: Math.floor(200 * particleRatio) });

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.9 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
}
