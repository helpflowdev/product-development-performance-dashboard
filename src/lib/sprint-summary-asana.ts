import { SprintSummaryResponse, SendToAsanaResult } from '@/types/sprint-summary';
import { createAsanaTask, postCommentToTask, postListInChunks } from './asana';

/**
 * Sends a computed Sprint Summary to Asana.
 *
 * Ports the legacy Google Apps Script `SprintPlanning.sendSprintSummaryToAsana`:
 * it creates a `Sprint Summary: <name>` task in the configured project, posts the
 * summary block as one comment, then posts the Completed / Transferred /
 * Next-Sprint task-URL lists as chunked comments.
 */

/** Asana project the summary task is created in (the script's hardcoded project). */
const DEFAULT_SUMMARY_PROJECT_ID = '514125768649585';

/** Small pause between comment posts to stay clear of Asana rate limits. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the summary comment text, matching the script's on-sheet summary block
 * run through formatSummaryText (heading lines — those ending in ':' — get a
 * blank line above and below).
 */
export function buildSummaryCommentText(summary: SprintSummaryResponse): string {
  const lines: string[] = [
    'Sprint Summary',
    `Sprint: ${summary.sprintId}`,
    `Total Tasks: ${summary.completedTasks} (${summary.totalTasks})`,
    `Completion Rate: ${summary.completionRate.toFixed(2)}%`,
    `Total Estimated vs Actual Hours: ${summary.totalHoursEstimate.toFixed(
      2,
    )} / ${summary.totalHoursActual.toFixed(2)}`,
    'Completed vs Total Task:',
  ];

  for (const a of summary.assignees) {
    lines.push(`${a.name}: ${a.completionRate.toFixed(2)}% (${a.completed}/${a.total})`);
  }

  lines.push('Actual vs Estimate Hours:');
  for (const a of summary.assignees) {
    // The hours section skips assignees with no hours at all (script parity).
    if (a.hoursEstimate === 0 && a.hoursActual === 0) continue;
    lines.push(
      `${a.name}: ${Math.ceil(a.hoursActual)} (${Math.ceil(a.hoursEstimate)})`,
    );
  }

  // formatSummaryText: pad heading lines (ending in ':') with surrounding blanks.
  return lines
    .map((line) => (line.endsWith(':') ? `\n${line}\n` : line))
    .join('\n');
}

export async function sendSprintSummaryToAsana(
  summary: SprintSummaryResponse,
): Promise<SendToAsanaResult> {
  const projectId =
    process.env.ASANA_SUMMARY_PROJECT_ID ?? DEFAULT_SUMMARY_PROJECT_ID;
  const taskTitle = `Sprint Summary: ${summary.sprintId}`;

  let commentsPosted = 0;
  try {
    const { gid, permalinkUrl } = await createAsanaTask(projectId, taskTitle);

    // 1. Summary block.
    const summaryResult = await postCommentToTask(
      gid,
      buildSummaryCommentText(summary),
    );
    if (summaryResult.success) commentsPosted++;
    await sleep(1000);

    // 2. Completed tasks (chunked).
    if (summary.completedTaskUrls.length > 0) {
      commentsPosted += await postListInChunks(
        gid,
        summary.completedTaskUrls,
        'Completed Tasks',
      );
      await sleep(1000);
    }

    // 3. Transferred tasks (single comment, as in the script).
    if (summary.transferredTaskUrls.length > 0) {
      const text =
        'Transferred Tasks:\n\n' + summary.transferredTaskUrls.join('\n');
      const r = await postCommentToTask(gid, text);
      if (r.success) commentsPosted++;
      await sleep(1000);
    }

    // 4. Next sprint tasks (chunked — a freshly synced sprint can be large).
    if (summary.nextSprintTaskUrls.length > 0) {
      commentsPosted += await postListInChunks(
        gid,
        summary.nextSprintTaskUrls,
        'Next Sprint Tasks',
      );
    }

    return {
      success: true,
      sprintId: summary.sprintId,
      taskGid: gid,
      taskUrl: permalinkUrl,
      commentsPosted,
    };
  } catch (error) {
    return {
      success: false,
      sprintId: summary.sprintId,
      commentsPosted,
      error: String(error).replace('Error: ', ''),
    };
  }
}
