import { SprintRow } from '@/types/sprint';
import { SprintCompletionStat, CompletionRateSummary } from '@/types/completion-rate';
import { AssigneeCompletionStat, AssigneeSprintStat } from '@/types/individual-cr';
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
 * Map from numeric month string to abbreviated month name used in the sheet.
 */
const MONTH_NUM_TO_ABBR: Record<string, string> = {
  '1': 'Jan', '2': 'Feb', '3': 'Mar', '4': 'Apr',
  '5': 'May', '6': 'Jun', '7': 'Jul', '8': 'Aug',
  '9': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

/**
 * Filter rows to those matching any of the given months (OR logic).
 * Empty array → return all rows (no filter).
 * Months from the UI are numeric strings ("1"-"12").
 * The sheet stores abbreviated names ("Jan"-"Dec").
 * This function handles both formats.
 */
export function filterByMonths(rows: SprintRow[], months: string[]): SprintRow[] {
  if (months.length === 0) return rows;

  // Build a set that includes both the raw input AND the abbreviated form
  const monthSet = new Set<string>();
  for (const m of months) {
    monthSet.add(m);
    const abbr = MONTH_NUM_TO_ABBR[m];
    if (abbr) monthSet.add(abbr);
  }

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

/**
 * Filter rows to those matching any of the given roles (OR logic).
 * Empty array → return all rows (no filter).
 * Empty string '' matches blank/missing role.
 */
export function filterByRoles(rows: SprintRow[], roles: string[]): SprintRow[] {
  if (roles.length === 0) return rows;
  const roleSet = new Set(roles);
  return rows.filter((row) => {
    const rowRole = row.role && row.role.trim() ? row.role.trim() : '';
    return roleSet.has(rowRole);
  });
}

/**
 * Extract unique role values from rows, sorted alphabetically.
 * Blank/missing roles returned as '' (displayed as "(Blank)" in UI).
 */
export function getUniqueRoles(rows: SprintRow[]): string[] {
  const roles = new Set<string>();
  for (const row of rows) {
    const role = row.role && row.role.trim() ? row.role.trim() : '';
    roles.add(role);
  }
  return Array.from(roles).sort();
}

/**
 * Compute per-assignee completion stats, optionally broken down per sprint.
 * Returns one AssigneeCompletionStat per unique assignee, sorted alphabetically by assigneeName.
 * bySprint is populated only when selectedSprintIds.length > 1.
 */
export function computeIndividualStats(
  rows: SprintRow[],
  selectedSprintIds: string[]
): AssigneeCompletionStat[] {
  if (rows.length === 0) return [];

  // Group rows by assignee
  const byAssignee = new Map<string, SprintRow[]>();
  for (const row of rows) {
    if (!row.assigneeName || !row.assigneeName.trim()) {
      continue; // skip rows without assignee
    }
    const name = row.assigneeName.trim();
    if (!byAssignee.has(name)) {
      byAssignee.set(name, []);
    }
    byAssignee.get(name)!.push(row);
  }

  const results: AssigneeCompletionStat[] = [];

  for (const [assigneeName, assigneeRows] of byAssignee.entries()) {
    // Compute aggregate stats
    const total = assigneeRows.length;
    const completed = assigneeRows.filter(isCompleted).length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    // Determine role: most common non-blank role in this assignee's rows
    const roleMap = new Map<string, number>();
    for (const row of assigneeRows) {
      const role = row.role && row.role.trim() ? row.role.trim() : '';
      if (role) {
        // Only count non-blank roles for frequency
        roleMap.set(role, (roleMap.get(role) || 0) + 1);
      }
    }
    let primaryRole = '';
    let maxCount = 0;
    for (const [role, count] of roleMap.entries()) {
      if (count > maxCount) {
        maxCount = count;
        primaryRole = role;
      }
    }

    // Compute per-sprint stats if multiple sprints selected
    let bySprint: AssigneeSprintStat[] = [];
    if (selectedSprintIds.length > 1) {
      const bySprintMap = new Map<string, { total: number; completed: number }>();

      for (const row of assigneeRows) {
        const sprintId = row.sprint;
        if (!bySprintMap.has(sprintId)) {
          bySprintMap.set(sprintId, { total: 0, completed: 0 });
        }
        const stat = bySprintMap.get(sprintId)!;
        stat.total += 1;
        if (isCompleted(row)) {
          stat.completed += 1;
        }
      }

      // Convert to AssigneeSprintStat array, ordered by selectedSprintIds
      const sprintOrder = new Map(selectedSprintIds.map((id, idx) => [id, idx]));
      const sprintStats: AssigneeSprintStat[] = [];
      for (const [sprintId, stat] of bySprintMap.entries()) {
        const rate = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
        sprintStats.push({
          sprintId,
          total: stat.total,
          completed: stat.completed,
          completionRate: Math.round(rate * 100) / 100,
        });
      }

      // Sort by selected sprint order
      sprintStats.sort((a, b) => {
        const orderA = sprintOrder.get(a.sprintId) ?? Infinity;
        const orderB = sprintOrder.get(b.sprintId) ?? Infinity;
        return orderA - orderB;
      });

      bySprint = sprintStats;
    }

    results.push({
      assigneeName,
      role: primaryRole,
      total,
      completed,
      completionRate: Math.round(completionRate * 100) / 100,
      bySprint,
    });
  }

  // Sort alphabetically by assignee name
  results.sort((a, b) => a.assigneeName.localeCompare(b.assigneeName));

  return results;
}
