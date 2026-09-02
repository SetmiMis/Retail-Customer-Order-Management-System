import { cn } from '../../lib/utils/cn';

const STAGE_CLASS: Record<string, string> = {
  New: 'b-New',
  Quoted: 'b-Quoted',
  'Follow-up': 'b-Followup',
  Won: 'b-Won',
  Lost: 'b-Lost',
  Dispatched: 'b-Dispatched',
  Closed: 'b-Closed',
};

const PRIORITY_CLASS: Record<string, string> = {
  Hot: 'pri-Hot',
  Warm: 'pri-Warm',
  Cold: 'pri-Cold',
};

/** Stage pill — same visual language as the original app's badge('Stage') helper. */
export function StageBadge({ stage }: { stage: string }) {
  return <span className={cn('badge', STAGE_CLASS[stage])}>{stage}</span>;
}

/** Priority text — colored, no pill background (matches the original's pri-Hot/Warm/Cold). */
export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={PRIORITY_CLASS[priority] || ''}>{priority}</span>;
}

/** Generic rounded pill for anything else (source, lead, counts). */
export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('pill', className)}>{children}</span>;
}
