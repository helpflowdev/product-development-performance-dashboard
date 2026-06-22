import { SprintRow, SprintMeta } from '@/types/sprint';
import { BurndownDay, BurndownResponse, QAFlag } from '@/types/burndown';
import {
  parseDate,
  toDateString,
  formatDisplayDate,
  daysBetween,
  isDateBefore,
  isDateAfter,
} from './date-utils';

/**
 * Resolve the burndown date for a task
 * Priority: dateCompletedForBurndown → dateCompleted → null
 */
function resolveBurndownDate(row: SprintRow): Date | null {
  let date = parseDate(row.dateCompletedForBurndown);
  if (date) return date;

  date = parseDate(row.dateCompleted);
  if (date) return date;

  return null;
}

/**
 * When did this task enter the sprint?
 * Prefer the explicit "Date Added to Sprint" (sourced from Asana's activity log),
 * which correctly catches backlog tasks pulled in mid-sprint. Fall back to the
 * task creation date ("Date Assigned") for rows not yet backfilled, preserving
 * the previous behavior until a sync populates column X.
 */
function resolveSprintEntryDate(row: SprintRow): Date | null {
  return parseDate(row.dateAddedToSprint) ?? parseDate(row.dateAssigned);
}

/**
 * Common fields every QA flag carries: task identity, status, and the
 * hours/story-point figures shown as columns in the Data Quality panel.
 */
function flagBase(row: SprintRow) {
  return {
    taskTitle: row.tasksTitle,
    taskUrl: row.linkToTask,
    assignee: row.assigneeName,
    status: row.status,
    storyPoints: row.storyPoints,
    hoursEstimate: row.hoursEstimate,
    hoursActual: row.hoursActual,
  };
}

/**
 * Get unique sprints from raw rows, sorted reverse-chronologically by start date
 */
export function getUniqueSprints(rows: SprintRow[]): SprintMeta[] {
  const sprintMap = new Map<string, SprintMeta>();

  for (const row of rows) {
    if (!row.sprint || sprintMap.has(row.sprint)) continue;

    const startDate = parseDate(row.sprintDateStart);
    const endDate = parseDate(row.sprintDateEnd);

    if (startDate && endDate) {
      sprintMap.set(row.sprint, {
        id: row.sprint,
        startDate: toDateString(startDate),
        endDate: toDateString(endDate),
      });
    }
  }

  // Convert to array and sort reverse-chronologically
  const sprints = Array.from(sprintMap.values());
  sprints.sort((a, b) => {
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  return sprints;
}

/**
 * Sprint naming convention: "Sprint #YYYY.QX.SY (MMDD-MMDD)". Parsed into an
 * orderable tuple so "the next sprint" is the next S within the quarter, rolling
 * over to S1 of the next quarter — independent of how many sprints a quarter has.
 */
const SPRINT_NAME_RE = /Sprint\s*#(\d{4})\.Q(\d)\.S(\d+)/i;
interface SprintOrder {
  year: number;
  quarter: number;
  sprint: number;
}
function parseSprintOrder(name: string): SprintOrder | null {
  const m = name.match(SPRINT_NAME_RE);
  if (!m) return null;
  return { year: +m[1], quarter: +m[2], sprint: +m[3] };
}
function compareOrder(a: SprintOrder, b: SprintOrder): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.quarter !== b.quarter) return a.quarter - b.quarter;
  return a.sprint - b.sprint;
}

/**
 * Resolve the next sprint's name relative to `selectedSprint`.
 *
 * Primary: by the naming convention — the smallest (year, quarter, sprint) tuple
 * strictly greater than the selected sprint's, among the sprints present in the
 * data. This handles S6 → S7 → (next quarter) S1 without depending on dates or
 * knowing how many sprints a quarter has.
 *
 * Fallback (selected name doesn't parse, or no convention-named sprint follows):
 * by start date via getUniqueSprints.
 *
 * Shared by the burndown engine (carry-over exclusion) and the sprint-summary
 * engine (carried-over bucket) so both apply the same team-confirmed definition.
 */
