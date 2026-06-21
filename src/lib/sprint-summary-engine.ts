import { SprintRow } from '@/types/sprint';
import { AssigneeSummary, SprintSummaryResponse } from '@/types/sprint-summary';
import { getUniqueSprints } from './burndown-engine';

/**
 * Sprint Summary engine — pure port of the legacy Google Apps Script
 * `SprintPlanning.generateEnhancedSprintSummary`.
 *
 * Given all sprint rows (already mapped + Augment-filtered by row-mapper) and a
 * selected sprint name, it computes the totals, completion rate, hours, the
 * per-assignee breakdown, and the Completed / Transferred / Next-Sprint task-URL
 * lists. No I/O — the API route fetches the rows and hands them in.
 */

/**
 * Display/order source of truth for known team members, ported verbatim from
 * the script's `nameOrder`. A row's assignee is matched to one of these names
 * by a case-insensitive whole-word match against the assignee's full name.
 * Anyone not matched here is treated as an "other" assignee.
 */
const NAME_ORDER = [
  'Krasimir',
  'Nikolay',
  'Alex',
  'Eric',
  'Artem',
  'JC',
  'Karim',
  'Shierraine',
  'Marion',
  'Gio',
  'Sing',
] as const;

interface MutableAssignee {
  total: number;
  completed: number;
  hoursEstimate: number;
  hoursActual: number;
}

/**
 * Resolve a row's display assignee, matching the script's logic:
 *  - whole-word match against NAME_ORDER (case-insensitive) → canonical name
 *  - otherwise the raw email (if it looks like one) or the capitalized first name
 *  - blank assignee → "Unknown"
 * Returns the resolved name and whether it's a known (NAME_ORDER) member.
 */
function resolveAssignee(assigneeFullName: string): {
  name: string;
  isKnown: boolean;
} {
  if (!assigneeFullName) return { name: 'Unknown', isKnown: false };

  const words = assigneeFullName.toLowerCase().trim().split(/\s+/);
  const match = NAME_ORDER.find((n) => words.includes(n.toLowerCase()));
  if (match) return { name: match, isKnown: true };

  if (assigneeFullName.includes('@')) {
    return { name: assigneeFullName, isKnown: false };
  }

  const first = assigneeFullName.split(/\s+/)[0] ?? assigneeFullName;
  const capitalized =
    first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  return { name: capitalized, isKnown: false };
}

/**
 * Resolve the sprint whose start date is the smallest one strictly greater than
 * the selected sprint's start date. Reuses getUniqueSprints (reverse-chrono,
 * normalized YYYY-MM-DD start dates) so date parsing/ordering lives in one place.
 * Returns null if the selected sprint has no known start date or is the newest.
 */
function resolveNextSprintName(
  allRows: SprintRow[],
  selectedSprint: string,
): string | null {
  const sprints = getUniqueSprints(allRows); // sorted newest-first
  const selected = sprints.find((s) => s.id === selectedSprint);
  if (!selected) return null;

  // YYYY-MM-DD strings compare lexicographically in chronological order.
  let next: { id: string; startDate: string } | null = null;
  for (const s of sprints) {
    if (s.startDate <= selected.startDate) continue;
    if (next === null || s.startDate < next.startDate) next = s;
  }
  return next ? next.id : null;
}

export function computeSprintSummary(
  allRows: SprintRow[],
  selectedSprint: string,
): SprintSummaryResponse {
  const target = selectedSprint.trim();
  const tasks = allRows.filter((r) => r.sprint.trim() === target);
  if (tasks.length === 0) {
    throw new Error(`No tasks found for sprint: ${selectedSprint}`);
  }

  let totalTasks = 0;
  let completedTasks = 0;
  let totalHoursEstimate = 0;
  let totalHoursActual = 0;

  const metrics: Record<string, MutableAssignee> = {};
  const otherAssignees = new Set<string>();
  const completedTaskUrls: string[] = [];
  const transferredTaskUrls: string[] = [];

  for (const row of tasks) {
    const status = row.status.trim();
    const { name, isKnown } = resolveAssignee(row.assigneeName.trim());
    if (!isKnown && name !== 'Unknown') otherAssignees.add(name);

    const hoursEstimate = parseFloat(row.hoursEstimate) || 0;
    const hoursActual = parseFloat(row.hoursActual) || 0;
    const isRecurring = row.recurringTask.trim().length > 0;

    totalTasks++;
    totalHoursEstimate += hoursEstimate;
    totalHoursActual += hoursActual;

    if (!metrics[name]) {
      metrics[name] = { total: 0, completed: 0, hoursEstimate: 0, hoursActual: 0 };
    }
    metrics[name].total++;
    metrics[name].hoursEstimate += hoursEstimate;
    metrics[name].hoursActual += hoursActual;

    if (status === 'Complete') {
      completedTasks++;
      metrics[name].completed++;
      if (!isRecurring) completedTaskUrls.push(row.linkToTask);
    } else if (!isRecurring) {
      transferredTaskUrls.push(row.linkToTask);
    }
  }

  // Build the ordered assignee list: known members (in NAME_ORDER) first, then
  // any other assignees alphabetically. Only assignees with at least one task
  // are emitted. (Faithful quirk: "Unknown" contributes to totals but is never
  // listed, since it's neither in NAME_ORDER nor added to otherAssignees.)
  const toSummary = (name: string): AssigneeSummary => {
    const m = metrics[name];
    return {
      name,
      total: m.total,
      completed: m.completed,
      completionRate: (m.completed / m.total) * 100,
      hoursEstimate: m.hoursEstimate,
      hoursActual: m.hoursActual,
    };
  };

  const assignees: AssigneeSummary[] = [
    ...NAME_ORDER.filter((n) => metrics[n] && metrics[n].total > 0),
    ...Array.from(otherAssignees)
      .sort()
      .filter((n) => metrics[n] && metrics[n].total > 0),
  ].map(toSummary);

  // Next sprint: resolve by date, then pull its (non-recurring) tasks by name.
  const nextSprintName = resolveNextSprintName(allRows, target);
  const nextSprintTaskUrls: string[] = [];
  let warning: string | null = null;

  if (nextSprintName) {
    for (const row of allRows) {
      if (row.sprint.trim() !== nextSprintName) continue;
      if (row.recurringTask.trim().length > 0) continue; // DT/recurring excluded
      nextSprintTaskUrls.push(row.linkToTask);
    }
  } else {
    warning =
      'Next sprint not found — sync the next sprint into the data, then regenerate.';
  }

  return {
    sprintId: target,
    totalTasks,
    completedTasks,
    completionRate: (completedTasks / totalTasks) * 100,
    totalHoursEstimate,
    totalHoursActual,
    assignees,
    completedTaskUrls,
    transferredTaskUrls,
    nextSprintName,
    nextSprintTaskUrls,
    warning,
    computedAt: new Date().toISOString(),
  };
}
