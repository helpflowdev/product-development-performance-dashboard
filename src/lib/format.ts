/**
 * Show an hours value as-is — no rounding up. Trims to at most 2 decimals and
 * drops trailing zeros (and floating-point noise from summing).
 * e.g. 71.2 -> "71.2", 71 -> "71", 71.25 -> "71.25", 71.200001 -> "71.2".
 */
export function formatHours(n: number): string {
  return Number(n.toFixed(2)).toString();
}
