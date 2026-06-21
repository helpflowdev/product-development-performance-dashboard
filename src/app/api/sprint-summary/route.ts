import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import {
  computeSprintSummary,
  getNonRecurringTaskTitles,
} from '@/lib/sprint-summary-engine';
import { generateFocusSummary } from '@/lib/sprint-focus-summary';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/sprint-summary
 * Request body: { sprintId: string }
 * Returns the computed Sprint Summary (totals, completion rate, hours, the
 * per-assignee breakdown, and the Completed / Transferred / Next-Sprint task-URL
 * lists) for the selected sprint.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { sprintId?: string };
    const sprintId = body.sprintId?.trim();

    if (!sprintId) {
      return NextResponse.json({ error: 'Missing sprintId' }, { status: 400 });
    }

    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);

    if (sprintRows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    const summary = computeSprintSummary(sprintRows, sprintId);

    // AI focus summary from non-recurring task titles. Returns null (no throw)
    // when GEMINI_API_KEY isn't set or generation fails — summary still works.
    summary.focusSummary = await generateFocusSummary(
      sprintId,
      getNonRecurringTaskTitles(sprintRows, sprintId),
    );

    return NextResponse.json(summary);
  } catch (error) {
    console.error('[POST /api/sprint-summary]', error);
    return NextResponse.json(
      { error: `Failed to compute sprint summary: ${String(error).replace('Error: ', '')}` },
      { status: 500 },
    );
  }
}
