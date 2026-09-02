'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils/cn';

export default function Modal({
  onClose, children, maxWidth = 640, className,
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
  className?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="modal-bg"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className={cn('modal card', className)}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
