/**
 * A single day's burndown data
 */
export interface BurndownDay {
  date: string;                            // YYYY-MM-DD (for chart x-axis consistency)
  displayDate: string;                     // "Mar 12" (human-readable)
  dailyCompletedSP: number;
  cumulativeCompletedSP: number;
  actualRemainingSP: number | null;
  idealRemainingSP: number;
  allottedPoints: number;
}

/**
 * QA flag type
 */
export type QAFlagType =
  | 'complete_missing_date'
  | 'complete_missing_story_points'
  | 'date_outside_sprint'
  | 'incomplete_missing_story_points'
  | 'task_in_multiple_sprints'
  | 'task_added_mid_sprint';

/**
 * A single QA flag
 */
export interface QAFlag {
  type: QAFlagType;
  taskTitle: string;
  taskUrl?: string;
  assignee?: string;
  status?: string;                         // task status: "Complete" | "Incomplete"
  date?: string;                           // for date_outside_sprint: the completion date
  dateAssigned?: string;                   // for task_added_mid_sprint: the assigned (creation) date
  sprintStart?: string;
  sprintEnd?: string;
  sprints?: string[];                      // for task_in_multiple_sprints: the OTHER sprints this task also appears in
}

/**
 * Response from POST /api/burndown
 */
export interface BurndownResponse {
  sprintId: string;
  allottedPoints: number;
  addedPoints: number;                    // story points of tasks added after sprint start (recurring excluded)
  days: BurndownDay[];
  qaFlags: QAFlag[];
  totalConsumedPoints: number;
  burndownRate: string;                   // overall: consumed ÷ full allotment, e.g. "96.17%"
  burndownRateToDate: string | null;      // up to date: consumed ÷ ideal-expected-by-today; null before sprint starts
  dailyIdealBurn: number;                 // expected story points to burn per day
  computedAt: string;                     // ISO timestamp
}

/**
 * Request to POST /api/burndown
 */
export interface BurndownRequest {
  sprintId: string;
  allottedPoints: number;
}
