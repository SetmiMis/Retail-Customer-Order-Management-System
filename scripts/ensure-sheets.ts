/**
 * Standalone schema bootstrap runner.
 *   npm run ensure-sheets
 * Needs the same env as the app (GOOGLE_SHEET_ID, GCP_*). Normally you'd just
 * call POST /api/staff/admin/ensure-sheets from the running app as an ADMIN.
 */
import { ensureSheets } from '../lib/oms/ensure';

ensureSheets()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
