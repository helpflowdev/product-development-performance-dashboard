/**
 * Weekly Scorecard types.
 *
 * The Scorecard is the leadership-facing health dashboard (companion to the
 * operational per-sprint Sprint Summary). It reuses the existing engines:
 *   - completion rate       ← completion-rate-engine (computeSummary)
 *   - QTD trend             ← completion-rate-engine (computeQtdCompletionRate)
 *   - devs vs team          ← completion-rate-engine + role/dev filter
 *   - burndown / points     ← burndown-engine (computeBurndown)
 *   - hours / per-assignee / spillover / task links ← sprint-summary-engine
 * plus two operator inputs (allotted story points, uptime note) and an analytical
 * Gemini narrative. Computed by `src/lib/scorecard-engine.ts`; the narrative is
 * attached by the route after the async call (the engine stays pure/sync).
 */

import { AssigneeSummary, AssigneeTaskGroup } from './sprint-summary';

export interface ScorecardResponse {
  sprintId: string; // the sprint the scorecard reports on (default: latest completed)
  sprintUrl: string | null; // Asana project permalink for the sprint (searched live); null if not found
  week: string; // the sprint's Week label, e.g. "WE192026" (most common in its rows; '' if none)
  dateRange: string; // "MM/DD/YYYY – MM/DD/YYYY" from the sprint dates

  completionRate: number; // this-sprint, computeSummary (final: completed ÷ all plotted)
  completionGoal: number; // target, default 95
  qtdCompletionRate: number | null; // quarter-to-date trend (replaces YTD)
  totalTasks: number;
  totalCompleted: number;

  // Running / to-date completion: of the tasks DUE on or before today (by Asana
  // due date), how many are complete. Reads ~100% mid-sprint when on pace, unlike
  // the final rate whose denominator is the whole sprint. Due dates are fetched
  // live from Asana (not in the sheet), so the route attaches these;
  // runningCompletionRate is null when no due-dated tasks are in range or the
  // lookup was unavailable (see runningCompletionError).
  runningCompletionRate: number | null; // tasksDueCompleted ÷ tasksDue * 100
  tasksDue: number; // tasks with a due date on/before today
  tasksDueCompleted: number; // of those, Status === "Complete"
  tasksNoDueDate: number; // sprint tasks with no Asana due date (excluded from running)
  runningCompletionError: string | null; // set only if the Asana due-date lookup failed

  devsCompletionRate: number; // role === "Developer" (or isDevMember) subset
  teamCompletionRate: number; // whole team

  allottedStoryPoints: number; // operator input
  consumedStoryPoints: number; // computeBurndown.totalConsumedPoints
  burndownRate: number; // computeBurndown.burndownRate (number, "%" stripped)

  uptimeNote: string; // operator input, e.g. "0% downtime for HAS and MyHF."

  // ── Pulled from the Sprint Summary engine (sprint-aware definitions) ──
  // These give the weekly a fuller operational picture: hour-variance
  // (estimation accuracy), per-named-assignee breakdown, spillover, and
  // task-level traceability. NOTE: the summary defines "Completed" as
  // Complete AND not carried over — a stricter rule than the status-based
  // headline completionRate above — so per-assignee rates and carried-over
  // counts intentionally use that lens (same duality as the two pages).
  totalHoursEstimate: number;
  totalHoursActual: number;
  assignees: AssigneeSummary[]; // per-assignee: completed/plotted % + hours
  carriedOverCount: number; // spillover into the next sprint
  carriedOverTasks: AssigneeTaskGroup[]; // hyperlinked, grouped per assignee
  completedTasks: AssigneeTaskGroup[]; // traceability
  incompleteTasks: AssigneeTaskGroup[]; // unfinished, not carried over

  narrative: string | null; // analytical summary (Gemini); null if unavailable
  narrativeError: string | null; // short reason when narrative is null (null when no key)

  computedAt: string; // ISO timestamp
}

export interface ScorecardInput {
  sprintId?: string; // default: most recent completed sprint
  allottedStoryPoints: number;
  uptimeNote?: string;
  completionGoal?: number; // default 95
}

/** Result of pushing a scorecard to Asana. */
export interface ScorecardSendResult {
  success: boolean;
  sprintId: string;
  taskGid?: string;
  taskUrl?: string;
  commentsPosted?: number;
  reused?: boolean; // true when an existing dated subtask was reused (not created)
  error?: string;
}
