import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import { backfillDerivedColumns } from '@/lib/completion-rate-engine';
import { computeScorecard } from '@/lib/scorecard-engine';
import { generateScorecardNarrative } from '@/lib/sprint-focus-summary';
import { ScorecardInput } from '@/types/scorecard';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/scorecard
 * Request body: { allottedStoryPoints: number, sprintId?, uptimeNote?, completionGoal? }
 *
 * Computes the Weekly Scorecard for the selected sprint (default: latest
 * completed) and attaches the analytical narrative (Gemini, never throws).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Partial<ScorecardInput>;

    if (
      typeof body.allottedStoryPoints !== 'number' ||
      body.allottedStoryPoints <= 0
    ) {
      return NextResponse.json(
        { error: 'allottedStoryPoints must be a positive number' },
        { status: 400 },
      );
    }

    const rawRows = await fetchSheetRows();
    // Backfill the Role column the replace-per-sprint sync leaves blank so the
    // devs-vs-team split matches the Individual CR page.
    const sprintRows = backfillDerivedColumns(mapRowsToSprintRows(rawRows));

    if (sprintRows.length === 0) {
      return NextResponse.json({ error: 'No data found in sheet' }, { status: 404 });
    }

    const scorecard = computeScorecard(sprintRows, {
      sprintId: body.sprintId?.trim() || undefined,
      allottedStoryPoints: body.allottedStoryPoints,
      uptimeNote: body.uptimeNote,
      completionGoal: body.completionGoal,
    });

    // Analytical narrative from the computed numbers. Never throws — surfaces a
    // reason in narrativeError when generation fails so it isn't silent.
    const narrative = await generateScorecardNarrative({
      sprintId: scorecard.sprintId,
      completionRate: scorecard.completionRate,
      completionGoal: scorecard.completionGoal,
      qtdCompletionRate: scorecard.qtdCompletionRate,
      devsCompletionRate: scorecard.devsCompletionRate,
      teamCompletionRate: scorecard.teamCompletionRate,
      allottedStoryPoints: scorecard.allottedStoryPoints,
      consumedStoryPoints: scorecard.consumedStoryPoints,
      burndownRate: scorecard.burndownRate,
      totalHoursEstimate: scorecard.totalHoursEstimate,
      totalHoursActual: scorecard.totalHoursActual,
    });
    scorecard.narrative = narrative.summary;
    scorecard.narrativeError = narrative.error;

    return NextResponse.json(scorecard);
  } catch (error) {
    console.error('[POST /api/scorecard]', error);
    return NextResponse.json(
      { error: `Failed to compute scorecard: ${String(error).replace('Error: ', '')}` },
      { status: 500 },
    );
  }
}
