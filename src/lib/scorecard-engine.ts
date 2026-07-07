import { SprintRow } from '@/types/sprint';
import { ScorecardResponse, ScorecardInput } from '@/types/scorecard';
import { computeBurndown, getUniqueSprints } from './burndown-engine';
import {
  computeSummary,
  computeQtdCompletionRate,
  filterBySprints,
  filterByRoles,
} from './completion-rate-engine';
import { computeSprintSummary } from './sprint-summary-engine';
import { isDevMember } from './dev-members';

/**
 * Weekly Scorecard engine.
 *
 * Pure/sync (no I/O, no Gemini). The route hands in ALL sprint rows and attaches
 * the analytical `narrative` after its async call — mirroring how the sprint-
 * summary route attaches `focusSummary`. Every metric is delegated to an existing
 * engine so the Scorecard agrees task-for-task with the Completion Rate,
 * Individual CR, and Burndown pages:
 *   - completion rate / counts  ← computeSummary
 *   - QTD trend                 ← computeQtdCompletionRate
 *   - devs vs team              ← filterByRoles / isDevMember + computeSummary
 *   - consumed points / rate    ← computeBurndown
 *
 * Rows should already be run through backfillDerivedColumns (done in the route) so
 * the Role column the sync leaves blank is filled — otherwise devsCompletionRate
 * would undercount whenever role is sparse.
 */

/** Default completion-rate target shown beside the this-sprint rate. */
const DEFAULT_COMPLETION_GOAL = 95;

