import { escapeHtml } from './asana';
import { REPORT_CC_MENTIONS_HTML } from './report-recipients';

/**
 * Shared shaping for the two sprint report comments (Weekly Scorecard and
 * Per-Sprint Summary). Both build their body as a list of plain lines and then
 * render it twice: as plain text, and as the Asana rich text actually posted.
 *
 * The rich-text rendering exists for one reason — the trailing `cc:` line. Asana
 * only notifies a person for a real mention element, and mention elements are
 * only honoured inside an `html_text` body, so a plain-text cc names people
 * without pinging any of them.
 */

/**
 * Join body lines, padding heading lines (those ending in ':') with a blank line
 * either side. The reports' long-standing layout — kept identical between the
 * plain-text and rich-text renderings so switching to HTML changed nothing an
 * operator can see.
 */
export function joinReportLines(lines: string[]): string {
  return lines
    .map((line) => (line.endsWith(':') ? `\n${line}\n` : line))
    .join('\n');
}

/**
 * Render body lines as an Asana `html_text` body with the standing cc list
 * appended as real @mentions.
 *
 * Three deliberate choices, each load-bearing:
 *   - Lines are separated by RAW NEWLINES, never `<br/>`. A `<br/>` trips
 *     Asana's story parser into storing the entire body as literal text — the
 *     tags render visibly AND the mentions stop notifying, with a 200 response
 *     either way. (Same reason `<p>` is avoided.)
 *   - Every content line is HTML-escaped, so an `&` or `<` typed into a note or
 *     produced by the AI narrative can't corrupt the body.
 *   - Bare URLs are wrapped in anchors: Asana auto-links a raw URL in the plain
 *     `text` field but not in `html_text`, so without this the sprint link would
 *     quietly stop being clickable.
 *
 * The cc line is appended AFTER escaping — those elements are markup, not text.
 */
export function buildReportCommentHtml(lines: string[]): string {
  const body = joinReportLines(
    lines.map((line) =>
      escapeHtml(line).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>'),
    ),
  );
  return `<body>${body}\ncc: ${REPORT_CC_MENTIONS_HTML}</body>`;
}
