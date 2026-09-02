/**
 * Creates the "OMS Bot" row in PFMS_Users (the account OMS attributes
 * customer-order requirements to) and prints its UserID for PFMS_BOT_USER_ID.
 *   npm run add-bot-user
 * Needs GOOGLE_SHEET_ID + GCP_* env (same as the app). Safe to re-run — it
 * won't add a duplicate. The bot never signs in; the password is random.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readSheet, appendRow } from '../lib/sheets/rows';

const TAB = 'PFMS_Users';
// UserID, Name, Email, Username, PassHash, Role, Department, Status, CreatedAt, Phone
const BOT_ID = 'OMSBOT';
const BOT_USERNAME = 'oms-bot';

function pfmsHash(pass: string, username: string): string {
  return createHash('sha256').update(`${pass}::${username.toLowerCase()}::pfms-setmi`).digest('hex');
}

(async () => {
  let rows: unknown[][];
  try {
    ({ rows } = await readSheet(TAB));
  } catch (e) {
    console.error(`Could not read ${TAB}. Is GOOGLE_SHEET_ID the Purchase FMS sheet, and does that tab exist?`);
    console.error(e);
    process.exit(1);
  }

  const existing = rows.find(
    (r) => String(r[0]).trim() === BOT_ID || String(r[3]).trim().toLowerCase() === BOT_USERNAME,
  );
  if (existing) {
    console.log(`OMS Bot already exists.\n\nPFMS_BOT_USER_ID=${String(existing[0]).trim()}`);
    process.exit(0);
  }

  await appendRow(TAB, [
    BOT_ID, 'OMS Bot', '', BOT_USERNAME, pfmsHash(randomBytes(24).toString('hex'), BOT_USERNAME),
    'REQUIREMENT_USER', 'Sales', 'Active', new Date(), '',
  ]);
  console.log(`Created "OMS Bot" in ${TAB}.\n\nPaste this into oms/.env.local (and Vercel):\n\nPFMS_BOT_USER_ID=${BOT_ID}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
