/**
 * Canonical roster of current Dev team members.
 * Used to restrict the Assignee filter dropdowns to active devs only,
 * regardless of who else appears in the source sheet.
 *
 * Matching is case-insensitive (and trims surrounding whitespace),
 * so casing differences between this list and the sheet are tolerated.
 */
export const DEV_MEMBERS: readonly string[] = [
  'Krasimir Hristozov',
  'Alex Fadez',
  'Nikolay Zhidenko',
  'Gio Layugan',
  'JC Hsieh',
  'Jun Levi Caligtan',
  'Karim Matolo',
  'Marion Faye Alexis Quimbo',
  'Micah Marie Marcelo',
  'Shann Bryle Rubido',
  'Shierraine Lobederio',
];

const DEV_MEMBER_SET = new Set(DEV_MEMBERS.map((name) => name.trim().toLowerCase()));

export function isDevMember(name: string | null | undefined): boolean {
  if (!name) return false;
  return DEV_MEMBER_SET.has(name.trim().toLowerCase());
}

/**
 * Keep only the names that belong to current dev members.
 * Preserves the input casing (so values stay consistent with the source sheet).
 */
export function filterToDevMembers(names: string[]): string[] {
  return names.filter((name) => isDevMember(name));
}
