'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: number; type: ToastType; message: string; }

const ICON: Record<ToastType, string> = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

const ToastContext = createContext<{ show: (type: ToastType, message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-stack">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className={`toast ${t.type}`}
              role="status"
            >
              <span aria-hidden>{ICON[t.type]}</span>
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/** `const toast = useToast(); toast.success('Saved'); toast.error('Failed to save');` */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast() must be called within <ToastProvider>.');
  return {
    success: (m: string) => ctx.show('success', m),
    error: (m: string) => ctx.show('error', m),
    warning: (m: string) => ctx.show('warning', m),
    info: (m: string) => ctx.show('info', m),
  };
}
