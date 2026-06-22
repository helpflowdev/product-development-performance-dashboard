import { SprintRow } from '@/types/sprint';
import {
  AssigneeSummary,
  AssigneeTaskGroup,
  SprintSummaryResponse,
  TaskRef,
} from '@/types/sprint-summary';
import { resolveNextSprintName } from './burndown-engine';

/**
 * Sprint Summary engine.
 *
 * Computes, for a selected sprint: the plotted/completed/carried-over counts,
 * completion rate, hours, a per-assignee breakdown, and the Completed /
 * Carried-Over / Incomplete / Next-Sprint task lists (each grouped by assignee
 * with task titles for hyperlinked display). No I/O — the route hands in rows.
 *
 * Definitions (confirmed with the team):
 *   - Carried Over: the same Asana task (by link) also appears in the NEXT sprint.
 *   - Completed:    status "Complete" AND not carried over.
 *   - Incomplete:   not "Complete" AND not carried over.
 *   - Plotted:      ALL tasks in the sprint (= the three buckets).
 * Unlike the burndown, recurring (DT)/(WT)/(ST) tasks ARE included here.
 */

/**
 * Display/order source of truth for known team members (from the legacy macro's
 * `nameOrder`). A row's assignee is matched to one of these by a case-insensitive
 * whole-word match against the full name; anyone else is an "other" assignee.
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

const NAME_ORDER_SET = new Set<string>(NAME_ORDER);

/**
 * Recurring-task markers (DT/WT/ST). The summary counts and lists these, but the
 * AI focus summary excludes them — see getNonRecurringTaskTitles.
 */
const RECURRING_MARKER = /\((?:DT|WT|ST)\)/i;
function isRecurring(row: SprintRow): boolean {
  return RECURRING_MARKER.test(row.recurringTask) || RECURRING_MARKER.test(row.tasksTitle);
}

/**
 * Distinct non-recurring task titles for a sprint — the input to the AI focus
 * summary (recurring DT/WT/ST tasks excluded, blanks dropped, de-duplicated).
 */
export function getNonRecurringTaskTitles(
  allRows: SprintRow[],
  selectedSprint: string,
): string[] {
  const target = selectedSprint.trim();
  const seen = new Set<string>();
  for (const row of allRows) {
    if (row.sprint.trim() !== target || isRecurring(row)) continue;
    const title = row.tasksTitle.trim();
    if (title) seen.add(title);
  }
  return [...seen];
}

interface MutableAssignee {
  total: number;
  completed: number;
  hoursEstimate: number;
  hoursActual: number;
}

/**
 * Resolve a row's display assignee (canonical NAME_ORDER name, else email or
 * capitalized first name, else "Unknown") — ported from the macro.
 */
