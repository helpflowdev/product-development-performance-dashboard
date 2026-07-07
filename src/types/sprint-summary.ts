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
 * `total` is the assignee's plotted (non-recurring) task count.
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
 * Full computed summary for one sprint. All counts/lists cover EVERY task in the
 * sprint, including recurring (DT)/(WT)/(ST) — unlike the burndown.
 */
export interface SprintSummaryResponse {
  sprintId: string;

  plottedCount: number; // total tasks plotted in the sprint (incl. recurring)
  completedCount: number; // Complete AND not carried over
  carriedOverCount: number; // also appears in the next sprint
  incompleteCount: number; // not Complete AND not carried over
  completionRate: number; // completedCount / plottedCount * 100

  totalHoursEstimate: number;
  totalHoursActual: number;

  // Story points (sprint-aware, same completed/carried-over rule as the counts).
  totalStoryPointsPlotted: number; // sum of storyPoints across all sprint tasks
  totalStoryPointsCompleted: number; // sum where Complete AND not carried over
  storyPointBurndownRate: number; // completed / plotted * 100 (0 when plotted === 0)

  // Trend: quarter-to-date completion rate (same year+quarter, up to this sprint).
  // null when the sprint id can't be parsed into a quarter.
  qtdCompletionRate: number | null;

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
  error?: string;
}
