/**
 * Per-sprint stats for an assignee within a month bucket
 */
export interface AssigneeSprintStat {
  sprintId: string;
  total: number;
  completed: number;
  completionRate: number; // 0-100
}

/**
 * Per-month stats for an assignee, with nested sprint breakdown
 */
export interface AssigneeMonthStat {
  monthKey: string; // sortable e.g. "2026-01"
  monthLabel: string; // display e.g. "January" or "January 2026" when multi-year
  total: number;
  completed: number;
  completionRate: number; // 0-100
  sprints: AssigneeSprintStat[]; // nested sprint breakdown for this month
}

/**
 * Completion stats for a single assignee across selected sprints
 */
export interface AssigneeCompletionStat {
  assigneeName: string;
  role: string; // primary role (most common for this assignee), blank role as ''
  total: number; // across all selected sprints
  completed: number;
  completionRate: number; // overall 0-100
  byMonth: AssigneeMonthStat[]; // month → sprint nested breakdown
}

/**
 * POST /api/individual-cr request
 */
export interface IndividualCRRequest {
  sprintIds?: string[]; // optional — any filter combination is allowed
  roles?: string[]; // optional, '' matches blank role
  assigneeNames?: string[]; // optional
  years?: string[]; // optional
  months?: string[]; // optional
}

/**
 * POST /api/individual-cr response
 */
export interface IndividualCRResponse {
  assigneeStats: AssigneeCompletionStat[];
  allRoles: string[]; // for filter dropdown, includes '' for "(Blank)"
  allAssignees: string[]; // for filter dropdown
  selectedSprintIds: string[]; // echoed back for column headers
  computedAt: string; // ISO timestamp
}
