import { ScorecardResponse, ScorecardSendResult } from '@/types/scorecard';
import { formatHours } from './format';
import {
  REPORT_CC_GIDS,
  REPORT_CC_MENTIONS_HTML,
  REPORT_CC_NAMES,
} from './report-recipients';
import {
  addTaskToProject,
  createAsanaSubtask,
  escapeHtml,
  findSprintScorecardSubtask,
  findSubtaskByName,
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
 * Matches a scorecard report subtask regardless of the date in its title (and of
 * the "(ST)"/"(WT)" prefix and the emoji, which have both drifted over the years).
 * Used to qualify the sprint-project lookup so it can only ever reuse a scorecard
 * subtask — never an unrelated subtask filed under the same parent.
 */
const SCORECARD_TITLE_PATTERN = /Product Development .*Scorecard\s+Report/i;

/**
 * Build the scorecard comment body as lines, WITHOUT the trailing cc: line —
 * that one differs between the plain-text and rich-text renderings (names vs
 * real @mentions), so each builder appends its own. Section headings (lines
 * ending in ':') are padded with surrounding blank lines exactly like
 * buildSummaryCommentText; sub-items are indented four spaces.
 */
function buildScorecardLines(
  sc: ScorecardResponse,
  dateMMDDYYYY: string,
): string[] {
  const lines: string[] = [
    `Sprint Scorecard Report - ${dateMMDDYYYY}`,
    `Sprint: ${sc.sprintId}`,
  ];

  // Sprint project link (Asana auto-links the raw URL in plain-text comments).
  if (sc.sprintUrl) lines.push(`Sprint Link: ${sc.sprintUrl}`);
  if (sc.week) lines.push(`Week: ${sc.week}`);

  // Only stated when the operator narrowed the report — an unqualified scorecard
  // is the whole team, and a partial one must never read as if it were.
  if (sc.assigneeNames.length > 0) {
    lines.push(`Scope: ${sc.assigneeNames.join(', ')} (partial team)`);
  }

  lines.push(
    `Date Range: ${sc.dateRange}`,
    'Completion Rate:',
    `    This Sprint: ${sc.completionRate.toFixed(2)}% (Goal: ${sc.completionGoal}%)`,
  );

  if (sc.runningCompletionRate !== null) {
    lines.push(
      `    Running (due to date): ${sc.runningCompletionRate.toFixed(2)}% (${sc.tasksDueCompleted}/${sc.tasksDue} due)`,
    );
  }
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

  return lines;
}

/** Apply the heading padding and join the lines into one body. */
function joinScorecardLines(lines: string[]): string {
  return lines
    .map((line) => (line.endsWith(':') ? `\n${line}\n` : line))
    .join('\n');
}

/**
 * The scorecard comment as plain text, cc'd by name. Kept for callers that want
 * the body without markup; the Asana post uses the rich-text builder below, so
 * that the cc actually notifies.
 */
export function buildScorecardCommentText(
  sc: ScorecardResponse,
  dateMMDDYYYY: string,
): string {
  const lines = buildScorecardLines(sc, dateMMDDYYYY);
  lines.push(`cc: ${REPORT_CC_NAMES}`);
  return joinScorecardLines(lines);
}

/**
 * The scorecard comment as Asana rich text (`html_text`), cc'd by @mention so
 * the collaborators are actually notified rather than merely named.
 *
 * The layout is unchanged from the plain-text version: every content line is
 * HTML-escaped and separated by RAW NEWLINES — `<br/>` is deliberately not used,
 * because it trips Asana's story parser into storing the whole body as literal
 * text, which would also kill the mentions. Bare URLs are wrapped in anchors,
 * since a raw URL only auto-links in the plain `text` field.
 */
export function buildScorecardCommentHtml(
  sc: ScorecardResponse,
  dateMMDDYYYY: string,
): string {
  const body = joinScorecardLines(
    buildScorecardLines(sc, dateMMDDYYYY).map((line) =>
      escapeHtml(line).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>'),
    ),
  );
  // Appended after escaping — the mention elements are markup, not text.
  return `<body>${body}\ncc: ${REPORT_CC_MENTIONS_HTML}</body>`;
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
    // Find-or-create, in priority order:
    //   1. The open scorecard subtask filed under THIS SPRINT'S project, due
    //      nearest the run date. Project membership is the only reliable key: the
    //      scorecard is weekly and sprints are biweekly, so each sprint project
    //      holds two of these subtasks, and picking between them by due-date
    //      proximity lands on the week the report covers. Titles lag (each week's
    //      subtask is duplicated from the previous one and inherits its date) and
    //      "due exactly today" misses whenever a run slips a day — both of which
    //      used to spawn a parallel subtask instead.
    //   2. Exact match on today's title — a same-day re-run after the sprint's
    //      subtask was completed, so it reuses the one this report just made
    //      rather than stacking up another.
    //   3. Create a fresh dated subtask, and file it under the sprint project so
    //      it sits with the hand-made ones and step 1 finds it next time.
    // A lookup error throws rather than risking a duplicate. On reuse we leave the
    // subtask exactly as found — title, due date, assignee and followers all
    // untouched — and only append the fresh comment(s).
    const sprintProjectGid = sc.sprintProjectGid;
    const sprintSubtask = sprintProjectGid
      ? await findSprintScorecardSubtask(parentGid, sprintProjectGid, todayDateOnly(), {
          namePattern: SCORECARD_TITLE_PATTERN,
        })
      : null;
    const existing = sprintSubtask ?? (await findSubtaskByName(parentGid, taskTitle));
    const reused = existing !== null;
    const matchedBy: ScorecardSendResult['matchedBy'] = sprintSubtask
      ? 'sprint-project'
      : existing
        ? 'title'
        : 'created';
    const { gid, permalinkUrl } = existing
      ? existing
      : await createAsanaSubtask(parentGid, taskTitle, {
          assignee,
          dueOn: todayDateOnly(),
          followers: REPORT_CC_GIDS,
        });

    // Newly created subtasks are filed under the sprint project, both so they sit
    // with the hand-made ones and so the next run matches them at step 1. A failed
    // add is not fatal — the comments still land on the right task.
    if (!existing && sprintProjectGid) await addTaskToProject(gid, sprintProjectGid);

    const matchedTaskName = sprintSubtask ? sprintSubtask.name : taskTitle;

    // 1. Scorecard metrics + hours + per-assignee, pinned to the top. Posted as
    //    rich text so the trailing cc: line carries real @mentions — a plain-text
    //    cc names the collaborators without notifying any of them.
    const result = await postCommentToTask(
      gid,
      buildScorecardCommentHtml(sc, dateMMDDYYYY),
      { asHtml: true, pinned: true },
    );
    if (result.success) commentsPosted++;

    if (!result.success) {
      return {
        success: false,
        sprintId: sc.sprintId,
        taskGid: gid,
        taskUrl: permalinkUrl,
        commentsPosted,
        reused,
        matchedBy,
        matchedTaskName,
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
      reused,
      matchedBy,
      matchedTaskName,
      // Comment landed, but as literal text — so the cc mentions did NOT notify.
      mentionsFailed: result.htmlFallback === true,
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
