import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import { getUniqueSprints } from '@/lib/burndown-engine';
import { SprintListResponse } from '@/types/sprint';

/**
 * GET /api/sprints
 * Returns list of unique sprints sorted reverse-chronologically
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);
    const sprints = getUniqueSprints(sprintRows);

    const response: SprintListResponse = { sprints };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/sprints]', error);
    return NextResponse.json(
      { error: `Failed to fetch sprints: ${String(error)}` },
      { status: 500 }
    );
  }
}
