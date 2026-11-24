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
 *
 * `fresh: true` skips the cache read (the result still refreshes it). A sync
 * only clears the cache of the server instance it ran on; other instances —
 * including the one serving the burndown — keep their copy for up to the TTL,
 * so a page that must show a just-finished sync asks for fresh rows.
 */
export async function fetchSheetRows(
  { fresh = false }: { fresh?: boolean } = {},
): Promise<string[][]> {
  // Check cache
  const now = Date.now();
  if (!fresh && cachedRows && lastFetchedAt && now - lastFetchedAt < CACHE_TTL_MS) {
    console.log('[sheets] Returning cached rows');
    return cachedRows;
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth: getReadAuth() });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
      range: process.env.GOOGLE_SHEET_RANGE ?? 'Sprints!A:X',
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
    range: `'${SHEET_NAME}'!A:X`,
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
 * Write single cells in column X ("Date Added to Sprint") for the given rows.
 * Targets only column X so the formula columns M–W are never touched.
 * Each entry: { rowNumber (1-based), value }.
 */
export async function batchUpdateColumnX(
  updates: Array<{ rowNumber: number; value: string }>,
): Promise<void> {
  if (updates.length === 0) return;

  const sheets = getWriteClient();
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates.map((u) => ({
        range: `'${SHEET_NAME}'!X${u.rowNumber}`,
        values: [[u.value]],
      })),
    },
  });
}

/**
 * Get the numeric sheet tab ID needed for structural operations (insert/delete
 * rows), plus the tab's current grid row count.
 */
export async function getSheetTab(): Promise<{ sheetId: number; rowCount: number }> {
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

  return {
    sheetId: tab.properties.sheetId,
    rowCount: tab.properties.gridProperties?.rowCount ?? 0,
  };
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
  const { sheetId, rowCount } = await getSheetTab();

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
            // Normally inherit from the row below. When the sprint was the last
            // block on the sheet, its rows were deleted off the end of the grid, so
            // startIndex == rowCount and there is no row below — the API rejects
            // that unless we inherit from the row above instead.
            inheritFromBefore: afterRow >= rowCount,
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
 *
 * Consecutive rows are collapsed into a single deleteDimension range, and the
 * ranges are applied bottom-to-top so row numbers stay valid as we go.
 *
 * The merge is not a micro-optimisation: every deleteDimension request forces
 * the row-2 ARRAYFORMULAs (open ranges like L3:L, spilling into M–W) to
 * recalculate the entire sheet. One-request-per-row cost ~80ms each, so a
 * 554-row sprint spent ~45s here and blew the request timeout mid-sync —
 * leaving the section deleted and not yet rewritten. A sprint's rows sit in one
 * contiguous block, so this normally collapses to a single request.
 *
 * Returns the number of ranges actually sent — if that ever climbs back into
 * the hundreds, the sprint's rows have become fragmented and the sync is at
 * risk of timing out again.
 */
export async function deleteSheetRows(rowNumbers: number[]): Promise<number> {
  if (rowNumbers.length === 0) return 0;

  const { sheetId } = await getSheetTab();

  // Ascending + de-duped, so consecutive runs are adjacent and mergeable.
  const sorted = [...new Set(rowNumbers)].sort((a, b) => a - b);

  // 1-based, inclusive on both ends.
  const ranges: Array<{ start: number; end: number }> = [];
  for (const row of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && row === last.end + 1) last.end = row;
    else ranges.push({ start: row, end: row });
  }

  // Bottom-to-top: deleting a lower block never shifts the blocks above it.
  ranges.reverse();

  const sheets = getWriteClient();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    requestBody: {
      requests: ranges.map((r) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: r.start - 1, // 1-based inclusive -> 0-based inclusive
            endIndex: r.end, // 1-based inclusive -> 0-based exclusive
          },
        },
      })),
    },
  });

  return ranges.length;
}

// ─── Sync Log tab: run lock + last successful sync per sprint ────────────────

/**
 * A small tab the sync keeps for itself, separate from the data tab:
 *   Row 1  = headers.
 *   Row 2  = the run lock: B2 = when it was taken (ISO, UTC), C2 = who holds it.
 *   Row 3+ = one row per sprint: name, last successful sync (ISO, UTC), what
 *            triggered it ("manual" / "scheduled"), task count.
 *
 * The lock exists because the sync deletes a sprint's rows and re-inserts them:
 * two overlapping runs (a scheduled one plus a manual click) would
 * delete by stale row numbers and duplicate or drop rows. The sync time feeds
 * the burndown's "last synced" line so stale data is visible, not silent.
 */
const SYNC_LOG_SHEET = 'Sync Log';
const SYNC_LOG = `'${SYNC_LOG_SHEET}'`;
const SYNC_LOG_HEADER = ['Sprint', 'Last Synced (UTC)', 'Trigger', 'Tasks'];
const SYNC_LOCK_LABEL = '(run lock)';
const SYNC_LOG_FIRST_SPRINT_ROW = 3;

