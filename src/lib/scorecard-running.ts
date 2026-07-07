import { ScorecardResponse } from '@/types/scorecard';
import { SprintRow } from '@/types/sprint';
import { fetchSprintAsanaData } from './asana';
import { filterBySprints } from './completion-rate-engine';
import { computeRunningCompletion } from './scorecard-engine';

/**
 * Fetch the selected sprint's live Asana data and attach it to `scorecard`
 * (mutates it) — mirroring how the routes attach the Gemini narrative. This is
 * the one async, Asana-dependent step, kept out of the pure engine and shared by
 * both the compute and send-to-asana routes. It sets:
 *   - sprintUrl: the Asana project permalink (searched by sprint name), so the
 *     reports can link the sprint name.
 *   - the running / to-date completion (due-based) from each task's due date,
 *     which isn't in the sheet.
 *
 * Never throws: on an Asana failure it records runningCompletionError, leaves
 * runningCompletionRate null and sprintUrl null, so the rest still renders/sends.
 */
export async function attachAsanaContext(
  scorecard: ScorecardResponse,
  allRows: SprintRow[],
): Promise<void> {
  try {
    const { projectUrl, dueByLink } = await fetchSprintAsanaData(scorecard.sprintId);
    scorecard.sprintUrl = projectUrl;

    const sprintRows = filterBySprints(allRows, [scorecard.sprintId]);
    const running = computeRunningCompletion(sprintRows, dueByLink);
    scorecard.runningCompletionRate = running.runningCompletionRate;
    scorecard.tasksDue = running.tasksDue;
    scorecard.tasksDueCompleted = running.tasksDueCompleted;
    scorecard.tasksNoDueDate = running.tasksNoDueDate;
    // Empty map = project not found in Asana or it has no tasks. That's not a
    // thrown error, but it means the running rate can't be trusted — flag it.
    scorecard.runningCompletionError =
      dueByLink.size === 0
        ? "Couldn't read due dates from Asana for this sprint (project not found or no tasks)."
        : null;
  } catch (error) {
    scorecard.runningCompletionError = String(error)
      .replace('Error: ', '')
      .slice(0, 200);
  }
}
