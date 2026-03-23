import { SprintRow } from '@/types/sprint';
import { SprintCompletionStat, CompletionRateSummary } from '@/types/completion-rate';
import { getUniqueSprints } from './burndown-engine';

/**
 * Check if a row should be counted toward completion rate.
 * A row is counted if it has completionRateCounter === "1"
 */
function isCompleted(row: SprintRow): boolean {
  return row.completionRateCounter === '1';
}

/**
 * Compute completion summary for an arbitrary set of rows.
 * Formula: totalCompleted / totalTasks * 100
 */
export function computeSummary(rows: SprintRow[]): CompletionRateSummary {
  const totalTasks = rows.length;
  const totalCompleted = rows.filter(isCompleted).length;
  const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

  return {
    totalTasks,
    totalCompleted,
    completionRate: Math.round(completionRate * 100) / 100, // 2 decimal places
  };
}

/**
 * Compute per-sprint statistics from rows, grouped by sprint ID.
 * Returns one SprintCompletionStat per unique sprint, sorted chronologically (ascending).
 */
export function computeSprintStats(rows: SprintRow[]): SprintCompletionStat[] {
  if (rows.length === 0) return [];

  // Get unique sprints with date metadata
  const uniqueSprints = getUniqueSprints(rows);
  const sprintMap = new Map(uniqueSprints.map((s) => [s.id, s]));

  // Group rows by sprint and compute stats
  const statsBySprint = new Map<string, { total: number; completed: number }>();

  for (const row of rows) {
    const sprintId = row.sprint;
    if (!statsBySprint.has(sprintId)) {
      statsBySprint.set(sprintId, { total: 0, completed: 0 });
    }

    const stat = statsBySprint.get(sprintId)!;
    stat.total += 1;
    if (isCompleted(row)) {
      stat.completed += 1;
    }
  }

  // Convert to SprintCompletionStat array
  const results: SprintCompletionStat[] = [];
  for (const [sprintId, stat] of statsBySprint.entries()) {
    const meta = sprintMap.get(sprintId);
    if (!meta) continue; // shouldn't happen, but be safe

    const completionRate = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;

    results.push({
      sprintId,
      sprintStartDate: meta.startDate,
      sprintEndDate: meta.endDate,
      total: stat.total,
      completed: stat.completed,
      completionRate: Math.round(completionRate * 100) / 100,
    });
  }

  // Sort chronologically by startDate (ascending)
  results.sort((a, b) => a.sprintStartDate.localeCompare(b.sprintStartDate));

  return results;
}

/**
 * Filter rows to those matching any of the given sprint IDs (OR logic).
 * Empty array → return all rows (no filter).
 */
export function filterBySprints(rows: SprintRow[], sprintIds: string[]): SprintRow[] {
  if (sprintIds.length === 0) return rows;
  const sprintSet = new Set(sprintIds);
  return rows.filter((row) => sprintSet.has(row.sprint));
}

/**
 * Filter rows to those matching any of the given years (OR logic).
 * Empty array → return all rows (no filter).
 */
export function filterByYears(rows: SprintRow[], years: string[]): SprintRow[] {
  if (years.length === 0) return rows;
  const yearSet = new Set(years);
  return rows.filter((row) => yearSet.has(row.year));
}

/**
 * Filter rows to those matching any of the given months (OR logic).
 * Empty array → return all rows (no filter).
 * Months are expected to be string representations (e.g., "1" for January, "12" for December).
 */
export function filterByMonths(rows: SprintRow[], months: string[]): SprintRow[] {
  if (months.length === 0) return rows;
  const monthSet = new Set(months);
  return rows.filter((row) => monthSet.has(row.month));
}

/**
 * Filter rows to those matching any of the given assignee names (OR logic).
 * Empty array → return all rows (no filter).
 */
export function filterByAssignees(rows: SprintRow[], assigneeNames: string[]): SprintRow[] {
  if (assigneeNames.length === 0) return rows;
  const assigneeSet = new Set(assigneeNames);
  return rows.filter((row) => assigneeSet.has(row.assigneeName));
}

/**
 * Extract unique assignee names from rows, sorted alphabetically.
 */
export function getUniqueAssignees(rows: SprintRow[]): string[] {
  const assignees = new Set<string>();
  for (const row of rows) {
    if (row.assigneeName && row.assigneeName.trim()) {
      assignees.add(row.assigneeName.trim());
    }
  }
  return Array.from(assignees).sort();
}

/**
 * Determine the current year to use for YTD calculations.
 * Returns the most recent year found in the rows, or the current calendar year.
 */
export function getCurrentYear(rows: SprintRow[]): string {
  if (rows.length === 0) {
    return new Date().getFullYear().toString();
  }

  // Find the max year value in the rows
  let maxYear = '2000';
  for (const row of rows) {
    if (row.year && row.year > maxYear) {
      maxYear = row.year;
    }
  }

  return maxYear || new Date().getFullYear().toString();
}
