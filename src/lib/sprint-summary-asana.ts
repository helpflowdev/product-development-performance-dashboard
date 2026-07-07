import { SprintSummaryResponse, SendToAsanaResult } from '@/types/sprint-summary';
import { formatHours } from './format';
import { REPORT_CC_GIDS, REPORT_CC_NAMES } from './report-recipients';
import {
  createAsanaSubtask,
  postCommentToTask,
  postGroupedTaskListInChunks,
} from './asana';

/**
 * Sends a computed Sprint Summary to Asana.
 *
 * Creates a `Sprint Summary: <name>` SUBTASK under the standing parent task
 * "DEV - End of Sprint Summary" (so every sprint's summary collects under one
 * parent), posts the metrics + per-assignee breakdown as a plain-text comment,
 * then posts the Completed / Carried-Over / Incomplete / Next-Sprint lists as
 * rich-text comments with hyperlinked titles grouped per assignee.
 */

/** Standing parent task the summary subtask is created under ("DEV - End of Sprint Summary"). */
const DEFAULT_SUMMARY_PARENT_TASK_ID = '1216367392606773';

/** Asana user the summary task is assigned to (Shann Bryle Rubido, shannbryle.rubido@helpflow.net). */
const DEFAULT_SUMMARY_ASSIGNEE_ID = '1166606777056089';

/** Small pause between comment posts to stay clear of Asana rate limits. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Today's date as YYYY-MM-DD in the configured timezone (for Asana due_on). */
function todayDateOnly(): string {
  const tz = process.env.TIMEZONE ?? 'America/Los_Angeles';
  // en-CA formats as YYYY-MM-DD, which is exactly Asana's due_on format.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
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
  );

  // Trend: this-sprint vs quarter-to-date (falls back to this-sprint when the
  // sprint id can't be parsed into a quarter).
  lines.push(
    summary.qtdCompletionRate !== null
      ? `Completion Rate (This Sprint / QTD): ${summary.completionRate.toFixed(
          2,
        )}% / ${summary.qtdCompletionRate.toFixed(2)}%`
      : `Completion Rate (This Sprint): ${summary.completionRate.toFixed(2)}%`,
  );

  lines.push(
    `Total Estimated vs Actual Hours: ${formatHours(
      summary.totalHoursEstimate,
    )} / ${formatHours(summary.totalHoursActual)}`,
    `Story Points (Completed / Plotted): ${formatHours(
      summary.totalStoryPointsCompleted,
    )} / ${formatHours(summary.totalStoryPointsPlotted)}`,
    `Story Point Burndown Rate: ${summary.storyPointBurndownRate.toFixed(2)}%`,
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

  lines.push(`cc: ${REPORT_CC_NAMES}`);

  return lines
    .map((line) => (line.endsWith(':') ? `\n${line}\n` : line))
    .join('\n');
}

export async function sendSprintSummaryToAsana(
  summary: SprintSummaryResponse,
): Promise<SendToAsanaResult> {
  const parentGid =
    process.env.ASANA_SUMMARY_PARENT_TASK_ID ?? DEFAULT_SUMMARY_PARENT_TASK_ID;
  const assignee =
    process.env.ASANA_SUMMARY_ASSIGNEE_ID ?? DEFAULT_SUMMARY_ASSIGNEE_ID;
  const taskTitle = `Sprint Summary: ${summary.sprintId}`;

  let commentsPosted = 0;
  try {
    // Created as a subtask under "DEV - End of Sprint Summary", assigned to
    // Shann Bryle Rubido, due today.
    const { gid, permalinkUrl } = await createAsanaSubtask(parentGid, taskTitle, {
      assignee,
      dueOn: todayDateOnly(),
      followers: REPORT_CC_GIDS,
    });

    // 1. Metrics + per-assignee breakdown (plain text), pinned to the top.
    const summaryResult = await postCommentToTask(
      gid,
      buildSummaryCommentText(summary),
      { pinned: true },
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
