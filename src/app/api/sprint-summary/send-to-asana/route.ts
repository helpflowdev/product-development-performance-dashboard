import { NextRequest, NextResponse } from 'next/server';
import { fetchSheetRows } from '@/lib/sheets';
import { mapRowsToSprintRows } from '@/lib/row-mapper';
import { computeSprintSummary } from '@/lib/sprint-summary-engine';
import { sendSprintSummaryToAsana } from '@/lib/sprint-summary-asana';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/sprint-summary/send-to-asana
 * Request body: { sprintId: string }
 *
 * Recomputes the summary server-side from the sheet (don't trust the client),
 * then creates a `Sprint Summary: <name>` task in Asana and posts the summary +
 * task lists as comments. Returns the created task's gid/url on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      sprintId?: string;
      focusSummary?: string;
    };
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
    // Task lists are recomputed server-side (don't trust the client), but the
    // focus summary is reviewed/edited narrative text — use what the operator saw.
    const focus = body.focusSummary?.trim();
    summary.focusSummary = focus ? focus : null;
    const result = await sendSprintSummaryToAsana(summary);

    if (!result.success) {
      return NextResponse.json(result, { status: 502 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('[POST /api/sprint-summary/send-to-asana]', error);
    return NextResponse.json(
      { error: `Failed to send summary to Asana: ${String(error).replace('Error: ', '')}` },
      { status: 500 },
    );
  }
}
