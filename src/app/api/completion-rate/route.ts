import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import {
  computeSummary,
  computeSprintStats,
  filterBySprints,
  filterByYears,
  filterByMonths,
  filterByAssignees,
  getUniqueAssignees,
} from '@/lib/completion-rate-engine';
import { CompletionRateRequest, CompletionRateResponse } from '@/types/completion-rate';

/**
 * POST /api/completion-rate
 * Request body: { sprintIds?, assigneeNames?, years?, months? }
 * Returns completion rate metrics
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CompletionRateRequest;

    // Validate request
    if (body.months !== undefined && body.months !== null && Array.isArray(body.months)) {
      for (const month of body.months) {
        const monthNum = parseInt(month, 10);
        if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
          return NextResponse.json({ error: 'Each month must be between 1 and 12' }, { status: 400 });
        }
      }
    }

    if (body.years !== undefined && body.years !== null && Array.isArray(body.years)) {
      for (const year of body.years) {
        const yearNum = parseInt(year, 10);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > 2100) {
          return NextResponse.json({ error: 'Each year must be between 1900 and 2100' }, { status: 400 });
        }
      }
    }

    // Fetch and parse sheet data
    const rawRows = await fetchSheetRows();
    const sprintRows = mapRowsToSprintRows(rawRows);

    if (sprintRows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    // Get full assignee list from all rows (for filter dropdown)
    const allAssignees = getUniqueAssignees(sprintRows);

    // Apply filters in sequence (OR logic for each filter, AND between filters)
    let filteredRows = [...sprintRows];

    if (body.sprintIds && body.sprintIds.length > 0) {
      filteredRows = filterBySprints(filteredRows, body.sprintIds);
    }

    if (body.years && body.years.length > 0) {
      filteredRows = filterByYears(filteredRows, body.years);
    }

    if (body.months && body.months.length > 0) {
      filteredRows = filterByMonths(filteredRows, body.months);
    }

    if (body.assigneeNames && body.assigneeNames.length > 0) {
      filteredRows = filterByAssignees(filteredRows, body.assigneeNames);
    }

    // Compute summary for filtered data
    const summary = computeSummary(filteredRows);

    // Compute per-sprint stats for filtered data
    const sprintStats = computeSprintStats(filteredRows);

    const response: CompletionRateResponse = {
      summary,
      sprintStats,
      allAssignees,
      computedAt: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[POST /api/completion-rate]', error);
    return NextResponse.json(
      { error: `Failed to compute completion rate: ${String(error)}` },
      { status: 500 }
    );
  }
}
