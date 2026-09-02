import { ORDER_STATUS } from '../../lib/oms/constants';

const S = ORDER_STATUS;

/** Order status -> semantic hue class (globals.css .os-*). */
const HUE: Record<string, string> = {
  [S.DRAFT]: 'os-neutral',
  [S.RECEIVED]: 'os-process',
  [S.CONFIRM_PENDING]: 'os-pending',
  [S.CONFIRMED]: 'os-process',
  [S.QTY_CHECK]: 'os-process',
  [S.REQUIREMENT_PENDING]: 'os-issue',
  [S.PARTIAL_AVAILABLE]: 'os-pending',
  [S.READY_FOR_PACKING]: 'os-accent',
  [S.PACKING]: 'os-process',
  [S.FINAL_VERIFICATION]: 'os-process',
  [S.READY_FOR_DISPATCH]: 'os-accent',
  [S.DISPATCHED]: 'os-success',
  [S.COMPLETED]: 'os-success',
  [S.ON_HOLD]: 'os-pending',
  [S.CANCELLED]: 'os-issue',
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`os ${HUE[status] || 'os-neutral'}`}>{status}</span>;
}
