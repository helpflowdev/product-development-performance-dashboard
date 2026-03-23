/**
 * Raw row from Google Sheets Asana export (23 columns)
 * All fields are strings initially; conversion happens in burndown-engine.ts
 */
export interface SprintRow {
  sprint: string;                          // e.g. "Sprint #2025.Q1.S1 (0108-0121)"
  sprintDateStart: string;                 // MM/DD/YYYY
  sprintDateEnd: string;                   // MM/DD/YYYY
  tasksTitle: string;
  linkToTask: string;
  assigneeName: string;
  dateAssigned: string;                    // MM/DD/YYYY
  dateCompleted: string;                   // MM/DD/YYYY or "Not Completed"
  hoursEstimate: string;
  hoursActual: string;
  storyPoints: string;                     // may be blank
  status: string;                          // "Complete" | "Incomplete"
  tasksCounter: string;
  completionRateCounter: string;           // "1" | "0"
  week: string;
  month: string;
  year: string;
  team: string;
  helper: string;
  recurringTask: string;                   // "(WT)" | "(DT)" | blank
  role: string;                            // "Developer" | "QA Tester" | "Product Specialist" etc.
  dateCompletedForBurndown: string;        // M/D/YYYY — PRIMARY date used for burndown
  carriedOver: string;
}

/**
 * Metadata about a single sprint
 */
export interface SprintMeta {
  id: string;                              // full sprint string e.g. "Sprint #2025.Q1.S1 (0108-0121)"
  startDate: string;                       // YYYY-MM-DD (normalized)
  endDate: string;                         // YYYY-MM-DD (normalized)
}

/**
 * Unique sprint list (for dropdown)
 */
export interface SprintListResponse {
  sprints: SprintMeta[];
}
