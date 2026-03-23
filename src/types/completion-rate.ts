/**
 * Sprint completion metrics
 */
export interface SprintCompletionStat {
  sprintId: string;
  sprintStartDate: string;      // YYYY-MM-DD
  sprintEndDate: string;        // YYYY-MM-DD
  week?: string;                // e.g., "WE72026" - optional, used for display
  total: number;                // total tasks in sprint
  completed: number;            // tasks completed in sprint
  completionRate: number;       // 0-100
}

/**
 * Summary metrics for filtered data
 */
export interface CompletionRateSummary {
  totalTasks: number;
  totalCompleted: number;
  completionRate: number;       // 0-100
}

/**
 * POST /api/completion-rate request
 */
export interface CompletionRateRequest {
  sprintIds?: string[];         // empty/omitted = all sprints
  assigneeNames?: string[];     // empty/omitted = all assignees
  years?: string[];             // empty/omitted = all years
  months?: string[];            // empty/omitted = all months
}

/**
 * POST /api/completion-rate response
 */
export interface CompletionRateResponse {
  summary: CompletionRateSummary;                 // aggregated across filtered rows
  sprintStats: SprintCompletionStat[];            // per-sprint breakdown of filtered rows
  allAssignees: string[];                          // full assignee list (for filter dropdown)
  computedAt: string;                              // ISO timestamp
}

/**
 * POST /api/completion-rate/compare request
 */
export interface CompareSprintsRequest {
  sprintIds: [string, string];  // exactly two sprint IDs
}

/**
 * POST /api/completion-rate/compare response
 */
export interface CompareSprintsResponse {
  sprints: [SprintCompletionStat, SprintCompletionStat];
  computedAt: string;
}
