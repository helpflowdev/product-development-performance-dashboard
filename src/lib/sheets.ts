import { google } from 'googleapis';

/**
 * Module-level cache with 60-second TTL
 */
let cachedRows: string[][] | null = null;
let lastFetchedAt: number | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

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
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
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
