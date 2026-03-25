/**
 * Date utilities to handle two different CSV date formats:
 * - MM/DD/YYYY (sprint start/end dates, date assigned, date completed)
 * - M/D/YYYY (date completed for burndown — no leading zeros)
 *
 * All are normalized to YYYY-MM-DD for internal use.
 */

/**
 * Parse MM/DD/YYYY or M/D/YYYY format
 * Returns null if parsing fails
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr || dateStr === 'Not Completed') return null;

  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Match M/D/YYYY or MM/DD/YYYY
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  // Validate that the date is valid (JS will clamp invalid dates)
  if (date.getMonth() !== month - 1) return null;

  return date;
}

/**
 * Convert Date to YYYY-MM-DD string
 */
export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Date as human-readable "MMM DD" (e.g. "Mar 12")
 */
export function formatDisplayDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  return `${month} ${day}`;
}

/**
 * Days between two dates (inclusive, e.g. 3/12 to 3/25 = 14 days)
 */
export function daysBetween(start: Date, end: Date): number {
  const startTime = start.getTime();
  const endTime = end.getTime();
  const diffTime = Math.abs(endTime - startTime);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * Check if date1 <= date2 (for comparison)
 */
export function isDateBefore(date1: Date, date2: Date): boolean {
  return date1.getTime() <= date2.getTime();
}

/**
 * Check if date1 > date2
 */
export function isDateAfter(date1: Date, date2: Date): boolean {
  return date1.getTime() > date2.getTime();
}
