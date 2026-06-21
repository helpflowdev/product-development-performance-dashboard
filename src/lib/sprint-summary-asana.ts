import { SprintSummaryResponse, SendToAsanaResult } from '@/types/sprint-summary';
import { formatHours } from './format';
import {
  createAsanaTask,
  postCommentToTask,
  postGroupedTaskListInChunks,
} from './asana';

/**
 * Sends a computed Sprint Summary to Asana.
 *
 * Creates a `Sprint Summary: <name>` task in the configured project, posts the
 * metrics + per-assignee breakdown as a plain-text comment, then posts the
 * Completed / Carried-Over / Incomplete / Next-Sprint lists as rich-text comments
 * with hyperlinked titles grouped per assignee.
 */

/** Asana project the summary task is created in (the legacy macro's project). */
const DEFAULT_SUMMARY_PROJECT_ID = '514125768649585';

/** Small pause between comment posts to stay clear of Asana rate limits. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the metrics + per-assignee summary comment (plain text). Heading lines
 * (those ending in ':') are padded with surrounding blank lines for readability.
 */
export function buildSummaryCommentText(summary: SprintSummaryResponse): string {
  const lines: string[] = [
    'Sprint Summary',
    `Sprint: ${summary.sprintId}`,
  ];

  if (summary.focusSummary) {
    lines.push('Focus:', summary.focusSummary);
  }

  lines.push(
    `Completed Tasks: ${summary.completedCount}`,
    `Plotted Tasks: ${summary.plottedCount}`,
    `Carried Over to Next Sprint: ${summary.carriedOverCount}`,
    `Completion Rate: ${summary.completionRate.toFixed(2)}%`,
    `Total Estimated vs Actual Hours: ${formatHours(
      summary.totalHoursEstimate,
    )} / ${formatHours(summary.totalHoursActual)}`,
    'Completed vs Plotted (per assignee):',
  );

  for (const a of summary.assignees) {
    lines.push(`${a.name}: ${a.completionRate.toFixed(2)}% (${a.completed}/${a.total})`);
  }

  lines.push('Actual vs Estimate Hours:');
  for (const a of summary.assignees) {
    if (a.hoursEstimate === 0 && a.hoursActual === 0) continue;
    lines.push(
      `${a.name}: ${formatHours(a.hoursActual)} (${formatHours(a.hoursEstimate)})`,
    );
  }

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

    // 1. Metrics + per-assignee breakdown (plain text).
    const summaryResult = await postCommentToTask(
      gid,
      buildSummaryCommentText(summary),
    );
    if (summaryResult.success) commentsPosted++;
    await sleep(1000);

    // 2-5. Grouped, hyperlinked task lists (rich text). Each helper no-ops on
    //      an empty list and returns how many comments it posted.
    const sections: Array<{ label: string; groups: typeof summary.completedTasks }> = [
      { label: 'Completed Tasks', groups: summary.completedTasks },
      { label: 'Carried Over to Next Sprint', groups: summary.carriedOverTasks },
      { label: 'Incomplete (Not Carried Over)', groups: summary.incompleteTasks },
      {
        label: summary.nextSprintName
          ? `Next Sprint Tasks — ${summary.nextSprintName}`
          : 'Next Sprint Tasks',
        groups: summary.nextSprintTasks,
      },
    ];

    for (const section of sections) {
      const posted = await postGroupedTaskListInChunks(
        gid,
        section.label,
        section.groups,
      );
      if (posted > 0) {
        commentsPosted += posted;
        await sleep(1000);
      }
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
