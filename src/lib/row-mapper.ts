import { SprintRow } from '@/types/sprint';

/**
 * Maps raw Google Sheets rows (string[][]) to typed SprintRow[]
 * Uses column names (from header row) instead of indices for resilience
 */

/**
 * Build a map of column name → column index from the header row
 */
function buildColumnMap(headerRow: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headerRow.forEach((colName, idx) => {
    map[colName.trim()] = idx;
  });
  return map;
}

/**
 * Get cell value safely, returning empty string if out of bounds
 */
function getCellValue(row: string[], colIndex: number): string {
  return colIndex >= 0 && colIndex < row.length ? row[colIndex] : '';
}

/**
 * Convert raw sheet rows to SprintRow array
 */
export function mapRowsToSprintRows(rawRows: string[][]): SprintRow[] {
  if (rawRows.length === 0) {
    throw new Error('No rows in sheet');
  }

  const headerRow = rawRows[0];
  const colMap = buildColumnMap(headerRow);

  // Validate that critical columns exist
  const requiredCols = [
    'Sprint',
    'Sprint Date Start',
    'Sprint Date End',
    'Tasks Title',
    'Link to Task',
    'Assignee Name',
    'Date Assigned',
    'Date Completed',
    'Hours Estimate',
    'Hours Actual',
    'Story Points',
    'Status (Incomplete or Complete)',
    'Tasks Counter',
    'Completion Rate Counter',
    'Week',
    'Month',
    'Year',
    'Team',
    'Helper',
    'Recurring Task',
    'Role',
    'Date Completed for Burndown',
    'Carried Over',
  ];

  for (const col of requiredCols) {
    if (!(col in colMap)) {
      throw new Error(`Missing required column: "${col}"`);
    }
  }

  // Map data rows
  const sprintRows: SprintRow[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];

    // Skip empty rows
    if (!row || row.length === 0 || !row[0]) {
      continue;
    }

    // Skip non-standard sprints (e.g. "Augment Launch > Sprint #...")
    const sprintValue = getCellValue(row, colMap['Sprint']);
    if (sprintValue.includes('Augment Launch >')) {
      continue;
    }

    sprintRows.push({
      sprint: getCellValue(row, colMap['Sprint']),
      sprintDateStart: getCellValue(row, colMap['Sprint Date Start']),
      sprintDateEnd: getCellValue(row, colMap['Sprint Date End']),
      tasksTitle: getCellValue(row, colMap['Tasks Title']),
      linkToTask: getCellValue(row, colMap['Link to Task']),
      assigneeName: getCellValue(row, colMap['Assignee Name']),
      dateAssigned: getCellValue(row, colMap['Date Assigned']),
      dateCompleted: getCellValue(row, colMap['Date Completed']),
      hoursEstimate: getCellValue(row, colMap['Hours Estimate']),
      hoursActual: getCellValue(row, colMap['Hours Actual']),
      storyPoints: getCellValue(row, colMap['Story Points']),
      status: getCellValue(row, colMap['Status (Incomplete or Complete)']),
      tasksCounter: getCellValue(row, colMap['Tasks Counter']),
      completionRateCounter: getCellValue(row, colMap['Completion Rate Counter']),
      week: getCellValue(row, colMap['Week']),
      month: getCellValue(row, colMap['Month']),
      year: getCellValue(row, colMap['Year']),
      team: getCellValue(row, colMap['Team']),
      helper: getCellValue(row, colMap['Helper']),
      recurringTask: getCellValue(row, colMap['Recurring Task']),
      role: getCellValue(row, colMap['Role']),
      dateCompletedForBurndown: getCellValue(row, colMap['Date Completed for Burndown']),
      carriedOver: getCellValue(row, colMap['Carried Over']),
    });
  }

  return sprintRows;
}
