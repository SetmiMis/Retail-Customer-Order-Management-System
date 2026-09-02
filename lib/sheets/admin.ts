import { sheetsApi, sheetId } from './client';

/** Tab titles currently in the spreadsheet. */
export async function getTabTitles(): Promise<string[]> {
  const { data } = await sheetsApi().spreadsheets.get({
    spreadsheetId: sheetId(),
    fields: 'sheets.properties.title',
  });
  return (data.sheets ?? []).map((s) => s.properties?.title ?? '').filter(Boolean);
}

/** Creates a tab if it doesn't exist. Returns true if it was created. */
export async function ensureTab(title: string): Promise<boolean> {
  const titles = await getTabTitles();
  if (titles.includes(title)) return false;
  await sheetsApi().spreadsheets.batchUpdate({
    spreadsheetId: sheetId(),
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return true;
}

/** Reads a tab's header row (first row) as trimmed strings. */
export async function readHeaderRow(title: string): Promise<string[]> {
  const { data } = await sheetsApi().spreadsheets.values.get({
    spreadsheetId: sheetId(),
    range: `${title}!1:1`,
  });
  return (data.values?.[0] ?? []).map((h) => String(h ?? '').trim());
}

/** Writes the header row (row 1) for a tab. */
export async function writeHeaderRow(title: string, headers: readonly string[]): Promise<void> {
  await sheetsApi().spreadsheets.values.update({
    spreadsheetId: sheetId(),
    range: `${title}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [headers as string[]] },
  });
}

/** Clears every data row of a tab (row 2 downward), leaving the header intact. */
export async function clearTabData(title: string): Promise<void> {
  await sheetsApi().spreadsheets.values.clear({
    spreadsheetId: sheetId(),
    range: `${title}!A2:AZ`,
  });
}

/** Appends any missing columns to the end of a tab's header row (never reorders existing ones).
 *  Mirrors Apps Script pfmsEnsureColumns_(). */
export async function ensureColumns(title: string, wantCols: readonly string[]): Promise<string[]> {
  const have = await readHeaderRow(title);
  const missing = wantCols.filter((c) => !have.includes(c));
  if (!missing.length) return [];
  const merged = [...have, ...missing];
  await writeHeaderRow(title, merged);
  return missing;
}
