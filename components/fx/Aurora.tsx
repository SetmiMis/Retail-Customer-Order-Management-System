/**
 * Fixed animated aurora background. Pure CSS (.fx-aurora keyframes in globals.css)
 * so it costs nothing on the main thread and freezes under prefers-reduced-motion.
 * Drop once near the top of a layout.
 */
export default function Aurora() {
  return <div className="fx-aurora" aria-hidden />;
}
