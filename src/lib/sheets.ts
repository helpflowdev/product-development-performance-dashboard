import { google, sheets_v4 } from 'googleapis';

/**
 * Module-level cache with 60-second TTL
 */
let cachedRows: string[][] | null = null;
let lastFetchedAt: number | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

const SHEET_NAME = 'RAW data format - Sprints';

/**
 * Get read-only auth for normal dashboard operations
 */
function getReadAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
}

/**
 * Get read/write auth for sync operations
 */
function getWriteAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

/**
 * Get a Sheets API client with write access
 */
function getWriteClient(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getWriteAuth() });
}

/**
 * Fetch raw rows from Google Sheets API
 * Returns a 2D array where each row is an array of cell values
 * Uses service account authentication
 *
 * Includes in-process cache (60-second TTL) to avoid hitting the API quota
 * (60 reads/minute per project)
 */
export async function fetchSheetRows(): Promise<string[][]> {
  // Check cache
  const now = Date.now();
  if (cachedRows && lastFetchedAt && now - lastFetchedAt < CACHE_TTL_MS) {
    console.log('[sheets] Returning cached rows');
    return cachedRows;
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getReadAuth() });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
      range: process.env.GOOGLE_SHEET_RANGE ?? 'Sprints!A:W',
    });

    const rows = response.data.values ?? [];
    console.log(`[sheets] Fetched ${rows.length} rows`);

    // Update cache
    cachedRows = rows;
    lastFetchedAt = now;

    return rows;
  } catch (error) {
    console.error('[sheets] Failed to fetch rows:', error);
    throw new Error(`Failed to fetch from Google Sheets: ${String(error)}`);
  }
}

/**
 * Invalidate the cache (useful for testing or manual refreshes)
 */
export function invalidateSheetCache(): void {
  cachedRows = null;
  lastFetchedAt = null;
  console.log('[sheets] Cache invalidated');
}

// ─── Write operations (used by sync-engine) ──────────────────────────────────

/**
 * Fetch fresh rows bypassing cache. Used during sync to get current sheet state.
 */
export async function fetchSheetRowsForSync(): Promise<string[][]> {
  const sheets = getWriteClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `'${SHEET_NAME}'!A:W`,
  });
  return response.data.values ?? [];
}

/**
 * Update a single row's columns A-L in the sheet.
 */
export async function updateSheetRow(
  rowNumber: number,
  values: string[],
): Promise<void> {
  const sheets = getWriteClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `'${SHEET_NAME}'!A${rowNumber}:L${rowNumber}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [values] },
  });
}

/**
 * Batch update multiple rows (columns A-L each).
 * Each entry: { rowNumber, values }
 */
export async function batchUpdateSheetRows(
  updates: Array<{ rowNumber: number; values: string[] }>,
): Promise<void> {
  if (updates.length === 0) return;

  const sheets = getWriteClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map((u) => ({
        range: `'${SHEET_NAME}'!A${u.rowNumber}:L${u.rowNumber}`,
        values: [u.values],
      })),
    },
  });
}

/**
 * Get the numeric sheet tab ID needed for structural operations (insert/delete rows).
 */
export async function getSheetTabId(): Promise<number> {
  const sheets = getWriteClient();
  const response = await sheets.spreadsheets.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    fields: 'sheets.properties',
  });

  const tab = response.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAME,
  );

  if (!tab?.properties?.sheetId && tab?.properties?.sheetId !== 0) {
    throw new Error(`Sheet tab "${SHEET_NAME}" not found`);
  }

  return tab.properties.sheetId;
}

/**
 * Insert new rows after a specific row position and write values to them.
 * afterRow is 1-based (sheet row number).
 */
export async function insertSheetRows(
  afterRow: number,
  values: string[][],
): Promise<void> {
  if (values.length === 0) return;

  const sheets = getWriteClient();
  const sheetId = await getSheetTabId();

  // Insert empty rows after the specified row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: afterRow, // 0-based: afterRow (1-based) maps to index afterRow
              endIndex: afterRow + values.length,
            },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  // Write values into the newly inserted rows (columns A-L)
  const startRow = afterRow + 1; // 1-based row number for the first new row
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `'${SHEET_NAME}'!A${startRow}:L${startRow + values.length - 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

/**
 * Append rows to the end of the sheet (columns A-L).
 */
export async function appendSheetRows(values: string[][]): Promise<void> {
  if (values.length === 0) return;

  const sheets = getWriteClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `'${SHEET_NAME}'!A:L`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

/**
 * Delete rows by their 1-based row numbers.
 * Rows are deleted from bottom to top to preserve indices.
 */
export async function deleteSheetRows(rowNumbers: number[]): Promise<void> {
  if (rowNumbers.length === 0) return;

  const sheetId = await getSheetTabId();
  // Sort descending so deletions don't shift indices
  const sorted = [...rowNumbers].sort((a, b) => b - a);

  const sheets = getWriteClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    requestBody: {
      requests: sorted.map((row) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: row - 1, // convert 1-based to 0-based
            endIndex: row,
          },
        },
      })),
    },
  });
}
