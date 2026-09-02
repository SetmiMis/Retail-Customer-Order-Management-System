'use client';

import { motion } from 'motion/react';

type Dir = 'up' | 'down' | 'left' | 'right' | 'none';
const OFF: Record<Dir, { x?: number; y?: number }> = {
  up: { y: 22 }, down: { y: -22 }, left: { x: 22 }, right: { x: -22 }, none: {},
};

/** Scroll-into-view reveal (AOS-style). Wrap any block. */
export default function Reveal({
  children, dir = 'up', delay = 0, className, once = true,
}: {
  children: React.ReactNode; dir?: Dir; delay?: number; className?: string; once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, ...OFF[dir] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
