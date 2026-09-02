import { OMS_SHEETS } from './constants';
import { appendRow, readSheet } from '../sheets/rows';
import { fmtNice, parseSheetDate } from '../shared/format';
import type { StaffSession, CustomerSession } from '../auth/session';

export type Actor =
  | { type: 'staff'; id: string; name: string; role: string }
  | { type: 'customer'; id: string; name: string; role: 'CUSTOMER' }
  | { type: 'system'; id: string; name: string; role: 'SYSTEM' };

export function staffActor(s: Pick<StaffSession, 'userId' | 'name' | 'role'>): Actor {
  return { type: 'staff', id: s.userId, name: s.name, role: s.role };
}
export function customerActor(c: Pick<CustomerSession, 'customerId' | 'companyName' | 'contactName'>): Actor {
  return { type: 'customer', id: c.customerId, name: c.companyName || c.contactName, role: 'CUSTOMER' };
}
export const SYSTEM_ACTOR: Actor = { type: 'system', id: 'system', name: 'OMS', role: 'SYSTEM' };

/** Appends an audit row. Never throws — logging must not break the primary action. */
export async function audit(
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
  oldValue?: unknown,
  newValue?: unknown,
  details?: string,
): Promise<void> {
  try {
    await appendRow(OMS_SHEETS.AUDIT, [
      new Date(),
      actor.type,
      actor.id,
      actor.name,
      actor.role,
      action,
      entity,
      entityId,
      oldValue === undefined || oldValue === null ? '' : String(oldValue),
      newValue === undefined || newValue === null ? '' : String(newValue),
      details || '',
    ]);
  } catch {
    /* swallow */
  }
}

export interface AuditEntry {
  timestamp: string;
  actorType: string;
  actorName: string;
  role: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue: string;
  newValue: string;
  details: string;
}

export interface AuditFilter {
  actor?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function getAuditLog(filter: AuditFilter = {}): Promise<AuditEntry[]> {
  const { rows } = await readSheet(OMS_SHEETS.AUDIT);
  let out: (AuditEntry & { _raw?: Date })[] = [];
  for (const r of rows) {
    if (!r[0]) continue;
    out.push({
      timestamp: fmtNice(r[0] as string),
      actorType: String(r[1] ?? '').trim(),
      actorName: String(r[3] ?? '').trim(),
      role: String(r[4] ?? '').trim(),
      action: String(r[5] ?? '').trim(),
      entity: String(r[6] ?? '').trim(),
      entityId: String(r[7] ?? '').trim(),
      oldValue: String(r[8] ?? ''),
      newValue: String(r[9] ?? ''),
      details: String(r[10] ?? ''),
      _raw: parseSheetDate(r[0]) ?? undefined,
    });
  }
  out.reverse();
  const f = filter;
  if (f.actor) out = out.filter((e) => e.actorName.toLowerCase().includes(f.actor!.toLowerCase()));
  if (f.action) out = out.filter((e) => e.action === f.action);
  if (f.entity) out = out.filter((e) => e.entity === f.entity);
  if (f.entityId) out = out.filter((e) => e.entityId === f.entityId);
  if (f.from) out = out.filter((e) => e._raw! >= new Date(f.from!));
  if (f.to) out = out.filter((e) => e._raw! <= new Date(f.to! + 'T23:59:59'));
  out.forEach((e) => delete e._raw);
  return f.limit ? out.slice(0, f.limit) : out;
}
