'use client';

import { motion } from 'motion/react';

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}
    >
      <div>
        <h1 className="brand-heading" style={{ fontSize: 24, margin: 0 }}>{title}</h1>
        {subtitle && <p className="tagline" style={{ marginTop: 4 }}>{subtitle}</p>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </motion.div>
  );
}
