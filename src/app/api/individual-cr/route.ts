import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import {
  filterBySprints,
  filterByRoles,
  filterByAssignees,
  filterByYears,
  filterByMonths,
  getUniqueRoles,
  getUniqueAssignees,
  computeIndividualStats,
} from '@/lib/completion-rate-engine';
import { IndividualCRRequest, IndividualCRResponse } from '@/types/individual-cr';

/**
 * POST /api/individual-cr
 * Request body: { sprintIds: [sprintId...], roles?: [...], assigneeNames?: [...], years?: [...], months?: [...] }
 * Returns per-assignee completion stats for selected sprints
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as IndividualCRRequest;

    // Validate request: sprintIds is required and non-empty
    if (!body.sprintIds || !Array.isArray(body.sprintIds) || body.sprintIds.length === 0) {
      return NextResponse.json(
        { error: 'sprintIds must be a non-empty array' },
        { status: 400 }
      );
    }

    // Fetch and parse sheet data
    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);

    if (sprintRows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    // Filter to selected sprints
    const sprintFilteredRows = filterBySprints(sprintRows, body.sprintIds);

    if (sprintFilteredRows.length === 0) {
      return NextResponse.json(
        { error: `No data found for selected sprints` },
        { status: 404 }
      );
    }

    // Get available roles and assignees from sprint-filtered data
    const allRoles = getUniqueRoles(sprintFilteredRows);
    const allAssignees = getUniqueAssignees(sprintFilteredRows);

    // Apply optional filters
    let filteredRows = sprintFilteredRows;

    if (body.roles && body.roles.length > 0) {
      filteredRows = filterByRoles(filteredRows, body.roles);
    }

    if (body.assigneeNames && body.assigneeNames.length > 0) {
      filteredRows = filterByAssignees(filteredRows, body.assigneeNames);
    }

    if (body.years && body.years.length > 0) {
      filteredRows = filterByYears(filteredRows, body.years);
    }

    if (body.months && body.months.length > 0) {
      filteredRows = filterByMonths(filteredRows, body.months);
    }

    // Compute per-assignee stats
    const assigneeStats = computeIndividualStats(filteredRows, body.sprintIds);

    const response: IndividualCRResponse = {
      assigneeStats,
      allRoles,
      allAssignees,
      selectedSprintIds: body.sprintIds,
      computedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/individual-cr]', error);
    return NextResponse.json(
      { error: `Failed to compute individual completion rate: ${String(error)}` },
      { status: 500 }
    );
  }
}
