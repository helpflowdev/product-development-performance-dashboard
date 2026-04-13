/**
 * A single day's burndown data
 */
export interface BurndownDay {
  date: string;                            // YYYY-MM-DD (for chart x-axis consistency)
  displayDate: string;                     // "Mar 12" (human-readable)
  dailyCompletedSP: number;
  cumulativeCompletedSP: number;
  actualRemainingSP: number;
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
  | 'incomplete_missing_story_points';

/**
 * A single QA flag
 */
export interface QAFlag {
  type: QAFlagType;
  taskTitle: string;
  taskUrl?: string;
  assignee?: string;
  date?: string;
  sprintStart?: string;
  sprintEnd?: string;
}

/**
 * Response from POST /api/burndown
 */
export interface BurndownResponse {
  sprintId: string;
  allottedPoints: number;
  days: BurndownDay[];
  qaFlags: QAFlag[];
  totalConsumedPoints: number;
  burndownRate: string;                   // e.g. "96.17%"
  computedAt: string;                     // ISO timestamp
}

/**
 * Request to POST /api/burndown
 */
export interface BurndownRequest {
  sprintId: string;
  allottedPoints: number;
}
