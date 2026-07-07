import { ScorecardResponse } from '@/types/scorecard';
import { SprintRow } from '@/types/sprint';
import { fetchSprintTaskDueDates } from './asana';
import { filterBySprints } from './completion-rate-engine';
import { computeRunningCompletion } from './scorecard-engine';

/**
 * Fetch the selected sprint's Asana due dates and attach the running / to-date
 * completion to `scorecard` (mutates it) — mirroring how the routes attach the
 * Gemini narrative. Due dates aren't in the sheet, so this is the one async,
 * Asana-dependent step; it's kept out of the pure engine and shared by both the
 * compute and send-to-asana routes.
 *
 * Never throws: on an Asana failure it records runningCompletionError and leaves
 * runningCompletionRate null, so the rest of the scorecard still renders/sends.
 */
export async function attachRunningCompletion(
  scorecard: ScorecardResponse,
  allRows: SprintRow[],
): Promise<void> {
  try {
    const dueByLink = await fetchSprintTaskDueDates(scorecard.sprintId);
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
