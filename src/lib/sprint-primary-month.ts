import { SprintRow } from '@/types/sprint';
import { parseDate } from './date-utils';

/**
 * Determine the primary (year, month) for a sprint — the calendar month that
 * contains the majority of the sprint's days. Used by the Sprint Completion
 * Rate page so a sprint that crosses a month boundary is counted under exactly
 * one month (the one with more days), instead of appearing under both.
 *
 * Tiebreaker: later month wins. With fixed 14-day sprints a true tie is
 * uncommon but possible; defaulting to the later month is consistent with how
 * teams typically refer to a cross-boundary sprint.
 */
function getSprintPrimaryYearMonth(
  sprintDateStart: string,
  sprintDateEnd: string
): { year: string; month: number } | null {
  const start = parseDate(sprintDateStart);
  const end = parseDate(sprintDateEnd);
  if (!start || !end || end < start) return null;

  type Bucket = { year: number; month: number; days: number };
  const counts = new Map<string, Bucket>();

  const cursor = new Date(start);
  while (cursor <= end) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const key = `${y}-${m}`;
    const existing = counts.get(key);
    if (existing) {
      existing.days += 1;
    } else {
      counts.set(key, { year: y, month: m, days: 1 });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  let best: Bucket | null = null;
  for (const b of counts.values()) {
    if (!best) {
      best = b;
      continue;
    }
    if (b.days > best.days) {
      best = b;
    } else if (b.days === best.days) {
      if (b.year > best.year || (b.year === best.year && b.month > best.month)) {
        best = b;
      }
    }
  }

  return best ? { year: String(best.year), month: best.month } : null;
}

/**
 * Filter rows so that a sprint is kept only when its primary (majority-days)
 * month and year fall within the selected filters. This is sprint-level
 * filtering — every row of a sprint is either fully kept or fully dropped.
 *
 * - `years` and `months` are treated as OR sets within each dimension and AND
 *   between them, matching the rest of the page's filter semantics.
 * - When both arrays are empty, rows are returned unchanged.
 * - Rows whose sprint has un-parseable dates are dropped while a filter is
 *   active (they could not be assigned to a month with confidence).
 */
export function filterBySprintPrimaryMonth(
  rows: SprintRow[],
  years: string[],
  months: string[]
): SprintRow[] {
  if (years.length === 0 && months.length === 0) return rows;

  const yearSet = new Set(years);
  const monthSet = new Set(months);

  const primaryBySprintId = new Map<string, { year: string; month: number } | null>();

  return rows.filter((row) => {
    if (!row.sprint) return false;

    if (!primaryBySprintId.has(row.sprint)) {
      primaryBySprintId.set(
        row.sprint,
        getSprintPrimaryYearMonth(row.sprintDateStart, row.sprintDateEnd)
      );
    }
    const primary = primaryBySprintId.get(row.sprint);
    if (!primary) return false;

    if (yearSet.size > 0 && !yearSet.has(primary.year)) return false;
    if (monthSet.size > 0 && !monthSet.has(String(primary.month))) return false;
    return true;
  });
}
