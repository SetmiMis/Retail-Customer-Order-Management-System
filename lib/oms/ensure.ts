import { OMS_SHEETS, HEADERS } from './constants';
import { getTabTitles, ensureTab, readHeaderRow, writeHeaderRow, ensureColumns } from '../sheets/admin';
import { appendRow, readSheet } from '../sheets/rows';
import { hashPassword } from '../auth/hash';

/**
 * Idempotent, self-healing schema bootstrap for every OMS_* tab:
 *  - creates any missing tab and writes its header row,
 *  - additively appends new columns to tabs that predate a feature
 *    (never reorders / removes existing columns or touches data rows),
 *  - seeds one Admin staff login ONLY if OMS_Users is still empty.
 * Safe to run repeatedly against a sheet that already holds live data.
 * Does NOT touch any PFMS_* or CRM tab.
 */
export async function ensureSheets(): Promise<{
  created: string[];
  managedTabs: string[];
  columnsAdded: Record<string, string[]>;
  seededAdmin: boolean;
}> {
  const created: string[] = [];
  const columnsAdded: Record<string, string[]> = {};

  const managed = Object.values(OMS_SHEETS);
  const existing = new Set(await getTabTitles());

  for (const tab of managed) {
    const headers = HEADERS[tab as keyof typeof HEADERS];
    if (!headers) continue;
    if (!existing.has(tab)) {
      await ensureTab(tab);
      await writeHeaderRow(tab, headers);
      created.push(tab);
    } else {
      const have = await readHeaderRow(tab);
      if (have.filter(Boolean).length === 0) {
        await writeHeaderRow(tab, headers);
      } else {
        const added = await ensureColumns(tab, headers);
        if (added.length) columnsAdded[tab] = added;
      }
    }
  }

  let seededAdmin = false;
  const { rows } = await readSheet(OMS_SHEETS.STAFF);
  if (rows.filter((r) => r[0]).length === 0) {
    await appendRow(OMS_SHEETS.STAFF, [
      'USR-0001', 'Administrator', 'admin@setmiindia.org', 'admin',
      hashPassword('Admin@123'), 'ADMIN', 'Active', new Date(), '',
    ]);
    seededAdmin = true;
  }

  return { created, managedTabs: managed, columnsAdded, seededAdmin };
}