let syncLogReady = false; // per server instance: skip the tab check once done

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Create the Sync Log tab (headers + lock label) if it doesn't exist yet. */
async function ensureSyncLogSheet(sheets: sheets_v4.Sheets): Promise<void> {
  if (syncLogReady) return;
  const spreadsheetId = process.env.GOOGLE_SHEET_ID!;

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SYNC_LOG_SHEET);

  if (!exists) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: SYNC_LOG_SHEET } } }] },
      });
    } catch (err) {
      // Another run created it a moment ago — fine.
      if (!/already exists/i.test(String(err))) throw err;
    }
    // Write only the header and the lock label — never B2:C2, so creating the
    // tab can't wipe a lock another run has just taken.
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [
          { range: `${SYNC_LOG}!A1:D1`, values: [SYNC_LOG_HEADER] },
          { range: `${SYNC_LOG}!A2`, values: [[SYNC_LOCK_LABEL]] },
        ],
      },
    });
  }
  syncLogReady = true;
}

async function readSyncLock(
  sheets: sheets_v4.Sheets,
): Promise<{ since: string; heldBy: string }> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `${SYNC_LOG}!B2:C2`,
  });
  const [since = '', heldBy = ''] = res.data.values?.[0] ?? [];
  return { since: String(since), heldBy: String(heldBy) };
}

export type SyncLockResult =
  | { acquired: true }
  | { acquired: false; heldBy: string; since: string };

/**
 * Take the sync run lock. A lock older than `ttlMs` is treated as abandoned (a
 * run killed by the platform timeout never releases it).
 *
 * Sheets has no compare-and-set, so this is write-then-confirm: two runs that
 * both see the lock free both write it, the later write wins, and after a short
 * pause each re-reads — only the run whose name is still there proceeds.
 */
export async function acquireSyncLock(holder: string, ttlMs: number): Promise<SyncLockResult> {
  const sheets = getWriteClient();
  await ensureSyncLogSheet(sheets);

  const current = await readSyncLock(sheets);
  // Blank/unparseable time → free. A slightly negative age (clock skew between
  // server instances) still counts as held.
  const age = Date.now() - Date.parse(current.since);
  if (current.heldBy && !Number.isNaN(age) && age < ttlMs) {
    return { acquired: false, ...current };
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `${SYNC_LOG}!B2:C2`,
    valueInputOption: 'RAW',
    requestBody: { values: [[new Date().toISOString(), holder]] },
  });

  await sleepMs(750);
  const after = await readSyncLock(sheets);
  if (after.heldBy !== holder) return { acquired: false, ...after };
  return { acquired: true };
}

/** Release the run lock — only if this run still holds it. */
export async function releaseSyncLock(holder: string): Promise<void> {
  const sheets = getWriteClient();
  const current = await readSyncLock(sheets);
  if (current.heldBy !== holder) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `${SYNC_LOG}!B2:C2`,
    valueInputOption: 'RAW',
    requestBody: { values: [['', '']] },
  });
}

/** Record a successful sync of `sprintName` (upserts that sprint's row). */
export async function recordSprintSync(
  sprintName: string,
  trigger: string,
  totalTasks: number,
): Promise<void> {
  const sheets = getWriteClient();
  await ensureSyncLogSheet(sheets);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `${SYNC_LOG}!A${SYNC_LOG_FIRST_SPRINT_ROW}:A`,
  });
  const names = (res.data.values ?? []).map((r) => String(r[0] ?? '').trim());
  const idx = names.indexOf(sprintName.trim());
  const rowNumber = SYNC_LOG_FIRST_SPRINT_ROW + (idx >= 0 ? idx : names.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: `${SYNC_LOG}!A${rowNumber}:D${rowNumber}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[sprintName.trim(), new Date().toISOString(), trigger, String(totalTasks)]],
    },
  });
}

export interface LastSync {
  at: string; // ISO, UTC
  trigger: string; // "manual" | "scheduled"
}

/**
 * When `sprintName` was last synced successfully and what triggered it, or null
 * when no sync has been recorded yet or the Sync Log can't be read. Never
 * throws — the burndown must still render if this lookup fails.
 */
export async function getLastSync(sprintName: string): Promise<LastSync | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getReadAuth() });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID!,
      range: `${SYNC_LOG}!A${SYNC_LOG_FIRST_SPRINT_ROW}:C`,
    });
    const target = sprintName.trim();
    const row = (res.data.values ?? []).find((r) => String(r[0] ?? '').trim() === target);
    const at = row?.[1] ? String(row[1]) : '';
    if (!at || Number.isNaN(Date.parse(at))) return null;
    return { at, trigger: String(row?.[2] ?? '') };
  } catch (err) {
    console.warn('[sheets] Could not read the Sync Log:', String(err));
    return null;
  }
}
