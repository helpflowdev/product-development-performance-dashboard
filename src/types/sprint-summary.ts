/**
 * Sprint Summary types.
 *
 * Evolved from the legacy Google Apps Script macro. Task lists are now grouped
 * per assignee and carry the task title (for hyperlinked display), and the
 * completed/carried-over split is sprint-aware:
 *   - Carried Over = the same Asana task also appears in the NEXT sprint.
 *   - Completed    = status "Complete" AND not carried over.
 * Computed by `src/lib/sprint-summary-engine.ts`.
 */

/** A single task shown as a hyperlinked title. */
export interface TaskRef {
  title: string;
  url: string;
}

/** Tasks for one assignee within a list (e.g. all of Gio's completed tasks). */
export interface AssigneeTaskGroup {
  assignee: string;
  tasks: TaskRef[];
}

/**
 * Per-assignee roll-up for the breakdown table.
 * `completed` follows the sprint-aware definition (Complete AND not carried over).
 * `total` is the assignee's plotted task count — mid-sprint additions excluded,
 * so it is 0 for someone whose only tasks were added mid-sprint (they're kept in
 * the list only for their hours; show no rate for them).
 * Hours cover ALL the assignee's tasks, mid-sprint additions included.
 */
export interface AssigneeSummary {
  name: string;
  total: number;
  completed: number;
  completionRate: number; // (completed / total) * 100
  hoursEstimate: number;
  hoursActual: number;
}

/**
 * Full computed summary for one sprint. Counts, rates and lists cover every task
 * in the sprint, including recurring (DT)/(WT)/(ST) — unlike the burndown — EXCEPT
 * mid-sprint additions (title ends in "(mid sprint)", in a sprint mid-sprint.ts
 * covers — only S2 for now), which are left out of every
 * count and rate and listed separately in midSprintTasks. Hours and story points
 * still include them.
 */
export interface SprintSummaryResponse {
  sprintId: string;

  plottedCount: number; // tasks plotted in the sprint (incl. recurring, excl. mid-sprint)
  completedCount: number; // Complete AND not carried over
  carriedOverCount: number; // also appears in the next sprint
  incompleteCount: number; // not Complete AND not carried over
  completionRate: number; // completedCount / plottedCount * 100

  totalHoursEstimate: number; // all tasks, mid-sprint additions included
  totalHoursActual: number; // all tasks, mid-sprint additions included

  // Story points (sprint-aware, same completed/carried-over rule as the counts).
  // Mid-sprint additions included, like hours.
  totalStoryPointsPlotted: number; // sum of storyPoints across all sprint tasks
  totalStoryPointsCompleted: number; // sum where Complete AND not carried over
  storyPointBurndownRate: number; // completed / plotted * 100 (0 when plotted === 0)

  // Trend: quarter-to-date completion rate (same year+quarter, up to this sprint),
  // mid-sprint additions excluded from every sprint in range.
  // null when the sprint id can't be parsed into a quarter.
  qtdCompletionRate: number | null;

  // Mid-sprint additions: tasks whose title ends in "(mid sprint)" (Security Issue
  // process), in a sprint mid-sprint.ts covers (only S2 for now; 0 elsewhere).
  // Shown for visibility only — NOT in any count or rate above.
  midSprintCount: number;
  midSprintCompletedCount: number; // of those, Status === "Complete"
  midSprintTasks: AssigneeTaskGroup[];

  // Per-assignee breakdown, ordered: known team members first, then others, Unknown last.
  assignees: AssigneeSummary[];

  // Task lists, each grouped by assignee in the same canonical order.
  completedTasks: AssigneeTaskGroup[];
  carriedOverTasks: AssigneeTaskGroup[]; // added to the next sprint (any status)
  incompleteTasks: AssigneeTaskGroup[]; // unfinished and not carried over

  nextSprintName: string | null;
  nextSprintTasks: AssigneeTaskGroup[]; // the next sprint's full plotted list

  // Short AI-generated "what this sprint focused on" summary (non-recurring tasks
  // only). null when GEMINI_API_KEY isn't set or generation failed — the
  // operator can still type a focus note manually before sending.
  focusSummary: string | null;
  // Short reason shown in the UI when focusSummary is null because generation
  // failed (bad key, model issue, timeout). null when no key is set (expected) or
  // when generation succeeded.
  focusSummaryError: string | null;

  // Set when the next sprint can't be resolved (e.g. not yet synced). Carry-over
  // detection can't run without it, so carriedOver falls back to empty.
  warning: string | null;

  computedAt: string; // ISO timestamp
}

/** Result of pushing a summary to Asana. */
export interface SendToAsanaResult {
  success: boolean;
  sprintId: string;
  taskGid?: string;
  taskUrl?: string;
  commentsPosted?: number;
  reused?: boolean; // true when an existing subtask was reused (not created)
  /**
   * How the target subtask was resolved: matched this sprint's title, matched the
   * open subtask due today (pre-created by duplication), or none existed so a
   * fresh subtask was created.
   */
  matchedBy?: 'title' | 'due-today' | 'created';
  renamedFrom?: string; // previous title, when a reused subtask was retitled
  /**
   * The summary comment posted, but Asana stored it as literal text instead of
   * rich text — so the cc'd collaborators were named without being @mentioned,
   * and none of them got a notification. Worth telling the operator: the numbers
   * are in Asana, the people weren't pinged.
   */
  mentionsFailed?: boolean;
  error?: string;
}