export function resolveNextSprintName(
  allRows: SprintRow[],
  selectedSprint: string,
): string | null {
  const names = new Set<string>();
  for (const r of allRows) {
    const n = r.sprint.trim();
    if (n) names.add(n);
  }

  const selOrder = parseSprintOrder(selectedSprint);
  if (selOrder) {
    let bestName: string | null = null;
    let bestOrder: SprintOrder | null = null;
    for (const name of names) {
      if (name === selectedSprint) continue;
      const o = parseSprintOrder(name);
      if (!o || compareOrder(o, selOrder) <= 0) continue; // not strictly after
      if (bestOrder === null || compareOrder(o, bestOrder) < 0) {
        bestOrder = o;
        bestName = name;
      }
    }
    if (bestName) return bestName;
  }

  // Date-based fallback.
  const sprints = getUniqueSprints(allRows); // newest-first, YYYY-MM-DD dates
  const selected = sprints.find((s) => s.id === selectedSprint);
  if (!selected) return null;
  let next: { id: string; startDate: string } | null = null;
  for (const s of sprints) {
    if (s.startDate <= selected.startDate) continue;
    if (next === null || s.startDate < next.startDate) next = s;
  }
  return next ? next.id : null;
}

/**
 * Build a unique key identifying an Asana task across sprints.
 * The task permalink (Link to Task) is the reliable unique identifier — the
 * same task synced into multiple sprint projects produces rows that share it.
 * Falls back to the task title when a link is missing.
 */
function taskKey(row: SprintRow): string {
  const link = row.linkToTask?.trim();
  if (link) return link;
  return row.tasksTitle?.trim() ?? '';
}

/**
 * Recurring-task markers: (DT) daily, (WT) weekly, (ST) sprintly. These tasks
 * are planned, but a new instance is spawned mid-sprint whenever the previous one
 * is completed — so their "Date Assigned" looks mid-sprint even though it isn't
 * unplanned scope. Checked in both the Recurring Task column and the task title.
 */
const RECURRING_MARKER = /\((?:DT|WT|ST)\)/i;

function isRecurringTask(row: SprintRow): boolean {
  return RECURRING_MARKER.test(row.recurringTask) || RECURRING_MARKER.test(row.tasksTitle);
}

/**
 * Map each task to the set of distinct sprints it appears in, across ALL rows.
 * A task spanning more than one sprint was added/carried over to another sprint.
 */
function buildTaskSprintMap(allRows: SprintRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of allRows) {
    const key = taskKey(row);
    const sprint = row.sprint?.trim();
    if (!key || !sprint) continue;
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(sprint);
  }
  return map;
}

/**
 * Main computation function
 * Takes filtered rows for a sprint, computes daily burndown, returns chart data + QA flags.
 * `allRows` (all sprints' rows) is used to detect tasks that also belong to other sprints.
 */