function resolveAssignee(assigneeFullName: string): string {
  if (!assigneeFullName) return 'Unknown';

  const words = assigneeFullName.toLowerCase().trim().split(/\s+/);
  const match = NAME_ORDER.find((n) => words.includes(n.toLowerCase()));
  if (match) return match;

  if (assigneeFullName.includes('@')) return assigneeFullName;

  const first = assigneeFullName.split(/\s+/)[0] ?? assigneeFullName;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** Canonical assignee order: known team (NAME_ORDER) → others (alpha) → Unknown. */
function canonicalOrder(names: Iterable<string>): string[] {
  const present = new Set(names);
  const known = NAME_ORDER.filter((n) => present.has(n));
  const others = [...present]
    .filter((n) => !NAME_ORDER_SET.has(n) && n !== 'Unknown')
    .sort();
  const unknown = present.has('Unknown') ? ['Unknown'] : [];
  return [...known, ...others, ...unknown];
}

/** Group {assignee, ref} pairs into per-assignee task groups in canonical order. */
function groupByAssignee(
  items: { assignee: string; ref: TaskRef }[],
): AssigneeTaskGroup[] {
  const map = new Map<string, TaskRef[]>();
  for (const { assignee, ref } of items) {
    if (!map.has(assignee)) map.set(assignee, []);
    map.get(assignee)!.push(ref);
  }
  return canonicalOrder(map.keys()).map((assignee) => ({
    assignee,
    tasks: map.get(assignee)!,
  }));
}

/** A task's display title (falls back to the URL when the title is blank). */
function taskRef(row: SprintRow): TaskRef {
  const url = row.linkToTask.trim();
  const title = row.tasksTitle.trim() || url || '(untitled task)';
  return { title, url };
}

export function computeSprintSummary(
  allRows: SprintRow[],
  selectedSprint: string,
): SprintSummaryResponse {
  const target = selectedSprint.trim();
  const sprintTasks = allRows.filter((r) => r.sprint.trim() === target);
  if (sprintTasks.length === 0) {
    throw new Error(`No tasks found for sprint: ${selectedSprint}`);
  }

  // Resolve the next sprint and the set of task links plotted there. A selected-
  // sprint task whose link is in this set was carried over / added to the next sprint.
  const nextSprintName = resolveNextSprintName(allRows, target);
  const nextSprintRows = nextSprintName
    ? allRows.filter((r) => r.sprint.trim() === nextSprintName)
    : [];
  const nextSprintLinks = new Set<string>();
  for (const r of nextSprintRows) {
    const link = r.linkToTask.trim();
    if (link) nextSprintLinks.add(link);
  }

  const metrics: Record<string, MutableAssignee> = {};
  const completedItems: { assignee: string; ref: TaskRef }[] = [];
  const carriedOverItems: { assignee: string; ref: TaskRef }[] = [];
  const incompleteItems: { assignee: string; ref: TaskRef }[] = [];

  let totalHoursEstimate = 0;
  let totalHoursActual = 0;

  for (const row of sprintTasks) {
    const assignee = resolveAssignee(row.assigneeName.trim());
    const link = row.linkToTask.trim();
    const isComplete = row.status.trim() === 'Complete';
    const carriedOver = link.length > 0 && nextSprintLinks.has(link);
    const completed = isComplete && !carriedOver;

    const hoursEstimate = parseFloat(row.hoursEstimate) || 0;
    const hoursActual = parseFloat(row.hoursActual) || 0;
    totalHoursEstimate += hoursEstimate;
    totalHoursActual += hoursActual;

    if (!metrics[assignee]) {
      metrics[assignee] = { total: 0, completed: 0, hoursEstimate: 0, hoursActual: 0 };
    }
    metrics[assignee].total++;
    metrics[assignee].hoursEstimate += hoursEstimate;
    metrics[assignee].hoursActual += hoursActual;
    if (completed) metrics[assignee].completed++;

    const ref = taskRef(row);
    if (carriedOver) carriedOverItems.push({ assignee, ref });
    else if (completed) completedItems.push({ assignee, ref });
    else incompleteItems.push({ assignee, ref });
  }

  const plottedCount =
    completedItems.length + carriedOverItems.length + incompleteItems.length;

  // Per-assignee breakdown in canonical order (only assignees with tasks).
  const assignees: AssigneeSummary[] = canonicalOrder(Object.keys(metrics)).map(
    (name) => {
      const m = metrics[name];
      return {
        name,
        total: m.total,
        completed: m.completed,
        completionRate: m.total > 0 ? (m.completed / m.total) * 100 : 0,
        hoursEstimate: m.hoursEstimate,
        hoursActual: m.hoursActual,
      };
    },
  );

  // Next-sprint task list, grouped by assignee (all statuses).
  const nextSprintTasks = groupByAssignee(
    nextSprintRows.map((r) => ({
      assignee: resolveAssignee(r.assigneeName.trim()),
      ref: taskRef(r),
    })),
  );

  return {
    sprintId: target,
    plottedCount,
    completedCount: completedItems.length,
    carriedOverCount: carriedOverItems.length,
    incompleteCount: incompleteItems.length,
    completionRate: plottedCount > 0 ? (completedItems.length / plottedCount) * 100 : 0,
    totalHoursEstimate,
    totalHoursActual,
    assignees,
    completedTasks: groupByAssignee(completedItems),
    carriedOverTasks: groupByAssignee(carriedOverItems),
    incompleteTasks: groupByAssignee(incompleteItems),
    nextSprintName,
    nextSprintTasks,
    // Attached by the route after an async Gemini call (pure engine stays sync).
    focusSummary: null,
    focusSummaryError: null,
    warning: nextSprintName
      ? null
      : 'Next sprint not found — carry-over detection is off until the next sprint is synced into the data.',
    computedAt: new Date().toISOString(),
  };
}
