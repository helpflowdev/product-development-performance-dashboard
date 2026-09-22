import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import { backfillDerivedColumns, filterByAssignees } from '@/lib/completion-rate-engine';
import { computeScorecard, normalizeAssigneeNames } from '@/lib/scorecard-engine';
import { attachAsanaContext } from '@/lib/scorecard-running';
import { sendScorecardToAsana } from '@/lib/scorecard-asana';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/scorecard/send-to-asana
 * Request body: { allottedStoryPoints, sprintId?, assigneeNames?, uptimeNote?, completionGoal?, narrative? }
 *
 * Recomputes the scorecard metrics server-side (don't trust the client), but
 * uses the operator-reviewed narrative / uptime note / allotted points / goal
 * from the request body. The assignee scope is re-applied here too, so what
 * lands in Asana covers exactly the people the operator picked. Creates the scorecard subtask + pinned comment in Asana.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      allottedStoryPoints?: number;
      sprintId?: string;
      assigneeNames?: string[];
      uptimeNote?: string;
      completionGoal?: number;
      narrative?: string;
    };

    if (
      typeof body.allottedStoryPoints !== 'number' ||
      body.allottedStoryPoints <= 0
    ) {
      return NextResponse.json(
        { error: 'allottedStoryPoints must be a positive number' },
        { status: 400 },
      );
    }

    if (body.assigneeNames !== undefined && !Array.isArray(body.assigneeNames)) {
      return NextResponse.json(
        { error: 'assigneeNames must be an array of names' },
        { status: 400 },
      );
    }
    const assigneeNames = normalizeAssigneeNames(body.assigneeNames);

    const rawRows = await fetchSheetRows();
    const sprintRows = backfillDerivedColumns(mapRowsToSprintRows(rawRows));

    if (sprintRows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    const scorecard = computeScorecard(sprintRows, {
      sprintId: body.sprintId?.trim() || undefined,
      assigneeNames,
      allottedStoryPoints: body.allottedStoryPoints,
      uptimeNote: body.uptimeNote,
      completionGoal: body.completionGoal,
    });
    // Recompute the sprint link + running/to-date completion server-side (live Asana),
    // over the same assignee-scoped rows the engine used.
    await attachAsanaContext(scorecard, filterByAssignees(sprintRows, assigneeNames));

    // Narrative is reviewed/edited prose — use what the operator saw.
    const narrative = body.narrative?.trim();
    scorecard.narrative = narrative ? narrative : null;

    const result = await sendScorecardToAsana(scorecard);

    if (!result.success) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/scorecard/send-to-asana]', error);
    return NextResponse.json(
      { error: `Failed to send scorecard to Asana: ${String(error).replace('Error: ', '')}` },
      { status: 500 },
    );
  }
}
