import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import { computeSprintPlanning } from '@/lib/sprint-planning-engine';
import { SprintPlanningRequest, SprintPlanningResponse } from '@/types/sprint-planning';

/**
 * POST /api/sprint-planning
 * Request body: { sprintId: string }
 * Returns per-member hours stats (Assigned = Σ estimate, Completed = Σ actual on
 * completed tasks, Remaining = difference) for roster members with tasks in the sprint.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as SprintPlanningRequest;
    const sprintId = body.sprintId?.trim();

    if (!sprintId) {
      return NextResponse.json({ error: 'Missing sprintId' }, { status: 400 });
    }

    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);

    if (sprintRows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    const members = computeSprintPlanning(sprintRows, sprintId);

    const response: SprintPlanningResponse = {
      sprintId,
      members,
      computedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/sprint-planning]', error);
    return NextResponse.json(
      { error: `Failed to compute sprint planning hours: ${String(error)}` },
      { status: 500 },
    );
  }
}
