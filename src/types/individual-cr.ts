/**
 * Per-sprint stats for an assignee
 */
export interface AssigneeSprintStat {
  sprintId: string;
  total: number;
  completed: number;
  completionRate: number; // 0-100
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
  bySprint: AssigneeSprintStat[]; // per-sprint breakdown (empty if only 1 sprint selected)
}

/**
 * POST /api/individual-cr request
 */
export interface IndividualCRRequest {
  sprintIds: string[]; // required — at least one sprint
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
