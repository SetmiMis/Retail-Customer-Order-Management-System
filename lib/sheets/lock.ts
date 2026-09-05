import { sheetsApi, sheetId } from './client';

/*****************************************************************
 * Advisory cross-invocation lock backed by a single cell.
 *
 * The Sheets API has no atomic compare-and-set, so this is best-effort:
 * a writer stamps its token + timestamp, waits briefly, re-reads, and only
 * proceeds if its token is still there (last-writer-wins on the stamp).
 * A stale claim (older than LEASE_MS) can be stolen. Good enough to
 * serialise the low-frequency ID-generating writes (REQ- / ORD- / RCV-)
 * so two near-simultaneous approvals don't mint the same sequential id.
 *
 * The lock cell must live on the SAME spreadsheet as the writes it's
 * guarding — locking sheet A while the guarded reads/writes hit sheet B
 * provides zero mutual exclusion. Callers that write to a different
 * spreadsheet (the requirement bridge writes to the PFMS sheet, not this
 * app's own) must pass that spreadsheet id explicitly.
 *****************************************************************/

const LOCK_TAB = 'PFMS_Sys';
const LEASE_MS = 20_000;
const MAX_TRIES = 12;

const readyTabs = new Set<string>();
async function ensureLockTab(spreadsheetId: string) {
  if (readyTabs.has(spreadsheetId)) return;
  const { data } = await sheetsApi().spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.title' });
  const titles = (data.sheets ?? []).map((s) => s.properties?.title ?? '');
  if (!titles.includes(LOCK_TAB)) {
    await sheetsApi().spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: LOCK_TAB } } }] },
    });
  }
  readyTabs.add(spreadsheetId);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readClaim(spreadsheetId: string): Promise<{ token: string; at: number }> {
  const { data } = await sheetsApi().spreadsheets.values.get({
    spreadsheetId,
    range: `${LOCK_TAB}!A1:B1`,
  });
  const row = data.values?.[0] ?? [];
  return { token: String(row[0] ?? ''), at: Number(row[1] ?? 0) || 0 };
}

async function writeClaim(spreadsheetId: string, token: string, at: number) {
  await sheetsApi().spreadsheets.values.update({
    spreadsheetId,
    range: `${LOCK_TAB}!A1:B1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[token, at]] },
  });
}

/** Runs `fn` while holding the lock on `spreadsheetId` (this app's own sheet by default).
 *  Falls through (runs anyway) if it can't be acquired within the retry budget —
 *  correctness of the ids still degrades gracefully. */
export async function withLock<T>(fn: () => Promise<T>, spreadsheetId: string = sheetId()): Promise<T> {
  try {
    await ensureLockTab(spreadsheetId);
    const me = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (let i = 0; i < MAX_TRIES; i++) {
      const cur = await readClaim(spreadsheetId);
      const free = !cur.token || Date.now() - cur.at > LEASE_MS;
      if (free) {
        await writeClaim(spreadsheetId, me, Date.now());
        await sleep(180);
        const check = await readClaim(spreadsheetId);
        if (check.token === me) {
          try {
            return await fn();
          } finally {
            try {
              const still = await readClaim(spreadsheetId);
              if (still.token === me) await writeClaim(spreadsheetId, '', 0);
            } catch {
              /* lease will expire on its own */
            }
          }
        }
      }
      await sleep(250 + Math.floor(Math.random() * 400));
    }
  } catch {
    /* lock infra unavailable — run unguarded rather than block the user */
  }
  return fn();
}
