import { ScorecardResponse, ScorecardSendResult } from '@/types/scorecard';
import { formatHours } from './format';
import {
  createAsanaSubtask,
  postCommentToTask,
  postGroupedTaskListInChunks,
} from './asana';

/** Small pause between comment posts to stay clear of Asana rate limits. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a computed Weekly Scorecard to Asana.
 *
 * Creates a `(ST) 🗒️ Product Development Sprint Scorecard Report (MM/DD/YYYY)`
 * SUBTASK under the standing parent task "Dev - Weekly Scorecard Report", then
 * posts the scorecard body as a single pinned plain-text comment. Mirrors
 * sendSprintSummaryToAsana, but the scorecard is one comment (no grouped task
 * lists — those stay unique to the Sprint Summary).
 */

/** Standing parent task the scorecard subtask is created under ("Dev - Weekly Scorecard Report"). */
const DEFAULT_SCORECARD_PARENT_TASK_ID = '1207376779108203';

/** Today's date as MM/DD/YYYY in the configured timezone (for the title + header). */
function todayMMDDYYYY(): string {
  const tz = process.env.TIMEZONE ?? 'America/Los_Angeles';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  const year = parts.find((p) => p.type === 'year')!.value;
  return `${month}/${day}/${year}`;
}

/** Today's date as YYYY-MM-DD in the configured timezone (for Asana due_on). */
function todayDateOnly(): string {
  const tz = process.env.TIMEZONE ?? 'America/Los_Angeles';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** The scorecard subtask title for a given date. */
export function scorecardTaskTitle(dateMMDDYYYY: string): string {
  return `(ST) 🗒️ Product Development Sprint Scorecard Report (${dateMMDDYYYY})`;
}

/**
 * Build the scorecard comment body (plain text). Section headings (lines ending
 * in ':') are padded with surrounding blank lines exactly like
 * buildSummaryCommentText; sub-items are indented four spaces.
 */
export function buildScorecardCommentText(
  sc: ScorecardResponse,
  dateMMDDYYYY: string,
): string {
  const lines: string[] = [
    `Sprint Scorecard Report - ${dateMMDDYYYY}`,
    `Sprint: ${sc.sprintId}`,
    `Date Range: ${sc.dateRange}`,
    'Completion Rate:',
    `    This Sprint: ${sc.completionRate.toFixed(2)}% (Goal: ${sc.completionGoal}%)`,
  ];

  if (sc.qtdCompletionRate !== null) {
    lines.push(`    QTD: ${sc.qtdCompletionRate.toFixed(2)}%`);
  }
  lines.push(`    Tasks: ${sc.totalTasks}  Completed: ${sc.totalCompleted}`);

  lines.push(
    'Individual Completion Rate:',
    `    Devs: ${sc.devsCompletionRate.toFixed(2)}%`,
    `    Product Development Team: ${sc.teamCompletionRate.toFixed(2)}%`,
    'Burndown:',
    `    Allotted Story Points: ${sc.allottedStoryPoints}`,
    `    Consumed Story Points: ${sc.consumedStoryPoints}`,
    `    Burndown Rate: ${sc.burndownRate.toFixed(2)}%`,
  );

  // Estimation accuracy (hours) — from the Sprint Summary.
  const variance = sc.totalHoursActual - sc.totalHoursEstimate;
  const accuracy =
    sc.totalHoursEstimate > 0
      ? `${((sc.totalHoursActual / sc.totalHoursEstimate) * 100).toFixed(1)}%`
      : 'n/a';
  lines.push(
    'Estimated vs Actual Hours:',
    `    Estimated: ${formatHours(sc.totalHoursEstimate)}`,
    `    Actual: ${formatHours(sc.totalHoursActual)}`,
    `    Variance: ${variance >= 0 ? '+' : ''}${formatHours(variance)} (Actual/Est: ${accuracy})`,
  );

  // Spillover.
  lines.push(`Carried Over to Next Sprint: ${sc.carriedOverCount}`);

  // Per-named-assignee breakdown (rate + hours).
  if (sc.assignees.length > 0) {
    lines.push('Per-Assignee (Completed / Plotted · Actual/Est Hours):');
    for (const a of sc.assignees) {
      const hours =
        a.hoursEstimate === 0 && a.hoursActual === 0
          ? ''
          : ` · ${formatHours(a.hoursActual)}/${formatHours(a.hoursEstimate)}h`;
      lines.push(
        `    ${a.name}: ${a.completionRate.toFixed(2)}% (${a.completed}/${a.total})${hours}`,
      );
    }
  }

  if (sc.uptimeNote.trim()) {
    lines.push(`Uptime: ${sc.uptimeNote.trim()}`);
  }

  if (sc.narrative && sc.narrative.trim()) {
    lines.push('Summary:', `    ${sc.narrative.trim()}`);
  }

  return lines
    .map((line) => (line.endsWith(':') ? `\n${line}\n` : line))
    .join('\n');
}

export async function sendScorecardToAsana(
  sc: ScorecardResponse,
): Promise<ScorecardSendResult> {
  const parentGid =
    process.env.ASANA_SCORECARD_PARENT_TASK_ID ?? DEFAULT_SCORECARD_PARENT_TASK_ID;
  const assignee = process.env.ASANA_SCORECARD_ASSIGNEE_ID;
  const dateMMDDYYYY = todayMMDDYYYY();
  const taskTitle = scorecardTaskTitle(dateMMDDYYYY);

  let commentsPosted = 0;
  try {
    const { gid, permalinkUrl } = await createAsanaSubtask(parentGid, taskTitle, {
      assignee,
      dueOn: todayDateOnly(),
    });

    // 1. Scorecard metrics + hours + per-assignee (plain text), pinned to the top.
    const result = await postCommentToTask(
      gid,
      buildScorecardCommentText(sc, dateMMDDYYYY),
      { pinned: true },
    );
    if (result.success) commentsPosted++;

    if (!result.success) {
      return {
        success: false,
        sprintId: sc.sprintId,
        taskGid: gid,
        taskUrl: permalinkUrl,
        commentsPosted,
        error: result.error ?? 'Failed to post scorecard comment',
      };
    }
    await sleep(1000);

    // 2-4. Task-level traceability: grouped, hyperlinked task lists (rich text).
    //      Each helper no-ops on an empty list and returns how many it posted.
    const sections: Array<{ label: string; groups: typeof sc.completedTasks }> = [
      { label: 'Completed Tasks', groups: sc.completedTasks },
      { label: 'Carried Over to Next Sprint', groups: sc.carriedOverTasks },
      { label: 'Incomplete (Not Carried Over)', groups: sc.incompleteTasks },
    ];
    for (const section of sections) {
      const posted = await postGroupedTaskListInChunks(gid, section.label, section.groups);
      if (posted > 0) {
        commentsPosted += posted;
        await sleep(1000);
      }
    }

    return {
      success: true,
      sprintId: sc.sprintId,
      taskGid: gid,
      taskUrl: permalinkUrl,
      commentsPosted,
    };
  } catch (error) {
    return {
      success: false,
      sprintId: sc.sprintId,
      commentsPosted,
      error: String(error).replace('Error: ', ''),
    };
  }
}
