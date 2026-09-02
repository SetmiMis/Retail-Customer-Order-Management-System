'use client';

import { useEffect } from 'react';
import { motion } from 'motion/react';

/**
 * Side panel for detail/record views (per the user's "prefer side drawers for detailed records"
 * instruction) — used by the Enquiry detail view and New Enquiry in Phase E. Note: exit animations
 * only play if the caller wraps conditional rendering in <AnimatePresence>; without it the drawer
 * still closes correctly, just instantly rather than sliding out.
 */
export default function Drawer({
  onClose, children, width,
}: {
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <>
      <motion.div
        className="drawer-bg"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      />
      <motion.div
        className="drawer-panel"
        style={width ? { width } : undefined}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </motion.div>
    </>
  );
}
