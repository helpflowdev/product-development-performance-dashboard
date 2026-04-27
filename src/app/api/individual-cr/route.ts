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
import { filterToDevMembers } from '@/lib/dev-members';
import { IndividualCRRequest, IndividualCRResponse } from '@/types/individual-cr';

/**
 * POST /api/individual-cr
 * Request body: { sprintIds: [sprintId...], roles?: [...], assigneeNames?: [...], years?: [...], months?: [...] }
 * Returns per-assignee completion stats for selected sprints
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as IndividualCRRequest;

    const sprintIds = body.sprintIds ?? [];
    const hasAnyFilter =
      sprintIds.length > 0 ||
      (body.roles?.length ?? 0) > 0 ||
      (body.assigneeNames?.length ?? 0) > 0 ||
      (body.years?.length ?? 0) > 0 ||
      (body.months?.length ?? 0) > 0;

    // Fetch and parse sheet data
    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);

    if (sprintRows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    // Dropdown options come from the full dataset so every filter is usable on its own.
    // Assignees are restricted to current dev members regardless of other filters.
    const allRoles = getUniqueRoles(sprintRows);
    const allAssignees = filterToDevMembers(getUniqueAssignees(sprintRows));

    // Without any filter, return options only (no stats) — the client guards this too
    if (!hasAnyFilter) {
      const response: IndividualCRResponse = {
        assigneeStats: [],
        allRoles,
        allAssignees,
        selectedSprintIds: [],
        computedAt: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }

    // Apply filters in any combination
    let filteredRows = sprintRows;

    if (sprintIds.length > 0) {
      filteredRows = filterBySprints(filteredRows, sprintIds);
    }

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
    const assigneeStats = computeIndividualStats(filteredRows, sprintIds);

    const response: IndividualCRResponse = {
      assigneeStats,
      allRoles,
      allAssignees,
      selectedSprintIds: sprintIds,
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
