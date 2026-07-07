/**
 * Standing "cc" list for the sprint reports.
 *
 * These people are added as Asana FOLLOWERS on both the Weekly Scorecard and the
 * Per-Sprint Summary subtasks — followers are Asana's equivalent of cc: they're
 * notified and can watch the task. Their names are also rendered as a trailing
 * `cc:` line in each report comment for at-a-glance visibility.
 *
 * gids were resolved from Asana (workspace 76943629462172); update here if the
 * stakeholder list changes.
 */

export interface ReportRecipient {
  name: string; // display name for the cc: line
  gid: string; // Asana user gid (follower)
}

export const REPORT_CC: readonly ReportRecipient[] = [
  { name: 'Shann Bryle', gid: '1166606777056089' },
  { name: 'JC Hsieh', gid: '296119491079818' },
  { name: 'Karim Matolo', gid: '1207437999841390' },
  { name: 'Gio Layugan', gid: '1201613513907942' },
  { name: 'Marion Quimbo', gid: '1201456098827504' },
];

/** Follower gids, for the createAsanaSubtask `followers` option. */
export const REPORT_CC_GIDS: string[] = REPORT_CC.map((r) => r.gid);

/** Comma-separated display names, for the `cc:` line in report bodies. */
export const REPORT_CC_NAMES: string = REPORT_CC.map((r) => r.name).join(', ');