export function computeBurndown(
  sprintRows: SprintRow[],
  allottedPoints: number,
  allRows: SprintRow[] = sprintRows
): Omit<BurndownResponse, 'sprintId' | 'computedAt'> {
  if (sprintRows.length === 0) {
    throw new Error('No tasks found for this sprint');
  }

  // Parse sprint dates from the first row
  const firstRow = sprintRows[0];
  const startDate = parseDate(firstRow.sprintDateStart);
  const endDate = parseDate(firstRow.sprintDateEnd);

  if (!startDate || !endDate) {
    throw new Error('Invalid sprint date format');
  }

  // Calculate date range
  // Display range: always show full sprint (start to end)
  // Completion cutoff: only count completed work up to today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeEnd = endDate; // Always show full sprint range
  const completionCutoff = today; // But only count completions up to today

  // Sprint duration
  const totalSprintDays = daysBetween(startDate, endDate) + 1;
  const dailyIdealBurn = parseFloat(
    (allottedPoints / (totalSprintDays - 1)).toFixed(2)
  );

  console.log(
    `[burndown] Sprint: ${firstRow.sprint}, Days: ${totalSprintDays}, Allotted: ${allottedPoints}, Daily Burn: ${dailyIdealBurn}`
  );

  // The same Asana task can appear in this sprint AND the next (carried over /
  // added forward). Per the team-confirmed definition (see sprint-summary-engine),
  // such a task's points belong to the sprint it was carried INTO — so a
  // "Complete" row whose task also appears in the next sprint is NOT counted as
  // this sprint's consumption. Collect the task links present in the next sprint.
  const currentSprint = firstRow.sprint?.trim() ?? '';
  const nextSprintName = resolveNextSprintName(allRows, currentSprint);
  const nextSprintLinks = new Set<string>();
  if (nextSprintName) {
    for (const r of allRows) {
      if (r.sprint?.trim() !== nextSprintName) continue;
      const link = r.linkToTask?.trim();
      if (link) nextSprintLinks.add(link);
    }
  }

  // Build daily completion map
  const dailyCompletionMap = new Map<string, number>();
  const qaFlags: QAFlag[] = [];
  let totalConsumedPoints = 0;

  for (const row of sprintRows) {
    if (row.status !== 'Complete') {
      // Incomplete task with missing story points → QA flag only
      if (row.storyPoints.trim() === '' || isNaN(parseFloat(row.storyPoints))) {
        qaFlags.push({
          type: 'incomplete_missing_story_points',
          ...flagBase(row),
        });
      }
      continue;
    }

    // Carried over / added to the NEXT sprint → its points are consumed by that
    // sprint, not this one. Mirrors the Sprint Summary's team-confirmed rule
    // ("Completed = Complete AND not carried over") so the two views agree. A
    // late completion that was NOT pushed forward still counts here, even when it
    // landed a few days after the sprint end (handled by the clamp further down).
    const link = row.linkToTask?.trim();
    if (link && nextSprintLinks.has(link)) {
      continue;
    }

    // Task is complete
    const sp = parseFloat(row.storyPoints) || 0; // Default to 0 if missing

    // Flag if missing story points, but still count it
    if (row.storyPoints.trim() === '' || isNaN(parseFloat(row.storyPoints))) {
      qaFlags.push({
        type: 'complete_missing_story_points',
        ...flagBase(row),
      });
      // Still count it with 0 points
    }

    // Resolve burndown date
    const burndownDate = resolveBurndownDate(row);
    if (!burndownDate) {
      qaFlags.push({
        type: 'complete_missing_date',
        ...flagBase(row),
      });
      continue; // Skip if no date at all
    }

    const dateStr = toDateString(burndownDate);

    // A completion dated outside the sprint window is still counted — a task
    // finished a few days late but never carried forward belongs to this sprint.
    // We only surface it as a QA flag for visibility.
    if (isDateBefore(burndownDate, startDate) || isDateAfter(burndownDate, endDate)) {
      qaFlags.push({
        type: 'date_outside_sprint',
        ...flagBase(row),
        date: dateStr,
        sprintStart: toDateString(startDate),
        sprintEnd: toDateString(endDate),
      });
    }

    // Count it unless dated after today (an in-progress sprint shouldn't count
    // future-dated completions). Attribute it to a day INSIDE the sprint window —
    // a late/early completion is clamped to the last/first sprint day — so the
    // burndown line's final point reflects every counted point. This guarantees
    // totalConsumedPoints equals the chart's final cumulative, and the line dips
    // below zero whenever the sprint over-delivers.
    if (!isDateAfter(burndownDate, completionCutoff)) {
      const plotDate = isDateBefore(burndownDate, startDate)
        ? startDate
        : isDateAfter(burndownDate, endDate)
          ? endDate
          : burndownDate;
      const plotDateStr = toDateString(plotDate);
      dailyCompletionMap.set(plotDateStr, (dailyCompletionMap.get(plotDateStr) ?? 0) + sp);
      totalConsumedPoints += sp;
    }
  }

  // Generate daily burndown series
  const days: BurndownDay[] = [];
  let cumulativeCompleted = 0;
  let dayIndex = 0;
  const cursor = new Date(startDate);

  while (cursor <= rangeEnd) {
    const dateStr = toDateString(cursor);
    const isFuture = isDateAfter(cursor, completionCutoff);
    const dailySP = dailyCompletionMap.get(dateStr) ?? 0;

    if (!isFuture) {
      cumulativeCompleted += dailySP;
    }
    const actualRemaining = isFuture ? null : allottedPoints - cumulativeCompleted;
    const idealRemaining = Math.round(
      Math.max(0, allottedPoints - dayIndex * dailyIdealBurn)
    );

    days.push({
      date: dateStr,
      displayDate: formatDisplayDate(cursor),
      dailyCompletedSP: dailySP,
      cumulativeCompletedSP: cumulativeCompleted,
      actualRemainingSP: actualRemaining,
      idealRemainingSP: idealRemaining,
      allottedPoints,
    });

    cursor.setDate(cursor.getDate() + 1);
    dayIndex++;
  }

  // Detect tasks in the selected sprint that also appear in other sprints
  // (i.e. carried over / added to another sprint).
  const taskSprintMap = buildTaskSprintMap(allRows);
  const seenTasks = new Set<string>();
  for (const row of sprintRows) {
    const key = taskKey(row);
    if (!key || seenTasks.has(key)) continue;
    seenTasks.add(key);

    const sprintsForTask = taskSprintMap.get(key);
    if (sprintsForTask && sprintsForTask.size > 1) {
      const otherSprints = Array.from(sprintsForTask)
        .filter((s) => s !== currentSprint)
        .sort();
      qaFlags.push({
        type: 'task_in_multiple_sprints',
        ...flagBase(row),
        sprints: otherSprints,
      });
    }
  }

  // Detect tasks added mid-sprint: the date the task entered the sprint falls
  // after the sprint start date, i.e. scope added after the sprint kicked off.
  // This uses "Date Added to Sprint" (when available) so backlog tasks pulled in
  // mid-sprint are caught even though they were created earlier; it falls back to
  // the creation date for rows not yet backfilled. Recurring tasks ((DT)/(WT)/(ST))
  // are excluded — they're planned, even though a fresh instance spawns mid-sprint
  // each time the previous one is completed.
  let addedPoints = 0;
  for (const row of sprintRows) {
    if (isRecurringTask(row)) continue;
    const entryDate = resolveSprintEntryDate(row);
    if (entryDate && isDateAfter(entryDate, startDate)) {
      addedPoints += parseFloat(row.storyPoints) || 0;
      qaFlags.push({
        type: 'task_added_mid_sprint',
        ...flagBase(row),
        dateAddedToSprint: toDateString(entryDate),
      });
    }
  }

  // Total story points actually in the sprint — every task, completed AND
  // incomplete. This is the running scope: compare it against allottedPoints to
  // see over/under-commitment, with addedPoints and totalConsumedPoints alongside.
  const totalSprintPoints =
    Math.round(
      sprintRows.reduce((sum, row) => sum + (parseFloat(row.storyPoints) || 0), 0) * 100,
    ) / 100;

  // Calculate burndown rate (overall): progress toward the full sprint allotment.
  const burndownRate = ((totalConsumedPoints / allottedPoints) * 100).toFixed(2);

  // Calculate burndown rate (up to date): pace vs. where the team *should* be
  // today. The denominator is the ideal cumulative burn expected by today, not
  // the full allotment — so being "on pace" reads ~100% even mid-sprint.
  // Before the sprint starts there's no expectation yet (null → shown as "—");
  // on/after the last day the expectation is the full allotment, so this
  // converges to the overall rate.
  let expectedConsumedToDate: number;
  if (isDateBefore(today, startDate)) {
    expectedConsumedToDate = 0;
  } else if (!isDateBefore(today, endDate)) {
    expectedConsumedToDate = allottedPoints;
  } else {
    const elapsedDays = daysBetween(startDate, today);
    expectedConsumedToDate = Math.min(elapsedDays * dailyIdealBurn, allottedPoints);
  }
  const burndownRateToDate =
    expectedConsumedToDate > 0
      ? `${((totalConsumedPoints / expectedConsumedToDate) * 100).toFixed(2)}%`
      : null;

  return {
    allottedPoints,
    addedPoints,
    totalSprintPoints,
    days,
    qaFlags,
    totalConsumedPoints,
    burndownRate: `${burndownRate}%`,
    burndownRateToDate,
    dailyIdealBurn,
  };
}
