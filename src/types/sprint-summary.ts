/**
 * Sprint Summary types.
 *
 * Mirrors the output of the legacy Google Apps Script
 * `SprintPlanning.generateEnhancedSprintSummary` — totals, completion rate,
 * hours, a per-assignee breakdown, and the Completed / Transferred / Next-Sprint
 * task-URL lists. Computed by `src/lib/sprint-summary-engine.ts`.
 */

/**
 * Per-assignee roll-up for a single sprint.
 * `hoursEstimate`/`hoursActual` are kept raw; the UI and the Asana comment
 * round them with Math.ceil at display time (matching the script).
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
 * Full computed summary for one sprint.
 */
export interface SprintSummaryResponse {
  sprintId: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number; // (completedTasks / totalTasks) * 100
  totalHoursEstimate: number;
  totalHoursActual: number;
  // Ordered: known team members (NAME_ORDER, with tasks) first, then any other
  // assignees sorted alphabetically.
  assignees: AssigneeSummary[];
  completedTaskUrls: string[]; // status "Complete", non-recurring
  transferredTaskUrls: string[]; // not complete, non-recurring
  nextSprintName: string | null;
  nextSprintTaskUrls: string[]; // all statuses, non-recurring (DT excluded)
  // Set when the next sprint can't be resolved (e.g. not yet synced). When this
  // is non-null, nextSprintName is null and nextSprintTaskUrls is empty.
  warning: string | null;
  computedAt: string; // ISO timestamp
}

/**
 * Result of pushing a summary to Asana.
 */
export interface SendToAsanaResult {
  success: boolean;
  sprintId: string;
  taskGid?: string;
  taskUrl?: string;
  commentsPosted?: number;
  error?: string;
}
