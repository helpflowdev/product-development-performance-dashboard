import { SprintSummaryResponse, SendToAsanaResult } from '@/types/sprint-summary';
import { formatHours } from './format';
import { REPORT_CC_GIDS, REPORT_CC_NAMES } from './report-recipients';
import {
  buildReportCommentHtml,
  joinReportLines,
} from './report-comment';
import {
  createAsanaSubtask,
  findOpenSubtaskDueOn,
  findSubtaskByName,
  postCommentToTask,
  postGroupedTaskListInChunks,
  renameTask,
} from './asana';

/**
 * Sends a computed Sprint Summary to Asana.
 *
 * Creates a `Sprint Summary: <name>` SUBTASK under the standing parent task
 * "DEV - End of Sprint Summary" (so every sprint's summary collects under one
 * parent), posts the metrics + per-assignee breakdown as a rich-text comment
 * (rich so its cc: line can @mention the collaborators), then posts the
 * Completed / Carried-Over / Incomplete / Next-Sprint lists as rich-text
 * comments with hyperlinked titles grouped per assignee.
 */

/** Standing parent task the summary subtask is created under ("DEV - End of Sprint Summary"). */
const DEFAULT_SUMMARY_PARENT_TASK_ID = '1216367392606773';

/** Asana user the summary task is assigned to (Shann Bryle Rubido, shannbryle.rubido@helpflow.net). */
const DEFAULT_SUMMARY_ASSIGNEE_ID = '1166606777056089';

/** Small pause between comment posts to stay clear of Asana rate limits. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Matches a sprint summary subtask whichever sprint it names (and through the
 * "Augment Launch > " prefix some cycles carried). Qualifies the due-today
 * lookup so it can only ever reuse a summary subtask — never an unrelated
 * subtask that happens to be due the same day.
 */
const SUMMARY_TITLE_PATTERN = /Sprint\s+Summary/i;

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
 * Build the metrics + per-assignee summary body as lines, WITHOUT the trailing
 * cc: line — that differs between the plain-text and rich-text renderings (names
 * vs real @mentions), so each builder appends its own. Heading lines (those
 * ending in ':') are padded with surrounding blank lines for readability.
 */
function buildSummaryLines(summary: SprintSummaryResponse): string[] {
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

  return lines;
}

/**
 * The summary comment as plain text, cc'd by name. Kept for callers that want
 * the body without markup; the Asana post uses the rich-text builder below, so
 * that the cc actually notifies.
 */
export function buildSummaryCommentText(summary: SprintSummaryResponse): string {
  const lines = buildSummaryLines(summary);
  lines.push(`cc: ${REPORT_CC_NAMES}`);
  return joinReportLines(lines);
}

/**
 * The summary comment as Asana rich text (`html_text`), cc'd by @mention so the
 * collaborators are actually notified rather than merely named. Shaping (and the
 * reasons behind it) lives in report-comment.ts.
 */
export function buildSummaryCommentHtml(summary: SprintSummaryResponse): string {
  return buildReportCommentHtml(buildSummaryLines(summary));
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
    // Find-or-create under "DEV - End of Sprint Summary" (assigned to Shann Bryle
    // Rubido, due today when newly created). Previously this always created, which
    // is why several sprints have two or three summary subtasks — every re-run
    // spawned another one. Priority order:
    //   1. Exact title match. Unlike the scorecard's date-keyed title, this title
    //      is keyed on the sprint id, so it identifies the target precisely no
    //      matter which day the report is run — the strongest key available here.
    //   2. An open summary subtask due today. Covers the task having been
    //      pre-created by duplicating the previous sprint's subtask, which leaves
    //      the PREVIOUS sprint's id in the title while the due date tracks this
    //      cycle (the failure mode that dogged the scorecard).
    //   3. Create a fresh subtask.
    // A lookup error throws rather than risking a duplicate. On reuse we leave the
    // existing assignee/followers untouched and just append the fresh comment(s).
    const byTitle = await findSubtaskByName(parentGid, taskTitle);
    const dueToday = byTitle
      ? null
      : await findOpenSubtaskDueOn(parentGid, todayDateOnly(), {
          namePattern: SUMMARY_TITLE_PATTERN,
        });
    const existing = byTitle ?? dueToday;
    const reused = existing !== null;
    const matchedBy = byTitle ? 'title' : dueToday ? 'due-today' : 'created';
    const { gid, permalinkUrl } = existing
      ? existing
      : await createAsanaSubtask(parentGid, taskTitle, {
          assignee,
          dueOn: todayDateOnly(),
          followers: REPORT_CC_GIDS,
        });

    // A subtask reused via the due-date match still names the sprint it was
    // duplicated from. Retitle it to this sprint so the parent's list stays
    // readable and the next run's title match hits. Best-effort: a failed rename
    // must not sink the report.
    let renamedFrom: string | undefined;
    if (dueToday && dueToday.name !== taskTitle) {
      const renamed = await renameTask(gid, taskTitle);
      if (renamed) renamedFrom = dueToday.name;
    }

    // 1. Metrics + per-assignee breakdown, pinned to the top. Posted as rich
    //    text so the trailing cc: line carries real @mentions — a plain-text cc
    //    names the collaborators without notifying any of them.
    const summaryResult = await postCommentToTask(
      gid,
      buildSummaryCommentHtml(summary),
      { asHtml: true, pinned: true },
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
      reused,
      matchedBy,
      renamedFrom,
      // Comment landed, but as literal text — so the cc mentions did NOT notify.
      mentionsFailed: summaryResult.htmlFallback === true,
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
