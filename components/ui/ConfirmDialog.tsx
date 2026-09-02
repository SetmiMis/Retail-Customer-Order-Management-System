'use client';

import { useCallback, useState, createElement } from 'react';
import Modal from './Modal';
import Button from './Button';

export interface ConfirmDialogProps {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** Replaces window.confirm() for destructive actions (delete, reject) with a styled, on-brand dialog. */
export default function ConfirmDialog({
  title, description, confirmLabel = 'Confirm', danger = true, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onCancel} maxWidth={380}>
      <div className="sectitle">{title}</div>
      {description && <p className="sub" style={{ marginBottom: 16 }}>{description}</p>}
      <div className="actions" style={{ justifyContent: 'flex-end' }}>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant={danger ? 'red' : 'primary'} size="sm" onClick={handleConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

type PendingConfirm = Omit<ConfirmDialogProps, 'onConfirm' | 'onCancel'> & { resolve: (v: boolean) => void };

/**
 * Hook form: `const { confirm, confirmElement } = useConfirm(); const ok = await confirm({ title, description });`
 * Render `{confirmElement}` once near the root of the component that calls confirm(). Resolves to
 * true/false instead of requiring the caller to manage dialog open/close state manually.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((opts: Omit<ConfirmDialogProps, 'onConfirm' | 'onCancel'>) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const confirmElement = pending
    ? createElement(ConfirmDialog, {
        ...pending,
        onConfirm: () => { pending.resolve(true); setPending(null); },
        onCancel: () => { pending.resolve(false); setPending(null); },
      })
    : null;

  return { confirm, confirmElement };
}
