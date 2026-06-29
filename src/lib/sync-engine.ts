import {
  findAsanaProject,
  findProjectInWorkspace,
  assignProjectToTeam,
  getProjectDetails,
  fetchProjectTasks,
  fetchTaskAddedToProjectDate,
  formatDateOnly,
} from '@/lib/asana';
import {
  fetchSheetRowsForSync,
  batchUpdateColumnX,
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
 * Main sync orchestrator. Replace-per-sprint strategy: snapshot the sprint's
 * existing rows, wipe the whole section, and re-add it fresh from Asana. This
 * avoids the fragile per-task matching (by task-URL + sprint name) that drifted
 * — and silently duplicated rows — whenever a sprint was renamed or a task link
 * changed.
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
    datesFilled: 0,
    durationMs: 0,
  };

  try {
    // 1. Find sprint in Asana (team-scoped first).
    log('Searching for sprint in Asana...');
    let project = await findAsanaProject(sprintName, log);

    // Self-healing fallback: a freshly-created sprint may not belong to the
    // (dept) Development team yet, so the team-scoped lookup above can't see it.
    // Search the whole workspace and, if found, add it to the team — this fixes
    // detection both for this sync and for all future dropdown/manual loads.
    if (!project) {
      const teamId = process.env.ASANA_TEAM_ID;
      log('Not in the Development team. Searching the whole workspace...');
      const wsProject = await findProjectInWorkspace(sprintName, log);

      if (wsProject) {
        if (teamId) {
          log(`Adding "${wsProject.name}" to the (dept) Development team...`);
          await assignProjectToTeam(wsProject.gid, teamId);
          log('Added to team.');
        }
        project = wsProject;
      }
    }

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

    // 5. Snapshot the sprint's existing rows before we touch anything: where the
    //    section lives, each task's already-resolved "Date Added to Sprint"
    //    (col X) keyed by task URL, and which task URLs were present before. We
    //    then wipe the whole section and re-add it from Asana so the sheet always
    //    mirrors Asana exactly — no fragile per-task matching that drifts when a
    //    sprint is renamed or a task link changes.
    log('Processing tasks...');
    const COL_X = 23; // 0-based index of column X
    const existingRowNumbers: number[] = [];
    const preservedX: Record<string, string> = {}; // task URL -> existing col X
    const oldUrls = new Set<string>();
    let firstRow = 0; // 1-based position of the sprint's first row

    for (let i = 1; i < sheetRows.length; i++) {
      const row = sheetRows[i];
      if (row[0] !== projectInfo.title) continue; // col A = Sprint
      if (firstRow === 0) firstRow = i + 1;
      existingRowNumbers.push(i + 1); // 1-based row number
      const url = row[4]; // col E = Link to Task
      if (url) {
        oldUrls.add(url);
        const x = (row[COL_X] ?? '').trim();
        if (x) preservedX[url] = x;
      }
    }

    // 6. Build a fresh row for every current Asana task, in Asana's order.
    const newRows = tasks.map((task) =>
      prepareTaskRow(
        task,
        projectInfo.title,
        projectInfo.startDate,
        projectInfo.endDate,
      ),
    );

    // Report the real net change for the summary, even though we physically
    // replace every row: a task already on the sheet counts as "updated", one
    // new to the sheet as "inserted", and a sheet task no longer in Asana as
    // "deleted".
    const newUrls = new Set(tasks.map((t) => t.permalink_url));
    result.tasksUpdated = [...newUrls].filter((u) => oldUrls.has(u)).length;
    result.tasksInserted = [...newUrls].filter((u) => !oldUrls.has(u)).length;
    result.tasksDeleted = [...oldUrls].filter((u) => !newUrls.has(u)).length;

    // 7. Wipe the sprint's existing rows. The helper deletes bottom-to-top so the
    //    row numbers stay valid as it goes.
    if (existingRowNumbers.length > 0) {
      log(`Clearing ${existingRowNumbers.length} existing row(s)...`);
      await deleteSheetRows(existingRowNumbers);
    }

    // 8. Re-add every current task. Insert back at the section's old position so
    //    sprint ordering on the sheet is preserved; append if the sprint is new.
    //    Columns M–W are ARRAYFORMULA-driven and refill themselves; only column X
    //    needs restoring (step 9).
    if (newRows.length > 0) {
      log(`Writing ${newRows.length} task(s)...`);
      if (firstRow > 0) {
        // firstRow is the min matching row, so rows above it never shifted during
        // the delete — inserting after (firstRow - 1) drops the block back in place.
        await insertSheetRows(firstRow - 1, newRows);
      } else {
        await appendSheetRows(newRows);
      }
    }

    // 9. Restore/backfill "Date Added to Sprint" (column X). Because we wiped the
    //    section, first write back the values we snapshotted (preservedX) for
    //    tasks that were already on the sheet — instant, no API calls — then look
    //    up only the genuinely new tasks from Asana's activity log. Best-effort:
    //    failures here never fail the overall sync, and writes are flushed in
    //    chunks so an interrupted run resumes next time.
    try {
      const freshRows = await fetchSheetRowsForSync(); // A:X
      const urlToGid = new Map(tasks.map((t) => [t.permalink_url, t.gid]));

      const restores: Array<{ rowNumber: number; value: string }> = [];
      const lookups: Array<{ rowNumber: number; gid: string }> = [];
      for (let i = 1; i < freshRows.length; i++) {
        const row = freshRows[i];
        if (row[0] !== projectInfo.title) continue; // only this sprint
        if ((row[COL_X] ?? '').trim()) continue; // already filled
        const url = row[4]; // col E = Link to Task
        const preserved = preservedX[url];
        if (preserved) {
          restores.push({ rowNumber: i + 1, value: preserved });
        } else {
          const gid = urlToGid.get(url);
          if (gid) lookups.push({ rowNumber: i + 1, gid });
        }
      }

      if (restores.length > 0) {
        log(`Restoring "Date Added to Sprint" for ${restores.length} task(s)...`);
        await batchUpdateColumnX(restores);
        result.datesFilled += restores.length;
      }

      if (lookups.length > 0) {
        log(`Resolving "Date Added to Sprint" for ${lookups.length} task(s)...`);
        // The serverless route caps at 60s. Stop well before that — flushing
        // each batch as we go — so a large first backfill ends cleanly and
        // simply resumes on the next Sync (already-filled rows are skipped).
        const TIME_BUDGET_MS = 48_000;
        const CONCURRENCY = 5; // parallel activity-log lookups; stays under Asana's rate limit
        let done = 0;
        let filled = 0; // X values written from activity-log lookups this phase
        let noEvent = 0; // call succeeded but the task has no matching add-event
        let errors = 0; // the lookup call failed (auth/scope/rate-limit)
        let lastError = '';
        let budgetReached = false;
        let batchIdx = 0;

        for (let start = 0; start < lookups.length; start += CONCURRENCY) {
          if (Date.now() - startTime > TIME_BUDGET_MS) {
            budgetReached = true;
            break;
          }
          const batch = lookups.slice(start, start + CONCURRENCY);
          const results = await Promise.all(
            batch.map((b) => fetchTaskAddedToProjectDate(b.gid, projectInfo.title)),
          );
          const writes: Array<{ rowNumber: number; value: string }> = [];
          batch.forEach((b, idx) => {
            const r = results[idx];
            if (r.date) writes.push({ rowNumber: b.rowNumber, value: r.date });
            else if (r.error) {
              errors++;
              lastError = r.error;
            } else noEvent++;
          });
          if (writes.length > 0) {
            await batchUpdateColumnX(writes);
            result.datesFilled += writes.length;
            filled += writes.length;
          }
          done += batch.length;
          if (++batchIdx % 5 === 0) log(`  ...resolved ${done}/${lookups.length}`);
          await new Promise((r) => setTimeout(r, 50)); // smooth out the request rate
        }

        // Report a breakdown so a 0-fill run reveals *why* (no events vs. failures).
        const left = lookups.length - done;
        const parts = [`Filled ${filled}`];
        if (noEvent > 0) parts.push(`${noEvent} had no add-event`);
        if (errors > 0) {
          parts.push(`${errors} lookup error(s)${lastError ? ` (last: ${lastError})` : ''}`);
        }
        if (budgetReached && left > 0) parts.push(`${left} left — run Sync again to finish`);
        log(parts.join('; ') + '.');
      }
    } catch (err) {
      // Non-fatal: the A–L sync already succeeded; X backfill resumes next run.
      log(`Warning: could not backfill "Date Added to Sprint": ${String(err)}`);
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
