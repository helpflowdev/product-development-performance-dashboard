/**
 * Standing "cc" list for the sprint reports.
 *
 * These people are added as Asana FOLLOWERS on both the Weekly Scorecard and the
 * Per-Sprint Summary subtasks — followers are Asana's equivalent of cc: they're
 * notified and can watch the task. They are also named on a trailing `cc:` line
 * in each report comment — as real @mentions where the comment is posted as
 * rich text (see REPORT_CC_MENTIONS_HTML), so the cc actually notifies them
 * rather than just printing their names.
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

/** Comma-separated display names, for the `cc:` line in PLAIN-TEXT report bodies. */
export const REPORT_CC_NAMES: string = REPORT_CC.map((r) => r.name).join(', ');

/**
 * The same cc list as Asana @mentions, for the `cc:` line in `html_text` report
 * bodies. `<a data-asana-gid="GID"/>` is Asana's mention element: self-closing,
 * valid only inside a `<body>`-wrapped html_text payload. On render Asana swaps
 * it for the user's display name AND fires them an inbox notification — which a
 * plain-text name never does.
 *
 * Must NOT be HTML-escaped by the caller (it is markup, not text).
 */
export const REPORT_CC_MENTIONS_HTML: string = REPORT_CC.map(
  (r) => `<a data-asana-gid="${r.gid}"/>`,
).join(', ');
