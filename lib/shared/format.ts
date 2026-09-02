/*****************************************************************
 * Date / number helpers — ported from the Apps Script Purchase FMS
 * (VendoreCode.js: fmtDate_, fmtNice_, todayStr_, waPhone_;
 *  PFMSCode.js: pfmsNowStr_). Everything renders in Asia/Kolkata
 * regardless of the server timezone, matching the original app.
 *****************************************************************/

export const TZ = 'Asia/Kolkata';

/**
 * Normalises whatever a Sheets cell hands back into a Date.
 * A plain "yyyy-MM-dd" / ISO string that the API stored WITHOUT a date number
 * format comes back as a serial number (days since 1899-12-30, in the sheet's
 * timezone) — those are far too small to be epoch-ms, so treat any number
 * below ~1e8 as a serial. Real Date objects / ISO strings pass straight through.
 */
function toDate(d: Date | string | number): Date {
  if (d instanceof Date) return d;
  if (typeof d === 'number' && isFinite(d) && Math.abs(d) < 1e8) {
    // Serial's wall-clock is Asia/Kolkata; keep those parts by building a UTC date.
    return new Date(Math.round((d - 25569) * 86400000));
  }
  return new Date(d);
}
const isSerial = (d: unknown): d is number => typeof d === 'number' && isFinite(d) && Math.abs(d) < 1e8;

/** yyyy-MM-dd in Asia/Kolkata (= Apps Script fmtDate_). */
export function fmtDate(d: Date | string | number | null | undefined): string {
  if (!d) return '';
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return '';
  const tz = isSerial(d) ? 'UTC' : TZ;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(dt);
}

/** dd MMM yyyy for display (= Apps Script fmtNice_). */
export function fmtNice(d: Date | string | number | null | undefined): string {
  if (!d) return '';
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return '';
  const tz = isSerial(d) ? 'UTC' : TZ;
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: 'short', year: 'numeric' }).format(dt);
}

/** yyyy-MM-dd HH:mm:ss in Asia/Kolkata (= Apps Script pfmsNowStr_). */
export function nowStr(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}`;
}

export function todayStr(): string {
  return fmtDate(new Date());
}

/** yyyy-MM for monthly trend grouping. */
export function monthKey(d: Date | string | number | null | undefined): string {
  if (!d) return '';
  const dt = toDate(d);
  if (isNaN(dt.getTime())) return '';
  const tz = isSerial(d) ? 'UTC' : TZ;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(dt).slice(0, 7);
}

/** Tolerant number parse — strips anything that isn't a digit / sign / dot. */
export function num(v: unknown): number {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

/** Phone normalized to a wa.me-compatible number with country code (= Apps Script waPhone_). */
export function waPhone(phone: unknown): string {
  let p = String(phone || '').replace(/\D/g, '');
  if (p.length === 10) p = '91' + p;
  return p;
}

/** Parse any Sheets date/datetime cell (Date, ISO string, or serial number) to a Date, or null. */
export function parseSheetDate(v: unknown): Date | null {
  if (v === '' || v == null) return null;
  const d = toDate(v as Date | string | number);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Renders a value read from a Sheets DateTime cell. The API returns these as a serial
 * number (days since 1899-12-30, in the sheet's timezone) when the column has no date
 * format; older rows written as "yyyy-MM-dd HH:mm:ss" strings come back parsed to that
 * serial too. Anything already a plain string is passed through.
 */
export function sheetDateTime(v: unknown): string {
  if (v === '' || v == null) return '';
  let d: Date;
  let tz = 'UTC';
  if (typeof v === 'number' && isFinite(v)) {
    d = new Date(Math.round((v - 25569) * 86400000)); // serial's wall-clock is already Asia/Kolkata
  } else {
    const s = String(v).trim();
    // "yyyy-MM-dd HH:mm:ss" (from nowStr) is Asia/Kolkata wall-clock with no zone marker.
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
    if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    else { d = new Date(s); tz = TZ; }
    if (isNaN(d.getTime())) return s;
  }
  if (isNaN(d.getTime())) return String(v);
  const p = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d).reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** Whole-days difference (b - a), floor. Used for cycle-time analytics. */
export function daysBetween(a: Date | string | number, b: Date | string | number): number {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return 0;
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}
