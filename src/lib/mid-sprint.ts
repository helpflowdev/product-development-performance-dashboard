import { SprintRow } from '@/types/sprint';

/**
 * Mid-sprint additions.
 *
 * Under the Security Issue process, a task added AFTER its sprint has started is
 * tagged by ending its title with "(mid sprint)". It's real work and stays visible
 * in the reports (listed in its own section), but it wasn't part of the sprint
 * plan, so it is left out of everything that measures the team against that plan:
 *   - the completion rate (this sprint, running/to-date, devs/team, QTD)
 *   - the plotted / completed / carried-over / incomplete counts
 *   - the per-assignee completed-vs-plotted rates
 * Hours and story points still include these tasks — the effort was spent.
 *
 * SCOPE — only the sprints listed in MID_SPRINT_EXCLUSION_SPRINTS. The rule was
 * agreed for Sprint #2026.Q4.S2 only; whether it carries on to later sprints
 * hasn't been decided, so in every other sprint a "(mid sprint)" task counts like
 * any other. To extend it, add the sprint's exact name (the sheet's Sprint column)
 * to the list.
 *
 * The check is per ROW (the row's own sprint), not per report. So S2's tagged
 * tasks stay out of the Q4 QTD on later sprints' reports too — S2 contributes the
 * same numbers to QTD as its own report showed — while those later sprints' own
 * tagged tasks still count.
 *
 * Only the Sprint Summary and the Weekly Scorecard apply this; the Completion
 * Rate, Individual CR and Burndown pages count every task as before.
 *
 * Matched on the END of the title, case-insensitively, and tolerant of a hyphen
 * or extra spaces ("(Mid-Sprint)", "( mid sprint )"), so a small typo in the tag
 * doesn't quietly put a task back into the rate. "(mid sprint)" anywhere else in
 * a title does not count — the process puts it at the end.
 */
export const MID_SPRINT_EXCLUSION_SPRINTS: ReadonlySet<string> = new Set([
  'Sprint #2026.Q4.S2 (1022-1104)',
]);

const MID_SPRINT_SUFFIX = /\(\s*mid[\s-]*sprint\s*\)\s*$/i;

/**
 * True when the row belongs to a sprint the rule covers AND its task title ends
 * with the "(mid sprint)" tag.
 */
export function isMidSprintAddition(row: SprintRow): boolean {
  return (
    MID_SPRINT_EXCLUSION_SPRINTS.has(row.sprint.trim()) &&
    MID_SPRINT_SUFFIX.test(row.tasksTitle)
  );
}

/** The rows that count toward completion — every row that isn't a mid-sprint addition. */
export function excludeMidSprintAdditions(rows: SprintRow[]): SprintRow[] {
  return rows.filter((row) => !isMidSprintAddition(row));
}
