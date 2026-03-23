import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import { computeBurndown } from '@/lib/burndown-engine';
import { BurndownRequest, BurndownResponse } from '@/types/burndown';

/**
 * POST /api/burndown
 * Request body: { sprintId, allottedPoints }
 * Returns computed burndown chart data
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as BurndownRequest;

    // Validate request
    if (!body.sprintId) {
      return NextResponse.json(
        { error: 'Missing sprintId in request body' },
        { status: 400 }
      );
    }

    if (typeof body.allottedPoints !== 'number' || body.allottedPoints <= 0) {
      return NextResponse.json(
        { error: 'allottedPoints must be a positive number' },
        { status: 400 }
      );
    }

    // Fetch and parse sheet data
    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);

    // Filter to selected sprint
    const selectedSprintRows = sprintRows.filter((row) => row.sprint === body.sprintId);

    if (selectedSprintRows.length === 0) {
      return NextResponse.json(
        { error: `Sprint not found: ${body.sprintId}` },
        { status: 404 }
      );
    }

    // Compute burndown
    const result = computeBurndown(selectedSprintRows, body.allottedPoints);

    const response: BurndownResponse = {
      sprintId: body.sprintId,
      ...result,
      computedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/burndown]', error);
    return NextResponse.json(
      { error: `Failed to compute burndown: ${String(error)}` },
      { status: 500 }
    );
  }
}