/** Today's date as YYYY-MM-DD in the configured timezone. */
function todayDateString(): string {
  const tz = process.env.TIMEZONE ?? 'America/Los_Angeles';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * Resolve which sprint the scorecard reports on. Honors an explicit sprintId;
 * otherwise defaults to the most recent sprint that has fully ended (endDate
 * before today). Falls back to the latest sprint overall if none have ended yet.
 * getUniqueSprints returns newest-first with YYYY-MM-DD dates, so a lexicographic
 * compare is safe.
 */
function resolveSprintId(rows: SprintRow[], requested?: string): string {
  const requestedId = requested?.trim();
  if (requestedId) return requestedId;

  const sprints = getUniqueSprints(rows); // newest-first
  if (sprints.length === 0) {
    throw new Error('No sprints found in the sheet data.');
  }
  const today = todayDateString();
  const lastCompleted = sprints.find((s) => s.endDate < today);
  return (lastCompleted ?? sprints[0]).id;
}

/** Running (to-date) completion, keyed off Asana due dates. See computeRunningCompletion. */
export interface RunningCompletion {
  runningCompletionRate: number | null;
  tasksDue: number;
  tasksDueCompleted: number;
  tasksNoDueDate: number;
}

/**
 * Running / to-date completion rate: of the sprint's tasks that are DUE on or
 * before today (by Asana due date), how many are complete. This is the metric
 * that reads ~100% mid-sprint when the team is on pace — the final completionRate
 * can't, because its denominator is the whole sprint (incl. not-yet-due tasks).
 *
 * `dueByLink` maps a task's permalink (= the sheet's "Link to Task") to its
 * Asana `due_on` ('YYYY-MM-DD', or '' when no due date is set). Tasks with no due
 * date — or not found in the map — are excluded from the ratio and counted in
 * tasksNoDueDate. Pure except for reading today's date (like the burndown's
 * to-date pace); YYYY-MM-DD compares lexicographically. Rate is null when no
 * due-dated tasks are in range (e.g. before any task's due date, or the Asana
 * lookup returned nothing).
 */
export function computeRunningCompletion(
  sprintRows: SprintRow[],
  dueByLink: Map<string, string>,
): RunningCompletion {
  const today = todayDateString();
  let tasksDue = 0;
  let tasksDueCompleted = 0;
  let tasksNoDueDate = 0;

  for (const row of sprintRows) {
    const link = row.linkToTask.trim();
    const dueOn = (link && dueByLink.get(link)) || '';
    if (!dueOn) {
      tasksNoDueDate++;
      continue;
    }
    if (dueOn <= today) {
      tasksDue++;
      if (row.status.trim() === 'Complete') tasksDueCompleted++;
    }
    // dueOn > today → not yet due → excluded from the running ratio.
  }

  return {
    runningCompletionRate:
      tasksDue > 0 ? Math.round((tasksDueCompleted / tasksDue) * 10000) / 100 : null,
    tasksDue,
    tasksDueCompleted,
    tasksNoDueDate,
  };
}

export function computeScorecard(
  allRows: SprintRow[],
  input: ScorecardInput,
): ScorecardResponse {
  const sprintId = resolveSprintId(allRows, input.sprintId);
  const sprintRows = filterBySprints(allRows, [sprintId]);
  if (sprintRows.length === 0) {
    throw new Error(`No tasks found for sprint: ${sprintId}`);
  }

  // Whole-team completion (this sprint) — computeSummary is the shared source of
  // truth (Status column), so this equals the /completion-rate page for the sprint.
  const teamSummary = computeSummary(sprintRows);

  // Developers subset. Prefer the Role column ("Developer"); when the sync has
  // left roles blank and the role-filtered set is empty, fall back to matching
  // the assignee against the canonical dev roster.
  const devRoleRows = filterByRoles(sprintRows, ['Developer']);
  const devRows =
    devRoleRows.length > 0
      ? devRoleRows
      : sprintRows.filter((r) => isDevMember(r.assigneeName));
  const devsCompletionRate = computeSummary(devRows).completionRate;

  // Burndown / story points — pass allRows as the 3rd arg so cross-sprint
  // carry-over is excluded exactly as on the /burndown page.
  const burndown = computeBurndown(sprintRows, input.allottedStoryPoints, allRows);
  const burndownRate = parseFloat(burndown.burndownRate); // "86.94%" → 86.94

  // Hours, per-assignee breakdown, spillover, and task-level links come from the
  // Sprint Summary engine over the SAME sprint — so the weekly ties out to the
  // Sprint Summary report task-for-task (and carries the sprint-aware "completed
  // = Complete AND not carried over" definition for those fields).
  const summary = computeSprintSummary(allRows, sprintId);

  const first = sprintRows[0];
  const dateRange = `${first.sprintDateStart} – ${first.sprintDateEnd}`;

  return {
    sprintId,
    dateRange,
    completionRate: teamSummary.completionRate,
    completionGoal: input.completionGoal ?? DEFAULT_COMPLETION_GOAL,
    qtdCompletionRate: computeQtdCompletionRate(allRows, sprintId),
    totalTasks: teamSummary.totalTasks,
    totalCompleted: teamSummary.totalCompleted,
    // Running/to-date completion needs live Asana due dates — the route fetches
    // them and overwrites these defaults (engine stays pure/sync).
    runningCompletionRate: null,
    tasksDue: 0,
    tasksDueCompleted: 0,
    tasksNoDueDate: 0,
    runningCompletionError: null,
    devsCompletionRate,
    teamCompletionRate: teamSummary.completionRate,
    allottedStoryPoints: input.allottedStoryPoints,
    consumedStoryPoints: burndown.totalConsumedPoints,
    burndownRate: Number.isFinite(burndownRate) ? burndownRate : 0,
    uptimeNote: input.uptimeNote?.trim() ?? '',
    totalHoursEstimate: summary.totalHoursEstimate,
    totalHoursActual: summary.totalHoursActual,
    assignees: summary.assignees,
    carriedOverCount: summary.carriedOverCount,
    carriedOverTasks: summary.carriedOverTasks,
    completedTasks: summary.completedTasks,
    incompleteTasks: summary.incompleteTasks,
    // Attached by the route after the async Gemini call (pure engine stays sync).
    narrative: null,
    narrativeError: null,
    computedAt: new Date().toISOString(),
  };
}
