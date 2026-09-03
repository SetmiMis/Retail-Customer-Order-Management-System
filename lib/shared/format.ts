/*****************************************************************
 * Date helpers — everything renders in Asia/Kolkata regardless of the
 * server timezone. Trimmed to what OMS actually uses (fmtNice, monthKey,
 * parseSheetDate); ported from the Apps Script Purchase FMS.
 *****************************************************************/

const TZ = 'Asia/Kolkata';

/**
 * Normalises whatever a Sheets cell hands back into a Date. A cell stored with
 * no date format comes back as a serial number (days since 1899-12-30, sheet
 * timezone) — those are far too small to be epoch-ms, so treat any number below
 * ~1e8 as a serial. Real Date objects / ISO strings pass straight through.
 */
function toDate(d: Date | string | number): Date {
  if (d instanceof Date) return d;
  if (typeof d === 'number' && isFinite(d) && Math.abs(d) < 1e8) {
    return new Date(Math.round((d - 25569) * 86400000));
  }
  return new Date(d);
}
const isSerial = (d: unknown): d is number => typeof d === 'number' && isFinite(d) && Math.abs(d) < 1e8;

/** dd MMM yyyy for display. */
export function fmtNice(d: Date | string | number | null | undefined): string {
  if (!d) return '';
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return '';
  const tz = isSerial(d) ? 'UTC' : TZ;
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' }).format(dt);
}

/** yyyy-MM for monthly trend grouping. */
export function monthKey(d: Date | string | number | null | undefined): string {
  if (!d) return '';
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return '';
  const tz = isSerial(d) ? 'UTC' : TZ;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(dt).slice(0, 7);
}

/** Parse any Sheets date/datetime cell (Date, ISO string, or serial number) to a Date, or null. */
export function parseSheetDate(v: unknown): Date | null {
  if (v === '' || v == null) return null;
  const d = toDate(v as Date | string | number);
  return isNaN(d.getTime()) ? null : d;
}
