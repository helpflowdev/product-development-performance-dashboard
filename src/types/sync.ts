/**
 * Request body for POST /api/sync-sprint
 */
export interface SyncRequest {
  sprintName: string;
}

/**
 * Final result returned after sync completes
 */
export interface SyncResult {
  success: boolean;
  sprintName: string;
  tasksUpdated: number;
  tasksInserted: number;
  tasksDeleted: number;
  totalTasks: number;
  error?: string;
  durationMs: number;
}

/**
 * SSE progress event sent during sync
 */
export interface SyncProgressEvent {
  stage:
    | 'searching'
    | 'fetching_details'
    | 'fetching_tasks'
    | 'reading_sheet'
    | 'processing'
    | 'updating'
    | 'inserting'
    | 'deleting'
    | 'cache'
    | 'done'
    | 'error';
  message: string;
}

/**
 * Asana project as returned by the workspace projects API
 */
export interface AsanaProject {
  gid: string;
  name: string;
}

/**
 * Parsed project info with sprint dates
 */
export interface ProjectInfo {
  gid: string;
  title: string;
  startDate: string; // MM/DD/YYYY
  endDate: string; // MM/DD/YYYY
}

/**
 * Asana task with relevant fields
 */
export interface AsanaTask {
  gid: string;
  name: string;
  permalink_url: string;
  assignee: { name: string } | null;
  created_at: string;
  completed_at: string | null;
  completed: boolean;
  custom_fields: Array<{
    name: string;
    number_value: number | null;
    text_value: string | null;
  }>;
}
