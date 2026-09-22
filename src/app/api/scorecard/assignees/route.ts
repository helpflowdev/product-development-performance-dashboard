import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import {
  filterBySprints,
  getUniqueAssignees,
} from '@/lib/completion-rate-engine';

export const runtime = 'nodejs';

export interface ScorecardAssigneesResponse {
  sprintId: string; // '' when no sprint was requested (all sprints)
  assignees: string[]; // alphabetical
}

/**
 * GET /api/scorecard/assignees?sprintId=<id>
 *
 * The people the Weekly Scorecard can be scoped to: every assignee who actually
 * has a task in the requested sprint, alphabetically. Sprint-scoped on purpose —
 * the scorecard reports on one sprint, so offering the all-time roster would let
 * an operator pick someone with nothing in it and get an empty report.
 *
 * Deliberately NOT narrowed to the dev roster (unlike the Completion Rate
 * page's assignee dropdown): the scorecard's hours and per-assignee sections
 * already cover everyone who worked the sprint, so everyone must be selectable.
 *
 * Omitting sprintId returns every assignee across all sprints.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const sprintId = request.nextUrl.searchParams.get('sprintId')?.trim() ?? '';

    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);

    const scoped = sprintId ? filterBySprints(sprintRows, [sprintId]) : sprintRows;

    const response: ScorecardAssigneesResponse = {
      sprintId,
      assignees: getUniqueAssignees(scoped),
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[GET /api/scorecard/assignees]', error);
    return NextResponse.json(
      { error: `Failed to fetch assignees: ${String(error).replace('Error: ', '')}` },
      { status: 500 },
    );
  }
}
