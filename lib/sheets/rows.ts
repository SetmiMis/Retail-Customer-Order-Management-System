import { sheetsApi, sheetId } from './client';
import { DATE_COLS } from '../oms/constants';
import { fmtNice } from '../shared/format';

/*****************************************************************
 * Thin row/range helpers over the Sheets v4 API. Same shape as
 * purchase-fms/lib/sheets/rows.ts — tab names are passed as literal strings.
 *****************************************************************/

export type ColMap = Record<string, number>;

/** header name -> column index. */
export function colMapFromRow(headerRow: unknown[]): ColMap {
  const m: ColMap = {};
  headerRow.forEach((h, i) => {
    m[String(h ?? '').trim()] = i;
  });
  return m;
}

export interface SheetData {
  header: unknown[];
  rows: unknown[][];
  map: ColMap;
}

const RANGE = (tab: string) => `${tab}!A1:BZ`;

/** Reads one tab (header + body), single round trip. `spreadsheetId` defaults to
 *  the OMS sheet; pass `pfmsSheetId()` to read the Requirement System's sheet. */
export async function readSheet(tab: string, spreadsheetId: string = sheetId()): Promise<SheetData> {
  const { data } = await sheetsApi().spreadsheets.values.get({
    spreadsheetId,
    range: RANGE(tab),
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const values = data.values ?? [];
  const [header = [], ...rows] = values;
  return { header, rows, map: colMapFromRow(header) };
}

/** Reads many tabs in one HTTP round trip. */
export async function readSheets(tabs: string[], spreadsheetId: string = sheetId()): Promise<Record<string, SheetData>> {
  const { data } = await sheetsApi().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: tabs.map(RANGE),
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  });
  const out: Record<string, SheetData> = {};
  (data.valueRanges ?? []).forEach((vr, i) => {
    const values = vr.values ?? [];
    const [header = [], ...rows] = values;
    out[tabs[i]] = { header, rows, map: colMapFromRow(header) };
  });
  return out;
}

/** Appends one row. */
export async function appendRow(tab: string, row: unknown[], spreadsheetId: string = sheetId()): Promise<void> {
  await sheetsApi().spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });
}

/** Appends many rows in one call. */
export async function appendRows(tab: string, rows: unknown[][], spreadsheetId: string = sheetId()): Promise<void> {
  if (!rows.length) return;
  await sheetsApi().spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A1`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  });
}

export function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Overwrites one row in place. rowIndex1Based counts the header as row 1 (first data row = 2). */
export async function updateRow(tab: string, rowIndex1Based: number, row: unknown[]): Promise<void> {
  await sheetsApi().spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${tab}!A${rowIndex1Based}:${colLetter(row.length)}${rowIndex1Based}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

/** Sets a single cell (1-based row/col). */
export async function setCell(tab: string, row1Based: number, col1Based: number, value: unknown): Promise<void> {
  await sheetsApi().spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${tab}!${colLetter(col1Based)}${row1Based}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[value]] },
  });
}

/** Writes several individual cells in one batch call. */
export async function setCells(
  tab: string,
  cells: Array<{ row1Based: number; col1Based: number; value: unknown }>,
  spreadsheetId: string = sheetId(),
): Promise<void> {
  if (!cells.length) return;
  await sheetsApi().spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: cells.map((c) => ({
        range: `${tab}!${colLetter(c.col1Based)}${c.row1Based}`,
        values: [[c.value]],
      })),
    },
  });
}

/**
 * Next sequential ID: `prefix` + zero-padded numeric suffix (max existing + 1).
 * `colIdx` is the ID column's 0-based index. `pad` defaults to 4.
 */
export function nextId(prefix: string, rows: unknown[][], colIdx: number, pad = 4): string {
  const taken = new Set<string>();
  let max = 0;
  for (const row of rows) {
    const id = String(row[colIdx] ?? '').trim();
    if (!id) continue;
    taken.add(id);
    const m = id.slice(id.lastIndexOf('-') + 1);
    const n = Number(m);
    if (m && !isNaN(n) && n > max) max = n;
  }
  let next = max + 1;
  let id = prefix + String(next).padStart(pad, '0');
  while (taken.has(id)) {
    next += 1;
    id = prefix + String(next).padStart(pad, '0');
  }
  return id;
}

/**
 * Sales-order id: SO-YYYY-NNNNNN, sequence global (not per-year) so it never
 * collides regardless of year rollover. `rows` = OMS_Orders data rows, col 0 = OrderID.
 */
export function nextOrderId(rows: unknown[][]): string {
  let max = 0;
  const taken = new Set<string>();
  for (const row of rows) {
    const id = String(row[0] ?? '').trim();
    if (!id) continue;
    taken.add(id);
    const m = id.match(/SO-\d{4}-(\d+)/);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  const year = new Date().getFullYear();
  let next = max + 1;
  let id = `SO-${year}-${String(next).padStart(6, '0')}`;
  while (taken.has(id)) {
    next += 1;
    id = `SO-${year}-${String(next).padStart(6, '0')}`;
  }
  return id;
}

/** Maps a raw row to a header-keyed object, rendering DATE_COLS via fmtNice. */
export function rowToObj<T = Record<string, unknown>>(row: unknown[], map: ColMap): T {
  const o: Record<string, unknown> = {};
  for (const k of Object.keys(map)) {
    let v = row[map[k]];
    if (DATE_COLS.has(k)) v = v ? fmtNice(v as string) : '';
    o[k] = v === null || v === undefined ? '' : v;
  }
  return o as T;
}
