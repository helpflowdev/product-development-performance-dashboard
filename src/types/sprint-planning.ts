import { PlanningRole } from '@/lib/sprint-planning-roster';

/**
 * Hours & story-point stats for a single roster member within the selected sprint.
 * - assignedHours:       Σ Hours Estimate over all the member's tasks (the plan)
 * - completedHours:      Σ Hours Actual over tasks with status === 'Complete'
 * - remainingHours:      assignedHours − completedHours
 * - assignedStoryPoints: Σ Story Points over all the member's tasks (committed)
 * - actualStoryPoints:   Σ Story Points over tasks with status === 'Complete' (delivered)
 *
 * The editable "budgeted hours" lives client-side (localStorage), not here.
 */
export interface SprintPlanningMemberStat {
  assigneeName: string; // canonical roster name
  role: PlanningRole;
  taskCount: number;
  assignedHours: number;
  completedHours: number;
  remainingHours: number;
  assignedStoryPoints: number;
  actualStoryPoints: number;
}

/** POST /api/sprint-planning request */
export interface SprintPlanningRequest {
  sprintId: string;
}

/** POST /api/sprint-planning response */
export interface SprintPlanningResponse {
  sprintId: string;
  members: SprintPlanningMemberStat[]; // only roster members with ≥1 task, role-grouped order
  computedAt: string; // ISO timestamp
}
