import { SprintRow } from '@/types/sprint';
import { SprintCompletionStat, CompletionRateSummary } from '@/types/completion-rate';
import {
  AssigneeCompletionStat,
  AssigneeMonthStat,
  AssigneeSprintStat,
} from '@/types/individual-cr';
import { getUniqueSprints } from './burndown-engine';

const MONTH_NUM_TO_FULL = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_NAME_TO_NUM: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function parseMonthToNum(raw: string | undefined | null): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  const named = MONTH_NAME_TO_NUM[s.toLowerCase()];
  if (named) return named;
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (n >= 1 && n <= 12) return n;
  }
  return null;
}

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
 * The UI sends numeric strings ("1"-"12"). The sheet may store the month as
 * a number, an abbreviation ("Mar"), or a full name ("March") — all three
 * are normalized to a number before comparison.
 */
export function filterByMonths(rows: SprintRow[], months: string[]): SprintRow[] {
  if (months.length === 0) return rows;

  const wantedNums = new Set<number>();
  for (const m of months) {
    const n = parseMonthToNum(m);
    if (n) wantedNums.add(n);
  }
  if (wantedNums.size === 0) return rows;

  return rows.filter((row) => {
    const n = parseMonthToNum(row.month);
    return n !== null && wantedNums.has(n);
  });
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
 * Compute per-assignee completion stats with a Month → Sprint nested breakdown.
 * Returns one AssigneeCompletionStat per unique assignee, sorted alphabetically by assigneeName.
 * byMonth is always populated; rows without a parseable month are excluded from the breakdown
 * but still counted in the assignee totals.
 */
export function computeIndividualStats(
  rows: SprintRow[]
): AssigneeCompletionStat[] {
  if (rows.length === 0) return [];

  // Sprint metadata for sorting sprints within a month by start date
  const sprintMeta = new Map(getUniqueSprints(rows).map((s) => [s.id, s]));

  // Show year in the month label only if rows span more than one year
  const yearsInRows = new Set<string>();
  for (const row of rows) {
    if (row.year && row.year.trim()) yearsInRows.add(row.year.trim());
  }
  const showYearInLabel = yearsInRows.size > 1;

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
    // Aggregate stats
    const total = assigneeRows.length;
    const completed = assigneeRows.filter(isCompleted).length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    // Primary role: most common non-blank role in this assignee's rows
    const roleMap = new Map<string, number>();
    for (const row of assigneeRows) {
      const role = row.role && row.role.trim() ? row.role.trim() : '';
      if (role) {
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

    // Build Month → Sprint nested breakdown
    type SprintBucket = { total: number; completed: number };
    type MonthBucket = {
      year: string;
      monthNum: number;
      total: number;
      completed: number;
      sprints: Map<string, SprintBucket>;
    };
    const monthMap = new Map<string, MonthBucket>(); // key = `${year}-${MM}`

    for (const row of assigneeRows) {
      const monthNum = parseMonthToNum(row.month);
      if (!monthNum) continue; // exclude from breakdown only
      const year = (row.year ?? '').trim();
      const key = `${year}-${String(monthNum).padStart(2, '0')}`;

      let bucket = monthMap.get(key);
      if (!bucket) {
        bucket = { year, monthNum, total: 0, completed: 0, sprints: new Map() };
        monthMap.set(key, bucket);
      }
      bucket.total += 1;
      if (isCompleted(row)) bucket.completed += 1;

      const sprintId = row.sprint;
      let sprintBucket = bucket.sprints.get(sprintId);
      if (!sprintBucket) {
        sprintBucket = { total: 0, completed: 0 };
        bucket.sprints.set(sprintId, sprintBucket);
      }
      sprintBucket.total += 1;
      if (isCompleted(row)) sprintBucket.completed += 1;
    }

    const byMonth: AssigneeMonthStat[] = [];
    for (const [monthKey, bucket] of monthMap.entries()) {
      const sprints: AssigneeSprintStat[] = [];
      for (const [sprintId, s] of bucket.sprints.entries()) {
        const rate = s.total > 0 ? (s.completed / s.total) * 100 : 0;
        sprints.push({
          sprintId,
          total: s.total,
          completed: s.completed,
          completionRate: Math.round(rate * 100) / 100,
        });
      }
      // Sort sprints chronologically within the month by start date; fall back to id
      sprints.sort((a, b) => {
        const aDate = sprintMeta.get(a.sprintId)?.startDate ?? '';
        const bDate = sprintMeta.get(b.sprintId)?.startDate ?? '';
        const cmp = aDate.localeCompare(bDate);
        return cmp !== 0 ? cmp : a.sprintId.localeCompare(b.sprintId);
      });

      const fullName = MONTH_NUM_TO_FULL[bucket.monthNum];
      const monthLabel = showYearInLabel && bucket.year
        ? `${fullName} ${bucket.year}`
        : fullName;
      const monthRate = bucket.total > 0 ? (bucket.completed / bucket.total) * 100 : 0;

      byMonth.push({
        monthKey,
        monthLabel,
        total: bucket.total,
        completed: bucket.completed,
        completionRate: Math.round(monthRate * 100) / 100,
        sprints,
      });
    }

    // Months chronologically ascending
    byMonth.sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    results.push({
      assigneeName,
      role: primaryRole,
      total,
      completed,
      completionRate: Math.round(completionRate * 100) / 100,
      byMonth,
    });
  }

  results.sort((a, b) => a.assigneeName.localeCompare(b.assigneeName));

  return results;
}
