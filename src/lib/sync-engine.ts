import {
  findAsanaProject,
  getProjectDetails,
  fetchProjectTasks,
  formatDateOnly,
} from '@/lib/asana';
import {
  fetchSheetRowsForSync,
  batchUpdateSheetRows,
  insertSheetRows,
  appendSheetRows,
  deleteSheetRows,
  invalidateSheetCache,
} from '@/lib/sheets';
import { AsanaTask, SyncResult } from '@/types/sync';

type LogFn = (message: string) => void;

/**
 * Prepare a task row for writing to columns A-L.
 * Ports GAS prepareTaskRow() (lines 160-179).
 *
 * Values are written positionally to match the actual sheet headers:
 * A: Sprint, B: Sprint Date Start, C: Sprint Date End, D: Tasks Title,
 * E: Link to Task, F: Assignee Name, G: Date Assigned, H: Date Completed,
 * I: Hours Estimate, J: Hours Actual, K: Story Points,
 * L: Status (Incomplete or Complete)
 */
function prepareTaskRow(
  task: AsanaTask,
  projectTitle: string,
  sprintStart: string,
  sprintEnd: string,
): string[] {
  const customFields: Record<string, string> = {};
  for (const field of task.custom_fields) {
    customFields[field.name] =
      field.number_value?.toString() ?? field.text_value ?? '';
  }

  const status = task.completed ? 'Complete' : 'Incomplete';

  return [
    projectTitle,
    sprintStart,
    sprintEnd,
    task.name,
    task.permalink_url,
    task.assignee ? task.assignee.name : 'Unassigned',
    formatDateOnly(task.created_at),
    task.completed_at ? formatDateOnly(task.completed_at) : 'Not Completed',
    customFields['Hrs Estimated'] || '',
    customFields['Hrs Actual'] || '',
    customFields['Story Points'] || '',
    status,
  ];
}

/**
 * Find the first row number (1-based) where a sprint section starts.
 * Ports GAS findSectionStartRow() (lines 272-278).
 */
function findSectionStartRow(rows: string[][], projectTitle: string): number {
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === projectTitle) return i + 1; // 1-based row number
  }
  return rows.length + 1; // append at end
}

/**
 * Find the last row number (1-based) of a sprint section.
 * Ports GAS findSectionEndRow() (lines 280-286).
 */
function findSectionEndRow(
  rows: string[][],
  sectionStartRow: number,
  projectTitle: string,
): number | null {
  // sectionStartRow is 1-based; convert to 0-based index
  const startIdx = sectionStartRow - 1;
  for (let i = startIdx; i < rows.length; i++) {
    if (i >= rows.length - 1 || rows[i][0] !== projectTitle) {
      return i + 1; // 1-based
    }
  }
  return rows.length; // 1-based last row
}

/**
 * Main sync orchestrator. Ports the full GAS flow:
 * updateSpecificSprint() + updateTasksForProject() + deleteRemovedTasks()
 */
export async function syncSprintData(
  sprintName: string,
  log: LogFn = console.log,
): Promise<SyncResult> {
  const startTime = Date.now();

  const result: SyncResult = {
    success: false,
    sprintName,
    tasksUpdated: 0,
    tasksInserted: 0,
    tasksDeleted: 0,
    totalTasks: 0,
    durationMs: 0,
  };

  try {
    // 1. Find sprint in Asana
    log('Searching for sprint in Asana...');
    const project = await findAsanaProject(sprintName, log);

    if (!project) {
      result.error = `Sprint "${sprintName}" not found in Asana`;
      log(`Error: ${result.error}`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // 2. Get project details and parse dates
    log(`Found: ${project.name}`);
    log('Fetching project details...');
    const projectInfo = await getProjectDetails(project.gid);

    if (!projectInfo) {
      result.error = 'Failed to get project details from Asana';
      log(`Error: ${result.error}`);
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // 3. Fetch all tasks
    const tasks = await fetchProjectTasks(project.gid, log);
    result.totalTasks = tasks.length;
    log(`Found ${tasks.length} tasks`);

    // 4. Read current sheet data
    log('Reading current sheet data...');
    const sheetRows = await fetchSheetRowsForSync();

    // 5. Build URL|SprintName lookup map (ports GAS lines 90-97)
    log('Processing tasks...');
    const urlProjectMap: Record<string, number> = {};
    for (let i = 1; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      if (row[4] && row[0]) {
        // Link to Task (col E) and Sprint (col A)
        const key = `${row[4]}|${row[0]}`;
        urlProjectMap[key] = i + 1; // 1-based row number
      }
    }

    // 6. Categorize tasks: update vs insert
    const rowsToUpdate: Array<{ rowNumber: number; values: string[] }> = [];
    const newRows: string[][] = [];
    const updatedRowNumbers = new Set<number>();

    for (const task of tasks) {
      const rowValues = prepareTaskRow(
        task,
        projectInfo.title,
        projectInfo.startDate,
        projectInfo.endDate,
      );
      const key = `${task.permalink_url}|${projectInfo.title}`;
      const existingRowNumber = urlProjectMap[key];

      if (existingRowNumber) {
        rowsToUpdate.push({ rowNumber: existingRowNumber, values: rowValues });
        updatedRowNumbers.add(existingRowNumber);
      } else {
        newRows.push(rowValues);
      }
    }

    // 7. Batch update existing rows
    if (rowsToUpdate.length > 0) {
      log(`Updating ${rowsToUpdate.length} existing tasks...`);
      await batchUpdateSheetRows(rowsToUpdate);
      result.tasksUpdated = rowsToUpdate.length;
    }

    // 8. Insert new rows
    if (newRows.length > 0) {
      log(`Inserting ${newRows.length} new tasks...`);
      const sectionStart = findSectionStartRow(sheetRows, projectInfo.title);
      const sectionEnd = findSectionEndRow(
        sheetRows,
        sectionStart,
        projectInfo.title,
      );

      if (sectionEnd && sectionStart <= sheetRows.length && sectionEnd < sheetRows.length) {
        await insertSheetRows(sectionEnd, newRows);
      } else {
        await appendSheetRows(newRows);
      }
      result.tasksInserted = newRows.length;
    }

    // 9. Delete tasks removed from Asana (ports GAS lines 257-270)
    const taskUrls = new Set(tasks.map((t) => t.permalink_url));
    const rowsToDelete: number[] = [];

    for (let i = sheetRows.length - 1; i >= 1; i--) {
      const row = sheetRows[i];
      const actualRowNumber = i + 1;

      if (
        row[0] === projectInfo.title &&
        !taskUrls.has(row[4]) &&
        !updatedRowNumbers.has(actualRowNumber)
      ) {
        rowsToDelete.push(actualRowNumber);
      }
    }

    if (rowsToDelete.length > 0) {
      log(`Removing ${rowsToDelete.length} deleted tasks...`);
      await deleteSheetRows(rowsToDelete);
      result.tasksDeleted = rowsToDelete.length;
    }

    // 10. Invalidate cache
    log('Invalidating dashboard cache...');
    invalidateSheetCache();

    result.success = true;
    result.durationMs = Date.now() - startTime;
    log('Sync complete!');

    return result;
  } catch (error) {
    result.error = String(error);
    result.durationMs = Date.now() - startTime;
    log(`Error: ${result.error}`);
    return result;
  }
}
