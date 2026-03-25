import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import { computeSprintStats, filterBySprints } from '@/lib/completion-rate-engine';
import { CompareSprintsRequest, CompareSprintsResponse } from '@/types/completion-rate';

/**
 * POST /api/completion-rate/compare
 * Request body: { sprintIds: [sprintIdA, sprintIdB] }
 * Returns side-by-side completion stats for two sprints
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CompareSprintsRequest;

    // Validate request
    if (!body.sprintIds || !Array.isArray(body.sprintIds) || body.sprintIds.length !== 2) {
      return NextResponse.json(
        { error: 'sprintIds must be an array of exactly two sprint IDs' },
        { status: 400 }
      );
    }

    const [sprintIdA, sprintIdB] = body.sprintIds;

    if (!sprintIdA || !sprintIdB) {
      return NextResponse.json(
        { error: 'Both sprint IDs must be non-empty' },
        { status: 400 }
      );
    }

    // Fetch and parse sheet data
    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);

    if (sprintRows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    // Filter each sprint
    const rowsA = filterBySprints(sprintRows, [sprintIdA]);
    const rowsB = filterBySprints(sprintRows, [sprintIdB]);

    if (rowsA.length === 0) {
      return NextResponse.json(
        { error: `Sprint not found: ${sprintIdA}` },
        { status: 404 }
      );
    }

    if (rowsB.length === 0) {
      return NextResponse.json(
        { error: `Sprint not found: ${sprintIdB}` },
        { status: 404 }
      );
    }

    // Compute stats for each sprint
    const statsA = computeSprintStats(rowsA)[0]; // should be exactly one
    const statsB = computeSprintStats(rowsB)[0]; // should be exactly one

    // Extract week information from the rows
    const weekA = rowsA.length > 0 ? rowsA[0].week : undefined;
    const weekB = rowsB.length > 0 ? rowsB[0].week : undefined;

    // Add week to stats
    if (statsA) statsA.week = weekA;
    if (statsB) statsB.week = weekB;

    const response: CompareSprintsResponse = {
      sprints: [statsA, statsB],
      computedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/completion-rate/compare]', error);
    return NextResponse.json(
      { error: `Failed to compare sprints: ${String(error)}` },
      { status: 500 }
    );
  }
}
