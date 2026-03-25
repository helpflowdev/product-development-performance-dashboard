import { SprintRow, SprintMeta } from '@/types/sprint';
import { BurndownDay, BurndownResponse, QAFlag, QAFlagType } from '@/types/burndown';
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
 * Main computation function
 * Takes filtered rows for a sprint, computes daily burndown, returns chart data + QA flags
 */
export function computeBurndown(
  sprintRows: SprintRow[],
  allottedPoints: number
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
          taskTitle: row.tasksTitle,
          assignee: row.assigneeName,
        });
      }
      continue;
    }

    // Task is complete
    const sp = parseFloat(row.storyPoints) || 0; // Default to 0 if missing

    // Flag if missing story points, but still count it
    if (row.storyPoints.trim() === '' || isNaN(parseFloat(row.storyPoints))) {
      qaFlags.push({
        type: 'complete_missing_story_points',
        taskTitle: row.tasksTitle,
        assignee: row.assigneeName,
      });
      // Still count it with 0 points
    }

    // Resolve burndown date
    const burndownDate = resolveBurndownDate(row);
    if (!burndownDate) {
      qaFlags.push({
        type: 'complete_missing_date',
        taskTitle: row.tasksTitle,
        assignee: row.assigneeName,
      });
      continue; // Skip if no date at all
    }

    const dateStr = toDateString(burndownDate);

    // Check if date is outside sprint window (warning, but still count it)
    if (isDateBefore(burndownDate, startDate) || isDateAfter(burndownDate, endDate)) {
      qaFlags.push({
        type: 'date_outside_sprint',
        taskTitle: row.tasksTitle,
        date: dateStr,
        sprintStart: toDateString(startDate),
        sprintEnd: toDateString(endDate),
      });
    }

    // Only add to daily completion and total if the completion date is on or before today
    if (isDateBefore(burndownDate, completionCutoff) || toDateString(burndownDate) === toDateString(completionCutoff)) {
      dailyCompletionMap.set(dateStr, (dailyCompletionMap.get(dateStr) ?? 0) + sp);
      totalConsumedPoints += sp;
    }
  }

  // Generate daily burndown series
  const days: BurndownDay[] = [];
  let cumulativeCompleted = 0;
  let dayIndex = 0;
  let cursor = new Date(startDate);

  while (cursor <= rangeEnd) {
    const dateStr = toDateString(cursor);
    const dailySP = dailyCompletionMap.get(dateStr) ?? 0;

    cumulativeCompleted += dailySP;
    const actualRemaining = Math.max(0, allottedPoints - cumulativeCompleted);
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

  // Calculate burndown rate
  const burndownRate = ((totalConsumedPoints / allottedPoints) * 100).toFixed(2);

  return {
    allottedPoints,
    days,
    qaFlags,
    totalConsumedPoints,
    burndownRate: `${burndownRate}%`,
  };
}
